import {
    ProtractorBrowser,
    browser as protractorDefaultBrowser,
    ElementHelper,
    element as protractorDefaultElement
} from 'protractor';

export let browser: ProtractorBrowser = protractorDefaultBrowser;
export let element: ElementHelper = protractorDefaultElement;

let usedBrowsers: ProtractorBrowser[] = [];

export function setDefaultBrowser(newDefault: ProtractorBrowser) {
    browser = newDefault;
    element = newDefault.element;
    if (!usedBrowsers.includes(newDefault) && newDefault !== protractorDefaultBrowser) {
        usedBrowsers.push(newDefault);
    }
}

export function closeBrowser(browserToClose: ProtractorBrowser) {
    browserToClose.close();
    const index = usedBrowsers.indexOf(browserToClose);
    usedBrowsers.splice(index, 1);
}

export async function closeAllNonDefaultProtractorBrowsers() {
    for (const currentBrowser of usedBrowsers) {
        await currentBrowser.close();
    }
    usedBrowsers = [];
}
