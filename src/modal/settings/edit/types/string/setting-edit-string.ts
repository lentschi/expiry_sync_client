import { SettingEditElement } from '../setting-edit-element';
import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'setting-string',
  templateUrl: 'setting-edit-string.html'
})
export class SettingEditStringElement extends SettingEditElement {
  constructor(modalCtrl: ModalController) {
    super(modalCtrl);
  }
}
