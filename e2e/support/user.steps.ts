import { by, until } from 'protractor';
import { browser, element } from './utils/protractor-browser-wrapper';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { fillAndSubmitForm, shouldSeeToast as seeToast, shouldSeeMenuPoint, tapMenuPoint } from './utils/ui-utils';
import { ScenarioMemory } from './utils/scenario-memory';
import { UserSamples } from './samples/user-samples';
import { Given, Then, Step, When } from './utils/cucumber-wrapper';

const expect = chai.use(chaiAsPromised).expect;

const memory = ScenarioMemory.singleton();


const openRegistrationForm = async () => {
    await element(by.xpath('//ion-label[text()="register"]')).click();
};

Given(/^the registration form is open$/, async () => {
    await browser.get(browser.baseUrl);
    try {
        await browser.wait(until.elementLocated(
            by.xpath('//ion-title[contains(text(),"registration")]')
        ), 1000);
    } catch (e) {
        await openRegistrationForm();
    }
});

Given(/^I open the registration form$/, async () => {
    await openRegistrationForm();
});

Given(/^I enter valid registration data(, that is different from the one I entered before)?$/, async (different) => {
    const userData = UserSamples.validUsers.find(currentUser => {
        return !different
            || !memory.recall('registered user')
            || memory.recall('registered user').account_name !== currentUser.account_name;
    });

    await fillAndSubmitForm({
        'user name': userData.account_name,
        'email': userData.email_address,
        'password': userData.password
    });

    memory.memorize(userData, ['that user', 'registered user']);
});


Then(/^I should see that registration succeeded$/, async () => {
    const registeredUser = memory.recall('registered user');
    await seeToast(`User '${registeredUser.account_name}' has been registered successfully.`);
});

Given(/^there exists a user$/, async () => {
    await Step(this, 'the registration form is open');
    await Step(this, 'I enter valid registration data');
    await Step(this, 'I should see that registration succeeded');
});

Given(/^I register a user with different data than on the first device$/, async() => {
    await Step(this, 'the registration form is open');
    await Step(this, 'I enter valid registration data, that is different from the one I entered before');
    await Step(this, 'I should see that registration succeeded');

    // TODO: Check why this is required:
    await Step(this, 'I am logged in as that user');
});

Given(/^the login form is open/, async () => {
    try {
        await browser.wait(until.elementLocated(
            by.xpath('//ion-title[contains(text(),"login")]')
        ), 1000);
    } catch (e) {
        await element(by.cssContainingText('ion-button', 'login instead')).click();
        await browser.wait(until.elementLocated(
            by.xpath('//ion-title[contains(text(),"login")]')
        ), 1000);
    }
});

// tslint:disable-next-line:max-line-length
When(/^I try to login (as that user|with the same user as on the first device|with the same user as previously)$/, async (whatUserParam: string) => {
    await Step(this, 'the login form is open');

    const userData = memory.recall(whatUserParam === 'as that user' ? 'that user' : 'user on the first device');

    await fillAndSubmitForm({
        'login': userData.account_name || userData.email_address,
        'password': userData.password
    });

    memory.memorize(userData, 'that user');
});

When(/^I try to log out$/, async() => {
    tapMenuPoint('Logout');
});

Then(/^logout should be successful$/, async () => {
    await seeToast('You have been logged out');
});


Then (/^I should be logged in as that user$/, async() => {
    const thatUser = memory.recall('that user');
    await shouldSeeMenuPoint(`Logout "${thatUser.account_name}"`);
});

Given(/^I am logged in as that user$/, async() => {
    try {
        await shouldSeeMenuPoint('Logout');
        await Step(this, 'I try to log out');
        await Step(this, 'logout should be successful');
    } catch (e) { }

    await Step(this, 'I try to login as that user');
    await Step(this, 'I should be logged in as that user');
});
