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
  static allowImplicitCreation = true;

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
  lastSuccessfulSync: Date;

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
    productEntry.id = productEntryData.id;
    productEntry.article = Article.createFromServerData(productEntryData.article);
    productEntry.articleId = productEntryData.article_id;
    productEntry.locationId = productEntryData.location_id;

    return productEntry;
  }

  static async getOutOfSync(includeSyncInProgress = false): Promise<ProductEntry[]> {
    const productEntries: Array<ProductEntry> = <Array<ProductEntry>>await ProductEntry
      .all()
      .filter('inSync', '=', false)
      .prefetch('article')
      .prefetch('location')
      .list();

    if (includeSyncInProgress) {
      productEntries.push(...<Array<ProductEntry>>await ProductEntry
        .all()
        .filter('syncInProgress', '=', true)
        .prefetch('article')
        .prefetch('location')
        .list()
      );
    }
    return productEntries;
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


  async markForDeletion(): Promise<void> {
    if (!this.lastSuccessfulSync && !this.syncInProgress) {
      return this.delete();
    }

    this.deletedAt = new Date();
    this.inSync = false;
    return this.save();
  }

  toServerData() {
    const productEntryData: any = {
      id: this.id,
      description: this.description,
      free_to_take: this.freeToTake,
      amount: this.amount,
      location_id: this.location.id,
      expiration_date: ApiServer.dateToHttpDate(this.expirationDate),
      created_at: ApiServer.dateToHttpDate(this.createdAt),
      updated_at: ApiServer.dateToHttpDate(this.updatedAt),
      article: this.article.toServerData()
    };

    return productEntryData;
  }

  public async storeOnServer(): Promise<ProductEntry> {
    let callId: number = ApiServerCall.createProductEntry;
    const params: any = {};

    params['product_entry_id'] = this.id;
    if (this.deletedAt) {
      callId = ApiServerCall.deleteProductEntry;
    } else {
      callId = ApiServerCall.updateProductEntry;
    }

    if (!this.deletedAt) {
      this.article.images = <Array<ArticleImage>>await ArticleImage
        .all()
        .filter('articleId', '=', this.article.id)
        .list();
      params.product_entry = this.toServerData();
    }

    const productEntryData = await ApiServer.call(callId, params);
    return this.deletedAt ? null : ProductEntry.createFromServerData(productEntryData.product_entry);
  }

  public async storeInLocalDb(syncDoneTimestamp: Date): Promise<ProductEntry> {
    this.article = await this.article.updateOrAddByBarcodeOrServerId();
    this.articleId = this.article.id;

    this.creator = await this.creator.updateOrAddByServerId();
    this.creatorId = this.creator.id;

    this.inSync = true;
    this.lastSuccessfulSync = syncDoneTimestamp;
    await this.save();
    return this;
  }

  async save(): Promise<void> {
    const app: ExpirySync = ExpirySync.getInstance();
    if (!this.creatorId && !this.lastSuccessfulSync && app.currentUser) {
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
