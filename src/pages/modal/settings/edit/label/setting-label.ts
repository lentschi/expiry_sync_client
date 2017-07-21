import { Component, Input } from '@angular/core';
import { Setting } from '../../../../../app/models/setting';

@Component({
  selector: 'setting-label',
  templateUrl: 'setting-label.html'
})
export class SettingLabelElement {
  @Input() setting: Setting;
}
