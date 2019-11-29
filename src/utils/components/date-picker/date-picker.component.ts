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

    private changeCallback: (val: string) => void;
    private touchCallback: () => void;
    private lastValue: string;
    private skipNextBlurRevert = false;
    private lastActivatedInput: HTMLInputElement;

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

        this.value = this.value;
    }

    writeValue(val: string) {
        this.lastValue = this.value = val;
    }

    set value(val: string) {
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
            return this.lastValue;
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
            this.onChange();
        } else if (!this.skipNextBlurRevert) {
            const dateInputs: Element[] = [this.dayInput.nativeElement, this.monthInput.nativeElement, this.yearInput.nativeElement];
            if (!dateInputs.includes(document.activeElement)) {
                this.value = this.lastValue;
            }
        }

        this.skipNextBlurRevert = false;
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

    onInputClicked(event: MouseEvent) {
        const input = <HTMLInputElement> event.target;
        if (this.lastActivatedInput !== input) {
            input.select();
        }

        this.lastActivatedInput = <HTMLInputElement> document.activeElement;
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

        this.lastValue = this.value;
        if (this.changeCallback) {
            this.changeCallback(this.lastValue);
        }
    }
}
