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
        this.addColumn('Location', 'lastSuccessfulSync', 'DATETIME');
        this.addIndex('Location', 'lastSuccessfulSync');
        this.addColumn('ProductEntry', 'lastSuccessfulSync', 'DATETIME');
        this.addIndex('ProductEntry', 'lastSuccessfulSync');


        this.executeSql(`
          UPDATE ProductEntry SET
            locationId = "Location-" || (SELECT serverId FROM location WHERE id = ProductEntry.locationId)
          WHERE EXISTS (SELECT serverId FROM location WHERE id = ProductEntry.locationId AND NOT serverId IS NULL)
        `);
        this.executeSql(`
          UPDATE LocationShare SET
            locationId = "Location-" || (SELECT serverId FROM location WHERE id = LocationShare.locationId)
          WHERE EXISTS (SELECT serverId FROM location WHERE id = LocationShare.locationId AND NOT serverId IS NULL)`);
        this.executeSql('UPDATE Location SET id = "Location-" || serverId, lastSuccessfulSync = date("now") WHERE NOT serverId IS NULL');
        this.removeColumn('Location', 'serverId');

        this.executeSql(`
          UPDATE ProductEntry SET
            id = "ProductEntry-" || serverId, lastSuccessfulSync = date("now")
          WHERE NOT serverId IS NULL`
        );
        this.removeColumn('ProductEntry', 'serverId');

        this.executeSql(`
          UPDATE ProductEntry SET
            articleId = "Article-" || (SELECT serverId FROM Article WHERE id = ProductEntry.articleId)
          WHERE EXISTS (SELECT serverId FROM Article WHERE id = ProductEntry.articleId AND NOT serverId IS NULL)`);
        this.executeSql(`
          UPDATE ArticleImage SET
            articleId = "Article-" || (SELECT serverId FROM Article WHERE id = ArticleImage.articleId)
          WHERE EXISTS (SELECT serverId FROM Article WHERE id = ArticleImage.articleId AND NOT serverId IS NULL)`);
        this.executeSql('UPDATE Article SET id = "Article-" || serverId WHERE NOT serverId IS NULL');
        this.removeColumn('Article', 'serverId');
        this.executeSql('UPDATE ArticleImage SET id = "ArticleImage-" || serverId WHERE NOT serverId IS NULL');
        this.removeColumn('ArticleImage', 'serverId');
      },
      down: function () {
        // not reversible
      }
    });
  }
}
