
import { Before, Given, setDefaultTimeout } from 'cucumber';
import { ServerUtils } from './utils/server-utils';




setDefaultTimeout(30000);

Before(async () => {
});

Given(/^the ExpirySync API server is in its pristine state and running$/, async () => {
    const utils = new ServerUtils();
    await utils.runFrontend();
    await utils.runBackend();
});
