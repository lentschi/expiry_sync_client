declare var persistence: any;

import { QueryCollection } from './query-collection';
import 'reflect-metadata';
import {v1 as uuid} from 'uuid';
import { IndexedMigration } from 'src/config/indexed-migrations/indexed-migration';

export function Column(colType?: string) {
  return function (object: any, propertyName: string) {
    if (!colType) {
      const meta = Reflect.getMetadata('design:type', object, propertyName);
      // const meta = {name: 'STRING'};
      const typeName: string = meta.name.toLowerCase();
      switch (typeName) {
        case 'number': colType = 'INT'; break;
        case 'boolean': colType = 'BOOL'; break;
        case 'string': colType = 'TEXT'; break;
        case 'date': colType = 'DATE'; break;
        case 'object': colType = 'JSON'; break;
        default: throw new Error(
          'persistencejs Column: Could not map type ' + typeName + ' of column ' + object.constructor.tableName + '.' + propertyName
        );
      }
    }
    if (!object.constructor.typeMap) {
      object.constructor.typeMap = [];
    }
    object.constructor.typeMap[propertyName] = colType;
  };
}

export function HasOne(typeName?: string) {
  return function (object: AppModel, propertyName: string) {
    if (!typeName) {
      const meta = Reflect.getMetadata('design:type', object, propertyName);
      typeName = meta.name;
    }

    const modelClass = <typeof AppModel> object.constructor;

    if (!modelClass.hasOneRelations) {
      modelClass.hasOneRelations = {};
    }
    modelClass.hasOneRelations[propertyName] = typeName;
  };
}


export function PersistenceModel(constructor: typeof AppModel) {
  if (!constructor.tableName) {
    throw new Error('table name must be specified - constructor.name: ' + constructor.name);
  }

  if (!constructor.hasOneRelations) {
    constructor.hasOneRelations = {};
  }


  AppModel.register(constructor.tableName, constructor);
}


/**
 * ORM representation of a db table
 */
export class AppModel {

  get persistenceId(): string {
    if (!this.internalInstance) {
      return this.updateId;
    }

    return this.internalInstance.id;
  }

  static typeMap: {[propertyName: string]: string};
  static hasOneRelations: {[propertyName: string]: string};
  static modelRegistry: {[propertyName: string]: typeof AppModel} = {};

  // indexed db:
  static db: IDBDatabase;
  static indexedProperties: string[];

  /**
   * the db table name
   */
  static tableName: string;

  static allowImplicitCreation: boolean;

  id: string;

  private updateId: string;
  private internalInstance;
  private deleted = false;

  static register(modelName: string, modelClass: typeof AppModel) {
    this.modelRegistry[modelName] = modelClass;
  }

  static getModelClass(modelName: string): typeof AppModel {
    return this.modelRegistry[modelName];
  }


  /**
   * Retrieve query collection for the model
   * @return {QueryCollection} the model's query collection
   */
  static all(): QueryCollection {
    return new QueryCollection(this.db, this);
  }

  /**
   * Find model instance by a specific property value
   * @param  {string}            propertyName the property's name
   * @param  {any}               value        the property's value
   * @return {Promise<AppModel>}              an AppModel instance for the record retrieved from the db
   */
  static findBy(propertyName: string, value: any): Promise<AppModel> {
    return this
      .all()
      .filter(propertyName, '=', value)
      .one();
  }

  /**
   * See [[AppModel.findBy]], but if no matching record can be found, one is created
   */
  static findOrCreateBy(propertyName: string, value: any): Promise<AppModel> {
    return new Promise(async (resolve) => {
      let modelInstance: AppModel;
      try {
        modelInstance = await this.findBy(propertyName, value);
      } catch (e) {
        modelInstance = new this();
        modelInstance[propertyName] = value;
      }

      resolve(modelInstance);
    });
  }

  static async createFromIndexedDbResult(data: any, relationsToLoad: string[]): Promise<AppModel> {
    if (!data) {
      throw new Error('Cannot create instance with no data');
    }
    const modelInstance: AppModel = new this();
    modelInstance.id = data.id;
    for (const propertyName of Object.keys(this.typeMap)) {
      const propertyType = this.typeMap[propertyName];
      if (propertyType !== 'BOOL') {
        modelInstance[propertyName] = data[propertyName];
      } else {
        modelInstance[propertyName] = (data[propertyName] === 1);
      }
    }

    for (const propertyName of Object.keys(this.hasOneRelations)) {
      if (!relationsToLoad.includes(propertyName)) {
        continue;
      }

      const relationName: string = this.hasOneRelations[propertyName];
      const relatedModelClass = AppModel.getModelClass(relationName);
      modelInstance[propertyName] = await relatedModelClass.findBy('id', modelInstance[propertyName + 'Id']);
    }

    return modelInstance;
  }

  static convertToIndexedDbValue(value: any, propertyType?: string) {
    if (typeof value === 'boolean' || propertyType === 'BOOL') {
      return value ? 1 : 0;
    }

    return value;
  }

  /**
   * Creates/updates record in the db matching the instance's data
   * @return {Promise<void>} resolved as soon as the record has been updated/created
   */
  save(): Promise<void> {
    if (this.deleted) {
      throw new Error('Cannot save deleted model instance');
    }

    const modelClass = <typeof AppModel> this.constructor;

    // indexedDB:
    return new Promise(async(resolve, reject) => {
      const data: any = {};
      for (const propertyName of Object.keys(modelClass.typeMap)) {
        const propertyValue = this[propertyName];
        const propertyType = modelClass.typeMap[propertyName];
        data[propertyName] = modelClass.convertToIndexedDbValue(propertyValue, propertyType);
      }

      const transaction = modelClass.db
        .transaction([modelClass.tableName], 'readwrite');
      const store = transaction.objectStore(modelClass.tableName);

      const idBefore = this.id;
      this.id = this.id || uuid();
      console.log(`DB:${modelClass.tableName}:PUT`, idBefore, this.id, data);
      store.put(data, this.id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = e => reject(e);
    });
  }

  /**
   * Remove the db record referenced by the instance
   * @return {Promise<void>} resolved as soon as the record has been removed
   */
  async delete(): Promise<void> {
    await new Promise((resolve, reject) => {
      const modelClass = (<typeof AppModel> this.constructor);
      console.log(`DB:${modelClass.tableName}:DELETE`, this.id, this);
      const transaction = modelClass.db
        .transaction([modelClass.tableName], 'readwrite');
      transaction
        .objectStore(modelClass.tableName)
        .delete(this.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = e => reject(e);
    });
  }

  clone(): AppModel {
    const modelClass = (<any>this.constructor);
    const copy = new modelClass;

    // copy fields:
    for (const propertyName of Object.keys(modelClass.typeMap)) {
      copy[propertyName] = this[propertyName];
    }

    // copy relations:
    for (const propertyName of Object.keys(modelClass.hasOneRelations)) {
      copy[propertyName] = this[propertyName];
    }

    return copy;
  }
}
