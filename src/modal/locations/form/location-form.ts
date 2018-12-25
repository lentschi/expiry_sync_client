import { Component, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Location } from 'src/app/models';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { UiHelper } from 'src/utils/ui-helper';

@Component({
  templateUrl: 'location-form.html'
})
export class LocationFormModal extends ExpirySyncController {
  location: Location;
  locationId: string;
  locationForm: NgForm;
  private app: ExpirySync;
  @ViewChild('locationForm') currentForm: NgForm;

  constructor(
    private modalCtrl: ModalController,
    private uiHelper: UiHelper,
    translate: TranslateService
  ) {
    super(translate);
    this.initialize();
  }

  private async initialize() {
    this.app = ExpirySync.getInstance();

    if (this.locationId) {
      try {
        this.location = <Location>await Location.findBy('id', this.locationId);
      } catch (e) {
        // This can happen, if a location in the list has been tapped during sync,
        // and was then deleted by sync:
        this.modalCtrl.dismiss();
      }
    } else {
      this.location = new Location();
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async deleteTapped(location: Location) {
    const locations = <Array<Location>>await Location
      .all()
      .prefetch('creator')
      .filter('deletedAt', '=', null)
      .list();

    if (locations.length === 1) {
      await this.uiHelper.errorToast(await this.translate('As this is the last location remaining, it cannot be removed!'));
      return;
    }

    if (!(await this.uiHelper.confirm(await this.translate('Do you really want to remove this location?')))) {
      return;
    }

    const wasSelected = location.isSelected;
    await location.markForDeletion();

    if (wasSelected) {
      const firstRemaining = locations.find(curLocation => (curLocation.id !== location.id));
      firstRemaining.isSelected = true;
      await firstRemaining.save();
    }

    this.modalCtrl.dismiss(location);
  }

  async submitTapped(valid: boolean) {
    if (!valid) {
      return;
    }

    const task: Symbol = this.app.loadingStarted('Saving location');
    this.location.inSync = false;
    await this.location.save();
    this.modalCtrl.dismiss(this.location);
    this.app.loadingDone(task);
  }
}
