declare var persistence: any;

export class AdeptDefaultRecipeSearchMigration {
  constructor() {
    persistence.defineMigration(8, {
      up: async function () {
        this.executeSql(`
          UPDATE Setting SET value="https://www.google.com/search?q={{recipeTranslation}}%20{{ingredients}}"
          WHERE key="searchUrl"
            AND value="http://www.google.com/#q={{recipeTranslation}}%20{{ingredients}}"
        `);
      },
      down: function () {
      }
    });
  }
}
