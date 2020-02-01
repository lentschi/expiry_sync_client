import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ModalController, IonButton } from '@ionic/angular';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { Setting } from 'src/app/models';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { readFile } from 'fs';
import { DbManager } from 'src/utils/db-manager';
import { SynchronizationHandler } from 'src/app/services/synchronization-handler.service';
import { UiHelper } from 'src/utils/ui-helper';
import { BackupManager } from 'src/utils/backup-manager/backup-manager';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { BackupReadError } from 'src/utils/backup-manager/backup-rollback-error';

@Component({
  templateUrl: 'import-export.html',
  styleUrls: ['import-export.scss']
})
export class ImportExportModal extends ExpirySyncController implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('fileInput', {static: true}) fileInput: ElementRef<HTMLInputElement>;
  @ViewChild('importBtn', {static: true, read: ElementRef}) inputBtn: ElementRef<HTMLElement>;

  validFileToDrop: boolean = null;
  invalidContents: boolean;

  private _file: File;
  private app: ExpirySync;
  private scrollImportButtonIntoView = false;

  constructor(
      translate: TranslateService,
      public modalCtrl: ModalController,
      private backupManager: BackupManager,
      private synchronizationHandler: SynchronizationHandler,
      public uiHelper: UiHelper,
      private androidPermissions: AndroidPermissions,
    ) {
    super(translate);

    this.app = ExpirySync.getInstance();
  }

  async ngOnInit() {
    if (!this.uiHelper.runningInBrowser
        && !(await this.androidPermissions.hasPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)).hasPermission) {
      if (!(await this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)).hasPermission) {
        console.error('Import/Export dialog closed (insufficient permissions)');
        this.modalCtrl.dismiss();
      }
    }

    const task = this.app.loadingStarted('Waiting for sync to complete');
    await this.synchronizationHandler.syncMutex.acquire();
    this.app.loadingDone(task);
  }

  async ngOnDestroy() {
    this.synchronizationHandler.syncMutex.release();
  }

  ngAfterViewChecked() {
    if (this.scrollImportButtonIntoView) {
      this.scrollImportButtonIntoView = false;
      this.inputBtn.nativeElement.scrollIntoView();
    }
  }

  set file(file: File) {
    this._file = file;
    this.invalidContents = false;
    this.scrollImportButtonIntoView = true;
  }

  get file(): File {
    return this._file;
  }

  fileChosen(event: Event) {
    const input = <HTMLInputElement> event.target;
    this.file = input.files[0];
  }

  async export() {
    const task = this.app.loadingStarted('Exporting');
    try {
      const fileName = await this.backupManager.export();
      if (this.uiHelper.runningInBrowser) {
        this.uiHelper.toast(await this.translate('Backup successfully created'), null, 3000);
      } else {
        this.uiHelper.toast(`${(await this.translate('Backup saved to'))} "/Download/${fileName}"`, null, 3000);
      }
      this.modalCtrl.dismiss();
    } catch (e) {
      console.error('Backup error', e);
      this.uiHelper.errorToast(await this.translate('Failed to export backup'));
    } finally {
      this.app.loadingDone(task);
    }
  }

  async exportSpreadsheet() {
    const task = this.app.loadingStarted('Exporting spreadsheet');
    try {
      const fileName = await this.backupManager.exportSpreadsheet();
      if (this.uiHelper.runningInBrowser) {
        this.uiHelper.toast(await this.translate('Spreadsheet successfully created'), null, 3000);
      } else {
        this.uiHelper.toast(`${(await this.translate('Spreadsheet saved to'))} "/Download/${fileName}"`, null, 3000);
      }
      this.modalCtrl.dismiss();
    } catch (e) {
      console.error('Backup error', e);
      this.uiHelper.errorToast(await this.translate('Failed to export spreadsheet'));
    } finally {
      this.app.loadingDone(task);
    }
  }

  async import() {
    const task = this.app.loadingStarted('Importing');
    try {
      await this.backupManager.import(this.file);
      this.uiHelper.toast(await this.translate('Backup successfully imported'), null, 3000);
      this.modalCtrl.dismiss();
    } catch (e) {
      console.error('Rollback failed', e);
      if (e instanceof BackupReadError) {
        this.invalidContents = true;
      } else {
        this.uiHelper.errorToast(await this.translate('An unexpected error occurred when trying to import the backup.'));
        this.modalCtrl.dismiss();
      }
    }
    this.app.loadingDone(task);
  }

  dropzoneTapped() {
    this.fileInput.nativeElement.click();
  }

  fileDropped(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer.files.length === 1) {
      const file = event.dataTransfer.files.item(0);
      if (file.type.toLowerCase()  === 'application/json') {
        this.file = file;
      }
    }

    this.validFileToDrop = null;
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer.items.length === 1) {
      const file = event.dataTransfer.items[0];
      this.validFileToDrop = file.type.toLowerCase() === 'application/json';
      return;
    }


    this.validFileToDrop = false;
  }
}
