import { Directive, forwardRef, Attribute } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS } from '@angular/forms';
@Directive({
  selector: '[validateLessThan]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => LessThanValidator), multi: true }
  ]
})
export class LessThanValidator implements Validator {
  constructor( @Attribute('validateLessThan') public validateLessThan: string) { }

  validate(c: AbstractControl): { [key: string]: any } {
    if (this.validateLessThan !== undefined
      && this.validateLessThan != ''
      && c.value != ''
      && parseFloat(c.value) >= parseFloat(this.validateLessThan)) {
        return {
          validateLessThan: true
        };
    }
    return null;
  }
}
