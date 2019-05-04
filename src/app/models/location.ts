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
  static allowImplicitCreation = true;

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

  @Column()
  syncInProgress: boolean;

  @Column('DATE')
  lastSuccessfulSync: Date;

  @Column('DATE')
  createdAt: Date = new Date();

  @Column('DATE')
  updatedAt: Date = new Date();

  @Column('DATE')
  deletedAt: Date;

  @Column()
  creatorId: string;

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

  static async markAllSyncInProgressDone(syncDoneTimestamp: Date): Promise<void> {
    return Location
      .all()
      .filter('syncInProgress', '=', true)
      .update([
        {propertyName: 'syncInProgress', value: false},
        {propertyName: 'lastSuccessfulSync', value: syncDoneTimestamp},
      ]);
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
    location.id = locationData.id;
    return location;
  }

  static async fetchSyncList(modifiedAfter?: Date): Promise<LocationSyncList> {
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

  static async getOutOfSync(includeSyncInProgress = false): Promise<Location[]> {
    const locations: Array<Location> = <Array<Location>>await Location
      .all()
      .filter('inSync', '=', false)
      .list();

    if (includeSyncInProgress) {
      locations.push(...<Array<Location>>await Location
        .all()
        .filter('syncInProgress', '=', true)
        .list()
      );
    }

    return locations;
  }

  static async pushAll(): Promise<void> {
    const locations: Array<Location> = <Array<Location>>await Location
      .all()
      .filter('inSync', '=', false)
      .list();

    for (const location of locations) {
      await location.storeOnServer();
    }
  }

  async markForDeletion(): Promise<void> {
    if (!this.lastSuccessfulSync) {
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
      id: this.id,
      name: this.name
    };

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
      location_id: this.id
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

  public async storeOnServer(): Promise<Location> {
    let callId: number = ApiServerCall.createLocation;
    const params: any = {};
    const app: ExpirySync = ExpirySync.getInstance();

    params['location_id'] = this.id;
    if (this.deletedAt) {
      callId = ApiServerCall.removeLocationShare;
      params['user_id'] = app.currentUser.serverId;
    } else {
      callId = ApiServerCall.updateLocation;
    }

    if (!this.deletedAt) {
      params['location'] = this.toServerData();
    }

    const locationData = await ApiServer.call(callId, params);
    return Location.createFromServerData(locationData.location);
  }

  async storeInLocalDb(syncDoneTimestamp: Date): Promise<Location> {
    this.inSync = true;
    this.lastSuccessfulSync = syncDoneTimestamp;
    this.creator = await this.creator.updateOrAddByServerId();
    this.creatorId = this.creator.id;
    await this.save();
    await this.updateShares();
    return this;
  }

  async addRemoteShare(user: User): Promise<User> {
    const params: any = {
      location_id: this.id,
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
    if (!this.creatorId && !this.lastSuccessfulSync && app.currentUser) {
      this.creatorId = app.currentUser.id;
    }
    return await super.save();
  }
}


export interface LocationSyncList {
  locations: Array<Location>;
  deletedLocations: Array<Location>;
}
