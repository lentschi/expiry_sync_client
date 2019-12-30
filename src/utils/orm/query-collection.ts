import { AppModel } from './app-model';
import { RecordNotFoundError } from './errors/record-not-found-error';
import { IDBIterator } from '../idb-iterator';

export class QueryCollection {
  private relationsToLoad: string[] = [];
  private filters: {property: string, operator: string, value: any}[] = [];

  /**
   * @param  {any} persistenceCollection the persistencejs-version of QueryCollection
   */
  constructor(private db: IDBDatabase, private modelClass: typeof AppModel) { }

  filter(property: string, operator: string, value: any): QueryCollection {
    this.filters.push({property, operator, value});
    return this;
  }

  private getSingle(id: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const transaction = this.db
        .transaction([this.modelClass.tableName], 'readonly');
      const store = transaction.objectStore(this.modelClass.tableName);
      const request = store.get(id);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = e => reject(e);
    });
  }

  private async getList(): Promise<Array<any>> {
    const idFilter = this.filters.find(filter => filter.property === 'id' && filter.operator === '=');
    if (idFilter) {
      if (this.filters.length > 1) {
        throw new Error('Searching for an ID and something else is currently not supported');
      }
      const result = await this.getSingle(idFilter.value);
      return result ? [{...result, id: idFilter.value}] : [];
    }

    const transaction = this.db
      .transaction([this.modelClass.tableName], 'readonly');
    const store = transaction.objectStore(this.modelClass.tableName);

    // Filter:
    let index: IDBIndex;
    let key: IDBKeyRange = null;
    const applicableFilters = this.filters
      .filter(filter => filter.operator === '=' && typeof filter.value !== 'undefined' && filter.value !== null);

    let indexName: string;
    if (applicableFilters.length > 0) {
      indexName = applicableFilters
        .map(filter => filter.property)
        .join('-');

      try {
        index = store.index(indexName);
      } catch (e) {
        console.error('Could not index ', this.modelClass.tableName, indexName, applicableFilters);
        throw e;
      }

      const onlyValue: any = applicableFilters.length === 1
        ? this.modelClass.convertToIndexedDbValue(applicableFilters[0].value)
        : applicableFilters.map(filter => this.modelClass.convertToIndexedDbValue(filter.value));
      try {
        key = IDBKeyRange.only(
          onlyValue
        );
      } catch (e) {
        console.error('Could not create index key ', onlyValue, this.modelClass.tableName, indexName, applicableFilters, e);
        throw e;
      }
    }

    // Fetch:
    const iterator = new IDBIterator(index || store, key);
    const ret: Array<any> = [];
    const remainingFilters = this.filters
        .filter(filter => !applicableFilters.includes(filter));
    for await (const item of iterator) {
      if (this.filtersMatch(remainingFilters, item)) {
        ret.push(item);
      }
    }
    console.log(
      `DB:${this.modelClass.tableName}:FETCH`,
      this.filters.map(filter => filter.property + filter.operator + filter.value).join(' && '),
      ret
    );
    return ret;
  }

  private filtersMatch(filters: {property: string, operator: string, value: any}[], item: any): boolean {
    for (const filter of filters) {
      if (!['=', '!=', '<>'].includes(filter.operator)) {
        throw new Error('Operator not implemented');
      }

      const convertedValue = this.modelClass.convertToIndexedDbValue(filter.value);

      if ((filter.operator === '<>' || filter.operator === '!=')
          && (
            item[filter.property] === convertedValue
            || (convertedValue === null && typeof item[filter.property] === 'undefined')
          )
      ) {
        return false;
      }

      if (filter.operator === '=' && (
          item[filter.property] !== convertedValue
          && (convertedValue !== null || typeof item[filter.property] !== 'undefined')
      )) {
        return false;
      }
    }

    return true;
  }

  async list(): Promise<Array<AppModel>> {
    const list = await this.getList();
    const ret: Array<AppModel> = [];
    for (const item of list ) {
      ret.push(
        await this.modelClass.createFromIndexedDbResult(item, this.relationsToLoad)
      );
    }

    return ret;
  }

  async one(): Promise<AppModel> {
    const list = await this.getList();
    if (list.length === 0) {
      console.log(`DB:${this.modelClass.tableName}:NOTFOUND`, this.filters);
      throw new RecordNotFoundError();
    }

    return await this.modelClass.createFromIndexedDbResult(list[0], this.relationsToLoad);
  }

  async delete(): Promise<void> {
    const list = await this.getList();
    if (list.length > 0) {
      await new Promise(async (resolve, reject) => {
        const transaction = this.db
          .transaction([this.modelClass.tableName], 'readwrite');

        console.log(`DB:${this.modelClass.tableName}:DELETE_MULTI`, this.filters, list.map(item => item.id));
        for (const item of list) {
          transaction.objectStore(this.modelClass.tableName)
            .delete(item.id);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = e => reject(e);
      });
    }
  }

  async count(): Promise<number> {
    const items = await this.getList();
    return items.length;
  }

  updateField(propertyName: string, value: any): Promise<void> {
    return this.update([{ propertyName, value }]);
  }

  async update(values: Array<{ propertyName: string, value: any }>): Promise<void> {
    const items = await this.getList();

    await new Promise((resolve, reject) => {
      const transaction = this.db
        .transaction([this.modelClass.tableName], 'readwrite');

      console.log(`DB:${this.modelClass.tableName}:PUT_MULTI`, this.filters, items.map(item => item.id));
      for (const item of items) {
        const store = transaction.objectStore(this.modelClass.tableName);
        for (const value of values) {
          const propertyType = this.modelClass.typeMap[value.propertyName];
          item[value.propertyName] = this.modelClass.convertToIndexedDbValue(value.value, propertyType);
        }
        store.put(item, item.id);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = e => reject(e);
    });
  }

  prefetch(propertyName: string): QueryCollection {
    this.relationsToLoad.push(propertyName);
    return this;
  }
}
