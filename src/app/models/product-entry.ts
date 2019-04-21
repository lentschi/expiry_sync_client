import { AppModel, Column, HasOne, PersistenceModel, RecordNotFoundError } from '../../utils/orm';
import { Article, ArticleImage, Location, User, Setting } from '../models';
import { ApiServer, ApiServerCall } from '../../utils/api-server';
import { ExpirySync } from '../app.expiry-sync';

import * as moment from 'moment';
import 'moment/min/locales';

declare var cordova;

@PersistenceModel
export class ProductEntry extends AppModel {

  set selected(selected: boolean) {
    this.isSelected = selected;
    const app = ExpirySync.getInstance();
    app.events.publish('productEntries:selectionChanged');
  }

  get selected(): boolean {
    return this.isSelected;
  }


  set expirationDateIsoStr(date: any) {
    // TODO: Remove all this after upgrading to ionic-angular 3.1.1:
    // (s. https://github.com/driftyco/ionic/issues/11503)
    if (typeof (date) === 'string') {
      this.expirationDate = new Date(date);
    } else {
      this.expirationDate = new Date(Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0));
    }
  }

  get expirationDateIsoStr(): any {
    return moment(this.expirationDate).toISOString();
  }

  get ownedByCurrentUser(): boolean {
    const app: ExpirySync = ExpirySync.getInstance();
    return (!this.creatorId || (app.currentUser && app.currentUser.id === this.creatorId));
  }

  get goneBad(): boolean {
    const days: number = parseInt(Setting.cached('daysBeforeBad'), 10);
    return this.expirationDateBeyondThreshold(days);
  }

  get goneMedium(): boolean {
    const days: number = parseInt(Setting.cached('daysBeforeMedium'), 10);
    return this.expirationDateBeyondThreshold(days);
  }
  static tableName = 'ProductEntry';

  /**
   * Relations:
   */

  @HasOne('Article')
  article: Article;

  @HasOne('Location')
  location: Location;

  @HasOne('User')
  creator: User;

  /**
   * Columns:
   */

  @Column()
  amount = 1;

  @Column()
  description: string;

  @Column()
  freeToTake: boolean;

  @Column()
  inSync: boolean;

  @Column()
  syncInProgress: boolean;

  @Column('DATE')
  expirationDate: Date = new Date();

  @Column('DATE')
  createdAt: Date = new Date();

  @Column('DATE')
  updatedAt: Date = new Date();

  @Column('DATE')
  deletedAt: Date;

  @Column()
  articleId: string;

  @Column()
  locationId: string;

  @Column()
  creatorId: string;

  @Column()
  serverId: number;

  private isSelected = false;

  addRemoveAnimation = 'normal';

  static createFromServerData(productEntryData): ProductEntry {
    const productEntry: ProductEntry = new ProductEntry();
    productEntry.amount = productEntryData.amount;
    productEntry.description = productEntryData.description;
    productEntry.freeToTake = productEntryData.free_to_take;
    productEntry.expirationDate = ApiServer.parseHttpDate(productEntryData.expiration_date);
    productEntry.createdAt = ApiServer.parseHttpDate(productEntryData.created_at);
    productEntry.updatedAt = ApiServer.parseHttpDate(productEntryData.updated_at);
    productEntry.deletedAt = ApiServer.parseHttpDate(productEntryData.deleted_at);
    if (productEntryData.creator !== undefined) {
      productEntry.creator = User.createFromServerData(productEntryData.creator);
    }
    productEntry.serverId = productEntryData.id;
    productEntry.article = Article.createFromServerData(productEntryData.article);

    return productEntry;
  }

  static async hasRemoteChanges(modifiedAfter?: Date): Promise<boolean> {
    const locations: Array<Location> = <Array<Location>>await Location
      .all()
      .filter('deletedAt', '=', null)
      .filter('serverId', '!=', null)
      .list();

    for (const location of locations) {
      const productEntrySyncList: ProductEntrySyncList = await location.fetchProductEntriesSyncList(modifiedAfter);
      if (productEntrySyncList.productEntries.length > 0 || productEntrySyncList.deletedProductEntries.length > 0) {
        return true;
      }
    }

    return false;
  }


  static async pullAll(modifiedAfter?: Date, updateId?: number, locationsCreatedByPull?: Array<Location>): Promise<void> {
    if (typeof (locationsCreatedByPull) === 'undefined') {
      locationsCreatedByPull = [];
    }

    const locations: Array<Location> = <Array<Location>>await Location
      .all()
      .filter('deletedAt', '=', null)
      .filter('serverId', '!=', null)
      .list();

    for (const location of locations) {
      await ProductEntry.pullAllByLocation(
        location,
        locationsCreatedByPull.find(pulledLocation => (pulledLocation.id === location.id)) ? null : modifiedAfter, updateId
      );
    }
  }

  private static async pullAllByLocation(location: Location, modifiedAfter?: Date, updateId?: number) {
    const productEntrySyncList: ProductEntrySyncList = await location.fetchProductEntriesSyncList(modifiedAfter);
    for (const productEntry of productEntrySyncList.productEntries) {
      if (productEntry.serverId === updateId) {
        continue; // we're going to update it in the same process -> don't pull
      }

      productEntry.inSync = true;
      productEntry.location = location;
      productEntry.locationId = location.id;
      await productEntry.updateOrAddByServerId();
    }

    for (const productEntryToDelete of productEntrySyncList.deletedProductEntries) {
      try {
        const dbProductEntry: ProductEntry = <ProductEntry>await ProductEntry.findBy('serverId', productEntryToDelete.serverId);
        await dbProductEntry.delete();
      } catch (e) {
        if (!(e instanceof RecordNotFoundError)) {
          throw (e);
        }
      }
    }
  }

  static async hasLocalChanges(): Promise<boolean> {
    const count = await ProductEntry
      .all()
      .filter('inSync', '=', false)
      .prefetch('article')
      .prefetch('location')
      .count();

    return count > 0;
  }

  static async getOutOfSync(): Promise<ProductEntry[]> {
    const productEntries: Array<ProductEntry> = <Array<ProductEntry>>await ProductEntry
      .all()
      .filter('inSync', '=', false)
      .prefetch('article')
      .prefetch('location')
      .list();
      
    return productEntries;
  }

  static async pushAll(): Promise<void> {
    const productEntries: Array<ProductEntry> = <Array<ProductEntry>>await ProductEntry
      .all()
      .filter('inSync', '=', false)
      .prefetch('article')
      .prefetch('location')
      .list();

    for (const productEntry of productEntries) {
      await productEntry.push();
    }
  }

  async markForDeletion(): Promise<void> {
    if (!this.serverId) {
      return this.delete();
    }

    this.deletedAt = new Date();
    this.inSync = false;
    return this.save();
  }

  toServerData() {
    const productEntryData: any = {
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

  public async push(): Promise<void> {
    let callId: number = ApiServerCall.createProductEntry;
    const params: any = {};

    if (this.serverId) {
      params['product_entry_id'] = this.serverId;
      if (this.deletedAt) {
        callId = ApiServerCall.deleteProductEntry;
      } else {
        callId = ApiServerCall.updateProductEntry;
      }
    }

    if (!this.deletedAt) {
      this.article.images = <Array<ArticleImage>>await ArticleImage
        .all()
        .filter('articleId', '=', this.article.id)
        .list();
      params.product_entry = this.toServerData();
    }

    const productEntryData = await ApiServer.call(callId, params);
    const receivedEntry: ProductEntry = ProductEntry.createFromServerData(productEntryData.product_entry);
    this.serverId = receivedEntry.serverId;
    // const productEntryData = await ApiServer.call(callId, params);
    // if (this.deletedAt) {
    //   await this.delete();
    // } else {
    //   const receivedEntry: ProductEntry = ProductEntry.createFromServerData(productEntryData.product_entry);
    //   this.serverId = receivedEntry.serverId;
    //   this.article.serverId = receivedEntry.article.serverId;
    //   await this.article.save();
    //   this.inSync = true;
    //   await this.save();
    // }
  }

  public async updateOrAddByServerId(): Promise<ProductEntry> {
    let productEntry: ProductEntry;
    try {
      productEntry = <ProductEntry>await ProductEntry.findBy('serverId', this.serverId);

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
    } catch (e) {
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

  async save(): Promise<void> {
    const app: ExpirySync = ExpirySync.getInstance();
    if (!this.creatorId && !this.serverId && app.currentUser) {
      this.creatorId = app.currentUser.id;
    }
    return super.save();
  }

  expirationDateBeyondThreshold(days: number): boolean {
    if (!this.expirationDate) {
      return null;
    }

    const datePlusThreshold: Date = moment().add(days, 'days').toDate();
    return datePlusThreshold > this.expirationDate;
  }
}

export interface ProductEntrySyncList {
  productEntries: Array<ProductEntry>;
  deletedProductEntries: Array<ProductEntry>;
}
