import { ViewController } from 'ionic-angular';
import { Setting } from '../../../../../app/models/setting';
import { Input, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';

export class SettingEditElement {
  @Input() protected setting: Setting;
  @ViewChild('settingForm') settingForm: NgForm;

  constructor(protected viewCtrl:ViewController) {

  }

  async saveSetting() {
    if (!this.settingForm.valid) {
      return;
    }
    let setting:Setting = await Setting.set(this.setting.key, this.setting.value);
    this.viewCtrl.dismiss(setting);
  }
}
