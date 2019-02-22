import { element, by, browser, ExpectedConditions, ElementFinder, Locator } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { setDefaultTimeout } from 'cucumber';
import * as moment from 'moment';


const expect = chai.use(chaiAsPromised).expect;
const assert = chai.use(chaiAsPromised).assert;

export async function getElement(
    locator: Locator,
    errorMessage: string | boolean = 'Timeout waiting for element',
    waitForVisibility = true,
    extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
    timeout = 3000,
    maxRetriesDueToStaleElements = 3): Promise<ElementFinder> {
    let foundElement: ElementFinder;
    let found = false;
    let staleElementError: Error;
    let staleElementErrorCount = 0;

    do {
        staleElementError = null;
        try {
            staleElementError = null;
            await browser.wait(async () => {
                const allElements = element.all(locator);
                for (let i = 0; i < await allElements.count(); i++) {
                    const currentElem = allElements.get(i);
                    if (!await currentElem.isPresent()) {
                        continue;
                    }

                    if (waitForVisibility && !await currentElem.isDisplayed()) {
                        continue;
                    }

                    if (extraCondition && (! await extraCondition(currentElem))) {
                        continue;
                    }

                    foundElement = currentElem;
                    break;
                }
                return !!foundElement;
            }, timeout);

            found = true;
        } catch (e) {
            if (!e.name || e.name !== 'TimeoutError') {
                staleElementError = e;
                staleElementErrorCount++;
                timeout = 1;
            }
        }
    } while (staleElementError && staleElementErrorCount < maxRetriesDueToStaleElements);

    if (!found && errorMessage !== false) {
        assert.fail(errorMessage + ` (Locator ${locator.toString()} did not return anything within ${timeout} ms)`);
    }

    return found ? foundElement : null;
}

export async function ensureDisappearance(locator: Locator,
        errorMessage: string | boolean = 'Timeout waiting for element',
        hidingIsEnough = false,
        timeout = 3000,
        maxRetriesDueToStaleElements = 3) {
    let disappeared = false;
    let staleElementError: Error;
    let staleElementErrorCount = 0;

    do {
        staleElementError = null;
        try {
            await browser.wait(async () => {
                const elem = element(locator);
                const present = await elem.isPresent();
                const displayed = present && (await elem.isDisplayed());

                return !present || (hidingIsEnough && !displayed);
            }, timeout);
            disappeared = true;
        } catch (e) {
            if (!e.name || e.name !== 'TimeoutError') {
                staleElementError = e;
                staleElementErrorCount++;
            }
        }
    } while (staleElementError && staleElementErrorCount < maxRetriesDueToStaleElements);

    if (!disappeared) {
        assert.fail(errorMessage + ` (Locator ${locator.toString()} still returned something after ${timeout} ms)`);
    }
}

export async function click(
        locator: Locator,
        errorMessage: string = 'Timeout waiting for element',
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
        timeout = 3000): Promise<ElementFinder> {
    const target: ElementFinder = await getElement(locator, errorMessage, false, extraCondition, timeout);
    if (!await target.isDisplayed()) {
        await browser.executeScript('arguments[0].scrollIntoView();', await target.getWebElement());
        await browser.sleep(400); // <- Unsure why this is required
    }
    await target.click();
    return target;
}

export async function getSingularElement(
        elem: ElementFinder,
        errorMessage: string | boolean = 'Timeout waiting for element',
        waitForVisibility = true,
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
        timeout = 3000,
        maxRetriesDueToStaleElements = 3): Promise<ElementFinder> {
    let found = false;
    let staleElementError: Error;
    let staleElementErrorCount = 0;

    do {
        staleElementError = null;
        try {
            staleElementError = null;
            await browser.wait(async () => {
                if (!await elem.isPresent()) {
                    return false;
                }

                if (waitForVisibility && !await elem.isDisplayed()) {
                    return false;
                }

                if (extraCondition && (! await extraCondition(elem))) {
                    return false;
                }

                return true;
            }, timeout);

            found = true;
        } catch (e) {
            if (!e.name || e.name !== 'TimeoutError') {
                staleElementError = e;
                staleElementErrorCount++;
                timeout = 1;
            }
        }
    } while (staleElementError && staleElementErrorCount < maxRetriesDueToStaleElements);

    if (!found && errorMessage !== false) {
        assert.fail(errorMessage + ` (getSingularElement did not return anything within ${timeout} ms)`);
    }

    // TODO: Ensure that there's only one of the kind
    return found ? elem : null;
}

export async function getFormField(
        label: string,
        errorMessage: string | boolean = 'Timeout waiting for element',
        waitForVisibility = true,
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null
    ): Promise<ElementFinder> {
    const elem = element(by.xpath(`//ion-label[contains(.,"${label}")]/../ion-input`))
        .element(by.css_sr('::sr .native-input'));
    return await getSingularElement(elem, errorMessage, waitForVisibility, extraCondition);
}


