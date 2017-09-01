import { AppModel, Column, PersistenceModel, HasOne, RecordNotFoundError } from '../utils/orm';
import { ProductEntry, ProductEntrySyncList, LocationShare } from '../models';
import { User } from '../models';
import { ApiServer, ApiServerCall } from '../utils/api-server';
import { ExpirySync } from '../app.expiry-sync'

@PersistenceModel
export class Location extends AppModel {
  static tableName = 'Location';

  @HasOne('User')
  creator:User;

  // @HasMany('LocationShare')
  locationShares:Array<LocationShare>;

  @Column()
  name:string;

  @Column()
  isSelected:boolean = false;

  @Column()
  inSync:boolean = false;

  @Column("DATE")
  createdAt:Date;

  @Column("DATE")
  updatedAt:Date;

  @Column("DATE")
  deletedAt:Date;

  @Column()
  creatorId:string;

  @Column()
  serverId:number;

  justCreatedByPull:boolean = false;

  static async createDefault():Promise<Location> {
    console.log("Creating default location");
    let location:Location = new this();
    location.isSelected = true;
    location.name = await ExpirySync.getInstance().translate('At home');
    await location.save();

    return location;
  }

  static async getSelected():Promise<Location> {
    try {
      let location:Location = <Location> await this.findBy('isSelected', true);
      return location;
    }
    catch(e) {
      if (await this.all().count() == 0) {
        return this.createDefault();
      }

      return null;
    }
  }

