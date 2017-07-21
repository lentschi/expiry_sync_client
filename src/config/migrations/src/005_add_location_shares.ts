declare var persistence: any;

export class AddLocationSharesMigration {
    constructor() {
      persistence.defineMigration(5, {
        up: function() {
          this.createTable('LocationShare', (t) => {
            t.text('userId');
            t.text('locationId');
          });
          this.addIndex('LocationShare', 'userId');
          this.addIndex('LocationShare', 'locationId');
        },
        down: function() {
          this.dropTable('LocationShare');
        }
      });
    }
  }
