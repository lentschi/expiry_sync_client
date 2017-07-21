declare var persistence: any;
declare var cordova: any;

export class ModifyBaseTablesMigration {
  constructor() {
    persistence.defineMigration(2, {
      up: function() {
        const renameTable = (from:string, to:string) => {
          this.executeSql(`ALTER TABLE ${from} RENAME TO ${to}`);
        }

        const moveTablesToTmpNames = (tableNames:Array<string>) => {
          for (let tableName of tableNames) {
            renameTable(tableName, tableName + "_tmp");
          }
        }

        // Move columns to temp names:
        moveTablesToTmpNames(['article', 'articleimage', 'productentry', 'location']);
        console.log("--- Moving DONE");

        // Create new base schema:
        this.createTable('Article', (t) => {
          t.text('barcode');
          t.text('name');
          t.integer('serverId');
        });
        console.log("--- Creating DONE");
        this.addIndex('Article', 'barcode');
        this.addIndex('Article', 'serverId');

        this.createTable('ArticleImage', (t) => {
          t.text('imageData');
          t.text('originalExtName');
          t.text('articleId');
          t.integer('serverId');
        });
        // this.executeSql('ALTER TABLE ArticleImage ADD imageData BLOB AFTER article_id');
        this.addIndex('ArticleImage', 'articleId');
        this.addIndex('ArticleImage', 'serverId');

        this.createTable('ProductEntry', (t) => {
          t.integer('amount');
          t.text('description');
          t.date('expirationDate');
          t.boolean('freeToTake');
          t.boolean('inSync');
          t.date('createdAt');
          t.date('updatedAt');
          t.date('deletedAt');
          t.text('articleId');
          t.text('creatorId');
          t.text('locationId');
          t.integer('serverId');
        });
        this.addIndex('ProductEntry', 'expirationDate');
        this.addIndex('ProductEntry', 'createdAt');
        this.addIndex('ProductEntry', 'updatedAt');
        this.addIndex('ProductEntry', 'deletedAt');
        this.addIndex('ProductEntry', 'inSync');
        this.addIndex('ProductEntry', 'articleId');
        this.addIndex('ProductEntry', 'creatorId');
        this.addIndex('ProductEntry', 'locationId');

        this.createTable('Location', (t) => {
          t.text('name');
          t.boolean('isSelected');
          t.boolean('inSync');
          t.date('createdAt');
          t.date('updatedAt');
          t.date('deletedAt');
          t.text('creatorId');
          t.integer('serverId');
        });
        this.addIndex('Location', 'createdAt');
        this.addIndex('Location', 'updatedAt');
        this.addIndex('Location', 'deletedAt');
        this.addIndex('Location', 'inSync');
        this.addIndex('Location', 'isSelected');
        this.addIndex('Location', 'creatorId');
        this.addIndex('Location', 'serverId');

        // Copy old schema's data:
        if (typeof(cordova) != 'undefined') { // only if not on web platform (else there's no old data to copy)
          this.executeSql(`
            INSERT INTO Article (id, barcode, name)
            SELECT id || '_Article', barcode, name
            FROM article_tmp
          `);
          this.executeSql(`
            INSERT INTO ArticleImage (id, imageData, originalExtName, articleId, serverId)
            SELECT id || '_ArticleImage', 'data:image/jpeg;base64,' || BASE64(imageData), '.jpg', article_id || '_Article', serverId
            FROM articleimage_tmp WHERE imageData IS NOT NULL
          `);
          this.executeSql(`
            INSERT INTO ArticleImage (id, originalExtName, articleId, serverId)
            SELECT id || '_ArticleImage', '.jpg', article_id || '_Article', serverId
            FROM articleimage_tmp WHERE imageData IS NULL
          `);
          this.executeSql(`
            INSERT INTO ProductEntry (id, amount, description, expirationDate, inSync, createdAt, updatedAt, deletedAt, articleId, locationId, serverId)
            SELECT id || '_ProductEntry', amount, description, STRFTIME('%s', DATE(expiration_date)), inSync, ROUND(created_at / 1000), ROUND(updated_at / 1000), ROUND(deleted_at / 1000), article_id || '_Article', location_id || '_Location', serverId
            FROM productentry_tmp WHERE deleted_at IS NOT NULL
          `);
          this.executeSql(`
            INSERT INTO ProductEntry (id, amount, description, expirationDate, inSync, createdAt, updatedAt, articleId, locationId, serverId)
            SELECT id || '_ProductEntry', amount, description, STRFTIME('%s', DATE(expiration_date)), inSync, ROUND(created_at / 1000), ROUND(updated_at / 1000), article_id || '_Article', location_id || '_Location', serverId
            FROM productentry_tmp WHERE deleted_at IS NULL
          `);
          this.executeSql(`
            INSERT INTO Location (id, name, isSelected, inSync, createdAt, updatedAt, deletedAt, serverId)
            SELECT id || '_Location', name, isDefault, '1', DATETIME(), DATETIME(), NULL, serverId
            FROM location_tmp
          `);
        }

        // Drop old schema:
        for (let tableName of ['article_tmp', 'articleimage_tmp', 'productentry_tmp', 'location_tmp']) {
          this.dropTable(tableName);
        }
      },
      down: function() {
        throw "Not implemented";
      }
    });
  }
}
