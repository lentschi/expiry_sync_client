import { Injectable, Inject } from '@angular/core';
import { Device } from '@ionic-native/device/ngx';
import * as oldPersistenceMigrations from '../config/migrations';
import { Setting } from 'src/app/models';
import { AppModel } from './orm';
import { IndexedMigration } from 'src/config/indexed-migrations/indexed-migration';
import { ExportData, implementsExportData, ExportDataRow } from 'src/app/non-persisted-models/export-data';
import { ExpirySync } from 'src/app/app.expiry-sync';

// https://x-team.com/blog/include-javascript-libraries-in-an-ionic-2-typescript-project/
// https://ionicframework.com/docs/v2/resources/app-scripts/
declare var persistence: any;

declare var window: any;
declare var openDatabase: any;

@Injectable()
export class DbManager {
  readonly DATABASE_NAME = 'ExpirySync';

  private rawDb: any;

  constructor(private device: Device, @Inject(IndexedMigration) private indexedMigrations: IndexedMigration[]) { }

  public async initialize(preventSqlite: boolean): Promise<void> {
    if (window.sqlitePlugin || typeof openDatabase !== 'undefined') {
      this.configureOldSqlDb(preventSqlite);
      if (await this.sqlSucceeds('SELECT * FROM article')) {
        // We still found some WebSQL data
        // -> run all remaining WebSQL migrations and then move the
        // data to indexedDb:

        // Run first indexeddb migration (compatible with last sql schema):
        await this.migrateIndexedDb(0, 1);

        await this.migrateFromV0_7();
        this.loadOldPersistenceMigrations();
        await this.runOldPersistenceMigrations();
        await this.moveWebsqlToIndexedDb();

        // Run the rest of the indexeddb migrations:
        await this.migrateIndexedDb(1);
        return;
      }
    }

    await this.migrateIndexedDb();
  }

  private get targetSchemaVersion(): number {
    return this.indexedMigrations.length;
  }

