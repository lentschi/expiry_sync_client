
import { BeforeAll, AfterAll, Before } from 'cucumber';
import { ServerUtils } from './utils/server-utils';
import { browser, Key } from 'protractor';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { initializeBrowser, shouldSeeToast } from './utils/ui-utils';
import { Given, Then } from './utils/cucumber-wrapper';
import { showWebcamVideo } from './utils/device-utils';
import { ScenarioMemory } from './utils/scenario-memory';


const expect = chai.use(chaiAsPromised).expect;
const utils = ServerUtils.singleton();
const memory = ScenarioMemory.singleton();

Before(async () => {
    memory.amnesia();
    await showWebcamVideo('blank');
    initializeBrowser(true);
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
    await browser.actions()
       .sendKeys(Key.chord(Key.CONTROL, Key.SHIFT , 'N'))
       .perform();

    await browser.sleep(1000);

    const handles = await browser.getAllWindowHandles();
    await browser.switchTo().window(handles[1]); // 0 or 1 to switch between the 2 open windows
    await browser.get(browser.baseUrl);
    console.log('TODO');
});
