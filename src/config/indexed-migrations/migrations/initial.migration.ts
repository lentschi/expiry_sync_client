import { IndexedMigration } from '../indexed-migration';

export class InitialMigration extends IndexedMigration {
    migrate(openDbRequest: IDBOpenDBRequest) {
        const db = openDbRequest.result;

        let store: IDBObjectStore;
        store = db.createObjectStore('Article');
        store.createIndex('barcode', 'barcode');
        store.createIndex('serverId', 'serverId');

        store = db.createObjectStore('ArticleImage');
        store.createIndex('articleId', 'articleId');
        store.createIndex('serverId', 'serverId');

        store = db.createObjectStore('Location');
        store.createIndex('syncInProgress', 'syncInProgress');
        store.createIndex('lastSuccessfulSync', 'lastSuccessfulSync');
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('deletedAt', 'deletedAt');
        store.createIndex('inSync', 'inSync');
        store.createIndex('isSelected', 'isSelected');
        store.createIndex('creatorId', 'creatorId');
        store.createIndex('serverId', 'serverId');

        store = db.createObjectStore('LocationShare');
        store.createIndex('userId', 'userId');
        store.createIndex('locationId', 'locationId');

        store = db.createObjectStore('ProductEntry');
        store.createIndex('syncInProgress', 'syncInProgress');
        store.createIndex('lastSuccessfulSync', 'lastSuccessfulSync');
        store.createIndex('expirationDate', 'expirationDate');
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('deletedAt', 'deletedAt');
        store.createIndex('inSync', 'inSync');
        store.createIndex('articleId', 'articleId');
        store.createIndex('creatorId', 'creatorId');
        store.createIndex('locationId', 'locationId');

        store = db.createObjectStore('Setting');
        store.createIndex('key', 'key');

        store = db.createObjectStore('User');
        store.createIndex('userName', 'userName');
        store.createIndex('email', 'email');
        store.createIndex('usedForLogin', 'usedForLogin');
        store.createIndex('serverId', 'serverId');

        return store.transaction;
    }
}
