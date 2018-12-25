import { Component } from '@angular/core';

import { NavController, ModalController, Events } from '@ionic/angular';
import { LocationFormModal } from '../form/location-form';
import { LocationSharesModal } from '../../location-shares/list/location-shares';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { ViewController } from '@ionic/core';
import { Location } from 'src/app/models';

@Component({
  templateUrl: 'locations.html'
})
export class LocationsModal extends ExpirySyncController {
  locations: Array<Location>;
  private app: ExpirySync;

  constructor(
    private events: Events,
    private modalCtrl: ModalController,
    translate: TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();

    ExpirySync.ready().then(async () => {
      await this.showList();
    });

  }

  ionViewWillLeave(): void {
    // this.app.disableMenuPoint(ExpirySync.MenuPointId.addLocation);
  }

  private async showList() {
    const task: Symbol = this.app.loadingStarted('Fetching locations');
    this.locations = <Array<Location>>await Location
      .all()
      .prefetch('creator')
      .filter('deletedAt', '=', null)
      .list();

    this.app.loadingDone(task);
  }

  private async onLocationUpdated(location: Location) {
    await this.showList();
    if (this.app.currentUser.loggedIn) {
      this.app.updatedLocation = location;
      this.app.synchronize().then(() => {
        this.showList();
      });
    } else {
      this.events.publish('app:syncDone');
    }
  }

  async openLocationForm(location?: Location) {
    const params: any = {};
    if (location) {
      params.id = location.id;
    }

    const modal = await this.modalCtrl.create({
      component: LocationFormModal,
      componentProps: { locationId: location ? location.id : null }
    });

    modal.onDidDismiss().then(async (event) => {
      const updatedLocation: Location = event.data;
      if (updatedLocation) {
        await this.onLocationUpdated(updatedLocation);
      }
    });
    modal.present();
  }

  async shareTapped(e: Event, location: Location) {
    e.stopPropagation();

    const modal = await this.modalCtrl.create({
      component: LocationSharesModal,
      componentProps: { locationId: location.id }
    });
    modal.present();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
