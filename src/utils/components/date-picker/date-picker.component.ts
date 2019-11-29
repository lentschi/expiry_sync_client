import { Component, Input, forwardRef, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import * as moment from 'moment';
import { Setting } from 'src/app/models';
import { IonDatetime } from '@ionic/angular';

@Component({
  selector: 'date-picker',
  templateUrl: 'date-picker.component.html',
  styleUrls: ['date-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true
    }
  ]
})
export class DatePickerComponent implements ControlValueAccessor, OnInit, AfterViewChecked {
  partSequence: string[];

  @Input() dateFormat: string;
  @Input() max: string;
  @Input() pickerFormat: string;
  @Input() monthsShort: string[];
  @Input() monthsLong: string[];
  @Input() daysShort: string[];
  @Input() daysLong: string[];
  @Input() cancelText: string;
  @Input() doneText: string;
  @Input() label: string;

  @ViewChild('dayInput', { static: false }) dayInput: ElementRef<HTMLInputElement>;
  @ViewChild('monthInput', { static: false }) monthInput: ElementRef<HTMLInputElement>;
  @ViewChild('yearInput', { static: false }) yearInput: ElementRef<HTMLInputElement>;
  @ViewChild('ionPicker', { static: false }) ionPicker: IonDatetime;


  ionPickerControl = new FormControl();

  private changeCallback: (val: string) => void;
  private touchCallback: () => void;
  private skipNextBlurRevert = false;
  private lastActivatedInput: HTMLInputElement;
  private selectFirstInputAfterViewChecked: boolean;

  ngOnInit() {
    const re = /[MDY]+/g;
    let match: RegExpExecArray;
    let lastMatchIndex = 0;
    this.partSequence = [];
    while ((match = re.exec(this.dateFormat.toUpperCase())) !== null) {
      if (match.index !== lastMatchIndex) {
        this.partSequence.push(this.dateFormat.substring(lastMatchIndex, match.index));
      }
      switch (match[0].substr(0, 1)) {
        case 'D': this.partSequence.push('day'); break;
        case 'M': this.partSequence.push('month'); break;
        case 'Y': this.partSequence.push('year'); break;
      }
      lastMatchIndex = match.index + match[0].length;
    }

    this.value = this.value;
    this.ionPickerControl.valueChanges.subscribe(val => {
      this.onChange();
    });
  }

  ngAfterViewChecked() {
    if (this.selectFirstInputAfterViewChecked) {
      this.selectFirstInputAfterViewChecked = false;

      const firstPart = this.partSequence.find(currentPart =>
        ['day', 'month', 'year'].includes(currentPart)
      );
      const firstInput = this.getInputForPart(firstPart);
      firstInput.select();
    }
  }


  writeValue(val: string) {
    this.value = val;
  }

  get keyboardMode(): boolean {
    return Setting.cached('keyboardDatepickerMode') === '1';
  }

  set keyboardMode(active: boolean) {
    Setting.set('keyboardDatepickerMode', active ? '1' : '0');
  }

  set value(val: string) {
    this.ionPickerControl.setValue(val);
    if (!this.dayInput || !this.monthInput || !this.yearInput) {
      return;
    }

    const date = new Date(val);
    this.dayInput.nativeElement.value = String(date.getDate());
    this.monthInput.nativeElement.value = String(date.getMonth() + 1);
    this.yearInput.nativeElement.value = String(date.getFullYear());
  }

  get value(): string {
    if (!this.dayInput || !this.monthInput || !this.yearInput) {
      return this.ionPickerControl.value;
    }

    return this.getIsoValue(
      this.yearInput.nativeElement.value,
      this.monthInput.nativeElement.value,
      this.dayInput.nativeElement.value
    );
  }


  registerOnChange(fn: (val: string) => void) {
    this.changeCallback = fn;
  }

  registerOnTouched(fn: () => void) {
    this.touchCallback = fn;
  }

