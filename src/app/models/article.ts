import { AppModel, Column, PersistenceModel } from '../utils/orm/app-model';
import { ApiServer, ApiServerCall } from '../utils/api-server';
import { ArticleImage } from './article-image';

@PersistenceModel
export class Article extends AppModel {
  static tableName = 'Article';

  @Column()
  barcode: string;

  @Column()
  name: string;

  @Column()
  serverId:number;

  images:Array<ArticleImage> = [];

  /**
   * Get an instance from data received from the API server
   * @param  {[key:string]:any}  articleData The article's data as received from the API server
   * @return {Article}             The newly created model instance
   */
  static createFromServerData(articleData:{[key:string]:any}):Article {
    let article:Article = new Article();
    article.barcode = articleData.barcode;
    article.name = articleData.name;
    article.serverId = articleData.id;
    article.images = [];
    if (articleData.images) {
      article.images = ArticleImage.createAllFromServerData(articleData.images);
    }

    return article;
  }

  /**
   * Convert the article to an object, the API server can understand
   * @return {[key:string]:any} Article data the API server can process
   */
  toServerData():{[key:string]:any} {
    let articleData:{[key:string]:any} = {
      barcode: this.barcode,
      name: this.name,
      images: [] // TODO
    };

    if (this.serverId) {
      articleData.id = this.serverId;
    }

    articleData.images = [];
    for (let image of this.images) {
      let imageData = image.toServerData();
      if (imageData) {
        articleData.images.push(imageData);
      }
    }

    return articleData;
  }

  static async fetchByBarcode(barcode:string):Promise<Article> {
      let articleData = await ApiServer.call(ApiServerCall.getArticleByBarcode, {barcode});
      return Article.createFromServerData(articleData.article);
  }

  static async findPullOrCreateByBarcode(barcode:string):Promise<Article> {
    try {
      var article:Article = <Article> await Article.findBy('barcode', barcode);
      article.images = <Array<ArticleImage>> await ArticleImage.all().filter('articleId', '=', article.id).list();
      return article;
    }
    catch(e) { }

    try {
      article = await Article.fetchByBarcode(barcode);
      await article.save();
      for (let image of article.images) {
        image.articleId = article.id;
        await image.save();
      }
    }
    catch(e) {
      article = new Article();
      article.barcode = barcode;
    }

    return article;
  }

  async updateOrAddByBarcodeOrServerId():Promise<Article> {
    if (this.barcode) {
      try {
        var article:Article = <Article> await Article.findBy('barcode', this.barcode);

        // update:
        article.name = this.name;
        article.serverId = this.serverId;
      }
      catch(e) {
        // create:
        article = this;
      }
    }
    else {
      try {
        var article:Article = <Article> await Article.findBy('serverId', this.serverId);

        // update:
        article.name = this.name;
      }
      catch(e) {
        // create:
        article = this;
      }
    }

    await article.save();

    for (let i in article.images) {
      let image:ArticleImage = article.images[i];
      image.articleId = article.id;
      article.images[i] = await image.updateOrAddByServerId();
    }

    return article;
  }

  get hasAnyImage():boolean {
    return this.images.length > 0
      && this.images[0].imageData !== undefined
      && this.images[0].imageData !== null;
  }
}
