declare var persistence: any;

/**
 * v0.7 database schema (without the indexes, which would cause trouble)
 */
export class BaseTablesMigration {
    constructor() {
      persistence.defineMigration(1, {
        up: function() {
          this.createTable('article', (t) => {
            t.text('barcode');
            t.text('name');
          });

          this.createTable('articleimage', (t) => {
            t.text('imageData');
            t.text('article_id');
            t.integer('serverId');
          });

          this.createTable('productentry', (t) => {
            t.integer('amount');
            t.text('description');
            t.text('expiration_date');
            t.boolean('inSync');
            t.date('created_at');
            t.date('updated_at');
            t.date('deleted_at');
            t.text('article_id');
            t.text('location_id');
            t.integer('serverId');
          });

          this.createTable('location', (t) => {
            t.text('name');
            t.boolean('isDefault');
            t.integer('serverId');
          });
        },
        down: function() {
          this.dropTable('article');
          this.dropTable('articleimage');
          this.dropTable('productentry');
          this.dropTable('location');
        }
      });
    }
}
