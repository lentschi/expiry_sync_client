import { ProductEntry } from '../../app/models';

export interface CreatorFilter {
  creator: string,
  remainingFilter: string
}

export class ProductEntriesListAdapter extends Array<ProductEntry> {
  filterValue:string = '';
  sortBy:string = 'expirationDate';
  sortAscending:boolean = true;

  /**
   * set the array's values
   * If an entry's attributes stay the same, ensure that it is not replaced
   * (in order not to lose any object references)
   */
  setValues(productEntries:Array<ProductEntry>) {
    // TODO: this may not be the most efficient way to do this:
    const tmp:Array<ProductEntry> = [];
    
    for (let productEntry of productEntries) {
      const existingEntry = this.find(curEntry => !this.entriesDiffer(curEntry, productEntry));
    
      if (existingEntry) {
        tmp.push(existingEntry);
      }
      else {
        tmp.push(productEntry);
      }
    }
    
    this.length = 0;
    for (let productEntry of tmp) {
      this.push(productEntry);
    }
  }

  private entriesDiffer(p1:ProductEntry, p2:ProductEntry):boolean {
    return p1.id != p2.id
      || p1.article.name != p2.article.name
      || p1.articleId != p2.articleId
      || p1.amount != p2.amount
      || p1.locationId != p2.locationId
      || p1.expirationDate.getTime() != p2.expirationDate.getTime()
      || p1.creatorId != p2.creatorId
      || p1.freeToTake != p2.freeToTake
      || p1.serverId != p2.serverId;
  }

  get creatorFilter():CreatorFilter {
    let filterValue = this.filterValue.toLowerCase();
    const re = /by:([^\s]+)/;
    const md = filterValue.match(re);
    if (!md || !md[1]) {
      return null;
    }

    return {
      creator: md[1].toLowerCase(),
      remainingFilter: filterValue.replace(re, '').trim()
    };
  }

  filterByFilterValue() {
    let filterValue = this.filterValue.toLowerCase();

    const creatorFilter = this.creatorFilter;
    if (creatorFilter) {
      filterValue = creatorFilter.remainingFilter;
    }

    let filteredEntries:Array<ProductEntry> = this.filter(productEntry =>
      filterValue == ""
      || productEntry.article.name.toLowerCase().indexOf(filterValue) > -1
      || (productEntry.article.barcode && productEntry.article.barcode.toLowerCase().indexOf(filterValue) > -1)
    );

    if (creatorFilter) {
      filteredEntries = filteredEntries.filter(productEntry =>
        (productEntry.creator.userName && productEntry.creator.userName.toLowerCase() == creatorFilter.creator)
        || (productEntry.creator.email && productEntry.creator.email.toLowerCase() == creatorFilter.creator)
      );
    }

    this.setValues(filteredEntries);
  }

  sortBySortField() {
    this.sort((p1:ProductEntry, p2:ProductEntry) => {
      let prop1, prop2;
      switch (this.sortBy) {
        case 'amount': prop1 = p1.amount; prop2 = p2.amount; break;
        case 'expirationDate': prop1 = p1.expirationDate; prop2 = p2.expirationDate; break;
        case 'name': prop1 = p1.article.name.toLowerCase(); prop2 = p2.article.name.toLowerCase(); break;
        case 'creator': prop1 = p1.creator.userName.toLowerCase(); prop2 = p2.creator.userName.toLowerCase(); break;
        case 'location': prop1 = p1.location.name.toLowerCase(); prop2 = p2.location.name.toLowerCase(); break;
        default: throw `Invalid order field: '${this.sortBy}''`;
      }

      if (!this.sortAscending) {
        let tmp = prop2;
        prop2 = prop1;
        prop1 = tmp;
      }

      if (prop1 > prop2) {
        return 1;
      }
      else if (prop1 < prop2) {
        return -1;
      }

      if (this.sortBy == 'creator') {
        if (!p1.freeToTake && p2.freeToTake) {
          return 1;
        }
      }

      return 0;
    });
  }

  get selected():Array<ProductEntry> {
    return this.filter(e => e.selected);
  }

  set allSelected(select:boolean) {
    for (let productEntry of this) {
      productEntry.selected = select;
    }
  }

  set anySelected(select:boolean) {
    this.allSelected = select;
  }

  get allSelected():boolean {
    for (let productEntry of this) {
      if (!productEntry.selected) {
        return false;
      }
    }

    return true;
  }
}
