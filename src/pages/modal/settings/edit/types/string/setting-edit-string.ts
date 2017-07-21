import {SettingEditElement} from '../setting-edit-element';
import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';

@Component({
  selector: 'setting-string',
  templateUrl: 'setting-edit-string.html'
})
export class SettingEditStringElement extends SettingEditElement {
  constructor(viewCtrl:ViewController) {
    super(viewCtrl);
  }
}
