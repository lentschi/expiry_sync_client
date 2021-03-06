import { by, ExpectedConditions, ElementFinder, Locator, Key } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { setDefaultTimeout } from 'cucumber';
import * as moment from 'moment';
import { element, browser, setDefaultBrowser } from './protractor-browser-wrapper';
import { takeScreenShotAndDumpLogs } from './testing-utils';


const expect = chai.use(chaiAsPromised).expect;
const assert = chai.use(chaiAsPromised).assert;


export async function getElement(
    locator: Locator,
    errorMessage: string | boolean = 'Timeout waiting for element',
    waitForVisibility = true,
    extraCondition: (elementInQuestion: ElementFinder) => Promise<string | boolean> = null,
    timeout = 5000,
    maxRetriesDueToNonTimeoutErrors = 3): Promise<ElementFinder> {
    let foundElement: ElementFinder;
    let found = false;
    let nonTimeoutError: Error;
    let nonTimeoutErrorCount = 0;
    let extraConditionResult: string | boolean;
    const originalTimeout = timeout;

    const startTime = new Date();

    do {
        nonTimeoutError = null;
        try {
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

                    if (extraCondition) {
                        extraConditionResult = await extraCondition(currentElem);
                        if (extraConditionResult !== true) {
                            continue;
                        }
                    }

                    foundElement = currentElem;
                    break;
                }
                return !!foundElement;
            }, timeout);

            found = true;
        } catch (e) {
            if (originalTimeout > (new Date().getTime() - startTime.getTime())) {
                nonTimeoutError = e;
                nonTimeoutErrorCount++;
                timeout = Math.max(1, originalTimeout - (new Date().getTime() - startTime.getTime()));
            }
        }
    } while (nonTimeoutError);

    if (!found && errorMessage !== false) {
        let extraErrorMessage = ` (Locator ${locator.toString()} did not return anything within ${originalTimeout} ms (retries: ${nonTimeoutErrorCount}))`;
        if (typeof extraConditionResult === 'string') {
            extraErrorMessage = ` (${extraConditionResult})`;
        } else if (extraConditionResult === false) {
            extraErrorMessage = ' (extra condition not fulfilled)';
        }
        const message = errorMessage + extraErrorMessage;

        // await takeScreenShotAndDumpLogs(message);
        assert.fail(message);
    }

    return found ? foundElement : null;
}

export async function ensureDisappearance(locator: Locator,
        errorMessage: string | boolean = 'Timeout waiting for element',
        hidingIsEnough = false,
        timeout = 3000) {

        try {
            await browser.wait(async () => {
                return !(await getElement(locator, false, hidingIsEnough, null, 100));
            }, timeout);
        } catch {
            assert.fail(errorMessage + ` (Locator ${locator.toString()} still returned something after ${timeout} ms)`);
        }
}

export async function click(
        locator: Locator,
        errorMessage: string = 'Timeout waiting for clickable element',
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
        timeout = 5000,
        sleepAfterScroll = 400): Promise<ElementFinder> {
    return await getElement(locator, errorMessage, false, async (target) => {
        try {
            if (extraCondition) {
                if (!await extraCondition(target)) {
                    return false;
                }
            }

            await browser.executeAsyncScript<void>(
                'arguments[0].scrollIntoView({block: "center", behavior: "smooth"}); arguments[1]();',
                await target.getWebElement()
            );

            if (sleepAfterScroll !== 0) {
                await browser.sleep(sleepAfterScroll); // <- Unsure why this is required
            }

            await target.click();
            return true;
        } catch (e) {
            return e.message;
        }
    }, timeout);
}

export async function getSingularElement(
        elem: ElementFinder,
        errorMessage: string | boolean = 'Timeout waiting for element',
        waitForVisibility = true,
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
        timeout = 3000): Promise<ElementFinder> {
    let found = false;
    let nonTimeoutError: Error;
    let nonTimeoutErrorCount = 0;

    const startTime = new Date();
    const originalTimeout = timeout;

    do {
        nonTimeoutError = null;
        try {
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
            if (originalTimeout > (new Date().getTime() - startTime.getTime())) {
                nonTimeoutError = e;
                nonTimeoutErrorCount++;
                timeout = Math.max(1, originalTimeout - (new Date().getTime() - startTime.getTime()));
            }
        }
    } while (nonTimeoutError);

    if (!found && errorMessage !== false) {
        assert.fail(errorMessage + ` (getSingularElement did not return anything within ${originalTimeout} ms, ${nonTimeoutErrorCount} retries)`);
    }

    // TODO: Ensure that there's only one of the kind
    return found ? elem : null;
}

