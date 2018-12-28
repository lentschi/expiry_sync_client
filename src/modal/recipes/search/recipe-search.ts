import { Component, OnInit } from '@angular/core';
import { NavParams, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ProductEntry, Setting } from 'src/app/models';

interface RecipeKeyword {
  text: string;
  active: boolean;
}

@Component({
  templateUrl: 'recipe-search.html',
  styleUrls: ['recipe-search.scss']
})
export class RecipeSearchModal extends ExpirySyncController implements OnInit {
  keywords: Array<RecipeKeyword>;
  selectedProductEntries: ProductEntry[];

  constructor(private modalCtrl: ModalController, translate: TranslateService) {
    super(translate);
  }

  ngOnInit() {
    this.keywords = [];
    for (const productEntry of this.selectedProductEntries) {
      const articleWords = productEntry.article.name.split(/\s/g);
      for (const word of articleWords) {
        if (word.length > 1 && !this.includedInKeywords(word)) {
          this.keywords.push({ text: word, active: true });
        }
      }
    }
  }

  private includedInKeywords(word: string): boolean {
    for (const keyword of this.keywords) {
      if (keyword.text.toLowerCase() === word.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  keywordTapped(keyword: RecipeKeyword) {
    keyword.active = !keyword.active;
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  get activeKeywords(): Array<RecipeKeyword> {
    return this.keywords.filter(keyword => keyword.active);
  }

  private get searchStr(): string {
    return this.activeKeywords
      .map(keyword => keyword.text)
      .join(' ');
  }

  private async getSearchUrl(): Promise<string> {
    const searchUrlTemplate = Setting.cached('searchUrl');
    let searchUrl = searchUrlTemplate.replace(/\{\{recipeTranslation\}\}/g, encodeURI(await this.translate('recipe')));
    const re = /\{\{ingredients\}\}/g;
    if (re.test(searchUrl)) {
      searchUrl = searchUrl.replace(re, encodeURI(this.searchStr));
    } else {
      searchUrl += encodeURI(this.searchStr);
    }
    return searchUrl;
  }

  async searchTapped() {
    this.modalCtrl.dismiss();

    window.open(await this.getSearchUrl());
  }

  selectAll(select = true) {
    for (const keyword of this.keywords) {
      keyword.active = select;
    }
  }
}
