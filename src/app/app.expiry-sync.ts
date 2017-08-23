import {DbManager} from './utils/db-manager';
import { Component, ViewChild } from '@angular/core';
import { Nav, Platform, ModalController, Events, LoadingController, MenuController, IonicApp, LoadingOptions, Loading, Config } from 'ionic-angular';
import { Device } from '@ionic-native/device';
import { ProductEntriesPage } from '../pages/product-entries/product-entries';
import { SettingsModal } from '../pages/modal/settings/list/settings';
import { LocationsModal } from '../pages/modal/locations/list/locations';
import { AboutModal } from '../pages/modal/about/about';
import { Setting, User, ProductEntry, Location } from './models';
import { ApiServer } from './utils/api-server';
import { UserRegistrationModal } from '../pages/modal/users/registration/user-registration';
import { AlternateServersChoiceModal } from '../pages/modal/alternate-servers/choice/alternate-servers-choice';
import { UserLoginModal } from '../pages/modal/users/login/user-login';
import { TranslateService } from '@ngx-translate/core';
import { LocalNotifications } from '@ionic-native/local-notifications';
import { UiHelper } from './utils/ui-helper';
import { ExpirySyncController } from './app.expiry-sync-controller';
import * as moment from 'moment';
import 'moment/min/locales';

declare var window;
declare var cordova;

/**
 * The main menu's menu points
 */
enum  MenuPointId {
  locationList,
  settings,
  selectAll,
  deselectAll,
  filterAllUsers,
  filterCurrentUser,
  registration,
  synchronize,
  moveEntriesToAnotherLocation,
  recipeSearch,
  login,
  logout,
  about
};

/**
 * Menu point configuration
 * @interface
 */
interface MenuPointConfig {id: number, component?: any, method?:Function, modal?: boolean, onDidDismiss?: Function, disabled?:boolean};

/**
 * The app's "main class"
 */
@Component({
  templateUrl: 'app.html'
})
export class ExpirySync extends ExpirySyncController {
  /**
   * Fallback version to display if determining the real version fails
   */
  static readonly FALLBACK_APP_VERSION = '0.9 web';

  /**
   * The app's version
   */
  version = ExpirySync.FALLBACK_APP_VERSION;

  /**
   * Reference to ion-nav
   */
  @ViewChild(Nav) nav: Nav;

  rootPage = ProductEntriesPage;
  curPage = ProductEntriesPage;

  /**
   * The app's current state (active/not active)
   * @member {boolean}
   */
  private active=true;

  /**
   * The active user
   * They don't have to be logged on the server - but even in offline mode there needs to be an anonymous currenUser to store
   * foreign keys (might be useful for a later sync)
   * @type {User}
   */
  currentUser:User;

  /**
   * Show/hide the loading overlay (prevents clicks to the background if the loader is visible)
   */
  showLoadingOverlay:boolean = false;

  /**
   * List of menu points to be shown in the main menu
   */
  menuPoints: Array<MenuPointConfig>;

  /**
   * The product entries page
   */
  entriesList:ProductEntriesPage;

  /**
   * Js timeout ID of the synchronization timeout
   */
  private syncTimeout:number;

  /**
   * Loader instance
   */
  private loader:Loading;

  /**
   * The loader dialog's stack
   */
  private loadingTasks:Array<Symbol> = [];

  /**
   * Singleton instance
   */
  private static appInstance:ExpirySync;

  /**
   * Resolved when the app has been initialized
   */
  private static readyPromise:Promise<{}>;

  /**
   * The main menu's menu points
   */
  public static MenuPointId = MenuPointId;

  /**
   * The main menu's menu points
   */
  public menuPointIds = MenuPointId;

  /**
   * Called when the back button is pressed while the loader is active
   */
  loaderBackButtonCallback:Function;

  /**
   * If true, the app will exit right after showing the reminder
   */
  private exitAfterReminder:boolean = false;

