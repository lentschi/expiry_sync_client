import { Component, ViewChild } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/core';

import { NavController, ModalController, TextInput, Events, Platform } from 'ionic-angular';
import { ProductEntry, Location, Setting, User } from '../../app/models';
import { ExpirySync } from '../../app/app.expiry-sync';
import { ExpirySyncController } from '../../app/app.expiry-sync-controller';
import { ProductEntryFormModal } from '../modal/product-entries/form/product-entry-form';
import { ProductEntryMoveFormModal } from '../modal/product-entries/move-form/product-entry-move-form';
import { RecipeSearchModal } from '../modal/recipes/search/recipe-search';
import { UiHelper } from '../../app/utils/ui-helper';
import { ProductEntriesListAdapter } from './product-entries-list-adapter';
import { ChangeDetectorRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'product-entries',
  templateUrl: 'product-entries.html',
  animations: [
    trigger('addRemoveAnimation', [
      state('normal', style(
        {color: '#888'}
      )),
      state('green', style(
        {color: '#0c0'}
      )),
      state('red', style(
        {color: '#c00'}
      )),
      transition('normal <=> green', animate('200ms linear')),
      transition('normal <=> red', animate('200ms linear'))
    ])
  ]
})
export class ProductEntriesPage extends ExpirySyncController {
  productEntries:ProductEntriesListAdapter = new ProductEntriesListAdapter();
  locations:Array<Location>;
  selectedLocationId:string;
  selectedLocation:Location;
  private app:ExpirySync;
  showFilter = false;
  loadingAfterLocationSwitchDone = false;
  currentUser:User;

  @ViewChild('filterField') filterField: TextInput;

  constructor(private platform: Platform, private navCtrl: NavController, private modalCtrl:ModalController, private uiHelper:UiHelper, private events:Events, private cd:ChangeDetectorRef, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.app.entriesList = this;

    ExpirySync.ready().then(async() => {
      await this.showListAndFilters();
      this.enableDisableMenuPoints();
      Setting.onChange('lastSync', async(setting:Setting) => {
        if (setting.value == '') {
          // Happens if the user is changed -> show an empty list until the new one has been pulled:
          await this.showListAndFilters();
        }
      });
    });

    events.subscribe('app:syncDone', () => {
      this.showListAndFilters();
    })

    events.subscribe('productEntries:selectionChanged', () => {
      this.enableDisableMenuPoints();
    })

    this.navCtrl.viewWillLeave.subscribe(() => {
      // this.app.disableMenuPoint(ExpirySync.MenuPointId.addProduct);
    });
  }

  async showList() {
    // var loadingTask:Symbol = this.app.loadingStarted('Listing entries');

    this.selectedLocation = await Location.getSelected();
    if (this.selectedLocation) {
      this.selectedLocationId = this.selectedLocation.id;
    }
    else {
      this.selectedLocationId = '';
    }

    this.locations = <Array<Location>> await Location
      .all()
      .filter('deletedAt', '=', null)
      .list();

    const query = ProductEntry
      .all()
      .prefetch('article')
      .prefetch('creator')
      .prefetch('location')
      .filter('deletedAt', '=', null);

    if (this.selectedLocationId) {
      query.filter('locationId', '=', this.selectedLocationId);
    }

    let dbEntries:Array<ProductEntry> = <Array<ProductEntry>> await query.list();

    const previouslySelectedEntries:Array<ProductEntry> = this.productEntries.selected;

    // sort the retrieved entries:
    this.productEntries.setValues(dbEntries);
    this.productEntries.sortBySortField();
    this.productEntries.filterByFilterValue();

    // re-select previously selected entries:
    for (let selectedEntry of previouslySelectedEntries) {
      let entry:ProductEntry = this.productEntries.find(entry => entry.id == selectedEntry.id);
      if (entry) {
        entry.selected = true;
      }
    }

    this.loadingAfterLocationSwitchDone = true;
  }

