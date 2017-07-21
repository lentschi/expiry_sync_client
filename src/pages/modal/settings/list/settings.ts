import { Component } from '@angular/core';

import { NavController, NavParams, ModalController, ViewController } from 'ionic-angular';
import { SettingEditModal } from '../edit/setting-edit'
import { Setting } from '../../../../app/models/setting';

@Component({
  templateUrl: 'settings.html',
})
export class SettingsModal {
  settings: Array<Setting>;

  constructor(public navCtrl: NavController, public modalCtrl:ModalController, public navParams: NavParams, private viewCtrl:ViewController) {
    // If we navigated to this page, we will have an item available as a nav param
    // this.selectedItem = navParams.get('item');

    this.settings = [];

    Setting.all().list().then((settings:Array<Setting>) => {
      this.settings = settings;
    });
  }

  settingTapped(event, item) {
    let modal = this.modalCtrl.create(SettingEditModal, {settingKey: item.key});
    modal.onDidDismiss((updatedSetting:Setting) => {
      if (updatedSetting) {
        // if the setting has been updated, replace the setting in out list:
        const index:number = this.settings.findIndex((setting:Setting) => {
          return updatedSetting.id == setting.id;
        });
        this.settings[index] = updatedSetting;
      }
    });
    modal.present();
  }

  async booleanValueChanged(setting:Setting) {
    setting.value = (setting.value == '1') ? '0' : '1';
    await Setting.set(setting.key, setting.value);
  }

  async timeValueChanged(setting:Setting) {
    // TODO: Remove all this after upgrading to ionic-angular 3.1.1:
    // (s. https://github.com/driftyco/ionic/issues/11503)
    let hour:string = (<any> setting.value).hour;
    if (typeof(hour) == "undefined") {
      return;
    }
    hour = String(hour);
    if (hour.length == 1) {
      hour = '0' + hour;
    }
    let minute:string = (<any> setting.value).minute;
    if (typeof(minute) == "undefined") {
      return;
    }
    minute = String(minute);
    if (minute.length == 1) {
      minute = '0' + minute;
    }
    setting.value =  `${hour}:${minute}`;

    await Setting.set(setting.key, setting.value);
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }
}
