import { Input, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { Setting } from 'src/app/models';

export class SettingEditElement {
  @Input() public setting: Setting;
  @ViewChild('settingForm') settingForm: NgForm;

  constructor(protected modalCtrl: ModalController) {

  }

  async saveSetting() {
    if (!this.settingForm.valid) {
      return;
    }
    const setting: Setting = await Setting.set(this.setting.key, this.setting.value);
    this.modalCtrl.dismiss(setting);
  }
}
