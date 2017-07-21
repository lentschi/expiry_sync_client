declare var persistence: any;

export class AddUsersMigration {
    constructor() {
      persistence.defineMigration(4, {
        up: function() {
          this.createTable('User', (t) => {
            t.text('userName');
            t.text('email');
            t.boolean('usedForLogin');
            t.text('password');
            t.integer('serverId');
          });
          this.addIndex('User', 'userName');
          this.addIndex('User', 'email');
          this.addIndex('User', 'usedForLogin');
          this.addIndex('User', 'serverId');
        },
        down: function() {
          this.dropTable('User');
        }
      });
    }
  }
