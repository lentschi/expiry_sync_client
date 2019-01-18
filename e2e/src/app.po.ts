import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo(destination) {
    return browser.get(destination);
  }

  getTitle() {
    return browser.getTitle();
  }

  async getPageOneTitleText() {
    const labelElement = element(by.deepCss('ion-label'));
    const html = await labelElement.getAttribute('outerHTML');
    const textContent = await labelElement.getAttribute('textContent');
    const text = await labelElement.getText();
    return text;
  }
}
