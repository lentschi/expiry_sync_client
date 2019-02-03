import { When, Then } from './utils/cucumber-wrapper';
import { tapMenuPoint } from './utils/ui-utils';
import { element, by, until, browser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

const expect = chai.use(chaiAsPromised).expect;

When(/^I open the add product screen$/, async() => {
    await element(by.deepCss('[name="add-circle"]')).element(by.xpath('parent::*')).click();
});

Then(/^barcode scanning should start automatically$/, async() => {
    await browser.wait(async () => {
        if (!await element(by.deepCss('.barcode-controls .aux-input')).isPresent()) {
            return false;
        }

        const currentValue = await element(by.deepCss('.barcode-controls .aux-input')).getAttribute('value');
        if (!currentValue || currentValue === '') {
            return false;
        }

        return true;
    }, 20000);

    const value = await element(by.deepCss('.barcode-controls .aux-input')).getAttribute('value');
    expect(value).to.equal('9121068520918');
});
