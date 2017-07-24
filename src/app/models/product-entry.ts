import { AppModel, Column, HasOne, PersistenceModel, RecordNotFoundError } from '../utils/orm';
import { Article, ArticleImage, Location, User, Setting } from '../models';
import { ApiServer, ApiServerCall } from '../utils/api-server';
import { ExpirySync } from '../app.expiry-sync'

import * as moment from 'moment';
import 'moment/min/locales';

declare var cordova;

@PersistenceModel
export class ProductEntry extends AppModel {
  static tableName = 'ProductEntry';

  /**
   * Relations:
   */

  @HasOne('Article')
  article:Article;

  @HasOne('Location')
  location:Location;

  @HasOne('User')
  creator:User;

  /**
   * Columns:
   */

  @Column()
  amount:number = 1;

  @Column()
  description:string;

  @Column()
  freeToTake:boolean = false;

  @Column()
  inSync:boolean = false;

  @Column("DATE")
  expirationDate:Date = new Date();

  @Column("DATE")
  createdAt:Date = new Date();

  @Column("DATE")
  updatedAt:Date = new Date();

  @Column("DATE")
  deletedAt:Date;

  @Column()
  articleId:string;

  @Column()
  locationId:string;

  @Column()
  creatorId:string;

  @Column()
  serverId:number;

  private isSelected:boolean = false;

  addRemoveAnimation:string = 'normal';

  set selected(selected:boolean) {
    this.isSelected = selected;
    let app = ExpirySync.getInstance();
    app.events.publish('productEntries:selectionChanged');
  }

  get selected():boolean {
    return this.isSelected;
  }


  set expirationDateIsoStr(date:any) {
    // TODO: Remove all this after upgrading to ionic-angular 3.1.1:
    // (s. https://github.com/driftyco/ionic/issues/11503)
    if (typeof(date) == 'string') {
      this.expirationDate = new Date(date);
    }
    else {
      this.expirationDate = new Date(Date.UTC(date.year, date.month-1, date.day, 0, 0, 0, 0));
    }
  }

  get expirationDateIsoStr():any {
    return moment(this.expirationDate).toISOString();
  }

  async markForDeletion():Promise<void> {
    if (!this.serverId) {
      return this.delete();
    }

    this.deletedAt = new Date();
    this.inSync = false;
    return this.save();
  }

  static createFromServerData(productEntryData):ProductEntry {
    let productEntry:ProductEntry = new ProductEntry();
    productEntry.amount = productEntryData.amount;
    productEntry.description = productEntryData.description;
    productEntry.freeToTake = productEntryData.free_to_take;
    productEntry.expirationDate = ApiServer.parseHttpDate(productEntryData.expiration_date);
    productEntry.createdAt = ApiServer.parseHttpDate(productEntryData.created_at);
    productEntry.updatedAt = ApiServer.parseHttpDate(productEntryData.updated_at);
    productEntry.deletedAt = ApiServer.parseHttpDate(productEntryData.deleted_at);
    if (productEntryData.creator != undefined) {
      productEntry.creator = User.createFromServerData(productEntryData.creator);
    }
    productEntry.serverId = productEntryData.id;
    productEntry.article = Article.createFromServerData(productEntryData.article);

    return productEntry;
  }

  toServerData() {
    let productEntryData:any = {
      description: this.description,
      free_to_take: this.freeToTake,
      amount: this.amount,
      location_id: this.location.serverId,
      expiration_date: ApiServer.dateToHttpDate(this.expirationDate),
      created_at: ApiServer.dateToHttpDate(this.createdAt),
      updated_at: ApiServer.dateToHttpDate(this.updatedAt),
      article: this.article.toServerData()
    };

    if (this.serverId) {
      productEntryData.id = this.serverId;
    }

    return productEntryData;
  }

  static async pullAll(modifiedAfter?:Date, updateId?:number, locationsCreatedByPull?:Array<Location>):Promise<void> {
    if (typeof(locationsCreatedByPull) == "undefined") {
      locationsCreatedByPull = [];
    }

    let locations:Array<Location> = <Array<Location>> await Location
      .all()
      .filter('deletedAt', '=', null)
      .filter('serverId', '!=', null)
      .list();

    for (let location of locations) {
      await ProductEntry.pullAllByLocation(location, locationsCreatedByPull.find(pulledLocation => (pulledLocation.id == location.id)) ? null : modifiedAfter, updateId);
    }
  }

