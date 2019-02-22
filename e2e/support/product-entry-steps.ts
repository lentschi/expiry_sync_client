import { When, Then, Given } from './utils/cucumber-wrapper';
import { tapMenuPoint, getElement, ensureDisappearance } from './utils/ui-utils';
import { element, by, until, browser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { showWebcamVideo } from './utils/device-utils';
import { Before } from 'cucumber';

const expect = chai.use(chaiAsPromised).expect;

Before('@emulated_camera', async () => {
    await showWebcamVideo('blank');
});

When(/^I open the add product screen$/, async() => {
    await element(by.deepCss('[name="add-circle"]')).element(by.xpath('parent::*')).click();
});

Given(/^I hold a valid barcode in front of the camera$/, async() => {
    await showWebcamVideo('barcode0');
});

Then(/^barcode scanning should start automatically$/, async() => {
    await getElement(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not start in time');
});

Then(/^barcode scanning should stop$/, async() => {
    await ensureDisappearance(by.deepCss('#quagga-barcode-scan video'), 'Barcode scanning did not stop');
});

Then(/^this barcode should appear in the barcode field$/, async() => {
    const input = await getElement(by.deepCss('.barcode-controls .aux-input'), 'Barcode field not found', false);
    const value = await input.getAttribute('value');
    expect(value).to.equal('0704679371330'); // TODO
});
