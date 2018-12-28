import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NavParams, ModalController, Platform } from '@ionic/angular';
import { BarcodeScanner } from '@ionic-native/barcode-scanner/ngx';
import { ProductEntry, Article, ArticleImage, Location, Setting } from 'src/app/models';
import { Camera } from '@ionic-native/camera/ngx';
import { Device } from '@ionic-native/device/ngx';
import { TranslateService } from '@ngx-translate/core';
import { QuaggaBarcodeScanModal } from '../barcode-scan/quagga-barcode-scan';
import { BrowserCamModal } from '../browser-cam/browser-cam';
import * as moment from 'moment';
import 'moment/min/locales';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { UiHelper } from 'src/utils/ui-helper';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ApiServer } from 'src/utils/api-server';

declare var cloudSky;
declare var navigator;

@Component({
  templateUrl: 'product-entry-form.html',
  styleUrls: ['product-entry-form.scss']
})
export class ProductEntryFormModal extends ExpirySyncController {
  static MAX_DAYS_UNTIL_EXPIRATION_DATE = 10000;

  productEntry: ProductEntry;
  dateFormat: string;
  displayLocation = false;
  private app: ExpirySync;

  maxExpirationDate: string;

  @ViewChild('entryForm') currentForm: NgForm;

  /**
   * I don't know how to reference an input with an attribute such as
   * #barcode="ngModel" -> get the surrounding item instead, later use
   * getNativeElement().querySelector('input')
   */
  @ViewChild('barcodeItem') barcodeItem: any;
  @ViewChild('articleNameItem') articleNameItem: any;

  constructor(
    public params: NavParams,
    private barcodeScanner: BarcodeScanner,
    private device: Device,
    private uiHelper: UiHelper,
    private camera: Camera,
    translate: TranslateService,
    private modalCtrl: ModalController,
    private platform: Platform
  ) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.dateFormat = moment.localeData(moment.locale()).longDateFormat('l');
    this.maxExpirationDate = moment().locale('en').add(ProductEntryFormModal.MAX_DAYS_UNTIL_EXPIRATION_DATE, 'days').format('YYYY-MM-DD');