  private static async pullAllByLocation(location:Location, modifiedAfter?:Date, updateId?:number) {
    let productEntrySyncList:ProductEntrySyncList = await location.fetchProductEntriesSyncList(modifiedAfter);
    for (let productEntry of productEntrySyncList.productEntries) {
      if (productEntry.serverId == updateId) {
        continue; // we're going to update it in the same process -> don't pull
      }

      productEntry.inSync = true;
      productEntry.location = location;
      productEntry.locationId = location.id;
      await productEntry.updateOrAddByServerId();
    }

    for (let productEntryToDelete of productEntrySyncList.deletedProductEntries) {
      try {
        let dbProductEntry:ProductEntry = <ProductEntry> await ProductEntry.findBy('serverId', productEntryToDelete.serverId);
        await dbProductEntry.delete();
      }
      catch(e) {
        if (!(e instanceof RecordNotFoundError)) {
          throw(e);
        }
      }
    }
  }

  static async pushAll():Promise<void> {
    let productEntries:Array<ProductEntry> = <Array<ProductEntry>> await ProductEntry
      .all()
      .filter('inSync', '=', false)
      .prefetch('article')
      .prefetch('location')
      .list();

    for (let productEntry of productEntries) {
      await productEntry.push();
    }
  }

  public async push():Promise<void> {
    let callId:number = ApiServerCall.createProductEntry;
    let params:any = {};

    if (this.serverId) {
      params['product_entry_id'] = this.serverId;
      if (this.deletedAt) {
        callId = ApiServerCall.deleteProductEntry;
      }
      else {
        callId = ApiServerCall.updateProductEntry;
      }
    }

    if (!this.deletedAt) {
      this.article.images = <Array<ArticleImage>> await ArticleImage
        .all()
        .filter('articleId', '=', this.article.id)
        .list();
      params.product_entry = this.toServerData();
    }

    let productEntryData = await ApiServer.call(callId, params);
    if (this.deletedAt) {
      await this.delete();
    }
    else {
      let receivedEntry:ProductEntry = ProductEntry.createFromServerData(productEntryData.product_entry);
      this.serverId = receivedEntry.serverId;
      this.article.serverId = receivedEntry.article.serverId;
      await this.article.save();
      this.inSync = true;
      await this.save();
    }
  }

  public async updateOrAddByServerId():Promise<ProductEntry> {
    try {
      var productEntry:ProductEntry = <ProductEntry> await ProductEntry.findBy('serverId', this.serverId);

      // update:
      productEntry.description = this.description;
      productEntry.amount = this.amount;
      productEntry.expirationDate = this.expirationDate;
      productEntry.freeToTake = this.freeToTake;
      productEntry.createdAt = this.createdAt;
      productEntry.updatedAt = this.updatedAt;
      productEntry.deletedAt = this.deletedAt;
      productEntry.locationId = this.locationId;
      productEntry.inSync = this.inSync;
    }
    catch(e) {
      // create:
      productEntry = this;
    }

    productEntry.location = this.location;

    productEntry.article = await this.article.updateOrAddByBarcodeOrServerId();
    productEntry.articleId = productEntry.article.id;

    productEntry.creator = await this.creator.updateOrAddByServerId();
    productEntry.creatorId = productEntry.creator.id;

    await productEntry.save();
    return productEntry;
  }

  async save():Promise<void> {
    const app:ExpirySync = ExpirySync.getInstance();
    if (!this.creatorId && !this.serverId && app.currentUser) {
      this.creatorId = app.currentUser.id;
    }
    return super.save();
  }

  get ownedByCurrentUser():boolean {
    const app:ExpirySync = ExpirySync.getInstance();
    return (!this.creatorId || (app.currentUser && app.currentUser.id == this.creatorId));
  }

  expirationDateBeyondThreshold(days:number):boolean {
    if (!this.expirationDate) {
      return null;
    }

    let datePlusThreshold:Date = moment().add(days, 'days').toDate();
    return datePlusThreshold > this.expirationDate;
  }

  get goneBad():boolean {
    let days:number = parseInt(Setting.cached('daysBeforeBad'));
    return this.expirationDateBeyondThreshold(days);
  }

  get goneMedium():boolean {
    let days:number = parseInt(Setting.cached('daysBeforeMedium'));
    return this.expirationDateBeyondThreshold(days);
  }
}

export interface ProductEntrySyncList {
  productEntries: Array<ProductEntry>,
  deletedProductEntries: Array<ProductEntry>
}
