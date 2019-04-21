import { ExpirySync } from './app.expiry-sync';
import { TranslateService } from '@ngx-translate/core';
import { AfterViewChecked } from '@angular/core';

export class ExpirySyncController implements AfterViewChecked {
  private static localChangesDonePromise: Promise<void>;
  private static syncDonePromise: Promise<void>;
  private static completeSyncDonePromise: Promise<void>;

  constructor(public translateSvc: TranslateService) { }

  translate(str: string, params?: any): Promise<string> {
    return new Promise<string>(resolve => {
      this.translateSvc.get(str, params).subscribe((trans: string) => {
        resolve(trans);
      });
    });
  }

  async pluralTranslate(str: string, count: number, params?: any): Promise<string> {
    if (typeof (params) === 'undefined') {
      params = {};
    }
    params.n = count;

    const key = `${str}._plurals.${count}`;
    const translation = await this.translate(key, params);
    if (translation !== key) {
      return translation;
    }

    return this.translate(`${str}._plurals.other`, params);
  }

  async viewChangeOccurred(awaitGetter?: Function, awaitExtraViewChange?: boolean): Promise<void> {
    // Wait for a variable to be substituted - TODO: Not sure if this is the best way to do this:
    return new Promise<void>(resolve => {
      if (awaitGetter && !awaitExtraViewChange && awaitGetter()) {
        resolve();
        return; // no need to wait -> getter already returns something
      }

      const origFunc = this.ngAfterViewChecked;

      this.ngAfterViewChecked = () => {
        if (awaitGetter && !awaitGetter()) {
          return; // -> keep waiting
        }
        if (origFunc) {
          origFunc.apply(this);
          this.ngAfterViewChecked = origFunc;
        } else {
          this.ngAfterViewChecked = null;
        }
        resolve();
      };
    });
  }


  ngAfterViewChecked() {

  }

  setCompleteSyncDonePromise(promise: Promise<void>) {
    ExpirySyncController.completeSyncDonePromise = promise;
  }

  completeSyncDone(): Promise<void> {
    if (!ExpirySyncController.completeSyncDonePromise) {
      return new Promise<void>(resolve => { resolve(); });
    }
    return ExpirySyncController.completeSyncDonePromise;
  }

  setLocalChangesDonePromise(promise: Promise<void>) {
    ExpirySyncController.localChangesDonePromise = promise;
  }

  localChangesDone(): Promise<void> {
    if (!ExpirySyncController.localChangesDonePromise) {
      return new Promise<void>(resolve => { resolve(); });
    }
    return ExpirySyncController.localChangesDonePromise;
  }

  setSyncDonePromise(promise: Promise<void>): Promise<void> {
    ExpirySyncController.syncDonePromise = promise;
    return promise;
  }

  async syncDone(showLoader = true) {
    if (!ExpirySyncController.syncDonePromise) {
      return new Promise<void>(resolve => { resolve(); });
    }

    const app: ExpirySync = ExpirySync.getInstance();
    let task: Symbol;
    if (showLoader) {
      task = app.loadingStarted('Synchronizing');
    }
    await ExpirySyncController.syncDonePromise;
    if (showLoader) {
      app.loadingDone(task);
    }
  }
}
