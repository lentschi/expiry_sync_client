import { Injectable, Inject } from '@angular/core';
import { Device } from '@ionic-native/device/ngx';
import * as migrations from '../config/migrations';
import { Setting } from 'src/app/models';
import { AppModel } from './orm';
import { IndexedMigration } from 'src/config/indexed-migrations/indexed-migration';

// https://x-team.com/blog/include-javascript-libraries-in-an-ionic-2-typescript-project/
// https://ionicframework.com/docs/v2/resources/app-scripts/
declare var persistence: any;

declare var window: any;
declare var openDatabase: any;

@Injectable()
export class DbManager {
  private rawDb: any;

  constructor(private device: Device, @Inject(IndexedMigration) private indexedMigrations: IndexedMigration[]) { }

  public async initialize(preventSqlite: boolean): Promise<any> {
    const migratedFrom = await this.migrateIndexedDb();

    if (migratedFrom === 0 && (window.sqlitePlugin || openDatabase)) {
      this.configure(preventSqlite);
      if (await this.sqlSucceeds('SELECT * FROM article')) {
        // We still found some WebSQL data
        // -> run all remaining WebSQL migrations and then move the
        // data to indexedDb:
        await this.migrateFromV0_7();
        this.loadMigrations();
        await this.runMigrations();
        await this.moveWebsqlToIndexedDb();
      }
    }
  }

  /**
   * Run indexedDb migrations
   * @returns version that we migrated from or null if no migration was required
   */
  migrateIndexedDb(): Promise<number> {
    let upgradeNeeded = false;
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('ExpirySync', this.indexedMigrations.length);
      request.onerror = error => reject(error);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        upgradeNeeded = true;
        const db: IDBDatabase = (<IDBRequest> event.target).result;
        AppModel.db = db;
        for (const migration of this.indexedMigrations) {
          const transaction = migration.migrate(db);
          transaction.oncomplete = () => resolve(event.oldVersion);
          transaction.onerror = e => reject(e);
        }
      };

      request.onsuccess = (event) => {
        if (!upgradeNeeded) {
          const db: IDBDatabase = (<IDBRequest> event.target).result;
          AppModel.db = db;
          resolve(null);
        }
      };
    });
  }

  async moveWebsqlToIndexedDb() {
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

  private configure(preventSqlite: boolean) {
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

  private loadMigrations() {
    for (const key of Object.keys(migrations)) {
      // tslint:disable-next-line:no-unused-expression
      new migrations[key]();
    }
  }

  private runMigrations(): Promise<any> {
    return new Promise((resolve, reject) => {
      persistence.migrations.init(() => {
        console.log('Migrations initialized');
        try {
          persistence.migrate(function () {
            console.log('Migrations done');
            resolve(persistence);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }


}
