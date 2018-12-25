import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ExpirySyncController } from 'src/app/app.expiry-sync-controller';
import { ModalController } from '@ionic/angular';


@Component({
  templateUrl: 'browser-cam.html'
})
export class BrowserCamModal extends ExpirySyncController implements OnInit, OnDestroy {
  @ViewChild('video') video: ElementRef;
  private localMediaStream: any;

  constructor(translate: TranslateService, private modalCtrl: ModalController) {
    super(translate);
  }

  ngOnInit() {
    navigator.mediaDevices.getUserMedia({ video: {facingMode: 'environment'}, audio: false }).then(stream => {
      this.localMediaStream = stream;
      this.video.nativeElement.srcObject = this.localMediaStream;
    }, () => {
      console.error('Could not access camera stream');
      this.modalCtrl.dismiss();
    });
  }

  takePicture() {
    // create a canvas and capture a frame from video stream
    const canvas = document.createElement('canvas');
    canvas.width = this.video.nativeElement.videoWidth;
    canvas.height = this.video.nativeElement.videoHeight;
    canvas.getContext('2d').drawImage(this.video.nativeElement, 0, 0, canvas.width, canvas.height);

    // convert image stored in canvas to base64 encoded image
    let imageData = canvas.toDataURL('image/jpeg');
    imageData = imageData.replace('data:image/jpeg;base64,', '');

    this.modalCtrl.dismiss(imageData);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  ngOnDestroy() {
    if (!this.localMediaStream) {
      return;
    }

    // stop video stream, remove video and button.
    // Note that MediaStream.stop() is deprecated as of Chrome 47.
    if (this.localMediaStream.stop) {
      this.localMediaStream.stop();
    } else {
      this.localMediaStream.getTracks().forEach(function(track) {
        track.stop();
      });
    }
  }
}
