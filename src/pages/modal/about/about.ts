import { Component } from '@angular/core';
import { ExpirySyncController } from '../../../app/app.expiry-sync-controller';
import { ExpirySync } from '../../../app/app.expiry-sync';
import { TranslateService } from '@ngx-translate/core';
import { Setting } from '../../../app/models';
import { ViewController } from 'ionic-angular';

@Component({
  templateUrl: 'about.html'
})
export class AboutModal extends ExpirySyncController {
  constructor(translate:TranslateService, private viewCtrl:ViewController) {
    super(translate);
  }

  get apiServer():string {
    if (Setting.cached('offlineMode') == '1') {
      return null;
    }

    return Setting.cached('host');
  }

  get version():string {
    return ExpirySync.getInstance().version;
  }

  get lastSync():string {
    const lastSync = Setting.cached('lastSync');
    return lastSync == '' ? null : lastSync;
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }
}