  /**
   * the entry, that has been last updated (before any sync)
   */
  updatedEntry:ProductEntry;

  /**
   * the location, that has been last updated (before any sync)
   */
  updatedLocation:Location;

  /**
   * resolved when auto login and initial sync have finished (no matter if successful or not)
   */
  private autoLoginAndSyncDone:Promise<void>;

  /**
   * Initializes the app's db locale and menu
   */
  constructor(private platform: Platform, translate:TranslateService, private config:Config, private menuCtrl:MenuController, private modalCtrl:ModalController, private app:IonicApp, private dbManager: DbManager, private server:ApiServer, public events: Events, private loadingCtrl: LoadingController, private localNotifications: LocalNotifications, private uiHelper:UiHelper, public device:Device) {
    super(translate);
    ExpirySync.appInstance = this;
    this.initializeApp();

    // used for an example of ngFor and navigation
    this.menuPoints = [
      { id: this.menuPointIds.locationList, component: LocationsModal, modal: true},
      { id: this.menuPointIds.settings, component: SettingsModal, modal:true},
      { id: this.menuPointIds.selectAll, disabled: true},
      { id: this.menuPointIds.deselectAll, disabled: true},
      { id: this.menuPointIds.filterAllUsers, disabled: true},
      { id: this.menuPointIds.filterCurrentUser, disabled: true},
      { id: this.menuPointIds.deselectAll, disabled: true},
      { id: this.menuPointIds.synchronize, method: this.synchronizeTapped, disabled: true},
      { id: this.menuPointIds.registration, component: UserRegistrationModal, modal:true, onDidDismiss: (openLoginInstead?:boolean) => {
        this.authDone(openLoginInstead);
      }},
      { id: this.menuPointIds.login, component: UserLoginModal, modal: true, onDidDismiss: () => {
        this.authDone(false);
      }},
      { id: this.menuPointIds.recipeSearch, disabled: true},
      { id: this.menuPointIds.moveEntriesToAnotherLocation, disabled: true},
      { id: this.menuPointIds.logout, method: this.logout, disabled: true},
      { id: this.menuPointIds.about, component: AboutModal, modal: true}
    ];
  }


  /**
   * Synchronize has been tapped in the main menu
   */
  async synchronizeTapped() {
    let task:Symbol = this.loadingStarted('Synchronizing');
    await this.mutexedSynchronize(true);
    this.loadingDone(task);
  }

  /**
   * Exit menu button has been tapped in the main menu
   */
  exitTapped() {
    this.platform.exitApp();
  }

  /**
   * Synchronize product entries with the server, waiting for any ongoing sync or local changes to complete first
   * @param  {number}        locationUpdateId     ID of a location that has just been updated locally (won't be pulled)
   * @param  {number}        productEntryUpdateId ID of a product entry that has just been updated locally (won't be pulled)
   * @return {Promise<void>}                      resolved after sync has finished (either successfully or with an error)
   */
  async mutexedSynchronize(requestedManually = false):Promise<void> {
    console.log("SYNC: Waiting for previous sync to finish...");
    await this.syncDone(false);

    return this.setSyncDonePromise(new Promise<void>(async resolve => {
      console.log("SYNC: Waiting for local changes to be completed...");
      await this.localChangesDone();

      try {
        await this.synchronize();
      }
      catch(e) {
        if (requestedManually) {
          this.uiHelper.errorToast(await this.translate('We have trouble connecting to the server you chose. Are you connected to the internet?'));
        }
        console.error("Error during sync: ", e);
      }
      resolve();

      this.events.publish('app:syncDone');
      if (!this.device.platform || this.active) {
        console.log("SYNC: Setting sync timeout");
        this.setSyncTimeout();
      }
    }));
  }

