import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { ExpirySync } from './app.expiry-sync';
import { AppRoutingModule } from './app-routing.module';
import { ProductEntriesPage } from './product-entries/product-entries';
import { AboutModal } from 'src/modal/about/about';
import { SettingsModal } from 'src/modal/settings/list/settings';
import { LocationsModal } from 'src/modal/locations/list/locations';
import { SettingEditModal } from 'src/modal/settings/edit/setting-edit';
import { AlternateServersChoiceModal } from 'src/modal/alternate-servers/choice/alternate-servers-choice';
import { ProductEntryFormModal } from 'src/modal/product-entries/form/product-entry-form';
import { ProductEntryMoveFormModal } from 'src/modal/product-entries/move-form/product-entry-move-form';
import { QuaggaBarcodeScanModal } from 'src/modal/product-entries/barcode-scan/quagga-barcode-scan';
import { BrowserCamModal } from 'src/modal/product-entries/browser-cam/browser-cam';
import { UserRegistrationModal } from 'src/modal/users/registration/user-registration';
import { LocationFormModal } from 'src/modal/locations/form/location-form';
import { LocationSharesModal } from 'src/modal/location-shares/list/location-shares';
import { RecipeSearchModal } from 'src/modal/recipes/search/recipe-search';
import { UserLoginModal } from 'src/modal/users/login/user-login';
import { SettingLabelElement } from 'src/modal/settings/edit/label/setting-label';
import { SettingInfoElement } from 'src/modal/settings/edit/info/setting-info';
import { SettingEditIntegerElement } from 'src/modal/settings/edit/types/integer/setting-edit-integer';
import { SettingEditStringElement } from 'src/modal/settings/edit/types/string/setting-edit-string';
import { SettingSelectElement } from 'src/modal/settings/edit/types/select/setting-select';
import { GreaterThanValidator, LessThanValidator, UrlValidator, IntegerValidator } from 'src/utils/custom-validators';
import { EllipsisPipe } from 'src/utils/custom-pipes';
import { IonicTranslateDirective } from 'src/utils/ionic-translate.directive';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { DbManager } from 'src/utils/db-manager';
import { ApiServer } from 'src/utils/api-server';
import { UiHelper } from 'src/utils/ui-helper';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { Device } from '@ionic-native/device/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { MomentModule } from 'ngx-moment';
import { EllipsisModule } from 'ngx-ellipsis';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SynchronizationHandler } from './services/synchronization-handler.service';
import { AppHttpParamsInterceptor } from './app.http-params-interceptor';
import { SettingWeekdaysElement } from 'src/modal/settings/edit/types/weekdays/setting-weekdays';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { DatePickerComponent } from 'src/utils/components/date-picker/date-picker.component';
import { MatDatepickerModule } from '@angular/material';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { IndexedMigrationsModule } from 'src/config/indexed-migrations/indexed-migrations.module';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, '../assets/i18n/', '.json');
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
    QuaggaBarcodeScanModal,
    BrowserCamModal,
    UserRegistrationModal,
    LocationFormModal,
    LocationSharesModal,
    RecipeSearchModal,
    UserLoginModal,
    SettingLabelElement,
    SettingInfoElement,
    SettingEditIntegerElement,
    SettingEditStringElement,
    SettingWeekdaysElement,
    SettingSelectElement,
    GreaterThanValidator,
    LessThanValidator,
    UrlValidator,
    IntegerValidator,
    EllipsisPipe,
    IonicTranslateDirective,
    DatePickerComponent
  ],
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
    QuaggaBarcodeScanModal,
    BrowserCamModal,
    LocationFormModal,
    LocationSharesModal,
    RecipeSearchModal,
    UserRegistrationModal,
    UserLoginModal,
    SettingEditIntegerElement,
    SettingEditStringElement,
    SettingWeekdaysElement,
    SettingSelectElement,
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    FormsModule,
    MomentModule,
    HttpClientModule,
    EllipsisModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatMomentDateModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (createTranslateLoader),
        deps: [HttpClient]
      }
    }),
    IndexedMigrationsModule
  ],
  providers: [
    DbManager,
    ApiServer,
    SynchronizationHandler,
    UiHelper,
    BarcodeScanner,
    LocalNotifications,
    HttpClientModule,
    Device,
    Camera,
    BackgroundMode,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AppHttpParamsInterceptor,
      multi: true
    }
  ],
  bootstrap: [ExpirySync]
})
export class AppModule {}
