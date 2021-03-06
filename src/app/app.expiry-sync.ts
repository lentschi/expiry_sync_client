import { Component, ViewEncapsulation } from '@angular/core';
import {
  Platform, ModalController, Events, LoadingController, MenuController,
} from '@ionic/angular';
import { Device } from '@ionic-native/device/ngx';
import { Setting, User, ProductEntry, Location } from './models';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from './app.expiry-sync-controller';
import * as moment from 'moment';
import 'moment/min/locales';
import { ProductEntriesPage } from './product-entries/product-entries';
import { UiHelper } from 'src/utils/ui-helper';
import { ApiServer } from 'src/utils/api-server';
import { DbManager } from 'src/utils/db-manager';
import { LocationsModal } from 'src/modal/locations/list/locations';
import { SettingsModal } from 'src/modal/settings/list/settings';
import { UserRegistrationModal } from 'src/modal/users/registration/user-registration';
import { UserLoginModal } from 'src/modal/users/login/user-login';
import { AboutModal } from 'src/modal/about/about';
import { LoadingOptions, OverlayEventDetail } from '@ionic/core';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';
import { AlternateServersChoiceModal } from 'src/modal/alternate-servers/choice/alternate-servers-choice';
import { SynchronizationHandler } from './services/synchronization-handler.service';
import * as _ from 'lodash';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { DateAdapter } from '@angular/material';
import { ImportExportModal } from 'src/modal/import-export/import-export';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

declare var window: any;
declare var cordova: any;

/**
 * The main menu's menu points
 */
enum MenuPointId {
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
  importExport,
  about
}

/**
 * Menu point configuration
 * @interface
 */
interface MenuPointConfig {
  id: number;
  component?: any;
  method?: Function;
  modal?: boolean;
  onDidDismiss?: Function;
  disabled?: boolean;
  skipAcquiringLocalSyncMutex?: boolean;
 }

/**
 * The app's 'main class'
 */
