import { AppModel, Column, PersistenceModel, HasOne, RecordNotFoundError } from '../../utils/orm';
import { ProductEntry, ProductEntrySyncList, LocationShare } from '../models';
import { User } from '../models';
import { ApiServer, ApiServerCall } from '../../utils/api-server';
import { ExpirySync } from '../app.expiry-sync';

@PersistenceModel
export class Location extends AppModel {

  get ownedByCurrentUser(): boolean {
    const app: ExpirySync = ExpirySync.getInstance();
    return (!this.creatorId || (app.currentUser && app.currentUser.id === this.creatorId));
  }
  static tableName = 'Location';

  @HasOne('User')
  creator: User;

  // @HasMany('LocationShare')
  locationShares: Array<LocationShare>;

  @Column()
  name: string;

  @Column()
  isSelected: boolean;

  @Column()
  inSync: boolean;

  @Column('DATE')
  createdAt: Date;

  @Column('DATE')
  updatedAt: Date;

  @Column('DATE')
  deletedAt: Date;

  @Column()
  creatorId: string;

  @Column()
  serverId: number;

  justCreatedByPull = false;

  static async createDefault(): Promise<Location> {
    console.log('Creating default location');
    const location: Location = new this();
    location.isSelected = true;
    location.name = await ExpirySync.getInstance().translate('At home');
    await location.save();

    return location;
  }

  static async getSelected(): Promise<Location> {
    try {
      const location: Location = <Location>await this.findBy('isSelected', true);
      return location;
    } catch (e) {
      if (await this.all().count() === 0) {
        return this.createDefault();
      }

      return null;
    }
  }

  private static createFromServerData(locationData): Location {
    const app: ExpirySync = ExpirySync.getInstance();
    const location = new Location();
    location.name = locationData.name;
    location.createdAt = ApiServer.parseHttpDate(locationData.created_at);
    location.updatedAt = ApiServer.parseHttpDate(locationData.updated_at);
    location.deletedAt = ApiServer.parseHttpDate(locationData.deleted_at);
    if (locationData.creator !== undefined) {
      location.creator = User.createFromServerData(locationData.creator);
    }
    if (locationData.users !== undefined) {
      location.locationShares = [];
      for (const userData of locationData.users) {
        const share: LocationShare = new LocationShare();
        share.user = User.createFromServerData(userData);
        share.location = location;

        if (share.user.serverId !== app.currentUser.serverId) { // ignore current user
          location.locationShares.push(share);
        }
      }
    }
    location.serverId = locationData.id;
    return location;
  }

  static async hasRemoteChanges(modifiedAfter?: Date): Promise<boolean> {
    const locationSyncList: LocationSyncList = await Location.fetchSyncList(modifiedAfter);
    return locationSyncList.locations.length > 0 || locationSyncList.deletedLocations.length > 0;
  }

  static async pullAll(modifiedAfter?: Date, updateId?: number): Promise<Array<Location>> {
    const newLocations = [];
    const app: ExpirySync = ExpirySync.getInstance();
    const locationSyncList: LocationSyncList = await Location.fetchSyncList(modifiedAfter);
    let updateFirstWithoutServerId: boolean = !modifiedAfter;
    for (const location of locationSyncList.locations) {
      if (location.serverId === updateId) {
        continue; // we're going to update it in the same process -> don't pull
      }

      location.inSync = true;
      await location.updateOrAddByServerId(updateFirstWithoutServerId && location.creator.serverId === app.currentUser.serverId);
      if (location.creator.serverId === app.currentUser.serverId) {
        updateFirstWithoutServerId = false;
      }
      if (location.justCreatedByPull) {
        newLocations.push(location);
      }
    }

    for (const locationToDelete of locationSyncList.deletedLocations) {
      try {
        const dbLocation: Location = <Location>await Location.findBy('serverId', locationToDelete.serverId);
        await dbLocation.delete();
      } catch (e) {
        if (!(e instanceof RecordNotFoundError)) {
          throw (e);
        }
      }
    }

    return newLocations;
  }

  private static async fetchSyncList(modifiedAfter?: Date): Promise<LocationSyncList> {
    const params: any = {};
    if (modifiedAfter) {
      params.from_timestamp = ApiServer.dateToHttpDate(modifiedAfter);
      params.time_skew = ApiServer.getInstance().timeSkew;
    }
    const serverData = await ApiServer.call(ApiServerCall.getLocations, params);
    const syncList: LocationSyncList = {
      locations: [],
      deletedLocations: []
    };

    for (const locationData of serverData.locations) {
      syncList.locations.push(Location.createFromServerData(locationData));
    }

    for (const locationData of serverData.deleted_locations) {
      syncList.deletedLocations.push(Location.createFromServerData(locationData));
    }

    return syncList;
  }

  static async hasLocalChanges(): Promise<boolean> {
    const count = await Location
      .all()
      .filter('inSync', '=', false)
      .count();

    return count > 0;
  }