  async showListAndFilters() {
    const creatorFilter = this.productEntries.creatorFilter;
    if (creatorFilter) {
      this.app.enableMenuPoint(ExpirySync.MenuPointId.filterAllUsers).method = () => {
        this.productEntries.filterValue = creatorFilter.remainingFilter;
        if (this.productEntries.filterValue == '') {
          this.showFilter = false;
        }
        this.showListAndFilters();
      };
      this.app.disableMenuPoint(ExpirySync.MenuPointId.filterCurrentUser);
    }
    else {
      if (this.app.currentUser.userName) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.filterCurrentUser).method = () => {
          if (this.productEntries.filterValue != "") {
            this.productEntries.filterValue += ' ';
          }
          this.productEntries.filterValue += 'by:' + this.app.currentUser.userName;
          this.showFilter = true;
          this.showListAndFilters();
        };
      }
      this.app.disableMenuPoint(ExpirySync.MenuPointId.filterAllUsers);
    }

    this.currentUser = this.app.currentUser;
    await this.showList();
  }

  private async onEntryUpdated(updatedEntry?:ProductEntry, showList?:boolean) {
    if (typeof showList === 'undefined') {
      showList = true;
    }
    if (showList) {
      await this.showList();
    }
    if (this.app.currentUser.loggedIn) {
      this.app.updatedEntry = updatedEntry;
      this.app.mutexedSynchronize().then(async () => {
        if (showList || (updatedEntry && !(await updatedEntry.exists()))) {
          await this.showList();
        }
      });
    }
  }


  async locationSwitched() {
    let task:Symbol = this.app.loadingStarted("Switching location");

    const oldSelectionId = this.selectedLocation ? this.selectedLocation.id : null;
    if (oldSelectionId != this.selectedLocationId) {
      this.loadingAfterLocationSwitchDone = false;
      this.productEntries.setValues([]);
      const oldSelection = this.selectedLocation;

      // select new location:
      if (this.selectedLocationId) {
        this.selectedLocation = <Location> await Location.findBy('id', this.selectedLocationId);
        this.selectedLocation.isSelected = true;
        await this.selectedLocation.save();
      }
      else {
        this.selectedLocation = null;
      }

      // de-select old location:
      if (oldSelection) {
        oldSelection.isSelected = false;
        await oldSelection.save();
      }
    }

    this.app.loadingDone(task);
    await this.showListAndFilters();
    this.enableDisableMenuPoints();
  }


  async openEntryForm(productEntry?:ProductEntry) {
    await this.syncDone();

    this.setLocalChangesDonePromise(new Promise<void>(resolve => {
      let params:any = {};
      if (productEntry) {
        params.id = productEntry.id;
        params.displayLocation = !this.selectedLocation;
      }

      let modal = this.modalCtrl.create(ProductEntryFormModal, params);
      modal.onDidDismiss(async(productEntry:ProductEntry) => {
        if (productEntry) {
          await this.onEntryUpdated(productEntry);
        }
        resolve();
      });
      modal.present();
    }));
  }

  async productEntrySwipedLeft(productEntry:ProductEntry) {
    await this.syncDone();

    this.setLocalChangesDonePromise(new Promise<void>(async resolve => {
      if (productEntry.amount == 1) {
        this.productEntries.anySelected = false;
        productEntry.selected = true;
        await this.viewChangeOccurred();
        if (await this.uiHelper.confirm(await this.pluralTranslate('Really delete those products?', this.productEntries.selected.length))) {
          await productEntry.markForDeletion();
        }
        await this.onEntryUpdated(productEntry);
        resolve();
        return;
      }
      productEntry.amount--;
      productEntry.inSync = false;

      await productEntry.save();
      await this.onEntryUpdated(productEntry, false);

      resolve();

      productEntry.addRemoveAnimation = 'red';
    }));
  }

  async productEntrySwipedRight(productEntry:ProductEntry) {
    await this.syncDone();

    this.setLocalChangesDonePromise(new Promise<void>(async resolve => {
      productEntry.amount++;
      productEntry.inSync = false;

      await productEntry.save();
      await this.onEntryUpdated(productEntry, false);
      resolve();

      productEntry.addRemoveAnimation = 'green';
    }));
  }

  productEntryCheckboxTapped(event:Event, productEntry:ProductEntry) {
    productEntry.selected = !productEntry.selected;
    event.stopPropagation();
  }

  sortTapped(sortBy:string) {
    if (this.productEntries.sortBy == sortBy) {
      this.productEntries.sortAscending = !this.productEntries.sortAscending;
    }
    else {
      this.productEntries.sortBy = sortBy;
      this.productEntries.sortAscending = true;
    }
    this.showList();
  }

  async deleteAllTapped() {
    await this.syncDone();

    this.setLocalChangesDonePromise(new Promise<void>(async resolve => {
      if (! await this.uiHelper.confirm(await this.pluralTranslate('Really delete those products?', this.productEntries.selected.length))) {
        resolve();
        return;
      }
      for (let productEntry of this.productEntries.selected) {
        await productEntry.markForDeletion();
      }
      await this.onEntryUpdated();
      resolve();
    }));
  }
  
  private deregisterBackButtonHandler:Function;

  async toggleSearchTapped() {
    this.showFilter = !this.showFilter;
    await this.viewChangeOccurred();
    if (this.showFilter) {
      this.filterField.setFocus();
      this.deregisterBackButtonHandler = this.platform.registerBackButtonAction(e => {
        this.toggleSearchTapped();
      }, 102);
    }
    else {
      this.deregisterBackButtonHandler();
      this.productEntries.filterValue = '';
      await this.showListAndFilters();
    }
  }

  /**
   * Clears the filter input
   */
  async clearFilterValue() {    
    this.productEntries.filterValue = '';
    await this.viewChangeOccurred();
    this.filterField.setFocus();
    await this.showListAndFilters();
  }

  enableDisableMenuPoints() {
    if (window.innerWidth < 350) {
      if (!this.productEntries.allSelected) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.selectAll).method = () => {
          this.productEntries.allSelected = true;
        };
      }
      else {
        this.app.disableMenuPoint(ExpirySync.MenuPointId.selectAll);
      }

      if (this.productEntries.selected.length > 0) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.deselectAll).method = () => {
          this.productEntries.allSelected = false;
        };
      }
      else {
          this.app.disableMenuPoint(ExpirySync.MenuPointId.deselectAll);
      }
    }
    else {
      this.app.disableMenuPoint(ExpirySync.MenuPointId.selectAll);
      this.app.disableMenuPoint(ExpirySync.MenuPointId.deselectAll);
    }

    if (this.productEntries.selected.length > 0) {
      this.app.enableMenuPoint(ExpirySync.MenuPointId.recipeSearch).method = () => {
        const modal = this.modalCtrl.create(RecipeSearchModal, {selectedProductEntries: this.productEntries.selected});
        modal.present();
      };

      if (this.locations.length > 1) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.moveEntriesToAnotherLocation).method = async () => {
          await this.syncDone();

          const modal = this.modalCtrl.create(ProductEntryMoveFormModal, {selectedProductEntries: this.productEntries.selected, locations: this.locations, selectedLocation: this.selectedLocation});
          this.setLocalChangesDonePromise(new Promise<void>(async resolve => {
            modal.present();
            modal.onDidDismiss(() => {
              resolve();
            });
          }));
        };
      }
    }
    else {
      this.app.disableMenuPoint(ExpirySync.MenuPointId.recipeSearch);
      this.app.disableMenuPoint(ExpirySync.MenuPointId.moveEntriesToAnotherLocation);
    }

  }

}
