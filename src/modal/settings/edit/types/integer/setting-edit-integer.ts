import { SettingEditElement } from '../setting-edit-element';
import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'setting-integer',
  templateUrl: 'setting-edit-integer.html'
})
export class SettingEditIntegerElement extends SettingEditElement {
  constructor(modalCtrl: ModalController) {
    super(modalCtrl);
  }
}
