import { AppModel, Column, PersistenceModel } from '../../utils/orm/app-model';
import { ExpirySync } from '../app.expiry-sync';
import { ApiServer } from '../../utils/api-server';
import { User } from './';
import { SettingEditStringElement } from '../../modal/settings/edit/types/string/setting-edit-string';
import { SettingWeekdaysElement } from '../../modal/settings/edit/types/weekdays/setting-weekdays';
import { SettingEditIntegerElement } from '../../modal/settings/edit/types/integer/setting-edit-integer';
import { SettingSelectElement } from '../../modal/settings/edit/types/select/setting-select';
import { SettingEditElement } from '../../modal/settings/edit/types/setting-edit-element';
import { Type } from '@angular/core';
import { environment } from 'src/environments/environment';
import * as moment from 'moment';
import 'moment/min/locales';

declare var SharedPreferences: any;
declare var cordova: any;


export interface SettingConfiguration {
  default: string;
  editComponent?: Type<SettingEditElement>;
  inlineEditableBoolean?: boolean;
  timeButton?: boolean;
  weekdaysSelect?: boolean;
  choices?: Array<{ key: string | number, label: string }>;
  disabled?: boolean;
}

class ReminderTimeSetting implements SettingConfiguration {
  default = '15:00';
  timeButton = true;

  get disabled(): boolean {
    try {
      return Setting.cached('showReminder') !== '1';
    } catch (_) {
      return true;
    }
  }
}

class ReminderWeekdaysSetting  implements SettingConfiguration {
  default = '[1,2,3,4,5,6,7]';
  weekdaysSelect = true;
  choices = [];
  editComponent = SettingWeekdaysElement;

  get disabled(): boolean {
    try {
      return Setting.cached('showReminder') !== '1';
    } catch (_) {
      return true;
    }
  }
}

@PersistenceModel
export class Setting extends AppModel {
  static tableName = 'Setting';

  static v07UpgradeRequired = false;

  /**
   * Dictionary of setting configurations
   * Key: name of the setting key, Value: setting config
   */
  static settingConfig: { [settingKey: string]: SettingConfiguration } = {
    showReminder: { default: '1', inlineEditableBoolean: true },
    reminderTime: new ReminderTimeSetting(),
    reminderWeekdays: new ReminderWeekdaysSetting(),
    lastReminder: { default: '' },
    localeId: {
      default: '', editComponent: SettingSelectElement, choices: [
        { key: 'de', label: 'Deutsch' },
        { key: 'en', label: 'English' },
        { key: 'es', label: 'Español' },
        { key: 'fr', label: 'Français' },
        { key: 'it', label: 'Italiano' },
        { key: 'ru', label: 'Русский' }
      ]
    },
    useSystemLocaleForDates: { default: '1', inlineEditableBoolean: true},
    daysBeforeBad: { default: '-3', editComponent: SettingEditIntegerElement },
    daysBeforeMedium: { default: '-1', editComponent: SettingEditIntegerElement },
    offlineMode: { default: '0', inlineEditableBoolean: true },
    barcodeEngine: {
      default: 'phonegap', editComponent: SettingSelectElement, choices: [
        { key: 'cszBar', label: 'cszBar' },
        { key: 'phonegap', label: 'phonegap' },
        { key: 'quaggaJs', label: 'quaggaJs' }
      ]
    },
    startBarcodeScanningAutomatically: { default: '1', inlineEditableBoolean: true },
    // searchUrl: {default: 'http://www.chefkoch.de/rs/s0/{{ingredients}}/Rezepte.html', editComponent: SettingEditStringElement},
    searchUrl: {
      default: 'https://www.google.com/search?q={{recipeTranslation}}%20{{ingredients}}',
      editComponent: SettingEditStringElement
    },
    host: { default: environment.defaultServerUrl, editComponent: SettingEditStringElement },
    lastSync: { default: '' },
    serverChosen: { default: environment.defaultServerChosen ? '1' : '0' },
    lastUserId: { default: '' },
    syncInterval: { default: '5000' },
    notificationTappedLocationId: { default: ''},
    keyboardDatepickerMode: { default: '0' }
  };

  get settingConfig(): SettingConfiguration {
    return Setting.settingConfig[this.key];
  }

  get position(): number {
    return Object.keys(Setting.settingConfig).indexOf(this.key);
  }

  get editable(): boolean {
    return this.settingConfig
      && (
        typeof (this.settingConfig.editComponent) !== 'undefined'
        || this.settingConfig.inlineEditableBoolean
        || this.settingConfig.timeButton
      );
  }

  get editComponent() {
    return this.settingConfig && this.settingConfig.editComponent;
  }

  private static settingsCache: { [settingKey: string]: string } = {};

  static changeListeners = [];

  @Column()
  key: string;

  @Column()
  value: string;

  static onChange(key: string, callback: Function) {
    if (!this.changeListeners[key]) {
      this.changeListeners[key] = [];
    }

    this.changeListeners[key].push(callback);
  }

  static callChangeListeners(setting: Setting) {
    if (!this.changeListeners[setting.key]) {
      return;
    }

    for (const changeListener of this.changeListeners[setting.key]) {
      changeListener(setting);
    }
  }

