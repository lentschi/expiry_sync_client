import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ModalController } from '@ionic/angular';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { Setting } from 'src/app/models';
import { ExpirySync } from 'src/app/app.expiry-sync';

@Component({
  templateUrl: 'about.html'
})
export class AboutModal extends ExpirySyncController {
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

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
