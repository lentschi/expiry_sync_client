import { When, Then, Given, cucumberPending, Step } from './utils/cucumber-wrapper';
import {
    getElement,
    ensureDisappearance,
    getFormField,
    fillFields,
    getSingularElement,
    fillDateField,
    click,
    inputWithValue,
    fillField } from './utils/ui-utils';
import { by, until, ElementFinder } from 'protractor';
import { browser, element } from './utils/protractor-browser-wrapper';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { showWebcamVideo } from './utils/device-utils';
import { Before } from 'cucumber';
import { ScenarioMemory } from './utils/scenario-memory';
import { ProductEntrySamples, ProductEntrySample } from './samples/product-entry-samples';
import * as lodash from 'lodash';
import * as moment from 'moment';

const expect = chai.use(chaiAsPromised).expect;
const memory = ScenarioMemory.singleton();

When(/^I open the add product screen$/, async() => {
    await element(by.deepCss('[name="add-circle"]')).element(by.xpath('parent::*')).click();
});

// tslint:disable-next-line:max-line-length
Given(/^I hold (a|another) valid barcode(, that is different from the original product entry's article,| of an article, that has a different name than those added before,| of an article, that has a different expiration date than those added before,)? in front of the camera$/, async(specifier1: string, specifier2: string) => {
    const usedUpEntries: {[key: string]: ProductEntrySample} =
        memory.recall('entries, whose barcodes were held in front of the camera', false) || {};
    specifier2 = specifier2 || ' ';
    specifier2 = specifier2.trimLeft();
    if (specifier2 === ', that is different from the original product entry\'s article,') {
        specifier1 = 'another';
    }

    let key = -1;
    let validEntry = ProductEntrySamples.validProductEntries.find(entry => {
        key++;
        if (!entry.article.__barcodeImageName) {
            return false;
        }
        if (specifier1 === 'another' && typeof usedUpEntries[key] !== 'undefined') {
            return false;
        }
        if (specifier2 === 'of an article, that has a different name than those added before,'
                && !Object.values(usedUpEntries).some(currentEntry =>
                    currentEntry.article.name === entry.article.name
                )) {
            return false;
        }

        return true;
    });

    if (!validEntry) {
        return cucumberPending('No matching valid product entry samples left');
    }

    validEntry = lodash.cloneDeep(validEntry);
    validEntry.__scannedAt = new Date();
    usedUpEntries[key] = validEntry;

    await showWebcamVideo(validEntry.article.__barcodeImageName);
    memory.memorize(usedUpEntries, 'entries, whose barcodes were held in front of the camera');
    memory.memorize(validEntry.article.barcode, 'this barcode');
});

