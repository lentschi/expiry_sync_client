import { Input, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Setting } from 'src/app/models';

export class SettingEditElement {
  @Input() public setting: Setting;
  @ViewChild('settingForm', { static: true }) settingForm: NgForm;

  constructor(protected modalCtrl: ModalController) {

  }

  async saveSetting() {
    if (!this.settingForm.valid) {
      return;
    }
    const setting: Setting = await Setting.set(
      this.setting.key,
      typeof this.setting.value === 'string' ? this.setting.value : JSON.stringify(this.setting.value)
    );
    this.modalCtrl.dismiss(setting);
  }
}
