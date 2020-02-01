export abstract class IndexedMigration {
    abstract migrate(openDbRequest: IDBOpenDBRequest): IDBTransaction;
}
