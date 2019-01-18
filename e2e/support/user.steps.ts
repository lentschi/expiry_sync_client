import { Before, Given, setDefaultTimeout } from 'cucumber';
import { browser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

const expect = chai.use(chaiAsPromised).expect;

Given(/^the registration form is open$/, async () => {
    browser.get(browser.baseUrl);
    await expect(browser.getTitle()).to.eventually.equal('ExpirySync');
});