  async markForDeletion():Promise<void> {
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

  private static createFromServerData(locationData):Location {
    let app:ExpirySync = ExpirySync.getInstance();
    let location = new Location();
    location.name = locationData.name;
    location.createdAt = ApiServer.parseHttpDate(locationData.created_at);
    location.updatedAt = ApiServer.parseHttpDate(locationData.updated_at);
    location.deletedAt = ApiServer.parseHttpDate(locationData.deleted_at);
    if (locationData.creator !== undefined) {
      location.creator = User.createFromServerData(locationData.creator);
    }
    if (locationData.users !== undefined) {
      location.locationShares = [];
      for (let userData of locationData.users) {
        let share:LocationShare = new LocationShare();
        share.user = User.createFromServerData(userData);
        share.location = location;

        if (share.user.serverId != app.currentUser.serverId) { // ignore current user
          location.locationShares.push(share);
        }
      }
    }
    location.serverId = locationData.id;
    return location;
  }

  toServerData() {
    let locationData:any = {
      name: this.name
    };

    if (this.serverId) {
      locationData.id = this.serverId;
    }

    return locationData;
  }

  static async pullAll(modifiedAfter?:Date, updateId?:number):Promise<Array<Location>> {
    let newLocations = [];
    let app:ExpirySync = ExpirySync.getInstance();
    let locationSyncList:LocationSyncList = await Location.fetchSyncList(modifiedAfter);
    let updateFirstWithoutServerId:boolean = !modifiedAfter;
    for (let location of locationSyncList.locations) {
      if (location.serverId == updateId) {
        continue; // we're going to update it in the same process -> don't pull
      }

      location.inSync = true;
      await location.updateOrAddByServerId(updateFirstWithoutServerId && location.creator.serverId == app.currentUser.serverId);
      if (location.creator.serverId == app.currentUser.serverId) {
        updateFirstWithoutServerId = false;
      }
      if (location.justCreatedByPull) {
        newLocations.push(location);
      }
    }

    for (let locationToDelete of locationSyncList.deletedLocations) {
      try {
        let dbLocation:Location = <Location> await Location.findBy('serverId', locationToDelete.serverId);
        await dbLocation.delete();
      }
      catch(e) {
        if (!(e instanceof RecordNotFoundError)) {
          throw(e);
        }
      }
    }

    return newLocations;
  }

  private async deleteAllShares():Promise<void> {
    return LocationShare
      .all()
      .filter('locationId', '=', this.id)
      .prefetch('location')
      .delete();
  }

  async delete():Promise<void> {
    await this.deleteAllShares();
    await super.delete();
  }

  private static async fetchSyncList(modifiedAfter?:Date):Promise<LocationSyncList> {
    let params:any = {};
    if (modifiedAfter) {
      params.from_timestamp = ApiServer.dateToHttpDate(modifiedAfter);
      params.time_skew = ApiServer.getInstance().timeSkew;
    }
    let serverData = await ApiServer.call(ApiServerCall.getLocations, params);
    let syncList:LocationSyncList = {
      locations: [],
      deletedLocations: []
    }

    for (let locationData of serverData.locations) {
      syncList.locations.push(Location.createFromServerData(locationData));
    }

    for (let locationData of serverData.deleted_locations) {
      syncList.deletedLocations.push(Location.createFromServerData(locationData));
    }

    return syncList;
  }

  async fetchProductEntriesSyncList(modifiedAfter?:Date):Promise<ProductEntrySyncList> {
    let params:any = {
      location_id: this.serverId
    };
    if (modifiedAfter) {
      params.from_timestamp = ApiServer.dateToHttpDate(modifiedAfter);
    }
    let serverData = await ApiServer.call(ApiServerCall.getProductEntries, params);
    let syncList:ProductEntrySyncList = {
      productEntries: [],
      deletedProductEntries: []
    }

    for (let productEntryData of serverData.product_entries) {
      syncList.productEntries.push(ProductEntry.createFromServerData(productEntryData));
    }

    for (let productEntryData of serverData.deleted_product_entries) {
      syncList.deletedProductEntries.push(ProductEntry.createFromServerData(productEntryData));
    }

    return syncList;
  }

  static async pushAll():Promise<void> {
    let locations:Array<Location> = <Array<Location>> await Location
      .all()
      .filter('inSync', '=', false)
      .list();

    for (let location of locations) {
      await location.push();
    }
  }

  public async push():Promise<void> {
    let callId:number = ApiServerCall.createLocation;
    let params:any = {};
    let app:ExpirySync = ExpirySync.getInstance();

    if (this.serverId) {
      params['location_id'] = this.serverId;
      if (this.deletedAt) {
        callId = ApiServerCall.removeLocationShare;
        params['user_id'] = app.currentUser.serverId;
      }
      else {
        callId = ApiServerCall.updateLocation;
      }
    }

    if (!this.deletedAt) {
      params['location'] = this.toServerData();
    }

    let locationData = await ApiServer.call(callId, params);
    if (this.deletedAt) {
      await ProductEntry
        .all()
        .filter('locationId', '=', this.id)
        .prefetch('location')
        .delete();
      await this.delete();
    }
    else {
      let receivedLocation:Location = Location.createFromServerData(locationData.location);
      this.serverId = receivedLocation.serverId;
      this.inSync = true;
      await this.save();
    }
  }

  async addRemoteShare(user:User):Promise<User> {
    let params:any = {
      location_id: this.serverId,
      user: {}
    };

    if (user.userName) {
      params.user.username = user.userName;
    }
    else if (user.email) {
      params.user.email = user.email;
    }

    let userData = await ApiServer.call(ApiServerCall.shareLocation, params);
    return User.createFromServerData(userData.user);
  }

  public async updateOrAddByServerId(updateFirstWithoutServerId?:boolean):Promise<Location> {
    let location:Location = null;
    try {
      // update record with matching serverId:
      location = <Location> await Location.findBy('serverId', this.serverId);
    }
    catch(e) { }

    if (updateFirstWithoutServerId) {
      try {
        // update first without serverId:
        location = <Location> await Location
          .all()
          .filter('serverId', '=', null)
          .one();

        location.serverId = this.serverId;
      }
      catch(e2) { }
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
    }
    else {
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

  private async updateShares():Promise<void> {
    // Remove all shares:
    await this.deleteAllShares();

    // Add them back in:
    for (let share of this.locationShares) {
      share.user = await share.user.updateOrAddByServerId();
      share.userId = share.user.id;
      share.location = this;
      share.locationId = this.id;
      await share.save();
    }
  }

  async save():Promise<void> {
    let app:ExpirySync = ExpirySync.getInstance();
    if (!this.creatorId && !this.serverId && app.currentUser) {
      this.creatorId = app.currentUser.id;
    }
    return await super.save();
  }

  get ownedByCurrentUser():boolean {
    const app:ExpirySync = ExpirySync.getInstance();
    return (!this.creatorId || (app.currentUser && app.currentUser.id == this.creatorId));
  }
}


export interface LocationSyncList {
  locations: Array<Location>,
  deletedLocations: Array<Location>
}
