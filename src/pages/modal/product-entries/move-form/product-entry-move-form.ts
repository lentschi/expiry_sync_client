import { Component } from '@angular/core';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { TranslateService } from '@ngx-translate/core';
import { ProductEntry, Location } from '../../../../app/models';
import { NavParams, ViewController, Events } from 'ionic-angular';
import { UiHelper } from '../../../../app/utils/ui-helper';

@Component({
  templateUrl: 'product-entry-move-form.html'
})
export class ProductEntryMoveFormModal extends ExpirySyncController {
  productEntries:Array<ProductEntry>;
  locations:Array<Location>;
  selectedLocationId:string;

  constructor(translate:TranslateService, private params:NavParams, private viewCtrl:ViewController, private uiHelper:UiHelper, private events: Events) {
    super(translate);

    this.productEntries = params.get('selectedProductEntries');

    const currentLocation:Location = params.get('selectedLocation');
    const locations:Array<Location> = params.get('locations');

    this.locations = [];
    for (let location of locations) {
      if (location.id != currentLocation.id) {
          this.locations.push(location);
          if (!this.selectedLocationId) {
            this.selectedLocationId = location.id;
          }
      }
    }
  }


  dismiss() {
    this.viewCtrl.dismiss();
  }

  async move() {
    const targetLocation = this.locations.find(location => location.id == this.selectedLocationId);
    if (!await this.uiHelper.confirm(await this.pluralTranslate('Are you you want to move products to location?', this.productEntries.length,  {location: targetLocation.name}))) {
      return;
    }

    const app = ExpirySync.getInstance();

    const task = app.loadingStarted('Moving entries...');
    for (let entry of this.productEntries) {
      // Create a clone at the target location:
      const copy = <ProductEntry> entry.clone();
      copy.locationId = targetLocation.id;
      copy.location = targetLocation;
      copy.serverId = null;
      copy.inSync = false;
      await copy.save();

      // remove the old entry:
      await entry.markForDeletion();
    }

    app.entriesList.loadingAfterLocationSwitchDone = false;
    if (app.currentUser.loggedIn) {
      await app.synchronize();
    }
    this.events.publish('app:syncDone');
    app.loadingDone(task);
    this.viewCtrl.dismiss();
  }
}
