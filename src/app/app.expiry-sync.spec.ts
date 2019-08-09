import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed, async } from '@angular/core/testing';

import { RouterTestingModule } from '@angular/router/testing';
import { ExpirySync } from './app.expiry-sync';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { FormsModule } from '@angular/forms';
import { MomentModule } from 'angular2-moment';
import { EllipsisModule } from 'ngx-ellipsis';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DbManager } from 'src/utils/db-manager';
import { ApiServer } from 'src/utils/api-server';
import { UiHelper } from 'src/utils/ui-helper';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';
import { Device } from '@ionic-native/device/ngx';
import { RouteReuseStrategy } from '@angular/router';
import { Camera } from '@ionic-native/camera/ngx';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, '../assets/i18n/', '.json');
}

describe('ExpirySync', () => {

  let statusBarSpy, splashScreenSpy, platformReadySpy, platformSpy;

  beforeEach(async(() => {
    statusBarSpy = jasmine.createSpyObj('StatusBar', ['styleDefault']);
    splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide']);
    platformReadySpy = Promise.resolve();
    platformSpy = jasmine.createSpyObj('Platform', { ready: platformReadySpy });

    TestBed.configureTestingModule({
      declarations: [ExpirySync],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        DbManager,
        ApiServer,
        UiHelper,
        BarcodeScanner,
        LocalNotifications,
        HttpClientModule,
        Device,
        Camera,
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
      ],
      imports: [
        RouterTestingModule.withRoutes([]),
        IonicModule.forRoot(),
        FormsModule,
        MomentModule,
        HttpClientModule,
        EllipsisModule,
        BrowserAnimationsModule,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useFactory: (createTranslateLoader),
            deps: [HttpClient]
          }
        })
      ],
    }).compileComponents();
  }));

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(ExpirySync);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });

});
