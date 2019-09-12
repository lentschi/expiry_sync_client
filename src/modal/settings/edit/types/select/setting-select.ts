import { SettingEditElement } from '../setting-edit-element';
import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'setting-select',
  templateUrl: 'setting-select.html'
})
export class SettingSelectElement extends SettingEditElement {
  constructor(modalCtrl: ModalController) {
    super(modalCtrl);
  }
}
