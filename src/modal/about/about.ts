import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ModalController } from '@ionic/angular';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { Setting } from 'src/app/models';
import { ExpirySync } from 'src/app/app.expiry-sync';

@Component({
  templateUrl: 'about.html',
  styleUrls: ['about.scss']
})
export class AboutModal extends ExpirySyncController {
  static readonly TAPS_REQUIRED_FOR_LOGS = 3;
  tapCounter = 0;
  logs: string;

  constructor(translate: TranslateService, private modalCtrl: ModalController) {
    super(translate);
  }

  get apiServer(): string {
    if (Setting.cached('offlineMode') === '1') {
      return null;
    }

    return Setting.cached('host');
  }

  get version(): string {
    return ExpirySync.getInstance().version;
  }

  get lastSync(): string {
    const lastSync = Setting.cached('lastSync');
    return lastSync === '' ? null : lastSync;
  }

  get currentLanguage(): string {
    return Setting.cached('localeId');
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  appTitleClicked() {
    this.tapCounter++;

    if (this.tapCounter === AboutModal.TAPS_REQUIRED_FOR_LOGS) {
      this.logs = '';
      const entries = ExpirySync.getInstance().logCache;
      for (const entry of entries) {
        const logTexts: string[] = [];
        for (const logPart of entry.data) {
          try {
            logTexts.push(JSON.stringify(logPart));
          } catch (e) {
            logTexts.push(`<stringify of ${typeof logPart} failed>`);
          }
        }
        this.logs += `${entry.level}: ${logTexts.join(' | ')} \n\n`;
      }
    }
  }
}
