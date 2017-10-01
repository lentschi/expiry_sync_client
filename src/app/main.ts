import "reflect-metadata"; // <- required for AppModel
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app.module';
import {enableProdMode} from '@angular/core';
import 'webrtc-adapter/out/adapter.js';

enableProdMode();


platformBrowserDynamic().bootstrapModule(AppModule);
