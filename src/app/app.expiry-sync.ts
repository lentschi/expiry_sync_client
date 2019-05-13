import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import {
  Platform, ModalController, Events, LoadingController, MenuController,
  IonNav,
  Config,
} from '@ionic/angular';
import { Device } from '@ionic-native/device/ngx';
import { Setting, User, ProductEntry, Location, ProductEntrySyncList } from './models';
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
  about
}

/**
 * Menu point configuration
 * @interface
 */
interface MenuPointConfig { id: number; component?: any; method?: Function; modal?: boolean; onDidDismiss?: Function; disabled?: boolean; }

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
  static readonly FALLBACK_APP_VERSION = '1.4 web';
  static readonly API_VERSION = 3;

  /**
   * Singleton instance
   */
  private static appInstance: ExpirySync;

  /**
   * Resolved when the app has been initialized
   */
  private static readyPromise: Promise<{}>;

  /**
   * The main menu's menu points
   */
  public static MenuPointId = MenuPointId;

  /**
   * The app's version
   */
  version = ExpirySync.FALLBACK_APP_VERSION;

  /**
   * Reference to ion-nav
   */
  @ViewChild(IonNav) nav: IonNav;

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

  /**
   * If true, the app will exit right after showing the reminder
   */
  private exitAfterReminder = false;

  /**
   * resolved when auto login and initial sync have finished (no matter if successful or not)
   */
  private autoLoginAndSyncDone: Promise<void>;

  preventNextBackButton = false;

  /**
   * @return {Promise}   resolved when the app has been initialized
   */
  static ready(): Promise<{}> {
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
    private uiHelper: UiHelper, public device: Device
  ) {
    super(translate);
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
        id: this.menuPointIds.registration, component: UserRegistrationModal, modal: true, onDidDismiss: (openLoginInstead?: boolean) => {
          this.authDone(openLoginInstead);
        }
      },
      {
        id: this.menuPointIds.login, component: UserLoginModal, modal: true, onDidDismiss: () => {
          this.authDone(false);
        }
      },
      { id: this.menuPointIds.recipeSearch, disabled: true },
      { id: this.menuPointIds.moveEntriesToAnotherLocation, disabled: true },
      { id: this.menuPointIds.logout, method: this.logout, disabled: true },
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
  async synchronize(requestedManually = false): Promise<void> {
    try {
      await this.synchronizationHandler.mutexedSynchronize();
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
    // this.setSyncTimeout();  // TODO-upgrade
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
    // TODO: UPGRADE: Check if this works:
    this.platform.backButton.subscribe(async (e) => {
      if (this.preventNextBackButton) {
        this.preventNextBackButton = false;
        return;
      }
      if (this.nav.canGoBack()) {
        this.nav.pop();
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

      // Close modals, or remove toasts/overlays if any:
      const modal = await this.modalCtrl.getTop();
      if (modal) {
        return modal.dismiss();
      }

      // Close menu if open:
      if (this.menuCtrl.isOpen()) {
        this.menuCtrl.close();
        return;
      }

      window.navigator.app.exit();
    });
  }

  /**
   * Sets up the daily reminder
   */
  private setupReminder() {
    this.scheduleReminder();
    Setting.onChange('reminderTime', (setting: Setting) => {
      this.scheduleReminder();
    });

    // handle the wakeup plugin's events:
    if (typeof (window.plugins) !== 'undefined') {
      console.log('Intent plugin found');
      window.plugins.intent.setNewIntentHandler(async intent => {
        console.log('New intent received: ' + JSON.stringify(intent));
        if (typeof (intent.extras) !== 'undefined' && typeof (intent.extras.wakeup) !== 'undefined' && intent.extras.wakeup) {
          // the app has been running and a wakeup occurred
          // -> show the reminder:
          await this.showReminder();
          if (this.exitAfterReminder) {
            // the app was in background when the wakeup occurred
            // -> simply exit the app (backgroundMode's moveToBackground would be better, but has some issues):
            window.navigator.app.exitApp();
          }
        }
      });

      window.plugins.intent.getCordovaIntent(async intent => {
        console.log('Inital intent: ' + JSON.stringify(intent) + ', ' + JSON.stringify(!!window.navigator)
          + ', ' + JSON.stringify(!!window.navigator.app) + ', ' + JSON.stringify(!!window.navigator.app.exitApp));
        if (typeof (intent.extras) !== 'undefined' && typeof (intent.extras.wakeup) !== 'undefined' && intent.extras.wakeup) {
          // the app has not been running and a wakeup occurred
          // -> show the reminder and then exit the app again:
          await this.showReminder();
          window.navigator.app.exitApp();
        }
      }, () => {
        console.error('unknown cdvintent error');
      });
    } else {
      console.log('No intent plugin');
    }
  }

  /**
   * Schedules a reminder to be trigger at the time configured by the 'reminderTime' setting
   * @see ExpirySync.showReminder
   */
  private scheduleReminder() {
    if (typeof (window.wakeuptimer) === 'undefined') {
      console.error('Cordova plugin wakeuptimer missing - no reminder scheduled');
      return;
    }

    const reminderTimeSetting = Setting.cached('reminderTime');
    const md = reminderTimeSetting.match(/([0-9]{2}):([0-9]{2})/);
    if (!md || md.length !== 3) {
      console.error('Invalid reminder time setting: ' + reminderTimeSetting);
      return;
    }

    window.wakeuptimer.wakeup((p: any) => {
      if (typeof (p.type) !== 'undefined' && p.type === 'wakeup' && !this.active) {
        this.exitAfterReminder = true;
      }
    },
      (error) => {
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
    let productEntries: Array<ProductEntry> = <Array<ProductEntry>>await ProductEntry
      .all()
      .order('expirationDate', true)
      .prefetch('article')
      .list();

    productEntries = productEntries.filter((productEntry: ProductEntry) => {
      return moment(productEntry.expirationDate).subtract(Setting.cached('daysBeforeMedium'), 'days').toDate() < new Date();
    });


    if (productEntries.length > 0) {
      let text = `${productEntries[0].amount}x ${productEntries[0].article.name}`;
      if (productEntries.length > 1) {
        text += ' ' + await this.pluralTranslate('and other articles', productEntries.length - 1);
      }

      let startupLocationId = productEntries[0].locationId;
      for (const entry of productEntries) {
        if (entry.locationId !== startupLocationId) {
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
      console.log('Displaying notification: ', notificationConf);
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
      let tappedNotificationData: any = null;
      this.localNotifications.on('click').subscribe(async (notification) => {
        tappedNotificationData = JSON.parse(notification.data);
      });

      console.log('--- Platform ready');
      await this.detectVersion();
      this.setupBackgroundMode();
      this.handleBackButton();

      let task: Symbol = this.loadingStarted('Initializing app');

      // initialize db:
      try {
        await this.dbManager.initialize(this.runningInBrowser);
      } catch (e) {
        console.error('DB ini failed with error: ', e);
        alert('Database initialization failed - Ensure that your platform supports WebSQL or SQLite!');
        return;
      }
      this.adeptPlatformDependingSettings();
      await Setting.addDefaultsForMissingKeys();

      // switch location if required by notification tap:
      if (tappedNotificationData) {
        await this.changeLocationForTappedNotification(tappedNotificationData);
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

      // show server choice dialog if this hasn't happened before:
      let justChoseAServer = false;
      if (Setting.cached('serverChosen') !== '1') {
        this.loadingDone(task);
        justChoseAServer = await this.showServerChoice();
        task = this.loadingStarted('Initializing app');
      }

      // when the host setting is changed, the db has to be cleaned:
      Setting.onChange('host', async () => {
        await this.synchronizationHandler.syncMutex.acquire();
        await User.clearUserRelatedData();
        await this.logout(false);
        await Setting.set('offlineMode', '0');
        this.synchronizationHandler.syncMutex.release();
        // Trigger list refresh:
        this.events.publish('app:syncDone');
      });

      // when offline mode is changed, login/logout has to be performed:
      Setting.onChange('offlineMode', async (setting: Setting) => {
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
      this.setupReminder();

      // allow access even before user login has completed (changes should sync later):
      resolve();
      this.loadingDone(task);

      await this.autoLogin(justChoseAServer);
    });
  }

  private adeptPlatformDependingSettings() {
    if (this.runningInBrowser) {
      // -> choose quaggaJs as default barcode engine and hide the selection from settings:
      Setting.settingConfig.barcodeEngine = { default: 'quaggaJs' };
    }
  }

  /**
   * switch to the first product entry's location after a notification has been tapped
   * @param  {any} tappedNotificationData notification data containing the first location id
   */
  private async changeLocationForTappedNotification(tappedNotificationData) {
    const currentLocation = <Location>await Location.getSelected();
    let currentLocationId: string = null;
    if (currentLocation) {
      currentLocationId = currentLocation.id;
    }

    if (tappedNotificationData.startupLocationId !== currentLocationId) {
      try {
        if (tappedNotificationData.startupLocationId) {
          const startupLocation = <Location>await Location.findBy('id', tappedNotificationData.startupLocationId);
          startupLocation.isSelected = true;
          await startupLocation.save();
        }

        if (currentLocation) {
          currentLocation.isSelected = false;
          await currentLocation.save();
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

    await this.switchLanguage(localeId);

    Setting.onChange('localeId', (setting: Setting) => {
      this.switchLanguage(setting.value);
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
   * @param  {string} localeId BCP 47 language code
   */
  private async switchLanguage(localeId: string) {
    this.translateSvc.use(localeId);
    moment.locale(localeId);

    const momentLocaleId = moment.locale();
    const momentLocale = moment.localeData(momentLocaleId);
    // TODO: UPGRADE
    // this.config.set('monthNames', momentLocale.months());
    // this.config.set('monthShortNames', momentLocale.monthsShort());
    // this.config.set('dayNames', momentLocale.weekdays());
    // this.config.set('dayShortNames', momentLocale.weekdaysMin());
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
      options.message = this.translateSvc.instant('Please wait...');
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
    await this.synchronizationHandler.acquireLocalChangesMutex();

    if (menuPoint.method) {
      menuPoint.method.apply(this);
      this.synchronizationHandler.localChangesMutex.release();
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
          this.synchronizationHandler.localChangesMutex.release();
        });
        modal.present();
        return;
      }

      // menu point configured to open a page:
      this.nav.setRoot(menuPoint.component, data);
      this.synchronizationHandler.localChangesMutex.release();
      return;
    }

    console.error('Menu point ' + menuPoint.id + 'doesn\'t do anyting');
    this.synchronizationHandler.localChangesMutex.release();
  }

  get runningInBrowser(): boolean {
    return (!this.device.platform || this.device.platform.toLowerCase() === 'browser');
  }

  async detectVersion() {
    if (!this.runningInBrowser) {
      console.log('Retrieving version');
      this.version = await cordova.getAppVersion.getVersionNumber();
      this.version += ' (Build: ' + await cordova.getAppVersion.getVersionCode() + ')';
      console.log('Version: ' + this.version);
    }
  }
}