export async function fillField(label: string, value: string) {
    const input = await getFormField(label);
    await input.clear();
    await input.sendKeys(value);
}

export async function fillDateField(label: string, value: Date) {
    const dateButton = await getSingularElement(
        element(by.xpath(`//ion-label[contains(.,"${label}")]/../ion-datetime`))
        .element(by.css_sr('::sr button'))
    );
    await dateButton.click();
    const doneButton = await getElement(by.xpath('//button[contains(.,"done")]'), 'Datepicker could not be opened');

    const date = moment(value);

    let currentDay: string, currentMonth: string, currentYear: string;
    const selectedButtons = element.all(by.xpath('//button[contains(@class, "picker-opt-selected")]'));
    for (let i = 0; i < await selectedButtons.count(); i++) {
        const currentButton = selectedButtons.get(i);
        switch (i) {
            case 1: currentDay = await currentButton.getText();     break;
            case 0: currentMonth = await currentButton.getText();   break;
            case 2: currentYear = await currentButton.getText();    break;
        }
    }


    const currentDate = moment(`${currentMonth}/${currentDay}/${currentYear}`, 'MMM/DD/YYYY');

    while (currentDate.year() !== date.year()) {
        const add = currentDate.year() < date.year() ? 1 : -1;
        await click(
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'year').format('YYYY')}")]`)
        );
    }

    while (currentDate.month() !== date.month()) {
        const add = currentDate.month() < date.month() ? 1 : -1;
        await click(
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'month').format('MMM')}")]`)
        );
    }

    while (currentDate.date() !== date.date()) {
        const add = currentDate.date() < date.date() ? 1 : -1;
        await click(
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'day').format('DD')}")]`)
        );
    }

    await doneButton.click();
}

export async function fillFields(fields: { [label: string]: string }) {
    for (const label of Object.keys(fields)) {
        await fillField(label, fields[label]);
    }
}

export async function fillAndSubmitForm(fields: { [label: string]: string }) {
    await fillFields(fields);
    await element(by.xpath('//ion-button[@type="submit"]')).click();
}

export async function shouldSeeToast(text: string) {
    const elem = element(by.deepCss('ion-toast'));

    await browser.wait(ExpectedConditions.presenceOf(elem), 1000, `Toast '${text}' not found`);
    await expect(elem.getText()).to.eventually.equal(text);
}

export async function shouldSeeMenuPoint(label: string) {
    // TODO: Ensure that menu is open (required on narrow screens):
    const elem = element(deepCssContainingText('ion-menu ion-label', label));
    await browser.wait(ExpectedConditions.presenceOf(elem), 1000, `Menu point '${label}' not found`);
}

export async function tapMenuPoint(label: string) {
    // TODO: Ensure that menu is open (required on narrow screens):
    const elem = element(deepCssContainingText('ion-menu ion-label', label));
    await browser.wait(ExpectedConditions.presenceOf(elem), 1000, `Menu point '${label}' not found`);
    await elem.click();
}

export function deepCssContainingText(cssSelector: string, searchText: string | RegExp) {
    return by.cssContainingText('html /deep/ ' + cssSelector, searchText);
}


export async function initializeBrowser() {
    setDefaultTimeout(30000);

    // I don't quite understand why I need this here (Possibly due to permanent HTTP polling)
    // s. https://stackoverflow.com/questions/42648077/how-does-waitforangularenabled-work
    // and https://github.com/angular/protractor/issues/5045:
    browser.waitForAngularEnabled(false);

    // s. https://github.com/angular/protractor/issues/4367
    // TODO: Remove this as soon as the above issue is fixed:
    by.addLocator('css_sr', (cssSelector: string, opt_parentElement: Element, opt_rootSelector: string) => {
        const selectors = cssSelector.split('::sr');
        if (selectors.length === 0) {
            return [];
        }

        const shadowDomInUse = ((<any>document.head).createShadowRoot || document.head.attachShadow);
        const getShadowRoot = (el) => ((el && shadowDomInUse) ? el.shadowRoot : el);
        const findAllMatches = (selector: string, targets: any[], firstTry: boolean) => {
            let using: { querySelectorAll: (arg0: string) => void; }, i: number;
            const currentMatches = [];
            for (i = 0; i < targets.length; ++i) {
                using = (firstTry) ? targets[i] : getShadowRoot(targets[i]);
                if (using) {
                    if (selector === '') {
                        currentMatches.push(using);
                    } else {
                        Array.prototype.push.apply(currentMatches, using.querySelectorAll(selector));
                    }
                }
            }
            return currentMatches;
        };

        let matches = findAllMatches(selectors.shift().trim(), [opt_parentElement || document], true);
        while (selectors.length > 0 && matches.length > 0) {
            matches = findAllMatches(selectors.shift().trim(), matches, false);
        }
        return matches;
    });
}

export async function inputWithValue(currentInput) {
    const value = await currentInput.getAttribute('value');
    return value !== '';
}
