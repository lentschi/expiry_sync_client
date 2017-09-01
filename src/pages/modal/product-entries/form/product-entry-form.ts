import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NavParams, ViewController } from 'ionic-angular';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { ProductEntry, Article, ArticleImage, Location, Setting } from '../../../../app/models';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { ApiServer } from '../../../../app/utils/api-server';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { UiHelper } from '../../../../app/utils/ui-helper';
import { Camera } from '@ionic-native/camera';
import { Device } from '@ionic-native/device';
import { TranslateService } from '@ngx-translate/core';

import * as moment from 'moment';
import 'moment/min/locales';

declare var cloudSky;

@Component({
  templateUrl: 'product-entry-form.html'
})
export class ProductEntryFormModal extends ExpirySyncController {
  productEntry:ProductEntry;
  dateFormat:string;
  displayLocation = false;
  private app:ExpirySync;

  static MAX_DAYS_UNTIL_EXPIRATION_DATE:number = 10000;
  maxExpirationDate:string;

  @ViewChild('entryForm') currentForm: NgForm;

  /**
   * I don't know how to reference an input with an attribute such as
   * #barcode="ngModel" -> get the surrounding item instead, later use
   * getNativeElement().querySelector('input')
   */
  @ViewChild('barcodeItem') barcodeItem:any;
  @ViewChild('articleNameItem') articleNameItem:any;

  constructor(public params:NavParams, public viewCtrl:ViewController, private barcodeScanner:BarcodeScanner, private device:Device, private uiHelper:UiHelper, private camera:Camera, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.dateFormat = moment.localeData(moment.locale()).longDateFormat('l');
    this.maxExpirationDate = moment().locale('en').add(ProductEntryFormModal.MAX_DAYS_UNTIL_EXPIRATION_DATE, 'days').format('YYYY-MM-DD');

    if (params.get('id')) {
      ProductEntry.findBy('id', params.get('id')).then(async(retrievedEntry:ProductEntry) => {
        retrievedEntry.article = <Article> await Article.findBy('id', retrievedEntry.articleId);
        if (params.get('displayLocation')) {
          retrievedEntry.location = <Location> await Location.findBy('id', retrievedEntry.locationId);
          this.displayLocation = true;
        }
        retrievedEntry.article.images = <Array<ArticleImage>> await ArticleImage
          .all()
          .filter('articleId', '=', retrievedEntry.articleId)
          .list();

        for (let image of retrievedEntry.article.images) {
          image.startLoadingImage();
        }

        this.productEntry = retrievedEntry;
        let curExpirationDate:string = moment(this.productEntry.expirationDate).locale('en').format('YYYY-MM-DD');
        if (curExpirationDate > this.maxExpirationDate) {
          this.maxExpirationDate = curExpirationDate;
        }
      }).catch(() => {
        // This can happen, if an item on the list has been tapped during sync,
        // and was then deleted by sync
        this.viewCtrl.dismiss();
      });
    }
    else {
      Location.getSelected().then((selectedLocation:Location) => {
        this.productEntry = new ProductEntry();
        this.productEntry.locationId = selectedLocation.id;
        this.productEntry.article = new Article();
      });
      if (this.device.platform) {
          this.scanBarcode();
      }
    }

  }


  async loadArticleByBarcode() {
    if (!this.productEntry.article.barcode || this.productEntry.article.barcode.length == 0) {
      return;
    }

    const task = this.app.loadingStarted('Fetching barcode');
    this.app.loaderBackButtonCallback = () => {
      ApiServer.getInstance().cancelCurrentRequest();
      this.app.loadingDone(task);
      this.app.loaderBackButtonCallback = null;
    };

    this.productEntry.article = <Article> await Article.findPullOrCreateByBarcode(this.productEntry.article.barcode);
    this.app.loadingDone(task);
    for (let image of this.productEntry.article.images) {
      image.startLoadingImage();
    }

    if (!this.productEntry.article.id) {
      this.articleNameItem.getNativeElement().querySelector('input').focus();
    }

  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  async saveEntry(valid:boolean) {
    if (!valid) {
      return;
    }

    let task:Symbol = this.app.loadingStarted("Saving product entry");
    await this.productEntry.article.save();
    this.productEntry.articleId = this.productEntry.article.id;
    for (let image of this.productEntry.article.images) {
      image.articleId = this.productEntry.article.id;
      await image.save();
    }
    this.productEntry.inSync = false;
    await this.productEntry.save();
    this.app.loadingDone(task);
    this.viewCtrl.dismiss(this.productEntry);
  }

  async cloneEntry(valid:boolean) {
    if (!valid) {
      return;
    }

    this.productEntry = <ProductEntry> this.productEntry.clone();
    this.productEntry.serverId = null;
    this.productEntry.inSync = false;
    await this.saveEntry(true);
  }

  async deleteEntry(productEntry:ProductEntry) {
    await productEntry.markForDeletion();
    this.viewCtrl.dismiss(productEntry);
  }

  async scanBarcode() {
    if (this.device.platform == 'Android' && Setting.cached('barcodeEngine') == 'cszBar') {
      // On Android use tjwoon's ZBar cordova wrapper, as
      // ZBar performs better than ionic's default
      // plugin ("phonegap-plugin-barcodescanner")
      cloudSky.zBar.scan({
        text_title: await this.translate('Place the barcode inside the scan area'),
        enter_manually_label: await this.translate('Enter manually'),
        drawSight: false
      }, barcode => {this.onBarcodeScanned(barcode)}, async(response:string) => {
        console.log("ZBar did not return a barcode", response);
        await this.viewChangeOccurred();
        this.barcodeItem.getNativeElement().querySelector('input').focus();
      })
    }
    else {
      this.barcodeScanner.scan({
        prompt: await this.translate('Place the barcode inside the scan area or press the "back" button to enter the product manually'),
      }).then((barcodeData) => {
        this.onBarcodeScanned(barcodeData.text);
      }).catch(async (e) => {
        console.log("barcodeScanner did not return a barcode", e);
        await this.viewChangeOccurred();
        this.barcodeItem.getNativeElement().querySelector('input').focus();
      });
    }
  }

  private onBarcodeScanned(barcode:string) {
    this.productEntry.article.barcode = barcode;
    this.loadArticleByBarcode();
  }

  takePicture() {
    this.camera.getPicture({
        destinationType: this.camera.DestinationType.DATA_URL,
        targetWidth: 400,
        quality: 90
    }).then(imageData => {
        this.productEntry.article.images[0] = new ArticleImage();
        this.productEntry.article.images[0].originalExtName = '.jpg';
        this.productEntry.article.images[0].imageData = "data:image/jpeg;base64," + imageData;
    }, (err) => {
        console.error("Error taking picture", err);
    });
  }
}