  async moveWebsqlToIndexedDb() {
    // TODO: Fix the tables that must be moved to object stores -
    // otherwise models that are later added will cause trouble:
    for (const modelClass of Object.values(AppModel.modelRegistry)) {
      const result = await this.executeSql(`SELECT * FROM ${modelClass.tableName}`);
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i] || result.rows.item(i);
        const model = new modelClass();
        for (const propertyName of Object.keys(row)) {
          let value = row[propertyName];
          const foreignKeyMatch = propertyName.match(/(.*)Id$/);

          if ((propertyName === 'id' || foreignKeyMatch)) {
            if (typeof value === 'string') {
              const tableName = foreignKeyMatch
                ? foreignKeyMatch[1].charAt(0).toUpperCase()
                  + foreignKeyMatch[1].slice(1)
                : modelClass.tableName;
              value = value.replace(new RegExp(`^${tableName}-`), '');
            } else if (typeof value === 'number') {
              value = String(value);
            }
          } else if (modelClass.typeMap[propertyName] === 'DATE' && value && typeof value === 'number') {
            value = new Date(value * 1000);
          }

          model[propertyName] = value;
        }
        await model.save();
      }
    }

    for (const modelClass of Object.values(AppModel.modelRegistry)) {
      await this.executeSql(`DROP TABLE ${modelClass.tableName}`);
    }

    await this.executeSql(`DROP TABLE schema_version`);
  }


  async executeSql(sql: string, params?: Array<any>): Promise<any> {
    console.log('Executing migration SQL: ' + sql);
    return new Promise<any>((resolve, reject) => {
      this.getRawDb().transaction(function (tx) {
        tx.executeSql(sql, params, function (_currentTx, rs) {
          resolve(rs);
        }, function (_currentTx, error) {
          reject(error);
          return false;
        });
      }, function (e) {
        reject(e);
      });
    });
  }

  async sqlSucceeds(sql: string, params?: Array<any>): Promise<boolean> {
    try {
      await this.executeSql(sql, params);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Run indexedDb migrations
   * @returns version that we migrated from or null if no migration was required
   */
  async migrateIndexedDb(fromVersion?: number, toVersion = this.targetSchemaVersion): Promise<number> {
    let upgradeNeeded = false;
    let db: IDBDatabase;

    if (AppModel.db) {
      AppModel.db.close();
      AppModel.db = null;
    }

    const upgradedFrom = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open(this.DATABASE_NAME, toVersion);
      request.onerror = error => reject(error);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        fromVersion = typeof fromVersion === 'undefined' ? event.oldVersion : fromVersion;
        upgradeNeeded = true;
        db = (<IDBOpenDBRequest> event.target).result;
        let transaction: IDBTransaction;
        console.log(`DB: Migration from version ${fromVersion} to ${toVersion} required`);
        for (const migration of this.indexedMigrations.slice(fromVersion, toVersion)) {
          transaction = migration.migrate(<IDBOpenDBRequest> event.target);
        }

        transaction.oncomplete = () => resolve(fromVersion);
        transaction.onerror = e => reject(e);
      };


      request.onsuccess = (event) => {
        if (!upgradeNeeded) {
          console.log('DB: No migration needed');
          db = (<IDBRequest> event.target).result;
          resolve(null);
        }
      };

    });

    console.log('DB: Done migrating', upgradedFrom);
    AppModel.db = db;

    return upgradedFrom;
  }

  private async migrateFromV0_7() {
    if (this.device.platform !== 'Android') {
      return; // v0.7 only existed for Android
    }

    console.log('Migrating from v0.7...');
    if (await this.sqlSucceeds('SELECT * FROM schema_version')) {
      console.log('Already migrated from v0.7');
      return;
    }

    // Fake a schema_version of 1:
    await this.executeSql('CREATE TABLE schema_version (current_version INTEGER)');
    await this.executeSql('INSERT INTO schema_version (current_version) VALUES (?)', [1]);
    console.log('Done with v0.7 upgrade');
    Setting.v07UpgradeRequired = true;
  }

  private getRawDb() {
    if (this.rawDb) {
      return this.rawDb;
    }

    if (window.sqlitePlugin) {
      this.rawDb = window.sqlitePlugin.openDatabase({ name: 'ExpirySync.sqlite', location: 'default' });
    } else {
      this.rawDb = openDatabase('ExpirySync.sqlite', '0.7', 'ExpirySync client db', 5 * 1024 * 1024);
    }

    return this.rawDb;
  }

  private configureOldSqlDb(preventSqlite: boolean) {
    if (preventSqlite && 'sqlitePlugin' in window) {
      delete window.sqlitePlugin;
    }
    persistence.store.cordovasql.config(
      persistence,
      'ExpirySync.sqlite',
      '0.7',                // DB version
      'ExpirySync client db',          // DB display name
      5 * 1024 * 1024,        // DB size (WebSQL fallback only)
      0,                      // SQLitePlugin Background processing disabled
      0                       // DB location (iOS only), 0 (default): Documents, 1: Library, 2: Library/LocalDatabase
      //   0: iTunes + iCloud, 1: NO iTunes + iCloud, 2: NO iTunes + NO iCloud
      //   More information at https://github.com/litehelpers/Cordova-sqlite-storage#opening-a-database
    );
  }

  private loadOldPersistenceMigrations() {
    for (const key of Object.keys(oldPersistenceMigrations)) {
      // tslint:disable-next-line:no-unused-expression
      new oldPersistenceMigrations[key]();
    }
  }

  private runOldPersistenceMigrations(): Promise<any> {
    return new Promise((resolve, reject) => {
      persistence.migrations.init(() => {
        console.log('OLDDB: Migrations initialized');
        try {
          persistence.migrate(function () {
            console.log('OLDDB: Migrations done');
            resolve(persistence);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }


}
