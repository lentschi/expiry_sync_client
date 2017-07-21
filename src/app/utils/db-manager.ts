import { Injectable } from '@angular/core';
import { Device } from '@ionic-native/device';
import * as migrations from '../../config/migrations';

//https://x-team.com/blog/include-javascript-libraries-in-an-ionic-2-typescript-project/
//https://ionicframework.com/docs/v2/resources/app-scripts/
declare var persistence: any;

declare var window: any;
declare var openDatabase: any;

@Injectable()
export class DbManager {
    private rawDb;

    constructor(private device:Device) {}

    public async initialize() : Promise<any> {
        this.configure();
        await this.migrateFromV0_7();
        this.loadMigrations();
        await this.runMigrations();
    }

    async executeSql(sql:string, params?:Array<any>):Promise<any> {
      return new Promise<boolean>((resolve, reject) => {
        this.getRawDb().transaction(function(tx) {
          tx.executeSql(sql, params, function(tx, rs) {
            resolve(rs);
          }, function(tx, error) {
            reject(error);
          });
        }, function(e) {
          reject(e);
        });
      });
    }

    async sqlSucceeds(sql:string, params?:Array<any>):Promise<boolean> {
      try {
        await this.executeSql(sql, params);
        return true;
      }
      catch(e) {
        return false;
      }
    }

    private async migrateFromV0_7() {
      if (this.device.platform != 'Android') {
        return; // v0.7 only existed for Android
      }

      console.log("Migrating from v0.7...");
      if (await this.sqlSucceeds('SELECT * FROM schema_version')) {
        console.log("Already migrated from v0.7");
        return;
      }

      if (!await this.sqlSucceeds('SELECT * FROM article')) {
        console.log("Fresh installation - default persistencejs migrations will take care of everything...");
        return;
      }

      // Fake a schema_version of 1:
      await this.executeSql('CREATE TABLE schema_version (current_version INTEGER)');
      await this.executeSql('INSERT INTO schema_version (current_version) VALUES (?)', [1]);
      console.log("Done with v0.7 upgrade");
    }

    private getRawDb() {
      if (this.rawDb) {
        return this.rawDb;
      }

      if (window.sqlitePlugin) {
        this.rawDb = window.sqlitePlugin.openDatabase({name: 'ExpirySync.sqlite', location: 'default'});
      }
      else {
        this.rawDb = openDatabase('ExpirySync.sqlite', '0.7', 'ExpirySync client db', 5 * 1024 * 1024);
      }

      return this.rawDb;
    }

    private configure() {
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
        for (let key in migrations) {
            new migrations[key]();
        }
    }

    private runMigrations() : Promise<any> {
        return new Promise((resolve, reject) => {
            persistence.migrations.init(() => {
                console.log("Migrations initialized");
                try {
                    persistence.migrate(function() {
                        console.log("Migrations done");
                        resolve(persistence);
                    });
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }


}
