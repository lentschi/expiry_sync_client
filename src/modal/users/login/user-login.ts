import { Component, ViewChild } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { User, Setting } from 'src/app/models';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { ApiServer, ValidationError, InvalidLogin } from 'src/utils/api-server';
import { UiHelper } from 'src/utils/ui-helper';


@Component({
  templateUrl: 'user-login.html',
  styleUrls: ['user-login.scss']
})
export class UserLoginModal extends ExpirySyncController {
  user: User;
  loginForm: NgForm;
  serverValidationErrors: any = {};
  private app: ExpirySync;
  @ViewChild('loginForm') currentForm: NgForm;

  constructor(
    private modalCtrl: ModalController,
    private server: ApiServer,
    private uiHelper: UiHelper,
    private params: NavParams,
    translate: TranslateService
  ) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.user = new User();

    if (params.get('error')) {
      if (this.app.currentUser) {
        this.user.login = this.app.currentUser.userName;
        this.user.password = this.app.currentUser.password;
      }
      this.displayError(params.get('error'));
    }
  }

  async dismiss() {
    if (Setting.cached('offlineMode') !== '1') {
      if (await this.uiHelper.confirm(await this.translate('Always stay in offline mode? (Can be undone on the settings page.)'))) {
        await Setting.set('offlineMode', '1');
      }
    }
    this.modalCtrl.dismiss();
  }

  private async displayError(e: Error) {
    if (e instanceof ValidationError) {
      this.serverValidationErrors = e.errorData.errors;
    } else if (e instanceof InvalidLogin) {
      this.serverValidationErrors['password'] = [await this.translate('Login failed.')];
    } else {
      this.uiHelper.errorToast(
        await this.translate('We have trouble connecting to the server you chose. Are you connected to the internet?')
      );
      console.error(e);
    }
  }

  async loginTapped(valid: boolean) {
    if (!valid) {
      return;
    }

    const task: Symbol = this.app.loadingStarted('Attempting login');

    try {
      await this.user.authenticate();
    } catch (e) {
      valid = false;
      this.displayError(e);
    }

    this.app.loadingDone(task);

    if (valid) {
      await Setting.set('offlineMode', '0');
      this.uiHelper.toast(await this.translate('Login succeeded.'));
      this.app.currentUser = this.user;
      this.modalCtrl.dismiss();
      if (this.app.entriesList) {
        this.app.entriesList.loadingAfterLocationSwitchDone = false;
      }
    }
  }

  get forgotPasswordUrl(): string {
    return ApiServer.getInstance().forgotPasswordUrl;
  }

}
