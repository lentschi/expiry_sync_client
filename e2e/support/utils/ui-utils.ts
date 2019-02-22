import { element, by, browser, ExpectedConditions, ElementFinder, Locator } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { setDefaultTimeout } from 'cucumber';


const expect = chai.use(chaiAsPromised).expect;
const assert = chai.use(chaiAsPromised).assert;

export async function getElement(
    locator: Locator,
    errorMessage: string | boolean = 'Timeout waiting for element',
    waitForVisibility = true,
    timeout = 3000): Promise<ElementFinder> {
    let foundElement: ElementFinder;
    let found = false;
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

                foundElement = currentElem;
                break;
            }
            return !!foundElement;
        }, timeout);

        found = true;
    } catch (e) { }

    if (!found && errorMessage !== false) {
        assert.fail(errorMessage + ` (Locator ${locator.toString()} did not return anything within ${timeout} ms)`);
    }

    return found ? foundElement : null;
}

export async function ensureDisappearance(locator: Locator,
        errorMessage: string | boolean = 'Timeout waiting for element',
        hidingIsEnough = false,
        timeout = 3000) {
    let disappeared = false;
    try {
        await browser.wait(async () => {
            const elem = element(locator);
            const present = await elem.isPresent();
            const displayed = present && (await elem.isDisplayed());

            return !present || (hidingIsEnough && !displayed);
        }, timeout);
        disappeared = true;
    } catch (e) {}

    if (!disappeared) {
        assert.fail(errorMessage + ` (Locator ${locator.toString()} still returned something after ${timeout} ms)`);
    }
}

export async function click(
    locator: Locator,
    errorMessage: string = 'Timeout waiting for element',
    waitForVisibility = true,
    timeout = 3000): Promise<ElementFinder> {
    const target = await getElement(locator, errorMessage, waitForVisibility, timeout);
    await target.click();
    return target;
}


export async function fillField(label: string, value: string) {
    const input = element(by.xpath(`//ion-label[contains(.,"${label}")]/../ion-input`))
        .element(by.css_sr('::sr .native-input'));
    await input.clear();
    await input.sendKeys(value);
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
