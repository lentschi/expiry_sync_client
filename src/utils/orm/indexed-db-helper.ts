export class IndexedDbHelper {
    constructor(private db: IDBDatabase) {}

    static async open(name: string): Promise<IndexedDbHelper> {
        return await new Promise<IndexedDbHelper>((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onerror = error => {
                reject(error);
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const helper = new IndexedDbHelper((<IDBRequest> event.target).result);
                resolve(helper);
            };
        });
    }

    async createObjectStore(name: string): Promise<IDBObjectStore> {
        return await new Promise<IDBObjectStore>((resolve, reject) => {
            const objectStore = this.db.createObjectStore(name, { keyPath: 'id' });
            objectStore.transaction.oncomplete = () => resolve(objectStore);
            objectStore.transaction.onerror = () => reject();
        });
    }
}
