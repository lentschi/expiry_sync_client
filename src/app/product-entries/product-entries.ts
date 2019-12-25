import { Component, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { ModalController, Events, IonInput } from '@ionic/angular';
import { ProductEntry, Location, Setting, User } from '../../app/models';
import { ExpirySync } from '../../app/app.expiry-sync';
import { ExpirySyncController } from '../../app/app.expiry-sync-controller';
import { ProductEntriesListAdapter } from './product-entries-list-adapter';
import { TranslateService } from '@ngx-translate/core';
import { UiHelper } from 'src/utils/ui-helper';
import { ProductEntryFormModal } from 'src/modal/product-entries/form/product-entry-form';
import { RecipeSearchModal } from 'src/modal/recipes/search/recipe-search';
import { ProductEntryMoveFormModal } from 'src/modal/product-entries/move-form/product-entry-move-form';
import { SynchronizationHandler } from '../services/synchronization-handler.service';


@Component({
  selector: 'product-entries',
  styleUrls: ['product-entries.scss'],
  templateUrl: 'product-entries.html',
  animations: [
    trigger('addRemoveAnimation', [
      state('normal', style(
        { color: '#888' }
      )),
      state('green', style(
        { color: '#0c0' }
      )),
      state('red', style(
        { color: '#c00' }
      )),
      transition('normal <=> green', animate('200ms linear')),
      transition('normal <=> red', animate('200ms linear'))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductEntriesPage extends ExpirySyncController {

  constructor(
    private modalCtrl: ModalController,
    private uiHelper: UiHelper,
    private synchronizationHandler: SynchronizationHandler,
    private cd: ChangeDetectorRef,
    events: Events,
    translate: TranslateService
  ) {
    super(translate);
    this.productEntries = new ProductEntriesListAdapter();
    this.app = ExpirySync.getInstance();
    this.app.entriesList = this;

    ExpirySync.ready().then(async () => {
      await this.showListAndFilters();
      this.enableDisableMenuPoints();
      Setting.onChange('lastSync', async (setting: Setting) => {
        if (setting.value === '') {
          // Happens if the user is changed -> show an empty list until the new one has been pulled:
          await this.showListAndFilters();
        }
      });

      events.subscribe('app:timeLocaleAdjusted', () => {
        // TODO: Unsure: Why this is required:
        this.productEntries.setValues([]);
        this.loadingAfterLocationSwitchDone = false;
        this.showListAndFilters();
      });
    });

    events.subscribe('app:syncDone', () => {
      this.synchronizationHandler.localChangesMutex.acquireFor(
        () => this.showListAndFilters()
      );
    });

    events.subscribe('app:localeChangedByNotificationTap', () => {
      this.synchronizationHandler.localChangesMutex.acquireFor(
        async () => {
          await this.showListAndFilters();
          this.cd.detectChanges();
        }
      );
    });

    events.subscribe('productEntries:selectionChanged', () => {
      this.enableDisableMenuPoints();
    });

    // TODO: UPGRADE?:
    // this.navCtrl.viewWillLeave.subscribe(() => {
    //   // this.app.disableMenuPoint(ExpirySync.MenuPointId.addProduct);
    // });
  }
  private currentProductEntries: ProductEntriesListAdapter;
  locations: Array<Location>;
  selectedLocationId: string;
  selectedLocation: Location;
  private app: ExpirySync;
  showFilter = false;
  loadingAfterLocationSwitchDone = false;
  currentUser: User;

  @ViewChild('filterField', { static: false }) filterField: IonInput;

  private deregisterBackButtonHandler: Function;

  get productEntries(): ProductEntriesListAdapter {
    return this.currentProductEntries;
  }

  set productEntries(entries: ProductEntriesListAdapter) {
    this.currentProductEntries = entries;
  }

  async showList() {
    // var loadingTask:Symbol = this.app.loadingStarted('Listing entries');
    this.selectedLocation = await Location.getSelected();
    if (this.selectedLocation) {
      this.selectedLocationId = this.selectedLocation.id;
    } else {
      this.selectedLocationId = '';
    }

    const locations = <Array<Location>>await Location
      .all()
      .filter('deletedAt', '=', null)
      .list();

    // only replace locations, if there has been a change (makes the ion-select reset):
    const locationsChanged = !this.locations || locations.length !== this.locations.length || !locations.every(currentLocation =>
      this.locations.some(currentExistingLocation =>
        currentExistingLocation.id === currentLocation.id
        && currentExistingLocation.name === currentLocation.name
      )
    );
    if (locationsChanged) {
      this.locations = locations;
    }

    const query = ProductEntry
      .all()
      .prefetch('article')
      .prefetch('creator')
      .prefetch('location')
      .filter('deletedAt', '=', null);

    if (this.selectedLocationId) {
      query.filter('locationId', '=', this.selectedLocationId);
    }

    const dbEntries: Array<ProductEntry> = <Array<ProductEntry>>await query.list();

    const previouslySelectedEntries: Array<ProductEntry> = this.productEntries.selected;

    // sort the retrieved entries:
    this.productEntries.setValues(dbEntries);
    this.productEntries.sortBySortField();
    this.productEntries.filterByFilterValue();

    // re-select previously selected entries:
    for (const selectedEntry of previouslySelectedEntries) {
      const entry: ProductEntry = this.productEntries.find(currentEntry => currentEntry.id === selectedEntry.id);
      if (entry) {
        entry.selected = true;
      }
    }

    this.loadingAfterLocationSwitchDone = true;
    this.cd.markForCheck();
  }

  async showListAndFilters() {
    const creatorFilter = this.productEntries.creatorFilter;
    if (creatorFilter) {
      this.app.enableMenuPoint(ExpirySync.MenuPointId.filterAllUsers).method = () => {
        this.productEntries.filterValue = creatorFilter.remainingFilter;
        if (this.productEntries.filterValue === '') {
          this.showFilter = false;
        }
        this.showListAndFilters();
      };
      this.app.disableMenuPoint(ExpirySync.MenuPointId.filterCurrentUser);
    } else {
      if (this.app.currentUser.userName) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.filterCurrentUser).method = () => {
          if (this.productEntries.filterValue !== '') {
            this.productEntries.filterValue += ' ';
          }
          this.productEntries.filterValue += `by:"${this.app.currentUser.userName.replace(/"/g, '\\"')}" `;
          this.showFilter = true;
          this.showListAndFilters();
        };
      }
      this.app.disableMenuPoint(ExpirySync.MenuPointId.filterAllUsers);
    }

    this.currentUser = this.app.currentUser;
    await this.showList();
  }

  private async onEntryUpdated(updatedEntry?: ProductEntry, showList: boolean = true) {
    if (showList) {
      await this.showList();
    }
    if (this.app.currentUser.loggedIn) {
      this.app.synchronize();
    }
  }


  async locationSwitched() {
    const task: Symbol = this.app.loadingStarted('Switching location');

    const oldSelectionId = this.selectedLocation ? this.selectedLocation.id : null;
    if (oldSelectionId !== this.selectedLocationId) {
      this.loadingAfterLocationSwitchDone = false;
      this.productEntries.setValues([]);
      const oldSelection = this.selectedLocation;

      // select new location:
      if (this.selectedLocationId) {
        this.selectedLocation = <Location>await Location.findBy('id', this.selectedLocationId);
        this.selectedLocation.isSelected = true;
        await this.selectedLocation.save();
      } else {
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


  async openEntryForm(productEntry?: ProductEntry) {
    await this.synchronizationHandler.acquireLocalChangesMutex();

    const params: any = {};
    if (productEntry) {
      params.id = productEntry.id;
      params.displayLocation = !this.selectedLocation;
    }

    const modal = await this.modalCtrl.create({ component: ProductEntryFormModal, componentProps: params });
    modal.onDidDismiss().then(async (event) => {
      const returnedProductEntry: ProductEntry = event.data;
      if (returnedProductEntry) {
        await this.onEntryUpdated(returnedProductEntry);
      }
      this.synchronizationHandler.localChangesMutex.release();
    });
    modal.present();
  }

  async productEntrySwipedLeft(productEntry: ProductEntry) {
    await this.synchronizationHandler.acquireLocalChangesMutex();

    productEntry = <ProductEntry>await ProductEntry.findBy('id', productEntry.id);
    if (productEntry.amount === 1) {
      this.productEntries.anySelected = false;
      productEntry.selected = true;
      await this.viewChangeOccurred();
      if (await this.uiHelper.confirm(await this.pluralTranslate('Really delete those products?', 1))) {
        await productEntry.markForDeletion();
      }
      await this.onEntryUpdated(productEntry);
      this.synchronizationHandler.localChangesMutex.release();
      return;
    }
    productEntry.amount--;
    productEntry.inSync = false;

    await productEntry.save();
    await this.onEntryUpdated(productEntry);

    this.synchronizationHandler.localChangesMutex.release();

    productEntry.addRemoveAnimation = 'red';
  }

  async productEntrySwipedRight(productEntry: ProductEntry) {
    await this.synchronizationHandler.acquireLocalChangesMutex();

    productEntry = <ProductEntry>await ProductEntry.findBy('id', productEntry.id);
    productEntry.amount++;
    productEntry.inSync = false;

    await productEntry.save();
    await this.onEntryUpdated(productEntry);
    this.synchronizationHandler.localChangesMutex.release();

    productEntry.addRemoveAnimation = 'green';
  }

  productEntryCheckboxTapped(event: Event, productEntry: ProductEntry) {
    productEntry.selected = !productEntry.selected;
    event.stopPropagation();
  }

  sortTapped(sortBy: string) {
    if (this.productEntries.sortBy === sortBy) {
      this.productEntries.sortAscending = !this.productEntries.sortAscending;
    } else {
      this.productEntries.sortBy = sortBy;
      this.productEntries.sortAscending = true;
    }
    this.showList();
  }

  async deleteAllTapped() {
    await this.synchronizationHandler.acquireLocalChangesMutex();

    if (! await this.uiHelper.confirm(await this.pluralTranslate('Really delete those products?', this.productEntries.selected.length))) {
      this.synchronizationHandler.localChangesMutex.release();
      return;
    }
    for (const productEntry of this.productEntries.selected) {
      await productEntry.markForDeletion();
    }
    await this.onEntryUpdated();
    this.synchronizationHandler.localChangesMutex.release();
  }

  async toggleSearchTapped() {
    this.showFilter = !this.showFilter;
    await this.viewChangeOccurred();
    if (this.showFilter) {
      this.filterField.setFocus();
      // TODO: UPGRADE:
      // this.deregisterBackButtonHandler = this.platform.registerBackButtonAction(e => {
      //   this.toggleSearchTapped();
      // }, 102);
    } else {
      if (this.deregisterBackButtonHandler) {
        this.deregisterBackButtonHandler();
      }
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
      } else {
        this.app.disableMenuPoint(ExpirySync.MenuPointId.selectAll);
      }

      if (this.productEntries.selected.length > 0) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.deselectAll).method = () => {
          this.productEntries.allSelected = false;
        };
      } else {
        this.app.disableMenuPoint(ExpirySync.MenuPointId.deselectAll);
      }
    } else {
      this.app.disableMenuPoint(ExpirySync.MenuPointId.selectAll);
      this.app.disableMenuPoint(ExpirySync.MenuPointId.deselectAll);
    }

    if (this.productEntries.selected.length > 0) {
      this.app.enableMenuPoint(ExpirySync.MenuPointId.recipeSearch).method = async () => {
        const modal = await this.modalCtrl.create(
          { component: RecipeSearchModal, componentProps: { selectedProductEntries: this.productEntries.selected } }
        );
        modal.present();
      };

      if (this.locations.length > 1 && this.selectedLocation) {
        this.app.enableMenuPoint(ExpirySync.MenuPointId.moveEntriesToAnotherLocation).method = async () => {
          await this.synchronizationHandler.acquireLocalChangesMutex();
          const modal = await this.modalCtrl.create({
            component: ProductEntryMoveFormModal,
            componentProps: {
              productEntries: this.productEntries.selected,
              allLocations: this.locations,
              currentLocation: this.selectedLocation
            }
          });
          modal.present();
          modal.onDidDismiss().then(() => {
            this.synchronizationHandler.localChangesMutex.release();
          });
        };
      }
    } else {
      this.app.disableMenuPoint(ExpirySync.MenuPointId.recipeSearch);
      this.app.disableMenuPoint(ExpirySync.MenuPointId.moveEntriesToAnotherLocation);
    }

  }

}
