import { Directive, forwardRef } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS } from '@angular/forms';
@Directive({
  selector: '[validateInteger]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => IntegerValidator), multi: true }
  ]
})
export class IntegerValidator implements Validator {
  constructor() { }

  validate(c: AbstractControl): { [key: string]: any } {
    if (c.value != ''
      && parseInt(c.value) != c.value) {
        return {
          validateInteger: true
        };
    }
    return null;
  }
}