Then(/^barcode scanning should start(?: automatically)?$/, async() => {
    await getElement(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not start in time');
});

Then(/^barcode scanning should stop$/, async() => {
    await ensureDisappearance(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not stop', false, 5000);
    await showWebcamVideo('blank');
});

Then(/^this barcode should appear in the barcode field$/, async() => {
    const thisBarcode = memory.recall('this barcode');
    await getElement(by.deepCss('.barcode-controls .aux-input'),
            `Barcode field containing '${thisBarcode}' not found`,
            false,
            async (currentInput) => {
        const value = await currentInput.getAttribute('value');
        return value === thisBarcode;
    });
});

Then(/^the matching article's name should appear in the name field$/, async() => {
    const thisBarcode = memory.recall('this barcode');
    const matchingEntry = ProductEntrySamples.validProductEntries.find(entry => entry.article.barcode === thisBarcode);
    const input = await getFormField('name', 'name field not found', true, inputWithValue);
    expect(await input.getAttribute('value')).to.equal(matchingEntry.article.name);

    memory.memorize(matchingEntry, 'the product entry');
});

// tslint:disable-next-line:max-line-length
When(/^I (supply|complement the form with) valid product entry data( without a barcode| including a barcode| with a photo| without a name| with an invalid amount)?$/, async (modeParam: string, containingParam: string) => {
    if (containingParam) {
        containingParam = containingParam.trimLeft();
    }

    let entry: ProductEntrySample;
    if (modeParam === 'supply') {
        // select an entry from the list of prepared samples that matches containingParam
        entry = ProductEntrySamples.validProductEntries.find(currentEntry => {
            // we might choose any really, but out of a whim, let's choose ones that don't exist on any of the remotes:
            if (currentEntry.article.__existsOnRemote) {
                return false;
            }

            switch (containingParam) {
                case 'including a barcode': return !!currentEntry.article.barcode;
                case 'without a barcode':   return !currentEntry.article.barcode;
                case 'with a photo':        return !!currentEntry.article.__photo;
                default:                    return true;
            }
        });

        if (!entry) {
            return cucumberPending('No matching valid product entry sample found');
        }

        entry = lodash.cloneDeep(entry);

        switch (containingParam) {
            case 'without a name':          entry.article.name = '';    break;
            case 'with an invalid amount':  entry.amount = 0;           break;
        }

        if (entry.article.barcode) {
            const elem = element(by.deepCss('.barcode-controls ion-input'))
                .element(by.css_sr('::sr .native-input'));
            const input = await getSingularElement(elem, 'Barcode field not found');
            await input.sendKeys(entry.article.barcode);
        }
        fillField('name', entry.article.name);
    } else {
        entry = memory.recall('the product entry');

        switch (containingParam) {
            case 'without a name':          entry.article.name = '';    break;
            case 'with an invalid amount':  entry.amount = 0;           break;
        }
    }

    memory.memorize(entry, 'the product entry');

    await fillDateField('expiration date', entry.expirationDate);

    await fillFields({
        'amount': String(entry.amount),
        'description': entry.description
    });

    if (entry.article.__photo) {
        await showWebcamVideo(entry.article.__photo);
        await click(by.xpath('//ion-button[contains(.,"take picture")]'), 'Take picture button 1 could not be clicked');
        await getElement(by.deepCss('.video-wall video'), 'Video wall did not open in time');
        await click(by.xpath(
            '//ion-button[contains(@class, "button-full")][contains(.,"take picture")]'), 'Take picture button 2 could not be clicked'
        );
    }
});


When(/^I try to save the product entry form$/, async() => {
    const onEditScreen = memory.recall('opened the edit product screen', false) || false;
    if (onEditScreen) {
        memory.memorize(memory.recall('the product entry'), 'the updated product entry');
    }
    await click(by.xpath('//ion-button[contains(.,"save")]'), 'Save button could not be clicked');
});

// tslint:disable-next-line:max-line-length
Then(/^I should (no longer |still )?see (the|that|both)( updated| deleted)? product entr(?:y's|ies') (data|article name) in the product entry list$/, async(modifierParam, specifierParam, modifiedHow, whatParam) => {
    let entries: ProductEntrySample[];
    if (specifierParam !== 'both') {
        let whatToRecall: string;
        switch (modifiedHow) {
            case ' updated':    whatToRecall = 'the updated product entry'; break;
            case ' deleted':    whatToRecall = 'the deleted product entry'; break;
            default:            whatToRecall = 'the product entry';         break;
        }
        entries = [memory.recall(whatToRecall)];
    } else {
        entries = Object.values(memory.recall('entries, whose barcodes were held in front of the camera'));
    }

    for (const entry of entries) {
        let xpath: string;
        if (whatParam === 'data') {
            xpath = `//span[contains(.,"${entry.amount}")]`
             + `/../span[contains(.,"${entry.article.name}")]`
             + `/../span[contains(.,"${moment(entry.expirationDate).format('M/D/YYYY')}")]`;
        } else {
            xpath = `//span[contains(.,"${entry.article.name}")]`;
        }

        if (modifierParam !== 'no longer') {
            await ensureDisappearance(by.xpath(xpath), `entry "${entry.article.name}" not in list`);
        } else {
            await getElement(by.xpath(xpath), `entry "${entry.article.name}" still in list`);
        }
    }
});


When(/^I open the edit product screen for that product entry$/, async() => {
    memory.memorize(true, 'opened the edit product screen');
    const entry: ProductEntrySample = memory.recall('the product entry');

    await click(by.xpath(`//span[contains(.,"${entry.amount}")]`
        + `/../span[contains(.,"${entry.article.name}")]`
        + `/../span[contains(.,"${moment(entry.expirationDate).format('M/D/YYYY')}")]`));
});

Then (/^I should see that product entry's data in the form fields$/, async() => {
    const entry: ProductEntrySample = memory.recall('the product entry');

    const nameInput = await getFormField('name', 'name field not found', true, inputWithValue);
    expect(await nameInput.getAttribute('value')).to.equal(entry.article.name);

    const barcodeInput = await getElement(by.deepCss('.barcode-controls .aux-input'), 'Barcode field not found', false);
    expect(await barcodeInput.getAttribute('value')).to.equal(entry.article.barcode || '');
});

