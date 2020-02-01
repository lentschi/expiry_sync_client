import { ExportData, implementsExportData, ExportDataRow } from 'src/app/non-persisted-models/export-data';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { Injectable, Inject } from '@angular/core';
import { AppModel } from '../orm';
import { IndexedMigration } from 'src/config/indexed-migrations/indexed-migration';
import { DbManager } from '../db-manager';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer/ngx';
import { File as NgxFile, FileEntry } from '@ionic-native/file/ngx';
import { UiHelper } from '../ui-helper';
import { BackupReadError } from './backup-rollback-error';
import { ProductEntry } from 'src/app/models';
import * as moment from 'moment';
import 'moment/min/locales';

@Injectable()
export class BackupManager {
  constructor(
    @Inject(IndexedMigration) private indexedMigrations: IndexedMigration[],
    private dbManager: DbManager,
    private transfer: FileTransfer,
    private file: NgxFile,
    private androidPermissions: AndroidPermissions,
    private uiHelper: UiHelper
  ) { }

  async exportSpreadsheet(): Promise<string> {
    const app = ExpirySync.getInstance();
    const fileName = Math.round((new Date()).getTime() / 1000) + '_ExpirySync.csv';
    const entries = <ProductEntry[]> await ProductEntry
      .all()
      .prefetch('article')
      .prefetch('location')
      .prefetch('creator')
      .list();

    const csvRows: string[] = [
      `"${await app.translate('location')}","${await app.translate('amount')}","${await app.translate('name')}",` +
      `"${await app.translate('description')}","${await app.translate('expiration date')}","${await app.translate('owner')}",` +
      `"${await app.translate('entry created')}"`
    ];

    for (const entry of entries) {
      const columns = [
        entry.location.name,
        entry.amount,
        entry.article.name,
        entry.description,
        entry.expirationDate,
        entry.creator.userName || entry.creator.email,
        entry.createdAt
      ];

      csvRows.push(
        columns
          .map(column =>
            '"' + (
              column instanceof Date
                ? moment(column).format('YYYY-MM-DD')
                : (column !== null ? String(column).replace('"', '""') : '')
            ) + '"'
          )
          .join(',')
      );
    }

    await this.offerFile(fileName, new Blob([csvRows.join('\n')]));

    return fileName;
  }

  async export(): Promise<string> {
    const data = await this.getExportData();
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const fileName = Math.round((new Date()).getTime() / 1000) + '_ExpirySync_backup.json';

    await this.offerFile(fileName, blob);
    return fileName;
  }

  private async offerFile(fileName: string, blob: Blob) {
    if (!this.uiHelper.runningInBrowser) {
      const filePath = this.file.cacheDirectory;

      // Write the file
      try {
        if (!(await this.androidPermissions.hasPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)).hasPermission) {
          if (!(await this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)).hasPermission) {
            console.error('Download aborted (insufficient permissions)');
          }
        }

        const fileEntry: FileEntry = await this.file.writeFile(filePath, fileName, blob, { replace: true });
        const transferObj = this.transfer.create();
        await transferObj.download(fileEntry.toURL(), this.file.externalRootDirectory + '/Download/' + fileName);
      } catch (err) {
        console.error('Error creating file: ' + err);
        throw err;
      }
    } else {
      const element = document.createElement('a');
      const href = URL.createObjectURL(blob);
      element.setAttribute('href', href);
      element.setAttribute('download', fileName);

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
      URL.revokeObjectURL(href);
    }
  }

  private async getExportData(): Promise<ExportData> {
    const exportData: ExportData = {
      exportedAt: new Date,
      schemaVersion: AppModel.db.version,
      objectStores: {}
    };

    for (const modelClass of Object.values(AppModel.modelRegistry)) {
      const list = await modelClass.all().list();
      exportData.objectStores[modelClass.tableName] = list.map(item => {
        const fields: any = {};
        for (const fieldName of Object.keys(item.rawData)) {
          const value = item.rawData[fieldName];
          fields[fieldName] = {
            value,
            originalType: typeof value,
            originalClass: (value && value.constructor) ? value.constructor.name : null
          };
        }
        return fields;
      });
    }

    return exportData;
  }

  async import(file: File): Promise<void> {
    let data: ExportData;
    try {
      data = await this.readFile(file);
      if (data && data.exportedAt) {
        data.exportedAt = new Date(data.exportedAt);
      }
    } catch (e) {
      throw new BackupReadError(e);
    }

    if (!implementsExportData(data)) {
      throw new BackupReadError('Invalid backup data format');
    }

    if (data.schemaVersion < 1 || data.schemaVersion > this.indexedMigrations.length) {
      throw new BackupReadError('Invalid backup schemaVersion: ' + data.schemaVersion);
    }

    console.log('DB_ROLLBACK: Valid backup file supplied - proceeding...');

    const emergencyBackup = await this.getExportData();

    const app = ExpirySync.getInstance();
    if (app.currentUser && app.currentUser.loggedIn) {
      await app.currentUser.logout();
    }

    app.currentUser = null;

    await this.deleteDatabase(this.dbManager.DATABASE_NAME);
    try {
      await this.applyBackup(data);
    } catch (e) {
      console.error('DB_ROLLBACK: Whoopsie something went wrong during import - Trying to revert backup', e);
      await this.deleteDatabase(this.dbManager.DATABASE_NAME);
      await this.applyBackup(emergencyBackup);
      console.log('DB_ROLLBACK: Emergency backup succesfully applied...');
      throw e;
    } finally {
      ExpirySync.readyPromise = new Promise<void>(resolve => {
        app.initializeFromDb(resolve);
      });

      await ExpirySync.readyPromise;
      console.log('DB_ROLLBACK: Done');
    }
  }

  private async applyBackup(data: ExportData) {
    await this.dbManager.migrateIndexedDb(0, data.schemaVersion);
    await this.importObjectStores(AppModel.db, data.objectStores);
    await this.dbManager.migrateIndexedDb(data.schemaVersion);
  }

  private deleteDatabase(dbName: string): Promise<void> {
    AppModel.db.close();
    AppModel.db = null;
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onerror = error => reject(error);
      req.onsuccess = () => resolve();
    });
  }

  private readFile(file: File): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = event => {
        const target = <FileReader> event.target;
        if (target.readyState !== FileReader.DONE) {
          return;
        }

        if (target.error) {
          reject(target.error);
        } else {
          try {
            resolve(JSON.parse(<string> target.result));
          } catch (error) {
            reject(error);
          }
        }
      };

      reader.readAsText(file);
    });
  }

  private importObjectStores(db: IDBDatabase, objectStores: {[storeName: string]: ExportDataRow[]}) {
    return new Promise((resolve, reject) => {
      const storeNames = Object.keys(objectStores);
      const transaction = db.transaction(storeNames, 'readwrite');
      for (const storeName of storeNames) {
        const storeData = objectStores[storeName];
        const store = transaction.objectStore(storeName);
        for (const fieldData of storeData) {
          let id: string;
          if (fieldData['id'] && fieldData['id'].value) {
            id = fieldData['id'].value;
          }

          const convertedFieldData: {[fieldName: string]: any} = {};
          for (const fieldName of Object.keys(fieldData)) {
            if (fieldName === 'id') {
              continue;
            }

            const fieldInfo = fieldData[fieldName];
            convertedFieldData[fieldName] = (fieldInfo.originalClass === 'Date')
              ? new Date(fieldInfo.value)
              : fieldInfo.value;
          }

          store.put(convertedFieldData, id);
        }
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = e => reject(e);
    });
  }
}