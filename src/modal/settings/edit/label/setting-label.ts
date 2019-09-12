import { Component, Input } from '@angular/core';
import { Setting } from 'src/app/models';

@Component({
  selector: 'setting-label',
  templateUrl: 'setting-label.html',
  styleUrls: ['./setting-label.scss']
})
export class SettingLabelElement {
  @Input() setting: Setting;
}
