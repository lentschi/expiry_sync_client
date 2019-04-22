
import { BeforeAll, AfterAll, Before, After } from 'cucumber';
import { ServerUtils } from './utils/server-utils';
import { by, ProtractorBrowser } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { initializeBrowser, shouldSeeToast, click, tapMenuPoint } from './utils/ui-utils';
import { Given, Then, When, cucumberPending } from './utils/cucumber-wrapper';
import { showWebcamVideo } from './utils/device-utils';
import { ScenarioMemory } from './utils/scenario-memory';
import { browser, setDefaultBrowser, closeAllNonDefaultProtractorBrowsers } from './utils/protractor-browser-wrapper';
import { takeScreenShotAndDumpLogs, initializeTestLogDirectory, removeAllScreenshotsAndLogs } from './utils/testing-utils';


const expect = chai.use(chaiAsPromised).expect;
const utils = ServerUtils.singleton();
const memory = ScenarioMemory.singleton();

BeforeAll(async() => {
    await initializeTestLogDirectory();
    await removeAllScreenshotsAndLogs();
});

Before(async (scenario) => {
    memory.amnesia();
    memory.memorize(scenario, 'current scenario');

    await showWebcamVideo('blank');
    await initializeBrowser(true);
});

After(async() => {
    try {
        await takeScreenShotAndDumpLogs();
        await closeAllNonDefaultProtractorBrowsers();
    } catch (e) {
        console.error(e);
    }
});


AfterAll(async () => {
    console.log('Done');
    // await utils.stopFrontend();
    // await utils.stopBackend();
    // TODO
});

Given(/^the ExpirySync API server is in its pristine state and running$/, {timeout: 60000}, async () => {
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
    memory.memorize(memory.recall('that user'), 'user on the first device');
    memory.forget('that user');
    memory.memorize(browser, 'first device');
    const browser2 = await browser.forkNewDriverInstance();
    await setDefaultBrowser(browser2);
    await initializeBrowser();
    await browser.get(browser.baseUrl);
    memory.memorize(browser, 'second device');
});

When(/^I switch back to the first device restarting the app?$/, async() => {
    await setDefaultBrowser(memory.recall('first device'));
});


When(/^I switch back to the second device restarting the app$/, async() => {
    await setDefaultBrowser(memory.recall('second device'));
});
