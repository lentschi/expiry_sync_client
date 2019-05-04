import { AppModel } from './app-model';
import { RecordNotFoundError } from './errors/record-not-found-error';

declare var persistence: any;

export class QueryCollection {
  /**
   * @param  {any} persistenceCollection the persistencejs-version of QueryCollection
   */
  constructor(private persistenceCollection, private modelClass, private internalEntity) { }

  filter(property: string, operator: string, value: any): QueryCollection {
    this.persistenceCollection = this.persistenceCollection.filter(property, operator, value);
    return this;
  }

  order(property: string, ascending?: boolean): QueryCollection {
    if (ascending === undefined) {
      ascending = true;
    }
    this.persistenceCollection = this.persistenceCollection.order(property, ascending);
    return this;
  }

  list(): Promise<Array<AppModel>> {
    return new Promise<Array<AppModel>>((resolve, reject) => {
      try {
        this.persistenceCollection.list((results) => {
          try {
            const modelInstances: Array<AppModel> = [];
            for (const persistenceInstance of results) {
              modelInstances.push(this.modelClass.createFromPersistenceInstance(persistenceInstance));
            }

            resolve(modelInstances);
          } catch (innerError) {
            reject(innerError);
          }
        });
      } catch (listError) {
        reject(listError);
      }
    });
  }

  one(): Promise<AppModel> {
    return new Promise<AppModel>((resolve, reject) => {
      this.persistenceCollection.one((persistenceInstance) => {
        if (!persistenceInstance) {
          reject(new RecordNotFoundError());
        } else {
          const modelInstance: AppModel = this.modelClass.createFromPersistenceInstance(persistenceInstance);
          resolve(modelInstance);
        }
      });
    });
  }

  delete(): Promise<void> {
    return new Promise<void>(resolve => {
      this.persistenceCollection.list(async (results) => {
        results.forEach((persistenceInstance) => {
          persistence.remove(persistenceInstance);
        });

        await this.modelClass.flushPersistence();
        resolve();
      });
    });
  }

  count(): Promise<number> {
    return new Promise<number>(resolve => {
      this.persistenceCollection.list(async (results) => {
        let count = 0;
        results.forEach((persistenceInstance) => {
          count++;
        });

        resolve(count);
      });
    });
  }

  updateField(propertyName: string, value: any): Promise<void> {
    return this.update([{ propertyName, value }]);
  }

  update(values: Array<{ propertyName: string, value: any }>): Promise<void> {
    return new Promise<void>(resolve => {
      this.persistenceCollection.list(async (results) => {
        results.forEach((persistenceInstance) => {
          for (const value of values) {
            if (typeof persistenceInstance[value.propertyName] === 'undefined') {
              throw new Error(`No such property: '${value.propertyName}'`);
            }
            persistenceInstance[value.propertyName] = value.value;
          }
        });

        await this.modelClass.flushPersistence();
        resolve();
      });
    });
  }

  prefetch(propertyName: string): QueryCollection {
    const relationName: string = this.modelClass.hasOneRelations[propertyName];
    if (!relationName) {
      throw new Error('Not a hasOne relation: ' + propertyName);
    }

    this.internalEntity.hasOne(AppModel.buildForeignKeyName(propertyName), AppModel.getModelClass(relationName).internalEntity);
    this.persistenceCollection = this.persistenceCollection.prefetch(AppModel.buildForeignKeyName(propertyName));
    return this;
  }
}
