import { Component, ViewEncapsulation, OnDestroy } from '@angular/core';

import { NavController, NavParams, ModalController, IonCheckbox } from '@ionic/angular';
import { SettingEditModal } from '../edit/setting-edit';
import { Setting } from 'src/app/models';
import { SettingWeekdaysElement } from '../edit/types/weekdays/setting-weekdays';
import * as moment from 'moment';
import 'moment/min/locales';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  templateUrl: 'settings.html',
  styleUrls: ['settings.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SettingsModal implements OnDestroy {
  settings: Array<Setting>;
  allDaysTranslation: string;

  private destroyed = new Subject<void>();

  constructor(
    public navCtrl: NavController,
    public modalCtrl: ModalController,
    public navParams: NavParams,
  ) {
    // If we navigated to this page, we will have an item available as a nav param
    // this.selectedItem = navParams.get('item');

    this.settings = [];

    Setting.all().list().then((settings: Array<Setting>) => {
      this.settings = settings.sort((s1, s2) => s1.position > s2.position ? 1 : -1);
      // Upgdate setting in the list, if changing one setting causes another to change:
      for (const setting of this.settings) {
        Setting.onChange(setting.key).pipe(takeUntil(this.destroyed)).subscribe(changedSetting => {
          setting.value = changedSetting.value;
        });
      }
    });

    ExpirySync.getInstance().translate('on all').then(translation => this.allDaysTranslation = translation);
    Setting.onChange('localeId').pipe(takeUntil(this.destroyed)).subscribe(_ => {
      ExpirySync.getInstance().translate('on all').then(translation => this.allDaysTranslation = translation);
    });
  }

  ngOnDestroy() {
    this.destroyed.next();
  }

  async settingTapped(_: MouseEvent, item: Setting) {
    if (item.settingConfig.disabled) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: SettingEditModal,
      componentProps: { settingKey: item.key }
    });
    modal.onDidDismiss().then(dismissEvent => {
      const updatedSetting: Setting = dismissEvent.data;
      if (updatedSetting) {
        // if the setting has been updated, replace the setting in out list:
        const index: number = this.settings.findIndex((setting: Setting) => {
          return updatedSetting.id === setting.id;
        });
        this.settings[index] = updatedSetting;
      }
    });
    modal.present();
  }

  async booleanValueChanged(setting: Setting, value: CustomEvent) {
    setting.value = ((<IonCheckbox> <unknown> value.target).checked === false) ? '0' : '1';
    await Setting.set(setting.key, setting.value);
  }

  async timeValueChanged(setting: Setting) {
    await Setting.set(setting.key, setting.value);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getChoiceLabel(setting: Setting): string {
    if (setting.editComponent !== SettingWeekdaysElement) {
      for (const choice of setting.settingConfig.choices) {
        if (choice.key === setting.value) {
          return choice.label;
        }
      }
      return '';
    }

    const values: number[] = setting.value ? JSON.parse(setting.value) : [];

    if (values.length === 7) {
      return this.allDaysTranslation;
    }

    return values.map(value => moment.weekdays(value)).join(', ');
  }
}
