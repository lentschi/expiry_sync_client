import { browser } from './protractor-browser-wrapper';
import { ScenarioMemory } from './scenario-memory';
import { createWriteStream, readdir, unlink, exists, mkdir } from 'fs';
import { promisify } from 'util';

const memory = ScenarioMemory.singleton();
const readdirAsync = promisify(readdir);
const unlinkAsync = promisify(unlink);
const existsAsync = promisify(exists);
const mkdirAsync = promisify(mkdir);


const TEST_LOG_DIR = 'e2e/support/error_dumps';

export async function initializeTestLogDirectory() {
    if (!await existsAsync(TEST_LOG_DIR)) {
        await mkdirAsync(TEST_LOG_DIR);
    }
}

export async function removeAllScreenshotsAndLogs() {
    const files = await readdirAsync(TEST_LOG_DIR);

    for (const file of files) {
        await unlinkAsync(`${TEST_LOG_DIR}/${file}`);
    }
}

export async function takeScreenShotAndDumpLogs(message = 'Completed') {
    let scenarioName = memory.recall('current scenario').pickle.name;

    let logs = message + '\n\n';
    const logTypes = await browser.manage().logs().getAvailableLogTypes();
    for (const type of logTypes) {
        logs += '\n----- Log Type: ' + JSON.stringify(type) + '\n';
        const browserLogs = await browser.manage().logs().get(type);
        for (const log of browserLogs) {
            logs += scenarioName + ': ' +
                + JSON.stringify(log.level) + ' :: ' + JSON.stringify(log.message) + '\n';
        }
        logs += '----- END OF Log Type: ' + JSON.stringify(type) + '\n';
    }

    if (scenarioName.length > 100) {
        scenarioName = scenarioName.substr(0, 100) + '_' + (new Date()).getMilliseconds();
    }

    const textStream = createWriteStream(`${TEST_LOG_DIR}/${scenarioName}.log`);
    await new Promise((resolve, reject) => {
        textStream.on('open', () => {
            textStream.write(Buffer.from(logs));
            textStream.end();
        }).on('finish', () => {
            resolve();
        }).on('error', err => {
            reject(err);
        });
    });

    // console.error('Done Dumping logs for ' + logCount);

    const data = await browser.takeScreenshot();
    const stream = createWriteStream(`${TEST_LOG_DIR}/${scenarioName}.png`);
    await new Promise((resolve, reject) => {
        stream.on('open', () => {
            stream.write(Buffer.from(data, 'base64'));
            stream.end();
        }).on('finish', () => {
            resolve();
        }).on('error', err => {
            reject(err);
        });
    });

    // console.error('Done saving screenshot for ' + logCount);
}
