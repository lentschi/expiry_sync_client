declare var persistence: any;

export class ChangeSyncFieldsMigration {
  constructor() {
    const self = this;
    persistence.defineMigration(7, {
      up: async function () {
        this.addColumn('Location', 'syncInProgress', 'BOOL');
        this.addIndex('Location', 'syncInProgress');
        this.addColumn('ProductEntry', 'syncInProgress', 'BOOL');
        this.addIndex('ProductEntry', 'syncInProgress');
        this.addColumn('Location', 'lastSuccessfulSync', 'DATE');
        this.addIndex('Location', 'lastSuccessfulSync');
        this.addColumn('ProductEntry', 'lastSuccessfulSync', 'DATE');
        this.addIndex('ProductEntry', 'lastSuccessfulSync');


        this.executeSql(`
          UPDATE ProductEntry SET 
            locationId = (SELECT serverId FROM location WHERE id = ProductEntry.locationId) 
          WHERE EXISTS (SELECT serverId FROM location WHERE id = ProductEntry.locationId AND NOT serverId IS NULL)
        `);
        this.executeSql(`
          UPDATE LocationShare SET
            locationId = (SELECT serverId FROM location WHERE id = LocationShare.locationId)
          WHERE EXISTS (SELECT serverId FROM location WHERE id = LocationShare.locationId AND NOT serverId IS NULL)`);
        this.executeSql('UPDATE Location SET id = serverId, lastSuccessfulSync = date("now") WHERE NOT serverId IS NULL');
        this.removeColumn('Location', 'serverId');

        this.executeSql('UPDATE ProductEntry SET id = serverId, lastSuccessfulSync = date("now") WHERE NOT serverId IS NULL');
        this.removeColumn('ProductEntry', 'serverId');

        this.executeSql(`
          UPDATE ProductEntry SET
            articleId = (SELECT serverId FROM Article WHERE id = ProductEntry.articleId)
          WHERE EXISTS (SELECT serverId FROM Article WHERE id = ProductEntry.articleId AND NOT serverId IS NULL)`);
        this.executeSql(`
          UPDATE ArticleImage SET
            articleId = (SELECT serverId FROM Article WHERE id = ArticleImage.articleId)
          WHERE EXISTS (SELECT serverId FROM Article WHERE id = ArticleImage.articleId AND NOT serverId IS NULL)`);
        this.executeSql('UPDATE Article SET id = serverId WHERE NOT serverId IS NULL');
        this.removeColumn('Article', 'serverId');
        this.executeSql('UPDATE ArticleImage SET id = serverId WHERE NOT serverId IS NULL');
        this.removeColumn('ArticleImage', 'serverId');
      },
      down: function () {
        // not reversible
      }
    });
  }
}
