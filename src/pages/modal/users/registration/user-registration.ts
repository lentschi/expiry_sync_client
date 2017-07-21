import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { User, Setting } from '../../../../app/models';
import { ViewController } from 'ionic-angular';
import { ApiServer, ValidationError } from '../../../../app/utils/api-server';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { UiHelper } from '../../../../app/utils/ui-helper';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { TranslateService } from '@ngx-translate/core';

@Component({
  templateUrl: 'user-registration.html'
})
export class UserRegistrationModal extends ExpirySyncController {
  user:User;
  registrationForm: NgForm;
  serverValidationErrors = {};
  private app:ExpirySync;
  @ViewChild('registrationForm') currentForm: NgForm;

  constructor(private viewCtrl:ViewController, private server:ApiServer, private uiHelper:UiHelper, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.user = new User();
  }

  async dismiss() {
    if (Setting.cached('offlineMode') != '1') {
      if(await this.uiHelper.confirm(await this.translate('Always stay in offline mode? (Can be undone on the settings page.)'))) {
        await Setting.set('offlineMode', '1');
      }
    }
    this.viewCtrl.dismiss();
  }

  loginInsteadTapped() {
    this.viewCtrl.dismiss(true);
  }


  async register(valid:boolean) {
    if (!valid) {
      return;
    }

    let task:Symbol = this.app.loadingStarted('Attempting registration');

    try {
      await this.user.register();
    }
    catch(e) {
      valid = false;
      if (e instanceof ValidationError) {
        this.serverValidationErrors = e.errorData.errors;
      }
      else {
        throw(e);
      }
    }

    this.app.loadingDone(task);

    if (valid) {
      this.app.currentUser = this.user;
      this.uiHelper.toast(await this.translate("User '' has been registered successfully.", {user: this.user.userName}));
      this.viewCtrl.dismiss();
    }
  }
}
