import { Component } from '@angular/core';

import { NavController, ModalController, ViewController, Events } from 'ionic-angular';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { Location } from '../../../../app/models';
import { LocationFormModal } from '../form/location-form';
import { LocationSharesModal } from '../../location-shares/list/location-shares';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { TranslateService } from '@ngx-translate/core';

@Component({
  templateUrl: 'locations.html'
})
export class LocationsModal extends ExpirySyncController {
  locations:Array<Location>;
  private app:ExpirySync;

  constructor(private navCtrl: NavController, private events:Events, private modalCtrl:ModalController, private viewCtrl:ViewController, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();

    ExpirySync.ready().then(async() => {
      await this.showList();
    });

  }

  ionViewWillLeave():void {
    // this.app.disableMenuPoint(ExpirySync.MenuPointId.addLocation);
  }

  private async showList() {
    let task:Symbol = this.app.loadingStarted('Fetching locations');
    this.locations = <Array<Location>> await Location
      .all()
      .prefetch('creator')
      .filter('deletedAt', '=', null)
      .list();

    this.app.loadingDone(task);
  }

  private async onLocationUpdated(location:Location) {
    await this.showList();
    if (this.app.currentUser.loggedIn) {
      this.app.synchronize(location.serverId).then(() => {
        this.showList();
      });
    }
    else {
      this.events.publish('app:syncDone');
    }
  }

  async openLocationForm(location?:Location) {
    let params:any = {};
    if (location) {
      params.id = location.id;
    }

    let modal = this.modalCtrl.create(LocationFormModal, params);
    modal.onDidDismiss(async (location:Location) => {
      if (location) {
        await this.onLocationUpdated(location);
      }
    });
    modal.present();
  }

  async shareTapped(e:Event, location:Location) {
    e.stopPropagation();

    let modal = this.modalCtrl.create(LocationSharesModal, {'location-id': location.id});
    modal.present();
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }
}