  onBlur() {
    if (this.inputIsValid(this.value)) {
      this.ionPickerControl.setValue(this.value);
      this.onChange();
    } else if (!this.skipNextBlurRevert) {
      const dateInputs: Element[] = [this.dayInput.nativeElement, this.monthInput.nativeElement, this.yearInput.nativeElement];
      if (!dateInputs.includes(document.activeElement)) {
        this.value = this.ionPickerControl.value;
      }
    }

    this.skipNextBlurRevert = false;
  }

  separatorClicked(index: number) {
    const previousPart = this.partSequence.slice(0, index).reverse().find(currentPart =>
      ['day', 'month', 'year'].includes(currentPart)
    );

    if (previousPart) {
      const input = this.getInputForPart(previousPart);
      input.select();
    }
  }

  private getIsoValue(year: string, month: string, day: string): string {
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
  }

  private inputIsValid(val: string): boolean {
    return moment(val, moment.ISO_8601, true).isValid();
  }

  private getNextInputPart(part: string): string {
    const partIndex = this.partSequence.indexOf(part);
    return this.partSequence.slice(partIndex + 1).find(currentPart =>
      ['day', 'month', 'year'].includes(currentPart)
    );
  }

  private getInputForPart(part: string): HTMLInputElement {
    switch (part) {
      case 'day': return this.dayInput ? this.dayInput.nativeElement : null;
      case 'month': return this.monthInput ? this.monthInput.nativeElement : null;
      case 'year': return this.yearInput ? this.yearInput.nativeElement : null;
    }
  }

  onInputClicked(event: MouseEvent) {
    const input = <HTMLInputElement>event.target;
    if (this.lastActivatedInput !== input) {
      input.select();
    }

    this.lastActivatedInput = <HTMLInputElement>document.activeElement;
  }

  onInput(part: string, input: HTMLInputElement) {
    const nextInputPart = this.getNextInputPart(part);
    if (!nextInputPart) {
      return;
    }

    const inputValue = input.value;
    if (input.selectionStart < inputValue.length - 1) {
      return;
    }

    const elementsSeparatedByNonNumber = inputValue.split(/[^0-9]/g);
    if (elementsSeparatedByNonNumber.length > 1) {
      this.moveToInput(
        input,
        elementsSeparatedByNonNumber[0],
        elementsSeparatedByNonNumber.slice(1).join('-'),
        nextInputPart
      );
      return;
    }

    const maxLength = (part === 'year') ? 4 : 2;
    if (inputValue.length < maxLength) {
      return;
    }

    const charactersToRemain = inputValue.substr(0, maxLength);
    const currentYear = (part === 'year') ? charactersToRemain : this.yearInput.nativeElement.value;
    const currentMonth = (part === 'month') ? charactersToRemain : this.monthInput.nativeElement.value;
    const currentDay = (part === 'day') ? charactersToRemain : this.dayInput.nativeElement.value;
    const currentValue = this.getIsoValue(currentYear, currentMonth, currentDay);
    if (!this.inputIsValid(currentValue)) {
      input.select();
      return;
    }

    this.moveToInput(
      input,
      charactersToRemain,
      (inputValue.length > maxLength) ? inputValue.substr(maxLength) : null,
      nextInputPart,
    );
  }

  enableKeyboardMode(event: Event, enable = true) {
    event.preventDefault();
    event.stopPropagation();
    this.keyboardMode = enable;

    if (!enable) {
      this.ionPicker.open();
    } else {
      this.selectFirstInputAfterViewChecked = true;
    }
  }

  private moveToInput(input: HTMLInputElement, charactersToRemain: string, charactersToBeTransfered: string, nextInputPart: string) {
    this.skipNextBlurRevert = true;
    input.value = charactersToRemain;
    const nextInput = this.getInputForPart(nextInputPart);
    if (charactersToBeTransfered) {
      nextInput.value = charactersToBeTransfered;
      nextInput.focus();
    } else {
      nextInput.select();
    }
    this.onInput(nextInputPart, nextInput);
  }

  private onChange() {
    if (this.touchCallback) {
      this.touchCallback();
    }

    if (this.changeCallback) {
      this.changeCallback(this.ionPickerControl.value);
    }
  }
}
