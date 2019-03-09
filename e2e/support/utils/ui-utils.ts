import { by, ExpectedConditions, ElementFinder, Locator, Key } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { setDefaultTimeout } from 'cucumber';
import * as moment from 'moment';
import { createWriteStream } from 'fs';
import { element, browser, setDefaultBrowser } from './protractor-browser-wrapper';
import { ScenarioMemory } from './scenario-memory';


const expect = chai.use(chaiAsPromised).expect;
const assert = chai.use(chaiAsPromised).assert;
const memory = ScenarioMemory.singleton();

export async function getElement(
    locator: Locator,
    errorMessage: string | boolean = 'Timeout waiting for element',
    waitForVisibility = true,
    extraCondition: (elementInQuestion: ElementFinder) => Promise<string | boolean> = null,
    timeout = 5000,
    maxRetriesDueToStaleElements = 3): Promise<ElementFinder> {
    let foundElement: ElementFinder;
    let found = false;
    let staleElementError: Error;
    let staleElementErrorCount = 0;
    let extraConditionResult: string | boolean;

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
            if (!e.name || e.name !== 'TimeoutError') {
                staleElementError = e;
                staleElementErrorCount++;
                timeout = 1;
            }
        }
    } while (staleElementError && staleElementErrorCount < maxRetriesDueToStaleElements);

    if (!found && errorMessage !== false) {
        let extraErrorMessage = ` (Locator ${locator.toString()} did not return anything within ${timeout} ms)`;
        if (typeof extraConditionResult === 'string') {
            extraErrorMessage = ` (${extraConditionResult})`;
        } else if (extraConditionResult === false) {
            extraErrorMessage = ' (extra condition not fulfilled)';
        }
        const message = errorMessage + extraErrorMessage;

        await takeScreenShotAndDumpLogs(message);
        assert.fail(message);
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
    const elem = element(by.xpath(`//ion-label[contains(.,"${label}")]/../ion-input/input`));
    return await getSingularElement(
        elem, errorMessage ? errorMessage + ` - form field: '${label}'` : null, waitForVisibility, extraCondition
    );
}


export async function fillField(label: string, value: string): Promise<ElementFinder> {
    return await getFormField(label, `Could not find or access form field ${label}`, true, async (input) => {
        try {
            await input.clear();
            // Sometimes input.clear doesn't work -> use backspace repeatedly instead:
            while (await input.getAttribute('value') !== '') {
                await input.sendKeys(Key.BACK_SPACE);
            }
            await input.sendKeys(value);
            return true;
        } catch (e) {
            return false;
        }
    });
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
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'year').format('YYYY')}")]`),
            'Date could not be clicked',
            null,
            5000,
            0
        );
    }

    while (currentDate.month() !== date.month()) {
        const add = currentDate.month() < date.month() ? 1 : -1;
        await click(
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'month').format('MMM')}")]`),
            'Date could not be clicked',
            null,
            5000,
            0
        );
    }

    while (currentDate.date() !== date.date()) {
        const add = currentDate.date() < date.date() ? 1 : -1;
        await click(
            by.xpath(`//button[contains(@class, "picker-opt")][contains(text(), "${currentDate.add(add, 'day').format('DD')}")]`),
            'Date could not be clicked',
            null,
            5000,
            0
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
    const elem = element(deepCssContainingText('ion-menu ion-label', label));
    await browser.wait(ExpectedConditions.presenceOf(elem), 1000, `Menu point '${label}' not found`);
    await elem.click();
}

export function deepCssContainingText(cssSelector: string, searchText: string | RegExp) {
    return by.cssContainingText('html /deep/ ' + cssSelector, searchText);
}


export async function initializeBrowser(restart = false) {
    if (restart) {
        await setDefaultBrowser(await browser.restart());
    }
    await browser.manage().window().maximize();
    setDefaultTimeout(30000);

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


export async function takeScreenShotAndDumpLogs(message = 'Completed') {
    const scenarioName = memory.recall('current scenario').pickle.name;
    let logs = message + '\n\n';
    const logTypes = await browser.manage().logs().getAvailableLogTypes();
    for (const type of logTypes) {
        logs += '\n----- Log Type: ' + JSON.stringify(type) + '\n';
        const browserLogs = await browser.manage().logs().get(type);
        for (const log of browserLogs) {
            logs += scenarioName + ': ' +
                + JSON.stringify(log.level) + ' :: ' + JSON.stringify(log.message) + '\n';
        }
        logs += '----- END OF Log Type: ' + JSON.stringify(type) + '\n';
    }
    const textStream = createWriteStream(`/srv/project/e2e/support/error_dumps/${scenarioName}.log`);
    await new Promise((resolve, reject) => {
        textStream.on('open', () => {
            textStream.write(Buffer.from(logs));
            textStream.end();
        }).on('finish', () => {
            resolve();
        }).on('error', err => {
            reject(err);
        });
    });

    // console.error('Done Dumping logs for ' + logCount);

    const data = await browser.takeScreenshot();
    const stream = createWriteStream(`/srv/project/e2e/support/error_dumps/${scenarioName}.png`);
    await new Promise((resolve, reject) => {
        stream.on('open', () => {
            stream.write(Buffer.from(data, 'base64'));
            stream.end();
        }).on('finish', () => {
            resolve();
        }).on('error', err => {
            reject(err);
        });
    });

    // console.error('Done saving screenshot for ' + logCount);
}
