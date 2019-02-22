import { When, Then, Given, cucumberPending } from './utils/cucumber-wrapper';
import { getElement, ensureDisappearance, getFormField, fillFields, getSingularElement, fillDateField } from './utils/ui-utils';
import { element, by, until, browser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { showWebcamVideo } from './utils/device-utils';
import { Before } from 'cucumber';
import { ScenarioMemory } from './utils/scenario-memory';
import { ProductEntrySamples, ProductEntrySample } from './samples/product-entry-samples';
import * as lodash from 'lodash';

const expect = chai.use(chaiAsPromised).expect;
const memory = ScenarioMemory.singleton();

Before('@emulated_camera', async () => {
    await showWebcamVideo('blank');
});

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

Then(/^barcode scanning should start automatically$/, async() => {
    await getElement(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not start in time');
});

Then(/^barcode scanning should stop$/, async() => {
    await ensureDisappearance(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not stop');
});

Then(/^this barcode should appear in the barcode field$/, async() => {
    const thisBarcode = memory.recall('this barcode');
    const input = await getElement(by.deepCss('.barcode-controls .aux-input'), 'Barcode field not found', false, async (currenInput) => {
        const value = await currenInput.getAttribute('value');
        return value !== '';
    });
    expect(await input.getAttribute('value')).to.equal(thisBarcode);
});

Then(/^the matching article's name should appear in the name field$/, async() => {
    const thisBarcode = memory.recall('this barcode');
    const matchingEntry = ProductEntrySamples.validProductEntries.find(entry => entry.article.barcode === thisBarcode);
    const input = await getFormField('name');
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
        // await getSingularElement(by.deepCss('.barcode-controls .aux-input'), 'Another photo button not found');
    }
});