export async function getFormField(
        label: string,
        errorMessage: string | boolean = 'Timeout waiting for element',
        waitForVisibility = true,
        extraCondition: (elementInQuestion: ElementFinder) => Promise<boolean> = null,
        timeout?: number
    ): Promise<ElementFinder> {
    const elem = element(by.xpath(`//ion-label[contains(.,"${label}")]/../ion-input/input`));
    return await getSingularElement(
        elem, errorMessage ? errorMessage + ` - form field: '${label}'` : false, waitForVisibility, extraCondition, timeout
    );
}


export async function fillField(label: string, value: string): Promise<ElementFinder> {
    return await getFormField(label, `Could not find or access form field ${label}`, true, input =>
        fillFieldElement(input, value)
    );
}

export async function fillFieldElement(input: ElementFinder, value: string): Promise<boolean> {
    try {
        await input.clear();
        // Sometimes input.clear doesn't work -> use backspace repeatedly instead:
        while (await input.getAttribute('value') !== '') {
            await input.sendKeys(Key.BACK_SPACE);
        }
        await input.sendKeys(value);
        return (await input.getAttribute('value')) === value;
    } catch (e) {
        return false;
    }
}

export async function fillDateField(label: string, value: Date) {
    const dayInput = await getSingularElement(
        element(by.xpath(`//div${xpathClassPredicate('label')}[contains(.,"${label}")]/..//input[@inputmode="numeric"][2]`))
    );
    await fillFieldElement(dayInput, String(value.getDate()));

    const monthInput = await getSingularElement(
        element(by.xpath(`//div${xpathClassPredicate('label')}[contains(.,"${label}")]/..//input[@inputmode="numeric"][1]`))
    );
    await fillFieldElement(monthInput, String(value.getMonth() + 1));

    const yearInput = await getSingularElement(
        element(by.xpath(`//div${xpathClassPredicate('label')}[contains(.,"${label}")]/..//input[@inputmode="numeric"][3]`))
    );
    await fillFieldElement(yearInput, String(value.getFullYear()));
}

export async function fillFields(fields: { [label: string]: string }) {
    for (const label of Object.keys(fields)) {
        await fillField(label, fields[label]);
    }
}

export async function fillAndSubmitForm(fields: { [label: string]: string }) {
    await fillFields(fields);
    await click(by.xpath('//ion-button[@type="submit"]'));
}

export async function shouldSeeToast(text: string) {

    await getElement(by.deepCss('ion-toast'), `No such toast: '${text}'`, true, async (toast) => {
        const currentText = await toast.getText();
        if (currentText !== text) {
            if (currentText) {
                return `Toast found, but with different text: '${currentText}' instead of expected '${text}'`;
            } else {
                return `No such toast: '${text}'`;
            }
        }
        return true;
    });

}

export async function shouldSeeMenuPoint(label: string) {
    // TODO: Ensure that menu is open (required on narrow screens):
    const elem = element(deepCssContainingText('ion-menu ion-label', label));
    await browser.wait(ExpectedConditions.presenceOf(elem), 1000, `Menu point '${label}' not found`);
}

export async function tapMenuPoint(label: string) {
    // TODO: Ensure that menu is open (required on narrow screens):
    await click(deepCssContainingText('ion-menu ion-label', label), `Menu point '${label}' not found`);
}

export function deepCssContainingText(cssSelector: string, searchText: string | RegExp) {
    return by.cssContainingText('html /deep/ ' + cssSelector, searchText);
}


export async function initializeBrowser(restart = false) {
    if (restart) {
        await setDefaultBrowser(await browser.restart());
    }
    await browser.manage().window().maximize();
    setDefaultTimeout(300000);

    // Required due to http polling:
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

export function xpathClassPredicate(className: string): string {
    return `[contains(concat(' ', normalize-space(@class), ' '), ' ${className} ')]`;
}