  static async pushAll(): Promise<void> {
    const locations: Array<Location> = <Array<Location>>await Location
      .all()
      .filter('inSync', '=', false)
      .list();

    for (const location of locations) {
      await location.push();
    }
  }

  async markForDeletion(): Promise<void> {
    if (!this.serverId) {
      await ProductEntry
        .all()
        .filter('locationId', '=', this.id)
        .prefetch('location')
        .delete();
      return this.delete();
    }

    this.deletedAt = new Date();
    this.inSync = false;
    this.isSelected = false;
    return this.save();
  }

  toServerData() {
    const locationData: any = {
      name: this.name
    };

    if (this.serverId) {
      locationData.id = this.serverId;
    }

    return locationData;
  }

  private async deleteAllShares(): Promise<void> {
    return LocationShare
      .all()
      .filter('locationId', '=', this.id)
      .prefetch('location')
      .delete();
  }

  async delete(): Promise<void> {
    await this.deleteAllShares();
    await super.delete();
  }

  async fetchProductEntriesSyncList(modifiedAfter?: Date): Promise<ProductEntrySyncList> {
    const params: any = {
      location_id: this.serverId
    };
    if (modifiedAfter) {
      params.from_timestamp = ApiServer.dateToHttpDate(modifiedAfter);
    }
    const serverData = await ApiServer.call(ApiServerCall.getProductEntries, params);
    const syncList: ProductEntrySyncList = {
      productEntries: [],
      deletedProductEntries: []
    };

    for (const productEntryData of serverData.product_entries) {
      syncList.productEntries.push(ProductEntry.createFromServerData(productEntryData));
    }

    for (const productEntryData of serverData.deleted_product_entries) {
      syncList.deletedProductEntries.push(ProductEntry.createFromServerData(productEntryData));
    }

    return syncList;
  }

  public async push(): Promise<void> {
    let callId: number = ApiServerCall.createLocation;
    const params: any = {};
    const app: ExpirySync = ExpirySync.getInstance();

    if (this.serverId) {
      params['location_id'] = this.serverId;
      if (this.deletedAt) {
        callId = ApiServerCall.removeLocationShare;
        params['user_id'] = app.currentUser.serverId;
      } else {
        callId = ApiServerCall.updateLocation;
      }
    }

    if (!this.deletedAt) {
      params['location'] = this.toServerData();
    }

    const locationData = await ApiServer.call(callId, params);
    if (this.deletedAt) {
      await ProductEntry
        .all()
        .filter('locationId', '=', this.id)
        .prefetch('location')
        .delete();
      await this.delete();
    } else {
      const receivedLocation: Location = Location.createFromServerData(locationData.location);
      this.serverId = receivedLocation.serverId;
      this.inSync = true;
      await this.save();
    }
  }

  async addRemoteShare(user: User): Promise<User> {
    const params: any = {
      location_id: this.serverId,
      user: {}
    };

    if (user.userName) {
      params.user.username = user.userName;
    } else if (user.email) {
      params.user.email = user.email;
    }

    const userData = await ApiServer.call(ApiServerCall.shareLocation, params);
    return User.createFromServerData(userData.user);
  }

  public async updateOrAddByServerId(updateFirstWithoutServerId?: boolean): Promise<Location> {
    let location: Location = null;
    try {
      // update record with matching serverId:
      location = <Location>await Location.findBy('serverId', this.serverId);
    } catch (e) { }

    if (updateFirstWithoutServerId) {
      try {
        // update first without serverId:
        location = <Location>await Location
          .all()
          .filter('serverId', '=', null)
          .one();

        location.serverId = this.serverId;
      } catch (e2) { }
    }

    if (location) {
      // update:
      location.name = this.name;
      location.createdAt = this.createdAt;
      location.updatedAt = this.updatedAt;
      location.deletedAt = this.deletedAt;
      location.inSync = this.inSync;
      location.locationShares = this.locationShares;
      location.creator = this.creator;
    } else {
      // create:
      this.justCreatedByPull = true;
      location = this;
    }

    location.creator = await location.creator.updateOrAddByServerId();
    location.creatorId = location.creator.id;

    await location.save();
    await location.updateShares();
    return location;
  }

  private async updateShares(): Promise<void> {
    // Remove all shares:
    await this.deleteAllShares();

    // Add them back in:
    for (const share of this.locationShares) {
      share.user = await share.user.updateOrAddByServerId();
      share.userId = share.user.id;
      share.location = this;
      share.locationId = this.id;
      await share.save();
    }
  }

  async save(): Promise<void> {
    const app: ExpirySync = ExpirySync.getInstance();
    if (!this.creatorId && !this.serverId && app.currentUser) {
      this.creatorId = app.currentUser.id;
    }
    return await super.save();
  }
}


export interface LocationSyncList {
  locations: Array<Location>;
  deletedLocations: Array<Location>;
}