    if (params.get('id')) {
      ProductEntry.findBy('id', params.get('id')).then(async (retrievedEntry: ProductEntry) => {
        retrievedEntry.article = <Article>await Article.findBy('id', retrievedEntry.articleId);
        if (params.get('displayLocation')) {
          retrievedEntry.location = <Location>await Location.findBy('id', retrievedEntry.locationId);
          this.displayLocation = true;
        }
        retrievedEntry.article.images = <Array<ArticleImage>>await ArticleImage
          .all()
          .filter('articleId', '=', retrievedEntry.articleId)
          .list();

        for (const image of retrievedEntry.article.images) {
          image.startLoadingImage();
        }

        this.productEntry = retrievedEntry;
        const curExpirationDate: string = moment(this.productEntry.expirationDate).locale('en').format('YYYY-MM-DD');
        if (curExpirationDate > this.maxExpirationDate) {
          this.maxExpirationDate = curExpirationDate;
        }
      }).catch(() => {
        // This can happen, if an item on the list has been tapped during sync,
        // and was then deleted by sync
        this.modalCtrl.dismiss();
      });
    } else {
      Location.getSelected().then((selectedLocation: Location) => {
        this.productEntry = new ProductEntry();
        this.productEntry.locationId = selectedLocation.id;
        this.productEntry.article = new Article();
      });
      this.scanBarcode();
    }

  }


  async loadArticleByBarcode() {
    if (!this.productEntry.article.barcode || this.productEntry.article.barcode.length === 0) {
      return;
    }

    const task = this.app.loadingStarted('Fetching barcode');
    // allow aborting when fetching the barcode:
    this.app.loaderBackButtonCallback = () => {
      ApiServer.getInstance().cancelCurrentRequest();
      this.app.loadingDone(task);
      this.app.loaderBackButtonCallback = null;
    };

    this.productEntry.article = <Article>await Article.findPullOrCreateByBarcode(this.productEntry.article.barcode);
    this.app.loadingDone(task);
    for (const image of this.productEntry.article.images) {
      image.startLoadingImage();
    }

    if (!this.productEntry.article.id) {
      this.articleNameItem.getNativeElement().querySelector('input').focus();
    }

  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveEntry(valid: boolean) {
    if (!valid) {
      return;
    }

    const task: Symbol = this.app.loadingStarted('Saving product entry');
    await this.productEntry.article.save();
    this.productEntry.articleId = this.productEntry.article.id;
    for (const image of this.productEntry.article.images) {
      image.articleId = this.productEntry.article.id;
      await image.save();
    }
    this.productEntry.inSync = false;
    await this.productEntry.save();
    this.app.loadingDone(task);
    this.modalCtrl.dismiss(this.productEntry);
  }

  async cloneEntry(valid: boolean) {
    if (!valid) {
      return;
    }

    this.productEntry = <ProductEntry>this.productEntry.clone();
    this.productEntry.serverId = null;
    this.productEntry.inSync = false;
    await this.saveEntry(true);
  }

  async deleteEntry(productEntry: ProductEntry) {
    await productEntry.markForDeletion();
    this.modalCtrl.dismiss(productEntry);
  }


  async scanBarcode() {
    console.log('BC scan');
    if (Setting.cached('barcodeEngine') === 'quaggaJs') {
      const modal = await this.modalCtrl.create({
        component: QuaggaBarcodeScanModal,
      });
      modal.onDidDismiss().then(event => {
        const barcode: string = event.data || null;
        if (barcode !== null) {
          this.onBarcodeScanned(barcode);
        }
      });
      modal.present();
    } else if (Setting.cached('barcodeEngine') === 'cszBar') {
      // On Android use tjwoon's ZBar cordova wrapper, as
      // ZBar performs better than ionic's default
      // plugin ("phonegap-plugin-barcodescanner")
      cloudSky.zBar.scan({
        text_title: await this.translate('Place the barcode inside the scan area'),
        enter_manually_label: await this.translate('Enter manually'),
        drawSight: false
      }, barcode => { this.onBarcodeScanned(barcode); }, async (response: string) => {
        console.log('ZBar did not return a barcode', response);
        await this.viewChangeOccurred();
        this.focusBarcodeInput();
      });
    } else {
      this.barcodeScanner.scan({
        prompt: await this.translate('Place the barcode inside the scan area or press the "back" button to enter the product manually'),
      }).then(async (barcodeData) => {
        const versions = this.device.version ? this.device.version.split('.') : [];
        const majorVersion = versions.length > 0 ? parseInt(versions[0], 10) : 0;
        if (barcodeData.cancelled && this.device.platform && this.device.platform.toLowerCase() === 'android' && majorVersion > 6) {
          this.app.preventNextBackButton = true;
          await this.viewChangeOccurred();
          this.focusBarcodeInput();
        } else {
          this.onBarcodeScanned(barcodeData.text);
        }
      }).catch(async (e) => {
        console.log('barcodeScanner did not return a barcode', e);
        await this.viewChangeOccurred();
        this.focusBarcodeInput();
      });
    }
  }

  private focusBarcodeInput() {
    if (!this.barcodeItem) {
      console.error('No barcode item');
      return;
    }
    this.barcodeItem.getNativeElement().querySelector('input').focus();
  }

  private onBarcodeScanned(barcode: string) {
    this.productEntry.article.barcode = barcode;
    this.loadArticleByBarcode();
  }

  async takePicture() {
    const saveImage = (imageData: string = null) => {
      if (imageData !== null) {
        this.productEntry.article.images[0] = new ArticleImage();
        this.productEntry.article.images[0].originalExtName = '.jpg';
        this.productEntry.article.images[0].imageData = 'data:image/jpeg;base64,' + imageData;
      }
    };

    if (this.app.runningInBrowser) {
      const modal = await this.modalCtrl.create({
        component: BrowserCamModal
      });

      modal.onDidDismiss().then(event => saveImage(event.data));
      modal.present();
    } else {
      this.camera.getPicture({
        destinationType: this.camera.DestinationType.DATA_URL,
        targetWidth: 400,
        quality: 90
      }).then(saveImage, (err) => {
        console.error('Error taking picture', err);
      });
    }
  }
}
