import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { User, Setting } from 'src/app/models';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { ValidationError } from 'src/utils/api-server';
import { UiHelper } from 'src/utils/ui-helper';
import { ModalController } from '@ionic/angular';

@Component({
  templateUrl: 'user-registration.html',
  styleUrls: ['user-registration.scss']
})
export class UserRegistrationModal extends ExpirySyncController {
  user: User;
  registrationForm: NgForm;
  serverValidationErrors = {};
  private app: ExpirySync;
  @ViewChild('registrationForm', { static: false }) currentForm: NgForm;

  constructor(
    private modalCtrl: ModalController,
    private uiHelper: UiHelper,
    translate: TranslateService
  ) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.user = new User();
  }

  async dismiss() {
    if (Setting.cached('offlineMode') !== '1') {
      if (await this.uiHelper.confirm(await this.translate('Always stay in offline mode? (Can be undone on the settings page.)'))) {
        await Setting.set('offlineMode', '1');
      }
    }
    this.modalCtrl.dismiss();
  }

  loginInsteadTapped() {
    this.modalCtrl.dismiss(true);
  }


  async register(valid: boolean) {
    if (!valid) {
      return;
    }

    const task: Symbol = this.app.loadingStarted('Attempting registration');

    try {
      await this.user.register();
    } catch (e) {
      valid = false;
      if (e instanceof ValidationError) {
        this.serverValidationErrors = e.errorData.errors;
      } else {
        throw (e);
      }
    }

    this.app.loadingDone(task);

    if (valid) {
      this.app.currentUser = this.user;
      this.uiHelper.toast(await this.translate('User \'\' has been registered successfully.', { user: this.user.userName }));
      this.modalCtrl.dismiss();
    }
  }
}
