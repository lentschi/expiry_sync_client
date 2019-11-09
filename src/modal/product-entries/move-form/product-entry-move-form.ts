import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Events, ModalController } from '@ionic/angular';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ProductEntry, Location, Article, ArticleImage } from 'src/app/models';
import { UiHelper } from 'src/utils/ui-helper';
import { ExpirySync } from 'src/app/app.expiry-sync';

@Component({
  templateUrl: 'product-entry-move-form.html'
})
export class ProductEntryMoveFormModal extends ExpirySyncController implements OnInit {
  productEntries: Array<ProductEntry>;
  allLocations: Array<Location>;
  locations: Array<Location>;
  currentLocation: Location;
  selectedLocationId: string;

  constructor(
    translate: TranslateService,
    private modalCtrl: ModalController,
    private uiHelper: UiHelper,
    private events: Events
  ) {
    super(translate);
  }

  ngOnInit() {
    this.locations = [];
    for (const location of this.allLocations) {
      if (location.id !== this.currentLocation.id) {
        this.locations.push(location);
        if (!this.selectedLocationId) {
          this.selectedLocationId = location.id;
        }
      }
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async move() {
    const targetLocation = this.locations.find(location => location.id === this.selectedLocationId);
    if (!await this.uiHelper.confirm(
      await this.pluralTranslate(
        'Are you sure you want to move products to location?',
        this.productEntries.length,
        { location: targetLocation.name }
      )
    )) {
      return;
    }

    const app = ExpirySync.getInstance();

    const task = app.loadingStarted('Moving entries...');
    for (const entry of this.productEntries) {
      // Create a clone at the target location:
      const entryCopy = <ProductEntry> entry.clone();
      if (!entryCopy.article.barcode) {
        const originalImages = <ArticleImage[]> await ArticleImage.all()
          .filter('articleId', '=', entryCopy.article.id)
          .list();
        entryCopy.article = <Article> entryCopy.article.clone();
        await entryCopy.article.save();
        entryCopy.articleId = entryCopy.article.id;

        for (const originalImage of originalImages) {
          const imageCopy = <ArticleImage>originalImage.clone();
          imageCopy.articleId = entryCopy.articleId;
          await imageCopy.save();
        }
      }
      entryCopy.locationId = targetLocation.id;
      entryCopy.location = targetLocation;
      entryCopy.inSync = false;
      await entryCopy.save();

      // remove the old entry:
      await entry.markForDeletion();
    }

    app.entriesList.loadingAfterLocationSwitchDone = false;
    if (app.currentUser.loggedIn) {
      await app.synchronize(false, true);
    }
    this.events.publish('app:syncDone');
    app.loadingDone(task);
    this.modalCtrl.dismiss();
  }
}
