import { SettingEditElement } from '../setting-edit-element';
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'setting-weekdays',
  templateUrl: 'setting-weekdays.html'
})
export class SettingWeekdaysElement extends SettingEditElement implements OnInit {
  constructor(modalCtrl: ModalController) {
    super(modalCtrl);
  }

  ngOnInit() {
    if (typeof this.setting.value === 'string') {
      this.setting.value = JSON.parse(this.setting.value);
    }
  }
}
