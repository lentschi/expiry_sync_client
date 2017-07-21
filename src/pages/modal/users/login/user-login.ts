import { Component, ViewChild } from '@angular/core';
import { ViewController, NavParams } from 'ionic-angular';
import { User, Setting } from '../../../../app/models';
import { NgForm } from '@angular/forms';
import { ApiServer, ValidationError, InvalidLogin } from '../../../../app/utils/api-server';
import { UiHelper } from '../../../../app/utils/ui-helper';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { TranslateService } from '@ngx-translate/core';


@Component({
  templateUrl: 'user-login.html'
})
export class UserLoginModal extends ExpirySyncController {
  user:User;
  loginForm: NgForm;
  serverValidationErrors = {};
  private app:ExpirySync;
  @ViewChild('loginForm') currentForm: NgForm;

  constructor(private params:NavParams, private viewCtrl:ViewController, private server:ApiServer, private uiHelper:UiHelper, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.user = new User();

    const e = params.get('error');
    if (e) {
      if (this.app.currentUser) {
        this.user.login = this.app.currentUser.userName;
        this.user.password = this.app.currentUser.password;
      }
      this.displayError(e);
    }
  }

  async dismiss() {
    if (Setting.cached('offlineMode') != '1') {
      if(await this.uiHelper.confirm(await this.translate('Always stay in offline mode? (Can be undone on the settings page.)'))) {
        await Setting.set('offlineMode', '1');
      }
    }
    this.viewCtrl.dismiss();
  }

  private async displayError(e:Error) {
    if (e instanceof ValidationError) {
      this.serverValidationErrors = e.errorData.errors;
    }
    else if (e instanceof InvalidLogin) {
      this.serverValidationErrors['password'] = [await this.translate('Login failed.')];
    }
    else {
      this.uiHelper.errorToast(await this.translate('We have trouble connecting to the server you chose. Are you connected to the internet?'));
      console.error(e);
    }
  }

  async loginTapped(valid:boolean) {
    if (!valid) {
      return;
    }

    let task:Symbol = this.app.loadingStarted('Attempting login');

    try {
      await this.user.authenticate();
    }
    catch(e) {
      valid = false;
      this.displayError(e);
    }

    this.app.loadingDone(task);

    if (valid) {
      await Setting.set('offlineMode', '0');
      this.uiHelper.toast(await this.translate('Login succeeded.'));
      this.app.currentUser = this.user;
      this.viewCtrl.dismiss();
      if (this.app.entriesList) {
        this.app.entriesList.loadingAfterLocationSwitchDone = false;
      }
    }
  }

  get forgotPasswordUrl():string {
    return ApiServer.getInstance().forgotPasswordUrl;
  }

}
