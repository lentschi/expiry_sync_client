declare var persistence: any;

import { QueryCollection } from './query-collection';
import { RecordNotFoundError } from './errors/record-not-found-error';
import 'reflect-metadata';
import {v1 as uuid} from 'uuid';

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
  return function (object: any, propertyName: string) {
    if (!object.constructor.hasOneRelations) {
      object.constructor.hasOneRelations = [];
    }

    if (!typeName) {
      const meta = Reflect.getMetadata('design:type', object, propertyName);
      typeName = meta.name;
    }

    object.constructor.hasOneRelations[propertyName] = typeName;
  };
}


export function PersistenceModel(constructor: any) {
  if (!constructor.tableName) {
    throw new Error('table name must be specified - constructor.name: ' + constructor.name);
  }

  if (!constructor.loadDefinitions) {
    throw new Error(('Class \'' + constructor.tableName + '\' must be derived from AppModel to act as a PersistenceModel'));
  }
  constructor.loadDefinitions();


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

  get id(): string {
    return (<any> this.constructor).persistenceIdToRealId(this.persistenceId);
  }

  set id(id: string) {
    this.updateId = (<any> this.constructor).realIdToPersistenceId(id);
  }
  private static internalEntity;
  private static typeMap;
  private static hasOneRelations;
  private static modelRegistry = [];

  /**
   * the db table name
   */
  static tableName: string;

  static allowImplicitCreation: boolean;

  private updateId: string;

  private internalInstance;

  private deleted = false;

  static loadDefinitions() {
    this.internalEntity = persistence.define(this.tableName, this.typeMap);
  }

  static buildForeignKeyName(relationName: string) {
    return relationName.charAt(0).toLowerCase() + relationName.slice(1) + 'Id';
  }

  static modelNameFromForeignKeyName(foreignKeyName: string) {
    return (foreignKeyName.charAt(0).toUpperCase() + foreignKeyName.slice(1))
      .substr(0, foreignKeyName.length - 2);
  }

  static register(modelName: string, modelClass) {
    this.modelRegistry[modelName] = modelClass;
  }

  static getModelClass(modelName: string) {
    return this.modelRegistry[modelName];
  }

  static convertAnyIdToPersistence(property: string, value: any) {
    if (property === 'id') {
      return this.realIdToPersistenceId(value);
    }

    if (property.endsWith('Id')) {
      const foreignKeyModelClass = this.getModelClass(this.modelNameFromForeignKeyName(property));
      if (foreignKeyModelClass) {
        return foreignKeyModelClass.realIdToPersistenceId(value);
      }
    }

    return value;
  }

  /**
   * Reset any relations that have been defined on the persistence
   * entity (currently only hasOne)
   */
  private static resetEntityRelations() {
    // let meta:any = persistence.getEntityMeta();
    // meta[this.tableName].hasOne = {};
    persistence.clean();
    this.loadDefinitions();
  }

  /**
   * Retrieve query collection for the model
   * @return {QueryCollection} the model's query collection
   */
  static all(): QueryCollection {
    this.resetEntityRelations();
    const persistenceQueryCollection = this.internalEntity.all();
    return new QueryCollection(persistenceQueryCollection, this, this.internalEntity);
  }

  /**
   * Find model instance by a specific property value
   * @param  {string}            propertyName the property's name
   * @param  {any}               value        the property's value
   * @return {Promise<AppModel>}              an AppModel instance for the record retrieved from the db
   */
  static findBy(propertyName: string, value: any): Promise<AppModel> {
    return new Promise((resolve, reject) => {
      if (propertyName === 'id') {
        value = this.realIdToPersistenceId(value);
      }
      this.resetEntityRelations();
      this.internalEntity.findBy(propertyName, value, (instance) => {
        if (instance === null) {
          reject(new RecordNotFoundError());
          return;
        }

        const modelInstance: AppModel = this.createFromPersistenceInstance(instance);
        resolve(modelInstance);
      });
    });
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

  private static flushPersistence(): Promise<void> {
    return new Promise<void>((resolve) => {
      persistence.flush(() => {
        resolve();
      });
    });
  }

  static createFromPersistenceInstance(instance): AppModel {
    if (instance === null) {
      throw new Error('Cannot create instance with no data');
    }
    const modelInstance: AppModel = new this();
    for (const propertyName of Object.keys(this.typeMap)) {
      try {
        modelInstance[propertyName] = propertyName === 'id' ? this.persistenceIdToRealId(instance[propertyName]) : instance[propertyName];
      } catch (e) {
        // Ignore errors of fields that should have been preloaded but weren't
        // console.error("persistencejs field getter error", e);
        modelInstance[propertyName] = instance._data[propertyName];
      }
    }
    modelInstance.internalInstance = instance;

    // load has one relations if they have been prefetched:
    if (!this.hasOneRelations) {
      this.hasOneRelations = {};
    }
    for (const propertyName of Object.keys(this.hasOneRelations)) {
      const relationName: string = this.hasOneRelations[propertyName];
      const relatedModelClass = AppModel.getModelClass(relationName);
      // persistencejs instance stores the submodel under the foreign key name:
      const foreignKeyName: string = AppModel.buildForeignKeyName(propertyName);
      let subInstance;
      try {
        subInstance = instance[foreignKeyName];
      } catch (e) {
        // Ignore errors of fields that should have been preloaded but weren't
        // console.error("persistencejs hasOne field getter error", e);
      }
      if (subInstance && typeof subInstance !== 'string') {
        modelInstance[propertyName] = relatedModelClass.createFromPersistenceInstance(subInstance);
        modelInstance[foreignKeyName] = relatedModelClass.persistenceIdToRealId(modelInstance[propertyName].id);
      }
    }

    return modelInstance;
  }

  private static persistenceIdToRealId(id: string): string {
    if (this.allowImplicitCreation && id && id.startsWith(`${this.tableName}-`)) {
      return id.substr(this.tableName.length + 1);
    }
    return id;
  }

  private static realIdToPersistenceId(id: string): string {
    if (this.allowImplicitCreation && id && id.match(/^[0-9]+$/)) {
      return `${this.tableName}-${id}`;
    }
    return id;
  }

  private async setUpdateId(id: string): Promise<{}> {
    return new Promise((resolve, reject) => {
      (<any>this.constructor).internalEntity.findBy('id', id, instance => {
        if (instance === null) {
          reject(new RecordNotFoundError());
          return;
        }

        this.internalInstance = instance;
        resolve();
      });
    });
  }

  private reloadInternalInstance(): Promise<{}> {
    return new Promise(async (resolve, reject) => {
      const modelClass: any = this.constructor;
      modelClass.internalEntity.findBy('id', this.persistenceId, (instance) => {
        if (instance === null) {
          reject(new RecordNotFoundError());
          return;
        }

        this.internalInstance = instance;
        resolve();
      });
    });
  }

  /**
   * Creates/updates record in the db matching the instance's data
   * @return {Promise<void>} resolved as soon as the record has been updated/created
   */
  async save(): Promise<void> {
    if (this.deleted) {
      throw new Error('Cannot save deleted model instance');
    }

    const modelClass: any = this.constructor;
    let newInstance = false;

    if (this.updateId) {
      try {
        await this.setUpdateId(this.updateId);
        this.updateId = null;
      } catch (e) {
        if (e instanceof RecordNotFoundError && modelClass.allowImplicitCreation) {
          newInstance = true;
        } else {
          throw e;
        }
      }
    }

    if (!newInstance && this.internalInstance) {
      await this.reloadInternalInstance();
    } else {
      newInstance = true;
      this.internalInstance = new modelClass.internalEntity();
      this.internalInstance.id = this.updateId || uuid();
    }

    for (const propertyName of Object.keys(modelClass.typeMap)) {
      try {
        const propertyType = modelClass.typeMap[propertyName];
        let propertyValue = this[propertyName];
        if (propertyType === 'BOOL' && typeof propertyValue === 'undefined') {
          // persistencejs would handle undefined as NULL, but for booleans
          // we want false here:
          propertyValue = false;
        }

        propertyValue = modelClass.convertAnyIdToPersistence(propertyName, propertyValue);
        this.internalInstance[propertyName] = propertyValue;
      } catch (e) {
        console.error('Error setting property', modelClass.tableName, propertyName, this.internalInstance, e);
      }
    }

    if (newInstance) {
      persistence.add(this.internalInstance);
    }

    return await AppModel.flushPersistence();
  }

  /**
   * Remove the db record referenced by the instance
   * @return {Promise<void>} resolved as soon as the record has been removed
   */
  delete(): Promise<void> {
    persistence.remove(this.internalInstance);
    this.deleted = true;

    return AppModel.flushPersistence();
  }

  /**
   * Check if a record matching this model instance exists
   * @return {Promise<boolean>} [description]
   */
  async exists(): Promise<boolean> {
    const found: AppModel = await (<any>this.constructor).findBy('id', this.id);
    if (found) {
      return true;
    } else {
      return false;
    }
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
      // persistencejs instance stores the submodel under the foreign key name:
      const foreignKeyName: string = AppModel.buildForeignKeyName(propertyName);
      copy[propertyName] = this[propertyName];
      copy[foreignKeyName] = this[foreignKeyName];
    }

    return copy;
  }
}
