declare var persistence: any;

export class RemoveOrphanedProductEntries {
    constructor() {
      persistence.defineMigration(6, {
        up: function() {
          this.executeSql(`
            DELETE FROM ProductEntry
            WHERE NOT EXISTS (
              SELECT 1 FROM Location
              WHERE Location.id = ProductEntry.locationId
            )
          `);
        },
        down: function() {
          // not reversible
        }
      });
    }
  }
