/**
 * Asyncronous iterable iterator for IndexedDB object stores or indexes
 *
 * @author Florian Lentsch <office@florian-lentsch.at>
 * @license GPLv3
 *
 * ____________________________________________________________________________
 * REQUIREMENTS: You may have to add "lib": ["esnext.asynciterable"] to
 * your tsconfig.json - see
 * https://stackoverflow.com/questions/43694281/ts2318-cannot-find-global-type-asynciterableiterator-async-generator?answertab=votes#tab-top
 *
 * ____________________________________________________________________________
 * USAGE SAMPLE (Based on the samples at https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB):
 *
 * const customersStore = db.transaction("customers", "readwrite").objectStore("customers");
 * // List all customers:
 * const allCustomers = new IDBIterator(customersStore);
 * for await (let customer of allCustomers) {
 *  console.log("Customer", customer);
 * }
 *
 * // List Donnas:
 * const customersCalledDonna = new IDBIterator(
 *   customersStore.index("name"),
 *   IDBKeyRange.only("Donna")
 * );
 * for await (let customer of customersCalledDonna) {
 *  console.log("Customer called 'Donna'", customer);
 * }
 *
 *
 */
export class IDBIterator implements AsyncIterableIterator<any> {
    private cursorRequest: IDBRequest;
    private cursor: IDBCursorWithValue;
    private curResolver: (result: IteratorResult<any>) => void;

    constructor(private objectStore: IDBObjectStore | IDBIndex, private keyRange: IDBKeyRange = null) { }

    [Symbol.asyncIterator](): AsyncIterableIterator<any> {
        return this;
    }

    public next(): Promise<IteratorResult<any>> {
        return new Promise<IteratorResult<any>>(async resolve => {
            // We need to store the resolver as an instance variable, since else the
            // success callback would always try to resolve the promise of the first
            // next() call only:
            this.curResolver = resolve;

            if (!this.cursorRequest) {
                // Initial request -> Open the cursor and listen for subsequent success events:
                this.cursorRequest = this.objectStore.openCursor(this.keyRange);

                this.cursorRequest.onerror = e => {
                    throw e;
                };

                this.cursorRequest.onsuccess = e => {
                    this.cursor = <IDBCursorWithValue>(<any>e.target).result;
                    if (this.cursor) {
                        this.curResolver({ value: {
                            id: this.cursor.primaryKey,
                            ...this.cursor.value
                        }, done: false });
                    } else {
                        // We have reached the end:
                        this.curResolver({ value: null, done: true });
                    }
                };
            } else {
                // 2nd request or later -> continue (Still, the above success
                // listener will be called when the cursor has been moved forward):
                this.cursor.continue();
            }
        });
    }
}
