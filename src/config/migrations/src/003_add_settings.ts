declare var persistence: any;

export class AddSettingsMigration {
    constructor() {
      persistence.defineMigration(3, {
        up: function() {
          this.createTable('Setting', (t) => {
            t.text('key');
            t.text('value');
          });
          this.addIndex('Setting', 'key');
        },
        down: function() {
          this.dropTable('Setting');
        }
      });
    }
  }
