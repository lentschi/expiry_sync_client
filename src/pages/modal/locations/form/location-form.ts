import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NavParams, ViewController, ModalController } from 'ionic-angular';
import { Location } from '../../../../app/models';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { UiHelper } from  '../../../../app/utils/ui-helper';
import { TranslateService } from '@ngx-translate/core';

@Component({
  templateUrl: 'location-form.html'
})
export class LocationFormModal extends ExpirySyncController {
  location:Location;
  locationForm: NgForm;
  private app:ExpirySync;
  @ViewChild('locationForm') currentForm: NgForm;

  constructor(private params:NavParams, private viewCtrl:ViewController, private modalCtrl:ModalController, private uiHelper:UiHelper, translate:TranslateService) {
    super(translate);
    this.initialize();
  }

  private async initialize() {
    this.app = ExpirySync.getInstance();

    if (this.params.get('id')) {
      try {
        this.location = <Location> await Location.findBy('id', this.params.get('id'));
      }
      catch(e) {
        // This can happen, if a location in the list has been tapped during sync,
        // and was then deleted by sync:
        this.viewCtrl.dismiss();
      }
    }
    else {
      this.location = new Location();
    }
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  async deleteTapped(location:Location) {
    let locations = <Array<Location>> await Location
      .all()
      .prefetch('creator')
      .filter('deletedAt', '=', null)
      .list();
      
    if (locations.length == 1) {
      await this.uiHelper.errorToast(await this.translate('As this is the last location remaining, it cannot be removed!'));
      return;
    }
    
    if (! (await this.uiHelper.confirm(await this.translate('Do you really want to remove this location?'))) ) {
      return;
    }

    const wasSelected = location.isSelected;
    await location.markForDeletion();
    
    if (wasSelected) {
      const firstRemaining = locations.find(curLocation => (curLocation.id != location.id));
      firstRemaining.isSelected = true;
      await firstRemaining.save();
    }
    
    this.viewCtrl.dismiss(location);
  }

  async submitTapped(valid:boolean) {
    if (!valid) {
      return;
    }

    let task:Symbol = this.app.loadingStarted("Saving location");
    this.location.inSync = false;
    await this.location.save();
    this.viewCtrl.dismiss(this.location);
    this.app.loadingDone(task);
  }
}
