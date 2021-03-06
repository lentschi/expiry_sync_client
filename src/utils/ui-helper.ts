import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { ExpirySync } from 'src/app/app.expiry-sync';
import { AlertButton } from '@ionic/core';
import { environment } from 'src/environments/environment';
import { Device } from '@ionic-native/device/ngx';

@Injectable()
export class UiHelper {
  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private device: Device,
  ) { }


  confirm(message: string): Promise<boolean> {
    return new Promise<boolean>(async resolve => {
      const app: ExpirySync = ExpirySync.getInstance();
      (await this.alertCtrl.create({
        message: message,
        buttons: [
          {
            text: await app.translate('yes'),
            handler: () => {
              resolve(true);
            }
          },
          {
            text: await app.translate('no'),
            handler: () => {
              resolve(false);
            }
          }
        ]
      })).present();
    });
  }

  multipleChoiceDialog(message: string, choices: { [key: string]: string }, header?: string): Promise<string> {
    return new Promise<string>(async resolve => {
      const buttons: AlertButton[] = [];
      for (const choiceKey of Object.keys(choices)) {
        const choice = choices[choiceKey];
        buttons.push({
          text: choice,
          handler: () => {
            resolve(choiceKey);
          }
        });
      }
      (await this.alertCtrl.create({
        message: message,
        buttons,
        header
      })).present();
    });
  }

  async toast(message: string, cssClass?: string, duration?: number): Promise<HTMLIonToastElement> {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: duration || environment.toastDuration,
      cssClass: cssClass || undefined
    });

    await toast.present();
    return toast;
  }

  errorToast(message: string): Promise<HTMLIonToastElement> {
    return this.toast(message, 'error');
  }

  get runningInBrowser(): boolean {
    return (!this.device.platform || this.device.platform.toLowerCase() === 'browser');
  }
}
