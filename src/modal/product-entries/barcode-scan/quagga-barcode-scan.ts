import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import Quagga from 'quagga';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ModalController } from '@ionic/angular';

@Component({
  templateUrl: 'quagga-barcode-scan.html'
})
export class QuaggaBarcodeScanModal extends ExpirySyncController implements OnInit, OnDestroy {
  @ViewChild('videowall') videoWall: ElementRef;

  constructor(translate: TranslateService, private modalCtrl: ModalController) {
    super(translate);
  }

  ngOnInit() {
    Quagga.init({
      inputStream : {
        name : 'Live',
        type : 'LiveStream',
        target: this.videoWall.nativeElement,
        constraint: {
          facingMode: 'environment'
        }
      },
      decoder : {
        readers : ['ean_reader']
      }
    }, err =>  {
        if (err) {
            console.error('QuaggaErr', err);
            this.modalCtrl.dismiss();
            return;
        }
        Quagga.start();
    });


    Quagga.onDetected(data => {
      Quagga.stop();
      this.modalCtrl.dismiss(data.codeResult.code);
    });
  }

  dismiss() {
    Quagga.stop();
    this.modalCtrl.dismiss();
  }

  ngOnDestroy() {
    Quagga.stop();
  }
}
