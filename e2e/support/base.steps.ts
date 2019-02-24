
import { BeforeAll, AfterAll, Before, After } from 'cucumber';
import { ServerUtils } from './utils/server-utils';
import { by, ProtractorBrowser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { initializeBrowser, shouldSeeToast } from './utils/ui-utils';
import { Given, Then } from './utils/cucumber-wrapper';
import { showWebcamVideo } from './utils/device-utils';
import { ScenarioMemory } from './utils/scenario-memory';
import { browser, setDefaultBrowser, closeAllNonDefaultProtractorBrowsers } from './utils/protractor-browser-wrapper';


const expect = chai.use(chaiAsPromised).expect;
const utils = ServerUtils.singleton();
const memory = ScenarioMemory.singleton();
let originalBrowser: ProtractorBrowser;

Before(async () => {
    memory.amnesia();
    await showWebcamVideo('blank');
    initializeBrowser(true);
});

After(async() => {
    await closeAllNonDefaultProtractorBrowsers();
});


AfterAll(async () => {
    // await utils.stopFrontend();
    // await utils.stopBackend();
    // TODO
});

Given(/^the ExpirySync API server is in its pristine state and running$/, async () => {
    await utils.runFrontend();
    await utils.runBackend();
});

Given(/^the app has just been freshly installed$/, async () => {
    initializeBrowser(true);
});


Then(/^I should see "(.+)"$/, async (text: string) => {
    await shouldSeeToast(text);
});

Given(/^I switch to a different device, on which the app has been freshly installed$/, async() => {
    const browser2 = await browser.forkNewDriverInstance();

    originalBrowser = browser;
    setDefaultBrowser(browser2);
    initializeBrowser();
});
