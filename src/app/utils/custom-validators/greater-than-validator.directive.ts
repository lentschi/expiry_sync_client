import { Directive, forwardRef, Attribute } from '@angular/core';
import { Validator, AbstractControl, NG_VALIDATORS } from '@angular/forms';
@Directive({
  selector: '[validateGreaterThan]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => GreaterThanValidator), multi: true }
  ]
})
export class GreaterThanValidator implements Validator {
  constructor( @Attribute('validateGreaterThan') public validateGreaterThan: string) { }

  validate(c: AbstractControl): { [key: string]: any } {
    if (this.validateGreaterThan !== undefined
      && this.validateGreaterThan != ''
      && c.value != ''
      && c.value <= this.validateGreaterThan) {
        return {
          validateGreaterThan: true
        };
    }
    return null;
  }
}
