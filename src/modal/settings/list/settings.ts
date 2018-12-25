import { Component } from '@angular/core';

import { NavController, NavParams, ModalController } from '@ionic/angular';
import { SettingEditModal } from '../edit/setting-edit';
import { Setting } from 'src/app/models';

@Component({
  templateUrl: 'settings.html',
})
export class SettingsModal {
  settings: Array<Setting>;

  constructor(
    public navCtrl: NavController,
    public modalCtrl: ModalController,
    public navParams: NavParams,
  ) {
    // If we navigated to this page, we will have an item available as a nav param
    // this.selectedItem = navParams.get('item');

    this.settings = [];

    Setting.all().list().then((settings: Array<Setting>) => {
      this.settings = settings;
    });
  }

  async settingTapped(event, item) {
    const modal = await this.modalCtrl.create({
      component: SettingEditModal,
      componentProps: { settingKey: item.key }
    });
    modal.onDidDismiss().then(dismissEvent => {
      const updatedSetting: Setting = dismissEvent.data;
      if (updatedSetting) {
        // if the setting has been updated, replace the setting in out list:
        const index: number = this.settings.findIndex((setting: Setting) => {
          return updatedSetting.id === setting.id;
        });
        this.settings[index] = updatedSetting;
      }
    });
    modal.present();
  }

  async booleanValueChanged(setting: Setting) {
    setting.value = (setting.value === '1') ? '0' : '1';
    await Setting.set(setting.key, setting.value);
  }

  async timeValueChanged(setting: Setting) {
    // TODO: Remove all this after upgrading to ionic-angular 3.1.1:
    // (s. https://github.com/driftyco/ionic/issues/11503)
    let hour: string = (<any>setting.value).hour;
    if (typeof (hour) === 'undefined') {
      return;
    }
    hour = String(hour);
    if (hour.length === 1) {
      hour = '0' + hour;
    }
    let minute: string = (<any>setting.value).minute;
    if (typeof (minute) === 'undefined') {
      return;
    }
    minute = String(minute);
    if (minute.length === 1) {
      minute = '0' + minute;
    }
    setting.value = `${hour}:${minute}`;

    await Setting.set(setting.key, setting.value);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
