import {SettingEditElement} from '../setting-edit-element';
import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';

@Component({
  selector: 'setting-select',
  templateUrl: 'setting-select.html'
})
export class SettingSelectElement extends SettingEditElement {
  constructor(viewCtrl:ViewController) {
    super(viewCtrl);
  }
}
