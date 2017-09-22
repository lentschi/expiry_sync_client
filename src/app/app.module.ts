import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { ExpirySync } from './app.expiry-sync';
import { ProductEntriesPage } from '../pages/product-entries/product-entries';
import { LocationsModal } from '../pages/modal/locations/list/locations';
import { SettingsModal } from '../pages/modal/settings/list/settings';
import { DbManager } from './utils/db-manager';
import { ApiServer } from './utils/api-server';
import { UiHelper } from './utils/ui-helper';
import { AboutModal } from '../pages/modal/about/about';
import { SettingEditModal } from '../pages/modal/settings/edit/setting-edit';
import { SettingEditIntegerElement } from '../pages/modal/settings/edit/types/integer/setting-edit-integer';
import { SettingEditStringElement } from '../pages/modal/settings/edit/types/string/setting-edit-string';
import { SettingSelectElement } from '../pages/modal/settings/edit/types/select/setting-select';
import { AlternateServersChoiceModal } from '../pages/modal/alternate-servers/choice/alternate-servers-choice';
import { ProductEntryFormModal } from '../pages/modal/product-entries/form/product-entry-form';
import { ProductEntryMoveFormModal } from '../pages/modal/product-entries/move-form/product-entry-move-form';
import { LocationFormModal } from '../pages/modal/locations/form/location-form';
import { LocationSharesModal } from '../pages/modal/location-shares/list/location-shares';
import { RecipeSearchModal } from '../pages/modal/recipes/search/recipe-search';
import { UserRegistrationModal } from '../pages/modal/users/registration/user-registration';
import { UserLoginModal } from '../pages/modal/users/login/user-login';
import { FormsModule }   from '@angular/forms';
import { MomentModule } from 'angular2-moment';
import { SettingInfoElement } from '../pages/modal/settings/edit/info/setting-info';
import { SettingLabelElement } from '../pages/modal/settings/edit/label/setting-label';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { LocalNotifications } from '@ionic-native/local-notifications';
import { GreaterThanValidator, LessThanValidator, IntegerValidator, UrlValidator } from './utils/custom-validators';
import { EllipsisPipe } from './utils/custom-pipes';
import { Device } from '@ionic-native/device';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Camera } from '@ionic-native/camera';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { IonicTranslateDirective } from './utils/ionic-translate.directive';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Http } from '@angular/http';
import { EllipsisModule } from 'ngx-ellipsis';


export function createTranslateLoader(http: Http) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    ExpirySync,
    ProductEntriesPage,
    AboutModal,
    SettingsModal,
    LocationsModal,
    SettingEditModal,
    AlternateServersChoiceModal,
    ProductEntryFormModal,
    ProductEntryMoveFormModal,
    UserRegistrationModal,
    LocationFormModal,
    LocationSharesModal,
    RecipeSearchModal,
    UserLoginModal,
    SettingLabelElement,
    SettingInfoElement,
    SettingEditIntegerElement,
    SettingEditStringElement,
    SettingSelectElement,
    GreaterThanValidator,
    LessThanValidator,
    UrlValidator,
    IntegerValidator,
    EllipsisPipe,
    IonicTranslateDirective
  ],
  imports: [
    IonicModule.forRoot(ExpirySync, {
    }),
    FormsModule,
    MomentModule,
    BrowserModule,
    HttpModule,
    BrowserAnimationsModule,
    EllipsisModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (createTranslateLoader),
        deps: [Http]
      }
    })
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    ExpirySync,
    ProductEntriesPage,
    AboutModal,
    SettingsModal,
    AlternateServersChoiceModal,
    LocationsModal,
    SettingEditModal,
    ProductEntryFormModal,
    ProductEntryMoveFormModal,
    LocationFormModal,
    LocationSharesModal,
    RecipeSearchModal,
    UserRegistrationModal,
    UserLoginModal,
    SettingEditIntegerElement,
    SettingEditStringElement,
    SettingSelectElement,
  ],
  providers: [
    DbManager,
    ApiServer,
    UiHelper,
    BarcodeScanner,
    LocalNotifications,
    Device,
    Camera,
    {provide: ErrorHandler, useClass: IonicErrorHandler}
  ]
})
export class AppModule {}
