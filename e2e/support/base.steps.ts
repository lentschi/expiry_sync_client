
import { BeforeAll, AfterAll } from 'cucumber';
import { ServerUtils } from './utils/server-utils';
import { browser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { initializeBrowser } from './utils/ui-utils';
import { Given } from './utils/cucumber-wrapper';


const expect = chai.use(chaiAsPromised).expect;
const utils = ServerUtils.singleton();


BeforeAll(() => {
    initializeBrowser();
});

AfterAll(async () => {
    // await utils.stopFrontend();
    // await utils.stopBackend();
    // TODO-no-commit
});

Given(/^the ExpirySync API server is in its pristine state and running$/, async () => {
    await utils.runFrontend();
    await utils.runBackend();
    // TODO-no-commit
});

Given(/^the app has just been freshly installed$/, async () => {
    await browser.restart();
    await browser.get(browser.baseUrl);
    await browser.manage().window().maximize();
    initializeBrowser();
});


// Then('I should see {string}', async (text: string) => {
//     await shouldSeeToast(text);
// });
