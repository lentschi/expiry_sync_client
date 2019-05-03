import { AppModel, Column, PersistenceModel, HasOne } from '../../utils/orm/app-model';
import { Article } from '../models';
import { ApiServer } from '../../utils/api-server';

@PersistenceModel
export class ArticleImage extends AppModel {
  static tableName = 'ArticleImage';

  @HasOne('Article')
  article: Article;

  @Column()
  imageData: string;

  @Column()
  originalExtName: string;

  @Column()
  articleId: string;

  /**
   * Create multiple ArticleImage model instances (without saving them) by interpreting data returned from the API server
   * @param  {Array<any>}          imagesData Image related data as returned from the API server
   * @return {Array<ArticleImage>}            The ArticleImages
   */
  static createAllFromServerData(imagesData: Array<any>): Array<ArticleImage> {
    const images: Array<ArticleImage> = [];
    for (const imageData of imagesData) {
      const image: ArticleImage = new ArticleImage();
      image.id = imageData.id;
      image.originalExtName = imageData.original_extname;
      images.push(image);
    }
    return images;
  }

  /**
   * Update or add the image referenced by the current server ID
   * @return {Promise<ArticleImage>} the created/updated image
   */
  async updateOrAddByServerId(): Promise<ArticleImage> {
    await this.save();
    return this;
  }

  /**
   * Convert the image to an object, the API server can understand
   * @return {[key:string]:any} Data readably by the API server
   */
  toServerData(): { [key: string]: any } {
    if (!this.imageData) {
      return null; // image that hasn't been fetched
    }

    const re: RegExp = /^data:(.+);base64,/;
    const md: RegExpMatchArray = this.imageData.match(re);

    if (!md) {
      throw new Error('Invalid image data');
    }

    return {
      image_data: this.imageData.replace(re, ''),
      mime_type: md[1],
      original_extname: this.originalExtName
    };
  }

  /**
   * Fetch image data for the referenced image from the API server and store it in the db
   */
  startLoadingImage(): void {
    if (this.imageData) {
      return; // nothing to do
    }

    const server: ApiServer = ApiServer.getInstance();
    server.fetchRemoteFileContents(server.applyPathTemplate(ApiServer.ARTICLE_IMAGE_PATH, { id: this.id })).then(imageData => {
      this.imageData = <string> imageData;
      this.save();
    }).catch(e => {
      console.error('Could not load image', e);
    });
  }
}
