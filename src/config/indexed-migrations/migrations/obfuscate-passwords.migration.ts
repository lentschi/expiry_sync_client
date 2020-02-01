import { IndexedMigration } from '../indexed-migration';

export class ObfuscatePasswordsMigration extends IndexedMigration {
    migrate(openDbRequest: IDBOpenDBRequest) {
        const transaction = openDbRequest.transaction;
        const store = transaction.objectStore('User');
        const index = store.index('usedForLogin');

        const getKeyRequest = index.getKey(1);
        getKeyRequest.onsuccess = keyResult => {
            const key: string = (<IDBRequest> keyResult.target).result;
            if (!key) {
                return;
            }

            const getRequest = store.get(key);

            getRequest.onsuccess = result => {
                const user = (<IDBRequest> result.target).result;
                if (!user.password) {
                    return;
                }
                user.password = btoa(user.password);
                store.put(user, key);
            };
        };

        return transaction;
    }
}
