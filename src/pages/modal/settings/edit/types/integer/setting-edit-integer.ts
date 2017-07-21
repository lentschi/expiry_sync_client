import {SettingEditElement} from '../setting-edit-element';
import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';

@Component({
  selector: 'setting-integer',
  templateUrl: 'setting-edit-integer.html'
})
export class SettingEditIntegerElement extends SettingEditElement {
  constructor(viewCtrl:ViewController) {
    super(viewCtrl);
  }
}
