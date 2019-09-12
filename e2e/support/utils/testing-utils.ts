import { ScenarioMemory } from './scenario-memory';
import { createWriteStream, readdir, unlink, exists, mkdir } from 'fs';
import { promisify } from 'util';
import { getAllBrowsers } from './protractor-browser-wrapper';

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
    const scenario = memory.recall('current scenario');

    let logs = scenario.sourceLocation.uri + ':' + scenario.sourceLocation.line + ' - ' + scenario.pickle.name
        + ' - ' + message + '\n\n';
    let i = 0;
    for (const browser of getAllBrowsers()) {
        logs += `--- BROWSER #${i++}:\n\n`;
        const logTypes = await browser.manage().logs().getAvailableLogTypes();
        for (const type of logTypes) {
            logs += '\n----- Log Type: ' + JSON.stringify(type) + '\n';
            const browserLogs = await browser.manage().logs().get(type);
            for (const log of browserLogs) {
                logs += JSON.stringify(log.message) + '\n';
            }
            logs += '----- END OF Log Type: ' + JSON.stringify(type) + '\n';
        }
    }

    const fileBaseName = scenario.sourceLocation.uri.replace(/e2e\/features\//, '').replace('/', '_')
        + '_line_' + scenario.sourceLocation.line;

    const textStream = createWriteStream(`${TEST_LOG_DIR}/${fileBaseName}.log`);
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

    i = 0;
    for (const browser of getAllBrowsers()) {
        const data = await browser.takeScreenshot();
        const stream = createWriteStream(`${TEST_LOG_DIR}/${fileBaseName}__browser_${i++}.png`);
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
    }

    // console.error('Done saving screenshot for ' + logCount);
}