When(/^I choose to enter the product entry manually$/, async() => {
    await click(by.xpath('//ion-button[contains(.,"Enter manually")]'), 'Enter manually button could not be clicked');
});

Then(/^the barcode field should still be empty$/, async() => {
    await browser.sleep(500); // <- TODO: Rather wait for some loader to disappear?
    const input = await getElement(by.deepCss('.barcode-controls .aux-input'), 'Barcode field not found', false);
    expect(await input.getAttribute('value')).to.equal('');
});

// tslint:disable-next-line:max-line-length
When(/^I successfully add (a|another) product entry(, that has a different expiration date than those added before|, that has a different name than those added before)?$/, async(specifier1Param: string, specifier2Param:string) => {
    await Step(this, 'I open the add product screen');
    await Step(this, 'barcode scanning should start automatically');
    await Step(this, `I hold ${specifier1Param} valid barcode`
        + (!specifier2Param ? '' : ` of an article${specifier2Param},`) + ` in front of the camera`);
    await Step(this, 'barcode scanning should stop');
    await Step(this, 'this barcode should appear in the barcode field');
    await Step(this, `the matching article's name should appear in the name field`);
    await Step(this, 'I complement the form with valid product entry data');
    await Step(this, 'I try to save the product entry form');
    await Step(this, `I should see the product entry's data in the product entry list`);
});

When(/^I try to change the product entry's data$/, async() => {
    await Step(this, 'I open the edit product screen for that product entry');
    await Step(this, 'I overwrite the form fields contents with valid but changed product entry data');
    await Step(this, 'I try to save the product entry form');
    await Step(this, `I should see the updated product entry's data in the product entry list`);
});

// tslint:disable-next-line:max-line-length
Given(/^there exist(?:s)? (a|several) product entr(?:y|ies)( with different expiration dates| with different names)?(?: in my list)?$/, async (quantifierParam: string, specifierParam: string) => {
    if (quantifierParam === 'a') {
        await Step(this, `I successfully add a product entry${specifierParam || ''}`);
        return;
    }

    if (!specifierParam) {
        specifierParam = ' ';
    }
    specifierParam = specifierParam.trimLeft();
    let newSpecifierParam = '';
    switch (specifierParam) {
        case 'with different expiration dates':
            newSpecifierParam = ', that has a different expiration date than those added before';
            break;
        case 'with different names':
            newSpecifierParam = ', that has a different name than those added before';
            break;
    }

    for (let i = 0; i < 3; i++) {
        await Step(this, `I successfully add another product entry${newSpecifierParam}`);
    }

    const addedEntries = memory.recall('entries, whose barcodes were held in front of the camera');
    memory.memorize(addedEntries, ['previously added product entries', 'these product entries']);
});

// tslint:disable-next-line:max-line-length
When(/I overwrite the form fields contents with (?:valid but )?changed product entry data( without a name| with an invalid amount)?/, async(containingParam) => {
    if (containingParam) {
        containingParam = containingParam.trimLeft();
    }
    const originalEntry = memory.recall('the product entry');
    const entry = lodash.cloneDeep(ProductEntrySamples.validProductEntries.find(currentEntry =>
        originalEntry.article.barcode !== currentEntry.article.barcode
        && originalEntry.article.name !== currentEntry.article.name
    ));

    switch (containingParam) {
        case 'without a name':          entry.article.name = '';    break;
        case 'with an invalid amount':  entry.amount = 0;   break;
    }

    await fillDateField('expiration date', entry.expirationDate);

    await fillFields({
        'name': entry.article.name,
        'amount': String(entry.amount),
        'description': entry.description
    });

    if (entry.article.__photo) {
        await showWebcamVideo(entry.article.__photo);
        await click(by.xpath('//ion-button[contains(.,"take picture")]'), 'Take picture button 1 could not be clicked');
        await getElement(by.deepCss('.video-wall video'), 'Video wall did not open in time');
        await click(by.xpath(
            '//ion-button[contains(@class, "button-full")][contains(.,"take picture")]'), 'Take picture button 2 could not be clicked'
        );
    }
});

Then (/I should see that (?:adding|updating) failed$/, async() => {
  await Step(this, 'I should see "Saving the product entry failed"');
});

When (/^I choose to scan another barcode$/, async() => {
    const elem = element(by.deepCss('.barcode-controls ion-button'))
        .element(by.css_sr('::sr button'));
    const button = await getSingularElement(elem, 'Barcode button not found');
    await button.click();
});
