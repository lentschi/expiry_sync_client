import { Component, Input, forwardRef, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import * as moment from 'moment';

@Component({
    selector: 'date-picker',
    templateUrl: 'date-picker.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DatePickerComponent),
            multi: true
        }
    ]
})
export class DatePickerComponent implements ControlValueAccessor, OnInit {
    partSequence: string[];

    @Input() dateFormat: string;

    @ViewChild('dayInput', {static: false}) dayInput: ElementRef<HTMLInputElement>;
    @ViewChild('monthInput', {static: false}) monthInput: ElementRef<HTMLInputElement>;
    @ViewChild('yearInput', {static: false}) yearInput: ElementRef<HTMLInputElement>;

    dayControl = new FormControl();
    monthControl = new FormControl();
    yearControl = new FormControl();

    private changeCallback: (val: string) => void;
    private touchCallback: () => void;
    private lastValue: string;

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
                case 'D': this.partSequence.push('day');    break;
                case 'M': this.partSequence.push('month');  break;
                case 'Y': this.partSequence.push('year');   break;
            }
            lastMatchIndex = match.index + match[0].length;
        }
    }

    writeValue(val: string) {
        this.lastValue = this.value = val;
    }

    set value(val: string) {
        const date = new Date(val);
        this.dayControl.setValue(String(date.getDate()));
        this.monthControl.setValue(String(date.getMonth() + 1));
        this.yearControl.setValue(String(date.getFullYear()));
    }

    get value(): string {
        return this.getIsoValue(this.yearControl.value, this.monthControl.value, this.dayControl.value);
    }


    registerOnChange(fn: (val: string) => void) {
        this.changeCallback = fn;
    }

    registerOnTouched(fn: () => void) {
        this.touchCallback = fn;
    }

    onBlur() {
        if (this.inputIsValid(this.value)) {
            this.onChange();
        } else {
            // this.value = this.lastValue;
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
            case 'day':     return this.dayInput.nativeElement;
            case 'month':   return this.monthInput.nativeElement;
            case 'year':    return this.yearInput.nativeElement;
        }
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

        const maxLength = (part === 'year') ? 4 : 2;
        if (inputValue.length < maxLength) {
            return;
        }

        const charactersToRemain = inputValue.substr(0, maxLength);
        const currentYear = (part === 'year') ? charactersToRemain : this.yearControl.value;
        const currentMonth = (part === 'month') ? charactersToRemain : this.monthControl.value;
        const currentDay = (part === 'day') ? charactersToRemain : this.dayControl.value;
        const currentValue = this.getIsoValue(currentYear, currentMonth, currentDay);
        if (!this.inputIsValid(currentValue)) {
            input.focus();
            input.select();
            return;
        }

        input.value = charactersToRemain;
        const nextInput = this.getInputForPart(nextInputPart);
        nextInput.value = inputValue.substr(maxLength);
        nextInput.focus();
        this.onInput(nextInputPart, nextInput);
    }

    private onChange() {
        if (this.touchCallback) {
            this.touchCallback();
        }

        this.lastValue = this.value;
        if (this.changeCallback) {
            console.log('change', this.lastValue);
            this.changeCallback(this.lastValue);
        }
    }
}