  static setLanguageDependentLabels() {
    Setting.settingConfig.reminderWeekdays.choices = [];
    for (let i = 0; i < 7; i++) {
      const day = moment().weekday(i);
      Setting.settingConfig.reminderWeekdays.choices.push(
        {key: day.isoWeekday(), label: day.format('dddd')}
      );
    }
  }


  /**
   * Set a setting to a specific value
   * @param {string} key - The setting's key
   * @param {string} value - The value to set
   */
  static async set(key: string, value: string): Promise<Setting> {
    Setting.settingsCache[key] = value;
    let setting: Setting;
    try {
      setting = <Setting>await Setting.findBy('key', key);
      if (setting.value === value) {
        return setting;
      }
    } catch (e) {
      setting = new Setting();
      setting.key = key;
    }

    return new Promise<Setting>(async (resolve, reject) => {
      await setting.saveValue(value);
      this.callChangeListeners(setting);
      resolve(setting);
    });

  }

  static cached(key: string): string {
    if (Setting.settingsCache[key] === undefined) {
      throw new Error(`Setting ${key} has not been cached`);
    }
    return Setting.settingsCache[key];
  }

  /**
   * Insert default values for all missing setting keys
   * @param  {Function} callback Optional callback function
   */
  static async addDefaultsForMissingKeys(): Promise<void> {
    const settings = <Array<Setting>>await Setting.all().list();

    for (const settingKey of Object.keys(this.settingConfig)) {
      const settingConfig = this.settingConfig[settingKey];

      let setting = settings.find(curSetting => (curSetting.key === settingKey));
      if (setting) {
        Setting.settingsCache[settingKey] = setting.value;
      } else {
        // setting with that key doesn't exist
        // -> created it with the default value:
        setting = new Setting();
        setting.key = settingKey;
        Setting.settingsCache[settingKey] = settingConfig.default;
        await setting.saveValue(settingConfig.default);
      }
    }

    if (Setting.v07UpgradeRequired) {
      await Setting.migrateV0_7Preferences();
    }
  }

  private static migrateV0_7Preferences(): Promise<void> {
    const getAndroidSharedPref = (key: string, type: string): Promise<string> => {
      return new Promise<any>((resolve, reject) => {
        // cordova-plugin-shared-preferences' js module only provides 'getString'
        // Since we want to access other types as well, we'll need to call the plugin
        // manually:
        cordova.exec(value => resolve(String(value)), e => reject(e), 'SharedPreferences', 'get' + type, [key]);
      });
    };

    return new Promise<void>(resolve => {
      if (ExpirySync.getInstance().device.platform !== 'Android') {
        resolve(); // v0.7 only existed for Android
        return;
      }


      SharedPreferences.getSharedPreferences('main', 'MODE_PRIVATE', async () => {
        try {
          const host = await getAndroidSharedPref('pref_key_host', 'String');
          const login = await getAndroidSharedPref('pref_key_email', 'String');
          const password = await getAndroidSharedPref('pref_key_password', 'String');
          const daysBeforeMedium = await getAndroidSharedPref('pref_key_days_before_medium', 'Int');
          const daysBeforeBad = await getAndroidSharedPref('pref_key_days_before_bad', 'Int');
          const reminderTimeMs = await getAndroidSharedPref('pref_key_alert_time', 'Long');
          const lastSyncMs = await getAndroidSharedPref('pref_key_last_entry_retrieval', 'Long');
          const offlineMode = await getAndroidSharedPref('pref_key_offline_mode', 'Boolean');
          const serverChosen = await getAndroidSharedPref('pref_key_server_chosen', 'Boolean');
          const searchUrl = await getAndroidSharedPref('pref_key_search_url', 'String');

          await Setting.set('host', host.replace(/\/$/, ''));
          await Setting.set('daysBeforeMedium', daysBeforeMedium);
          await Setting.set('daysBeforeBad', daysBeforeBad);
          await Setting.set('reminderTime', moment(reminderTimeMs, 'x').format('HH:mm'));
          await Setting.set('lastSync', ApiServer.dateToHttpDate(moment(lastSyncMs, 'x').toDate()));
          await Setting.set('offlineMode', offlineMode);
          await Setting.set('serverChosen', serverChosen);
          await Setting.set('searchUrl', searchUrl + '{{recipeTranslation}}%20{{ingredients}}');

          if (login !== '') {
            const currentUser = new User();
            if (login.indexOf('@') !== -1) {
              currentUser.email = login;
            } else {
              currentUser.userName = login;
            }
            currentUser.unObfuscatedPassword = password;
            currentUser.usedForLogin = true;
            await currentUser.save();
            await currentUser.assignMissingUserIds();
          }

          console.log('Successfully migrated all preferences from v0.7');
        } catch (e) {
          // That's okay - probably just means, there is no need for a migration
        }

        // clear prefs even if something went wrong
        // (E.g. Else, if we converted half the prefs to Settings before an error occurred,
        // next time we would overwrite those settings again):
        SharedPreferences.clear(() => resolve(), clearError => resolve());
      }, error => resolve());
    });
  }

  saveValue(value: string): Promise<void> {
    this.value = value;
    return this.save();
  }
}
