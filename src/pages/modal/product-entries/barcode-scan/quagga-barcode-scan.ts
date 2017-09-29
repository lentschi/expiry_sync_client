import { Component, ViewChild, ElementRef } from '@angular/core';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { ViewController } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import Quagga from 'quagga';

@Component({
  templateUrl: 'quagga-barcode-scan.html'
})
export class QuaggaBarcodeScanModal extends ExpirySyncController {
  @ViewChild('videowall') videoWall: ElementRef;

  constructor(translate:TranslateService, private viewCtrl:ViewController) {
    super(translate);
  }

  ngOnInit() {
    Quagga.init({
      inputStream : {
        name : "Live",
        type : "LiveStream",
        target: this.videoWall.nativeElement
      },
      decoder : {
        readers : ['ean_reader']
      }
    }, err =>  {
        if (err) {
            console.error("QuaggaErr", err);
            this.viewCtrl.dismiss();
            return;
        }
        Quagga.start();
    });


    Quagga.onDetected(data => {
      Quagga.stop();
      this.viewCtrl.dismiss(data.codeResult.code);
    });
  }

  dismiss() {
    Quagga.stop();
    this.viewCtrl.dismiss();
  }

  ngOnDestroy() {
    Quagga.stop();
  }
}