@Component({
  selector: 'app-root',
  templateUrl: 'app.expiry-sync.html',
  styleUrls: ['app.expiry-sync.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ExpirySync extends ExpirySyncController {
  /**
   * Fallback version to display if determining the real version fails
   */
  static readonly FALLBACK_APP_VERSION = '2.0 web';
  static readonly API_VERSION = 3;
  static readonly MAX_LOG_CACHE_ENTRIES = 100;

  /**
   * Singleton instance
   */
  private static appInstance: ExpirySync;

  /**
   * Resolved when the app has been initialized
   */
  static readyPromise: Promise<void>;

  /**
   * The main menu's menu points
   */
  public static MenuPointId = MenuPointId;

  /**
   * The app's version
   */
  version = ExpirySync.FALLBACK_APP_VERSION;


  rootPage = ProductEntriesPage;
  curPage = ProductEntriesPage;

  /**
   * The app's current state (active/not active)
   * @member {boolean}
   */
  private active = true;

  /**
   * The active user
   * They don't have to be logged on the server - but even in offline mode there needs to be an anonymous currenUser to store
   * foreign keys (might be useful for a later sync)
   * @type {User}
   */
  currentUser: User;

  /**
   * List of menu points to be shown in the main menu
   */
  menuPoints: Array<MenuPointConfig>;

  /**
   * The product entries page
   */
  entriesList: ProductEntriesPage;

  /**
   * Js timeout ID of the synchronization timeout
   */
  private syncTimeout: any;

  /**
   * Loader instance
   */
  private loader: HTMLIonLoadingElement;

  /**
   * The loader dialog's stack
   */
  private loadingTasks: Array<Symbol> = [];


  /**
   * The main menu's menu points
   */
  public menuPointIds = MenuPointId;

  /**
   * Called when the back button is pressed while the loader is active
   */
  loaderBackButtonCallback: Function;

  backButtonOverrideCallback: Function;

  /**
   * If true, the app will exit right after showing the reminder
   */
  private moveToBackgroundAfterReminder = false;

  /**
   * resolved when auto login and initial sync have finished (no matter if successful or not)
   */
  private autoLoginAndSyncDone: Promise<void>;

  preventNextBackButton = false;

  private languageInitialized: boolean;

  logCache: {level: 'log' | 'info' | 'warn' | 'error', data: any[]}[] = [];

  /**
   * @return {Promise}   resolved when the app has been initialized
   */
  static ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Get a singleton instance
   * @return {ExpirySync} singleton instance
   */
  static getInstance(): ExpirySync {
    return ExpirySync.appInstance;
  }

  /**
   * Initializes the app's db locale and menu
   */
  constructor(
    private platform: Platform,
    translate: TranslateService,
    private menuCtrl: MenuController,
    private modalCtrl: ModalController,
    private dbManager: DbManager,
    private synchronizationHandler: SynchronizationHandler,
    public events: Events,
    private loadingCtrl: LoadingController,
    private localNotifications: LocalNotifications,
    private uiHelper: UiHelper,
    public device: Device,
    private backgroundMode: BackgroundMode,
    private dateAdapter: DateAdapter<any>,
    private androidPermissions: AndroidPermissions
  ) {
    super(translate);

    const originalConsole = window.console;
    const newConsole: any = { };
    for (const key of Object.keys(originalConsole)) {
      const value = originalConsole[key];
      if (['info', 'warn', 'error', 'log'].includes(key)) {
        newConsole[key] = (...args) => {
          originalConsole[key](args);
          if (this.logCache.length > ExpirySync.MAX_LOG_CACHE_ENTRIES) {
            this.logCache.splice(0, 1);
          }
          this.logCache.push({
            level: <'log' | 'info' | 'warn' | 'error'> key,
            data: args
          });
        };
      } else {
        newConsole[key] = value;
      }
    }
    window.console = newConsole;

    ExpirySync.appInstance = this;
    this.initializeApp();

    // used for an example of ngFor and navigation
    this.menuPoints = [
      { id: this.menuPointIds.locationList, component: LocationsModal, modal: true },
      { id: this.menuPointIds.settings, component: SettingsModal, modal: true },
      { id: this.menuPointIds.selectAll, disabled: true },
      { id: this.menuPointIds.deselectAll, disabled: true },
      { id: this.menuPointIds.filterAllUsers, disabled: true },
      { id: this.menuPointIds.filterCurrentUser, disabled: true },
      { id: this.menuPointIds.deselectAll, disabled: true },
      { id: this.menuPointIds.synchronize, method: this.synchronizeTapped, disabled: true },
      {
        id: this.menuPointIds.registration, component: UserRegistrationModal, modal: true, onDidDismiss: (openLoginInstead?: boolean) =>
          this.authDone(openLoginInstead)
      },
      {
        id: this.menuPointIds.login, component: UserLoginModal, modal: true, onDidDismiss: () => this.authDone(false)
      },
      { id: this.menuPointIds.recipeSearch, disabled: true },
      { id: this.menuPointIds.moveEntriesToAnotherLocation, disabled: true },
      { id: this.menuPointIds.logout, method: this.logout, disabled: true },
      { id: this.menuPointIds.importExport, component: ImportExportModal, modal: true, skipAcquiringLocalSyncMutex: true },
      { id: this.menuPointIds.about, component: AboutModal, modal: true }
    ];
  }


  /**
   * Synchronize has been tapped in the main menu
   */
  async synchronizeTapped() {
    const task = this.loadingStarted('Synchronizing');
    await this.synchronize(true);
    this.loadingDone(task);
  }

  /**
   * Exit menu button has been tapped in the main menu
   */
  exitTapped() {
    window.navigator.app.exit();
  }

  /**
   * Synchronize product entries with the server, waiting for any ongoing sync or local changes to complete first
   * @param  {number}        productEntryUpdateId ID of a product entry that has just been updated locally (won't be pulled)
   * @return {Promise<void>}                      resolved after sync has finished (either successfully or with an error)
   */
  async synchronize(requestedManually = false, skipLocalChangesMutexCheck = false): Promise<void> {
    try {
      await this.synchronizationHandler.mutexedSynchronize(skipLocalChangesMutexCheck);
    } catch (e) {
      console.error('Error during sync: ', e);
      if (requestedManually) {
        this.uiHelper.errorToast(
          await this.translate('We have trouble connecting to the server you chose. Are you connected to the internet?')
        );
      }
    }

    this.events.publish('app:syncDone');
    console.log('SYNC: Setting sync timeout');
    this.setSyncTimeout();
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

    // Abort if the app has been deactivated:
    if (this.device.platform && !this.active) {
      return;
    }

    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      if (this.currentUser && this.currentUser.loggedIn) {
        this.synchronize();
      }
    }, parseInt(Setting.cached('syncInterval'), 10));
  }

  /**
   * Log the current user out
   * @param  {boolean} remotely also do a logout API call (default: true)
   */
  async logout(remotely = true, forgetPassword = true) {
    const task = this.loadingStarted('Logout');

    await this.currentUser.logout(remotely, forgetPassword);
    this.disableMenuPoint(ExpirySync.MenuPointId.logout);
    this.disableMenuPoint(ExpirySync.MenuPointId.synchronize);
    this.enableMenuPoint(ExpirySync.MenuPointId.login);
    this.enableMenuPoint(ExpirySync.MenuPointId.registration);
    this.loadingDone(task);
    console.log('Successfully logged out');
    this.uiHelper.toast('You have been logged out');

    if (Setting.cached('offlineMode') !== '1') {
      this.openMenuPoint(this.menuPoints.find((menuPoint: MenuPointConfig) => {
        return menuPoint.id === ExpirySync.MenuPointId.login;
      }));
    }
  }

  get runningInBrowser(): boolean {
    return this.uiHelper.runningInBrowser;
  }

  /**
  * Enable/disable a main menu point
  * @param  {number}          menuPointId the menu point's ID
  * @param  {boolean}         enable      true -> enable / false -> disable (default: enable)
  * @return {MenuPointConfig}             the enabled/disabled menu point's config
  *
  * @see MenuPointId
  */
  enableMenuPoint(menuPointId: number, enable?: boolean): MenuPointConfig {
    const menuPoint: MenuPointConfig = this.menuPoints.find((curMenuPoint: MenuPointConfig) => {
      return (curMenuPoint.id === menuPointId);
    });

    if (!menuPoint) {
      throw new Error('Invalid menuPoint id');
    }

    menuPoint.disabled = (enable !== undefined) ? !enable : false;
    return menuPoint;
  }

  /**
   * @see ExpirySync.enableMenuPoint
   */
  disableMenuPoint(menuPointId: number) {
    this.enableMenuPoint(menuPointId, false);
  }

  /**
   * stop/resume auto sync when entering/leaving background mode
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

  private handleBackButton() {
    this.platform.backButton.subscribeWithPriority(9999, async () => {
      if (this.preventNextBackButton) {
        this.preventNextBackButton = false;
        return;
      }

      if (this.backButtonOverrideCallback) {
        this.backButtonOverrideCallback();
        return;
      }

      // Don't do anything while a loader is open:
      const loader = await this.loadingCtrl.getTop();
      if (loader) {
        if (this.loaderBackButtonCallback) {
          this.loaderBackButtonCallback();
        }
        return;
      }

      if (await this.closeAnyOverlay()) {
        return;
      }

      window.navigator.app.exitApp();
    });
  }

  /**
   * Close any modal or the main menu
   * @returns true, if something needed closing, else false
   */
  private async closeAnyOverlay(): Promise<boolean> {
    // Close modals, or remove toasts/overlays if any:
    const modal = await this.modalCtrl.getTop();
    if (modal) {
      await modal.dismiss();
      return true;
    }

    // Close menu if open:
    if (await this.menuCtrl.isOpen() && await this.menuCtrl.close()) {
      return true;
    }

    return false;
  }

  private get isAndroid10OrGreater(): boolean {
    if (this.device.platform.toLowerCase() !== 'android') {
      return false;
    }

    const version = this.device.version;
    if (!version) {
      return false;
    }

    const versionParts = version.split('.');
    if (versionParts.length < 1) {
      return false;
    }

    return parseInt(versionParts[0], 10) >= 10;
  }

  private async requestWakeupPermissions(): Promise<boolean> {
    if (!this.isAndroid10OrGreater) {
      return true;
    }

    await new Promise(resolve => setTimeout(() => resolve(), 1000));
    if (this.loader) {
      await this.loader.dismiss();
    }

    if (Setting.cached('askedForOverlaysPermission') !== '1') {
      await Setting.set('askedForOverlaysPermission', '1');
      const question = await this.translate('Do you want to show a notification when products expire?'
        + ' (If you choose yes, you will have to grant ExpirySync the necessary permissions on the next screen.)');
      if (!await this.uiHelper.confirm(question)) {
        return false;
      }
    }

    const granted = await new Promise<boolean>(resolve => {
      window.wakeuptimer.requestPermissions(response => {
        resolve(response.canDrawOverlays);
      }, () => resolve(false));
    });

    if (this.loader) {
      await this.loader.present();
    }

    return granted;
  }


  /**
   * Sets up the daily reminder
   */
  private async setupReminder() {
    await this.scheduleReminder();
    Setting.onChange('reminderTime').subscribe(() => {
      this.scheduleReminder();
    });

    Setting.onChange('showReminder').subscribe(setting => {
      if (setting.value === '1') {
        this.scheduleReminder();
      }
    });

    // handle the wakeup plugin's events:
    if (this.platform.is('cordova')) {
      // Not using @ionic-native/web-intent because of this bug:
      // https://github.com/ionic-team/ionic-native/issues/1609
      window.plugins.intentShim.onIntent(async intent => {
        console.log('New intent received during runtime: ' + JSON.stringify(intent));
        if (typeof (intent.extras) !== 'undefined'
          && typeof ((<any>intent.extras).wakeup) !== 'undefined'
          && (<any>intent.extras).wakeup) {
          console.log('Intent looks like a wakeup -> show reminder (if required) and moving to background');
          // the app has been running and a wakeup occurred
          // -> show the reminder:
          await this.showReminder();
          if (this.moveToBackgroundAfterReminder) {
            // the app was in background when the wakeup occurred
            // -> move it back there again
            this.moveToBackgroundAfterReminder = false;
            this.backgroundMode.moveToBackground();
          }
        }
      });

      let intent: any;

      try {
        intent = await new Promise((resolve, reject) => {
          window.plugins.intentShim.getIntent(result => resolve(result), error => reject(error));
        });
      } catch (e) {
        console.error('Failed to get extra', e);
      }

      if (intent.extras && intent.extras.wakeup) {
        console.log('Wakeup intent received at startup -> showing reminder (if required) & exiting');
        // the app has not been running and a wakeup occurred
        // -> show the reminder and then exit the app again:

        await this.showReminder();
        await new Promise(resolve => setTimeout(() => resolve(), 3000));
        window.navigator.app.exitApp();
      } else {
        console.log('Normal startup (no wakeup intent received) - leaving the app open and in the foreground');
      }
    }
  }

  /**
   * Schedules a reminder to be trigger at the time configured by the 'reminderTime' setting
   * @see ExpirySync.showReminder
   */
  private async scheduleReminder(performWakeupPermissionCheck = true) {
    if (typeof (window.wakeuptimer) === 'undefined') {
      console.error('Cordova plugin wakeuptimer missing - no reminder scheduled');
      return;
    }

    const showReminderSetting = Setting.cached('showReminder');
    if (showReminderSetting !== '1') {
      return;
    }

    const reminderTimeSetting = Setting.cached('reminderTime');
    const md = reminderTimeSetting.match(/([0-9]{2}):([0-9]{2})/);
    if (!md || md.length !== 3) {
      console.error('Invalid reminder time setting: ' + reminderTimeSetting);
      return;
    }

    if (performWakeupPermissionCheck && !(await this.requestWakeupPermissions())) {
      await Setting.set('showReminder', '0');
      return;
    }

    console.log('Scheduling wakeup call');

    window.wakeuptimer.wakeup((p: any) => {
      if (typeof (p.type) !== 'undefined' && p.type === 'wakeup' && !this.active) {
        this.moveToBackgroundAfterReminder = true;
      }
    },
      () => {
        console.error('Wakeup error');
      },
      {
        alarms: [{
          type: 'onetime',
          time: { hour: md[1], minute: md[2] },
        }]
      });
  }

  /**
   * Immediately show a local notification about expiring products (if any)
   */
  private async showReminder() {
    console.log('Showing reminder');
    if (this.autoLoginAndSyncDone) {
      await this.autoLoginAndSyncDone;
    }

    this.localNotifications.cancelAll();

    const showReminder = Setting.cached('showReminder') === '1';
    const reminderWeekdaysSetting = Setting.cached('reminderWeekdays');
    const reminderWeekdays: number[] = reminderWeekdaysSetting ? JSON.parse(reminderWeekdaysSetting) : [];

    if (!showReminder || !reminderWeekdays.includes(moment().isoWeekday())) {
      return;
    }

    let productEntries: Array<ProductEntry> = <Array<ProductEntry>>await ProductEntry
      .all()
      .order('expirationDate')
      .filter('deletedAt', '=', null)
      .prefetch('article')
      .prefetch('location')
      .list();

    productEntries = productEntries.filter((productEntry: ProductEntry) => {
      return moment(productEntry.expirationDate).subtract(Setting.cached('daysBeforeMedium'), 'days').toDate() < new Date();
    });


    if (productEntries.length > 0) {
      let text = `${productEntries[0].amount}x ${productEntries[0].article.name}`;
      if (productEntries.length > 1) {
        text += ' ' + await this.pluralTranslate('and other articles', productEntries.length - 1);
      }

      let startupLocationId = productEntries[0].location.id;
      for (const entry of productEntries) {
        if (entry.location.id !== startupLocationId) {
          startupLocationId = null;
          break;
        }
      }

      const notificationConf = {
        id: 1,
        title: await this.translate('Eat now:'),
        icon: 'res://icon',
        smallIcon: 'res://icon',
        text: text,
        led: 'FFFFFF',
        data: { startupLocationId }
      };
      Setting.set('notificationTappedLocationId', startupLocationId || 'all');
      console.log('Displaying notification: ' + JSON.stringify(notificationConf));
      this.localNotifications.schedule(notificationConf);

      await Setting.set('lastReminder', ApiServer.dateToHttpDate(new Date()));
    }

    // setup the reminder due in one day:
    this.scheduleReminder(false);
  }


  /**
   * Initialize db & locale; trigger auto login and auto synchronization ...
   */
  private initializeApp() {
    window.skipLocalNotificationReady = true;

    ExpirySync.readyPromise = new Promise<void>(async resolve => {
      await this.platform.ready();
      if (this.platform.is('cordova')) {
        this.localNotifications.fireQueuedEvents();
      }

      console.log('--- Platform ready');
      await this.detectVersion();
      this.setupBackgroundMode();
      this.handleBackButton();


      // initialize db:
      let task: Symbol;
      try {
        task = this.loadingStarted('Initializing database');
        await this.dbManager.initialize(this.uiHelper.runningInBrowser);
      } catch (e) {
        console.error('DB ini failed with error: ', e);
        alert('Unexpected error: Database initialization failed - If the problem persists, '
          + 'please try to clear your site data and reload the page!');
        return;
      } finally {
        this.loadingDone(task);
      }
      this.adeptPlatformDependingSettings();
      await this.initializeFromDb(resolve);
    });
  }

  async initializeFromDb(resolve: () => void) {
    let task: Symbol = this.loadingStarted('Initializing app');
    await Setting.addDefaultsForMissingKeys();

    // switch location if required by notification tap:
    if (this.platform.is('cordova')) {
      this.localNotifications.on('click').subscribe(async (notification) => {
        await this.changeLocationForTappedNotification(notification.data.startupLocationId, true);
      });

      console.log('Plugin.notification', _.get(cordova, 'plugins.notification'));
      if (_.get(cordova, 'plugins.notification.local.launchDetails.action') === 'click') {
        const locationId = Setting.cached('notificationTappedLocationId');
        if (locationId) {
          await this.changeLocationForTappedNotification(locationId === 'all' ? null : locationId);
        }
      }
    }

    // find/create current user in the db:
    try {
      this.currentUser = <User>await User.findBy('usedForLogin', true);
    } catch (e) {
      const lastUserId = Setting.cached('lastUserId');
      if (lastUserId !== '') {
        this.currentUser = <User>await User.findBy('id', lastUserId);
      } else {
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

    // now show the loader in the correct languange:
    this.loadingDone(task);
    task = this.loadingStarted('Initializing app');

    // show server choice dialog if this hasn't happened before:
    let justChoseAServer = false;
    if (Setting.cached('serverChosen') !== '1') {
      this.loadingDone(task);
      justChoseAServer = await this.showServerChoice();
      task = this.loadingStarted('Initializing app');
    }

    // when the host setting is changed, the db has to be cleaned:
    Setting.onChange('host').subscribe(async () => {
      await this.closeAnyOverlay();
      await this.synchronizationHandler.syncMutex.acquire();
      await User.clearUserRelatedData();
      await this.logout(false);
      await Setting.set('offlineMode', '0');
      this.synchronizationHandler.syncMutex.release();
      // Trigger list refresh:
      this.events.publish('app:syncDone');
    });

    // when offline mode is changed, login/logout has to be performed:
    Setting.onChange('offlineMode').subscribe(async (setting: Setting) => {
      await this.closeAnyOverlay();
      if (setting.value !== '1') {
        await this.autoLogin();
        console.log('Logged in after offline mode has been deactivated');
      } else if (this.currentUser.loggedIn) {
        this.clearSyncTimeout();
        await this.logout(true, false);
        console.log('Logged out as offline mode has been activated');
      }
    });

    // configure the daily reminder about expired/expiring products
    await this.setupReminder();

    // allow access even before user login has completed (changes should sync later):
    resolve();
    this.loadingDone(task);

    await this.autoLogin(justChoseAServer);
  }

  private adeptPlatformDependingSettings() {
    if (this.uiHelper.runningInBrowser) {
      // -> choose quaggaJs as default barcode engine and hide the selection from settings:
      Setting.settingConfig.barcodeEngine = { default: 'quaggaJs' };
    }
  }

  /**
   * switch to the first product entry's location after a notification has been tapped
   * @param  {any} tappedNotificationData notification data containing the first location id
   */
  private async changeLocationForTappedNotification(startupLocationId: string, emitEvent = false) {
    await this.closeAnyOverlay();

    const currentLocation = <Location>await Location.getSelected();
    let currentLocationId: string = null;
    if (currentLocation) {
      currentLocationId = currentLocation.id;
    }

    if (startupLocationId !== currentLocationId) {
      try {
        if (startupLocationId) {
          const startupLocation = <Location>await Location.findBy('id', startupLocationId);
          startupLocation.isSelected = true;
          await startupLocation.save();
        }

        if (currentLocation) {
          currentLocation.isSelected = false;
          await currentLocation.save();
        }

        if (emitEvent) {
          this.events.publish('app:localeChangedByNotificationTap');
        }
      } catch (e) {
        console.error('Unable to switch location after notification has been tapped');
      }
    }
  }

  /**
   * Display the server choice dialog
   * @return {Promise<void>} resolved when the choice has been made
   */
  private showServerChoice(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const modal = await this.modalCtrl.create({ component: AlternateServersChoiceModal });
      modal.onDidDismiss().then(async (event: OverlayEventDetail<boolean>) => {
        const serverSelected = event.data;
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
      const offlineModeStr: string = Setting.cached('offlineMode');
      const offlineMode: boolean = (offlineModeStr === '1');
      if (offlineMode) {
        resolve();
        return;
      }

      this.disableMenuPoint(ExpirySync.MenuPointId.login);
      this.disableMenuPoint(ExpirySync.MenuPointId.registration);

      let user: User;
      try {
        user = <User>await User.findBy('usedForLogin', true);
        user.login = user.userName ? user.userName : user.email;
        await user.authenticate();
        user.loggedIn = true;
        this.currentUser = user;
        await this.authDone();
      } catch (e) {
        let loginMenuPoint;
        const params: any = {};

        if (openRegistrationOnFailure || !user || !user.login) {
          loginMenuPoint = this.menuPoints.find(menuPoint => menuPoint.id === ExpirySync.MenuPointId.registration);
        } else {
          loginMenuPoint = this.menuPoints.find(menuPoint => menuPoint.id === ExpirySync.MenuPointId.login);
          // We tried with a seemingly valid user -> display errors:
          params.error = e;
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
  private async authDone(openLoginInstead?: boolean) {
    if (openLoginInstead) {
      this.openMenuPoint(this.menuPoints.find(menuPoint => {
        return menuPoint.id === ExpirySync.MenuPointId.login;
      }));
      return;
    }


    const offlineModeStr: string = Setting.cached('offlineMode');
    const offlineMode: boolean = (offlineModeStr === '1');

    if (!offlineMode && this.currentUser.loggedIn) {
      console.log('Login done', this.currentUser);
      this.disableMenuPoint(ExpirySync.MenuPointId.login);
      this.disableMenuPoint(ExpirySync.MenuPointId.registration);
      this.enableMenuPoint(ExpirySync.MenuPointId.logout);
      this.enableMenuPoint(ExpirySync.MenuPointId.synchronize);
      await this.synchronize();
    } else {
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
    if (localeId === '') {
      localeId = this.detectLocaleId();
      await Setting.set('localeId', localeId);
    }

    await this.switchLanguage(localeId, (Setting.cached('useSystemLocaleForDates') === '1') ? navigator.language : localeId);

    Setting.onChange('localeId').subscribe(setting => {
      this.switchLanguage(setting.value, (Setting.cached('useSystemLocaleForDates') === '1') ? navigator.language : setting.value);
    });

    Setting.onChange('useSystemLocaleForDates').subscribe(setting => {
      localeId = Setting.cached('localeId');
      this.switchLanguage(localeId, (setting.value === '1') ? navigator.language : localeId);
    });
  }

  /**
   * Retrieve BCP 47 language code, that matches the device's default setting (navigator.language)
   * @return {string} required language code or 'en' if the app hasn't been translated into that language
   */
  private detectLocaleId(): string {
    const langExists = (currentLocaleId: string): boolean => {
      return !(!Setting.settingConfig['localeId'].choices.find((choice) => (choice.key === currentLocaleId)));
    };

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
   * @param localeId BCP 47 language code
   * @param dateFormatLocaleId language code for the date format
   */
  private async switchLanguage(localeId: string, dateFormatLocaleId: string) {
    await this.translateSvc.use(localeId).toPromise();
    moment.locale(dateFormatLocaleId);
    this.dateAdapter.setLocale(dateFormatLocaleId);
    this.events.publish('app:timeLocaleAdjusted');
    Setting.setLanguageDependentLabels();
    this.languageInitialized = true;
  }

  /**
   * Adds a task to the loadingTasks stack, and show a loading dialog (if it's not already shown)
   * @param  {string} content    loader text
   * @param  {string} symbolName the task's ID (autogenerated, if not passed)
   * @return {Symbol}            the task's ID
   */
  loadingStarted(content?: string, symbolName?: string, forceReopening = false): Symbol {
    console.log('Loading started: ' + content);
    if (content && !symbolName) {
      symbolName = content;
    }
    const task: Symbol = Symbol(symbolName);

    const options: LoadingOptions = {};
    if (content) {
      // options.content = content ;
      options.message = this.languageInitialized ? this.translateSvc.instant('Please wait...') : '';
    }

    if (this.loader && forceReopening) {
      this.loader.dismiss();
      this.loader = null;
    }

    this.loadingTasks.push(task);
    if (!this.loader) {
      this.loadingCtrl.create(options).then(async (loader) => {
        if (!this.loadingTasks.includes(task)) {
          return;
        }
        await loader.present();
        if (!this.loadingTasks.includes(task)) {
          loader.dismiss();
          return;
        }

        this.loader = loader;
      });
    }

    return task;
  }

  /**
   * Stop showing the loader, if all loading tasks have completed
   * @param  {Symbol} task the loader task's ID
   */
  loadingDone(task: Symbol) {
    // before really removing the loader, wait
    // a millisecond in case another loader pops
    // up in the same process (avoid flickering)
    setTimeout(() => {
      console.log('Loading done: ' + task.toString());

      const i: number = this.loadingTasks.indexOf(task);
      if (i === -1) {
        throw new Error('No such loader ' + task.toString());
      }
      this.loadingTasks.splice(i, 1);

      if (this.loadingTasks.length === 0) {
        if (this.loader) {
          this.loader.dismiss();
          this.loader = null;
        }
        console.log('All loading done');
      } else {
        console.log('Loading still in progress', this.loadingTasks.map(currentTask => currentTask.toString()).join(', '));
      }
    }, 1);
  }

  /**
   * Run action configured for a specific menu point
   * @param  {MenuPointConfig} menuPoint the menu point to run actions for
   */
  async openMenuPoint(menuPoint: MenuPointConfig, data?: any) {
    // opening any menu point might ensue local changes
    // -> set the promise, which 'mutexedSynchronize' will have to wait for:
    // menu point configured to call a method:
    if (!menuPoint.skipAcquiringLocalSyncMutex) {
      await this.synchronizationHandler.acquireLocalChangesMutex();
    }

    if (menuPoint.method) {
      menuPoint.method.apply(this);
      if (!menuPoint.skipAcquiringLocalSyncMutex) {
        this.synchronizationHandler.localChangesMutex.release();
      }
      return;
    }

    if (menuPoint.component) {
      // menu point configured to open a modal:
      if (menuPoint.modal) {
        const modal = await this.modalCtrl.create({ component: menuPoint.component, componentProps: data });
        modal.onDidDismiss().then((event) => {
          if (menuPoint.onDidDismiss) {
            const args = [];
            if (typeof event.data !== 'undefined') {
              args.push(event.data);
            }
            menuPoint.onDidDismiss.apply(this, args);
          }
          if (!menuPoint.skipAcquiringLocalSyncMutex) {
            this.synchronizationHandler.localChangesMutex.release();
          }
        });
        modal.present();
        return;
      }

      // menu point configured to open a page:
      // TODO: currently not implemented
    }

    console.error('Menu point ' + menuPoint.id + 'doesn\'t do anyting');
    this.synchronizationHandler.localChangesMutex.release();
  }

  async detectVersion() {
    if (!this.uiHelper.runningInBrowser) {
      console.log('Retrieving version');
      this.version = await cordova.getAppVersion.getVersionNumber();
      this.version += ' (Build: ' + await cordova.getAppVersion.getVersionCode() + ')';
      console.log('Version: ' + this.version);
    }
  }
}