  /**
   * Synchronize product entries with the server
   * Pulls and pushes locations from/to the server that were modified after the timestamp
   * stored in the 'lastSync' setting.
   * @param  {number}        locationUpdateId     ID of a location that has just been updated locally (won't be pulled)
   * @param  {number}        productEntryUpdateId ID of a product entry that has just been updated locally (won't be pulled)
   * @return {Promise<void>}                      resolved after sync has finished (either successfully or with an error)
   */
  async synchronize():Promise<void> {
    console.log("SYNC: Synchronizing...");
    let lastSync:Date = null;
    let lastSyncRfc2616:string = Setting.cached('lastSync');
    if (lastSyncRfc2616 != '') {
      lastSync = new Date(lastSyncRfc2616);
    }


    const beforeSync = new Date();
    const newLocations = await Location.pullAll(lastSync, this.updatedLocation ? this.updatedLocation.serverId : null);
    await Location.pushAll();

    this.updatedLocation = null;

    await ProductEntry.pullAll(lastSync, this.updatedEntry ? this.updatedEntry.serverId : null, newLocations);
    await ProductEntry.pushAll();

    this.updatedEntry = null;

    lastSync = moment(beforeSync).add(this.server.timeSkew, 'ms').toDate();

    await Setting.set('lastSync', ApiServer.dateToHttpDate(lastSync));
    console.log("SYNC: Done");
  }

