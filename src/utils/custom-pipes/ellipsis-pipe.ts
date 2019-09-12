import { Pipe } from '@angular/core';

@Pipe({
  name: 'ellipsis'
})
export class EllipsisPipe {
  transform(val:string, maxLength:number):string {
    // let re:RegExp = new RegExp("^(.{" + maxLength + "}[^\s]*).*");
    // let truncatedStr:string = val.replace(re, "$1");
    if (!val) {
      return val;
    }
    let truncatedStr:string = val.substr(0, maxLength);

    if (truncatedStr == val) {
      return val;
    }

    return truncatedStr + "...";
  }
}
