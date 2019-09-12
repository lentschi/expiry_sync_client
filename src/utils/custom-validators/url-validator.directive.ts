import { Directive, forwardRef } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS } from '@angular/forms';
@Directive({
  selector: '[validateUrl]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => UrlValidator), multi: true }
  ]
})
export class UrlValidator implements Validator {
  constructor() { }

  validate(c: AbstractControl): { [key: string]: any } {
    if (!/^https?:\/\/\w+(\.\w+)*(:[0-9]+)?\/?(\/[.\w]*)*$/.test(c.value)) {
        return {
          validateUrl: true
        };
    }
    return null;
  }
}