  /**
   * Clears the timeout set for synchronization if any
   */
  private clearSyncTimeout() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }

  /**
   * Sets the timeout for the next synchronization
   */
  private setSyncTimeout() {
    this.clearSyncTimeout();
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      if (this.currentUser && this.currentUser.loggedIn) {
        this.mutexedSynchronize();
      }
    }, Setting.cached('syncInterval'));
  }

  /**
   * Log the current user out
   * @param  {boolean} remotely also do a logout API call (default: true)
   */
  async logout(remotely = true, forgetPassword = true) {
    let task:Symbol = this.loadingStarted("Logout");

    await this.currentUser.logout(remotely, forgetPassword);
    this.disableMenuPoint(ExpirySync.MenuPointId.logout);
    this.disableMenuPoint(ExpirySync.MenuPointId.synchronize);
    this.enableMenuPoint(ExpirySync.MenuPointId.login);
    this.enableMenuPoint(ExpirySync.MenuPointId.registration);
    this.loadingDone(task);
    console.log("Successfully logged out");

    if (Setting.cached('offlineMode') != '1') {
      this.openMenuPoint(this.menuPoints.find((menuPoint:MenuPointConfig) => {
        return menuPoint.id == ExpirySync.MenuPointId.login;
      }));
    }
  }

 /**
 * Enable/disable a main menu point
 * @param  {number}          menuPointId the menu point's ID
 * @param  {boolean}         enable      true -> enable / false -> disable (default: enable)
 * @return {MenuPointConfig}             the enabled/disabled menu point's config
 *
 * @see MenuPointId
 */
  enableMenuPoint(menuPointId:number, enable?:boolean):MenuPointConfig {
    let menuPoint:MenuPointConfig = this.menuPoints.find((curMenuPoint:MenuPointConfig) => {
      return (curMenuPoint.id == menuPointId);
    });

    if (!menuPoint) {
      throw "Invalid menuPoint id";
    }

    menuPoint.disabled = (enable !== undefined) ? !enable : false;
    return menuPoint;
  }

  /**
   * @see ExpirySync.enableMenuPoint
   */
  disableMenuPoint(menuPointId:number) {
    this.enableMenuPoint(menuPointId, false);
  }

  /**
   * @return {Promise}   resolved when the app has been initialized
   */
  static ready():Promise<{}> {
    return this.readyPromise;
  }

  /**
   * TODO: Handle back button?
   */
  private setupBackgroundMode() {
    this.platform.resume.subscribe(() => {
      this.active = true;
      this.setSyncTimeout();
    });

    this.platform.pause.subscribe(() => {
      this.active = false;
      this.clearSyncTimeout();
    });
  }

  /**
   * Sets up the daily reminder
   */
  private setupReminder() {
    this.scheduleReminder();
    Setting.onChange('reminderTime', (setting:Setting) => {
      this.scheduleReminder();
    });

    // handle the wakeup plugin's events:
    if (typeof(window.plugins) != "undefined") {
      window.plugins.intent.setNewIntentHandler(async intent => {
        if (typeof(intent.extras) != 'undefined' && typeof(intent.extras.wakeup) != 'undefined' && intent.extras.wakeup) {
          // the app has been running and a wakeup occurred
          // -> show the reminder:
          await this.showReminder();
          if (this.exitAfterReminder) {
            // the app was in background when the wakeup occurred
            // -> simply exit the app (backgroundMode's moveToBackground would be better, but has some issues):
            this.platform.exitApp();
          }
        }
      });

      window.plugins.intent.getCordovaIntent(async intent => {
        if (typeof(intent.extras) != 'undefined' && typeof(intent.extras.wakeup) != 'undefined' && intent.extras.wakeup) {
          // the app has not been running and a wakeup occurred
          // -> show the reminder and then exit the app again:
          await this.showReminder();
          this.platform.exitApp();
        }
      }, () => {
        console.error("unknown cdvintent error");
      });
    }
  }

  /**
   * Schedules a reminder to be trigger at the time configured by the 'reminderTime' setting
   * @see ExpirySync.showReminder
   */
  private scheduleReminder() {
    if (typeof(window.wakeuptimer) === 'undefined') {
      console.error("Cordova plugin wakeuptimer missing - no reminder scheduled");
      return;
    }

    const reminderTimeSetting = Setting.cached('reminderTime');
    let md = reminderTimeSetting.match(/([0-9]{2}):([0-9]{2})/);
    if (!md || md.length != 3) {
      console.error("Invalid reminder time setting: " + reminderTimeSetting);
      return;
    }

    window.wakeuptimer.wakeup((p:any) => {
      if (typeof(p.type) != 'undefined' && p.type == 'wakeup' && !this.active) {
        this.exitAfterReminder = true;
      }
    },
     (error) => {
       console.error("Wakeup error");
     },
     {
          alarms : [{
              type : 'onetime',
              time : { hour : md[1], minute : md[2] },
         }]
     });
  }

  /**
   * Immediately show a local notification about expiring products (if any)
   */
  private async showReminder() {
    console.log("Showing reminder");
    if (this.autoLoginAndSyncDone) {
      await this.autoLoginAndSyncDone;
    }

    this.localNotifications.cancelAll();
    let productEntries:Array<ProductEntry> = <Array<ProductEntry>> await ProductEntry
      .all()
      .order('expirationDate', true)
      .prefetch('article')
      .list();

    productEntries = productEntries.filter((productEntry:ProductEntry) => {
      return moment(productEntry.expirationDate).subtract(Setting.cached('daysBeforeMedium'), 'days').toDate() < new Date();
    });


    if (productEntries.length > 0) {
      let text:string = `${productEntries[0].amount}x ${productEntries[0].article.name}`;
      if (productEntries.length > 1) {
        text += " " + await this.pluralTranslate('and other articles', productEntries.length);
      }

      let notificationConf = {
        id: 1,
        title: await this.translate('Eat now:'),
        icon: 'res://icon',
        smallIcon: 'res://icon',
        text: text,
        led: 'FFFFFF',
        data: {firstLocationId: productEntries[0].locationId}
      };
      console.log("Displaying notification: ", notificationConf);
      this.localNotifications.schedule(notificationConf);

      await Setting.set('lastReminder', ApiServer.dateToHttpDate(new Date()));
    }

    // setup the reminder due in one day:
    this.scheduleReminder();
  }


  /**
   * Initialize db & locale; trigger auto login and auto synchronization ...
   */
  private initializeApp() {
    ExpirySync.readyPromise = new Promise<{}>(async resolve => {
      await this.platform.ready();

      // Check, if the app has been launched due to a notification click:
      let tappedNotificationData:any = null;
      this.localNotifications.on('click', async (notification) => {
        tappedNotificationData = JSON.parse(notification.data);
      });

      console.log("--- Platform ready");
      await this.detectVersion();
      this.setupBackgroundMode();

      let task:Symbol = this.loadingStarted("Initializing app");

      // initialize db:
      await this.dbManager.initialize();
      await Setting.addDefaultsForMissingKeys();

      // switch location if required by notification tap:
      if (tappedNotificationData) {
        await this.changeLocationForTappedNotification(tappedNotificationData);
      }

      // find/create current user in the db:
      try {
        this.currentUser = <User> await User.findBy('usedForLogin', true);
      }
      catch(e) {
        const lastUserId = Setting.cached('lastUserId');
        if (lastUserId != '') {
          this.currentUser = <User> await User.findBy('id', lastUserId);
        }
        else {
          // create dummy user:
          this.currentUser = new User();
          this.currentUser.usedForLogin = true;
          await this.currentUser.save();
          // in case we're migrating from v0.7:
          await this.currentUser.assignMissingUserIds();
        }
      }

      // i18n:
      await this.setupI18n();

      // show server choice dialog if this hasn't happened before:
      let justChoseAServer = false;
      if (Setting.cached('serverChosen') != '1') {
        this.loadingDone(task);
        justChoseAServer = await this.showServerChoice();
        task = this.loadingStarted("Initializing app");
      }

      // when the host setting is changed, the db has to be cleaned:
      Setting.onChange('host', async() => {
        await this.syncDone();
        await User.clearUserRelatedData();
        await this.logout(false);
        await Setting.set('offlineMode', '0');
        // Trigger list refresh:
        this.events.publish('app:syncDone');
      });

      // when offline mode is changed, login/logout has to be performed:
      Setting.onChange('offlineMode', async(setting:Setting) => {
        if (setting.value != '1') {
          await this.autoLogin();
          console.log("Logged in after offline mode has been deactivated");
        }
        else if (this.currentUser.loggedIn) {
          this.clearSyncTimeout();
          await this.logout(true, false);
          console.log("Logged out as offline mode has been activated");
        }
      });

      // configure the daily reminder about expired/expiring products
      this.setupReminder();

      // allow access even before user login has completed (changes should sync later):
      resolve();
      this.loadingDone(task);

      await this.autoLogin(justChoseAServer);
    });
  }

  /**
   * switch to the first product entry's location after a notification has been tapped
   * @param  {any} tappedNotificationData notification data containing the first location id
   */
  private async changeLocationForTappedNotification(tappedNotificationData) {
    let currentLocation = <Location> await Location.getSelected();

    if (tappedNotificationData.firstLocationId != currentLocation.id) {
        try {
          let firstLocation = <Location> await Location.findBy('id', tappedNotificationData.firstLocationId);
          firstLocation.isSelected = true;
          await firstLocation.save();

          currentLocation.isSelected = false;
          await currentLocation.save();
        }
        catch(e) {
          console.error("Unable to switch location after notification has been tapped");
        }
    }
  }

  /**
   * Display the server choice dialog
   * @return {Promise<void>} resolved when the choice has been made
   */
  private showServerChoice():Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const modal = this.modalCtrl.create(AlternateServersChoiceModal);
      modal.onDidDismiss(async(serverSelected:boolean) => {
        await Setting.set('serverChosen', '1');
        resolve(serverSelected);
      });
      modal.present();
    });
  }

  /**
   * Perform automatic login, unless the 'offlineMode' setting is active or there is no user 'usedForLogin=true' in the db
   * If auto login fails, show the login form
   * @param {boolean} openRegistrationOnFailure open the registration form on failure (instead of the login form)
   */
  private async autoLogin(openRegistrationOnFailure = false) {
    this.autoLoginAndSyncDone = new Promise<void>(async resolve => {
      console.log("Versions: " + JSON.stringify(this.platform.versions()));
      let offlineModeStr:string = Setting.cached('offlineMode');
      let offlineMode:boolean = (offlineModeStr === '1');
      if (offlineMode) {
        resolve();
        return;
      }

      this.disableMenuPoint(ExpirySync.MenuPointId.login);
      this.disableMenuPoint(ExpirySync.MenuPointId.registration);

      try {
        var user:User = <User> await User.findBy('usedForLogin', true);
        user.login = user.userName ? user.userName : user.email;
        await user.authenticate();
        user.loggedIn = true;
        this.currentUser = user;
        await this.authDone();
      }
      catch(e) {
        let loginMenuPoint;
        let params:any = {};

        if (openRegistrationOnFailure) {
          loginMenuPoint = this.menuPoints.find(menuPoint => menuPoint.id == ExpirySync.MenuPointId.registration);
        }
        else {
          loginMenuPoint = this.menuPoints.find(menuPoint => menuPoint.id == ExpirySync.MenuPointId.login);
          if (user && user.login) {
            // We tried with a seemingly valid user -> display errors:
            params.error = e;
          }
        }
        this.openMenuPoint(loginMenuPoint, params);
      }

      resolve();
    });

    await this.autoLoginAndSyncDone;
  }

  /**
   * Enable/disable auth related menu points
   * Called when either login or registration have completed.
   * @param  {boolean} openLoginInstead true, if the user requested to open the login form
   */
  private async authDone(openLoginInstead?:boolean) {
    if (openLoginInstead) {
      this.openMenuPoint(this.menuPoints.find(menuPoint => {
        return menuPoint.id == ExpirySync.MenuPointId.login;
      }));
      return;
    }


    let offlineModeStr:string = Setting.cached('offlineMode');
    let offlineMode:boolean = (offlineModeStr === '1');

    if (!offlineMode && this.currentUser.loggedIn) {
      console.log("Login done", this.currentUser);
      this.disableMenuPoint(ExpirySync.MenuPointId.login);
      this.disableMenuPoint(ExpirySync.MenuPointId.registration);
      this.enableMenuPoint(ExpirySync.MenuPointId.logout);
      this.enableMenuPoint(ExpirySync.MenuPointId.synchronize);
      await this.mutexedSynchronize();
    }
    else {
      this.enableMenuPoint(ExpirySync.MenuPointId.login);
      this.enableMenuPoint(ExpirySync.MenuPointId.registration);
      this.disableMenuPoint(ExpirySync.MenuPointId.logout);
      this.disableMenuPoint(ExpirySync.MenuPointId.synchronize);
    }
  }

  /**
   * Sets the ngx-translate and momentjs locales
   */
  private async setupI18n() {
    let localeId = Setting.cached('localeId');
    if (localeId == '') {
      localeId = this.detectLocaleId();
      await Setting.set('localeId', localeId);
    }

    await this.switchLanguage(localeId);

    Setting.onChange('localeId', (setting:Setting) => {
      this.switchLanguage(setting.value);
    });
  }

  /**
   * Retrieve BCP 47 language code, that matches the device's default setting (navigator.language)
   * @return {string} required language code or 'en' if the app hasn't been translated into that language
   */
  private detectLocaleId():string {
    const langExists = (localeId:string):boolean => {
      return !(!Setting.settingConfig['localeId'].choices.find((choice) => (choice.key == localeId)));
    }

    let localeId = navigator.language;
    if (langExists(localeId)) {
      return localeId;
    }
    console.error(`Language '${localeId}' does not exist`);

    // not available -> try without the suffix:
    localeId = localeId.replace(/-.+$/, '');
    if (langExists(localeId)) {
      return localeId;
    }
    console.error(`Fallback language '${localeId}' does not exist either - falling back to 'en'`);

    return 'en';
  }

  /**
   * Set ngx-translate's language, moment's locale, and ionic's datepicker configs
   * @param  {string} localeId BCP 47 language code
   */
  private async switchLanguage(localeId:string) {
    this.translateSvc.use(localeId);
    moment.locale(localeId);

    let momentLocaleId = moment.locale();
    let momentLocale = moment.localeData(momentLocaleId);
    this.config.set('monthNames', momentLocale.months());
    this.config.set('monthShortNames', momentLocale.monthsShort());
    this.config.set('dayNames', momentLocale.weekdays());
    this.config.set('dayShortNames', momentLocale.weekdaysMin());
  }

  /**
   * Get a singleton instance
   * @return {ExpirySync} singleton instance
   */
  static getInstance():ExpirySync {
    return ExpirySync.appInstance;
  }

  /**
   * Adds a task to the loadingTasks stack, and show a loading dialog (if it's not already shown)
   * @param  {string} content    loader text
   * @param  {string} symbolName the task's ID (autogenerated, if not passed)
   * @return {Symbol}            the task's ID
   */
  loadingStarted(content?:string, symbolName?:string, forceReopening = false):Symbol {
    console.log("Loading started: " + content);
    if (content && !symbolName) {
      symbolName = content;
    }
    let task:Symbol = Symbol(symbolName);

    let options:LoadingOptions = {};
    if (content) {
      // options.content = content ;
      options.content = this.translateSvc.instant('Please wait...');
    }

    this.showLoadingOverlay = true;
    setTimeout(() => {
      if (this.showLoadingOverlay) {
        if (!this.loader) {
          this.loader = this.loadingCtrl.create(options);
          this.loader.present();
        }
        else if (forceReopening) {
          this.loader.dismiss();
          this.loader = this.loadingCtrl.create(options);
          this.loader.present();
        }
      }
    }, 200);

    this.loadingTasks.push(task);
    return task;
  }

  /**
   * Stop showing the loader, if all loading tasks have completed
   * @param  {Symbol} task the loader task's ID
   */
  loadingDone(task:Symbol) {
    // before really removing the loader, wait
    // a millisecond in case another loader pops
    // up in the same process (avoid flickering)
    setTimeout(() => {
      console.log("Loading done: " + task.toString());

      let i:number = this.loadingTasks.indexOf(task);
      if (i == -1) {
        throw "No such loader " + task.toString();
      }
      this.loadingTasks.splice(i, 1);

      if (this.loadingTasks.length == 0) {
        if (this.loader) {
          this.loader.dismiss();
          this.loader = null;
        }
        this.showLoadingOverlay = false;
        console.log("All loading done");
      }
    }, 1);
  }

  /**
   * Run action configured for a specific menu point
   * @param  {MenuPointConfig} menuPoint the menu point to run actions for
   */
  async openMenuPoint(menuPoint:MenuPointConfig, data?:any) {
    await this.syncDone();

    // opening any menu point might ensue local changes
    // -> set the promise, which 'mutexedSynchronize' will have to wait for:
    this.setLocalChangesDonePromise(new Promise<void>(resolve => {
      // menu point configured to call a method:
      if (menuPoint.method) {
        menuPoint.method.apply(this);
        resolve();
        return;
      }

      if (menuPoint.component) {
        // menu point configured to open a modal:
        if(menuPoint.modal) {
          const modal = this.modalCtrl.create(menuPoint.component, data);
          modal.onDidDismiss((...args: any[]) => {
            if (menuPoint.onDidDismiss) {
              menuPoint.onDidDismiss.apply(this, args);
            }
            resolve();
          });
          modal.present();
          return;
        }

        // menu point configured to open a page:
        this.nav.setRoot(menuPoint.component, data);
        resolve();
        return;
      }

      console.error("Menu point " + menuPoint.id + "doesn't do anyting");
    }));
  }

  async detectVersion() {
    if (typeof(cordova) != 'undefined' && (this.platform.is('android') || this.platform.is('ios'))) {
      console.log("Retrieving version");
      this.version = await cordova.getAppVersion.getVersionNumber();
      this.version += ' (Build: ' + await cordova.getAppVersion.getVersionCode() + ')';
      console.log("Version: " + this.version);
    }
  }
}
