import { Component, ViewEncapsulation } from '@angular/core';

import { NavController, NavParams, ModalController } from '@ionic/angular';
import { SettingEditModal } from '../edit/setting-edit';
import { Setting } from 'src/app/models';

@Component({
  templateUrl: 'settings.html',
  styleUrls: ['settings.scss'],
  encapsulation: ViewEncapsulation.None
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
    await Setting.set(setting.key, setting.value);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
