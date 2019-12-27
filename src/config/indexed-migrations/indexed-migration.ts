export abstract class IndexedMigration {
    abstract migrate(db: IDBDatabase): IDBTransaction;
}
