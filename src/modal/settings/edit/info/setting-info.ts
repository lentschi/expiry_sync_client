import { Component, Input } from '@angular/core';
import { Setting } from 'src/app/models';

@Component({
  selector: 'setting-info',
  templateUrl: 'setting-info.html'
})
export class SettingInfoElement {
  @Input() setting: Setting;
}
