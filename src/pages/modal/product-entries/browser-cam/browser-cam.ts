import { Component, ViewChild, ElementRef } from '@angular/core';
import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { ViewController } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  templateUrl: 'browser-cam.html'
})
export class BrowserCamModal extends ExpirySyncController {
  @ViewChild('video') video: ElementRef;
  private localMediaStream:any;

  constructor(translate: TranslateService, private viewCtrl: ViewController) {
    super(translate);
  }

  ngOnInit() {
    navigator.getUserMedia({ video: true, audio: false }, stream => {
      this.localMediaStream = stream;
      this.video.nativeElement.src = window.URL.createObjectURL(this.localMediaStream);
      this.video.nativeElement.play();
    }, () => {
      console.error("Could not access camera stream");
      this.viewCtrl.dismiss();
    });
  }

  takePicture() {
    // create a canvas and capture a frame from video stream
    var canvas = document.createElement('canvas');
    canvas.width = this.video.nativeElement.videoWidth;
    canvas.height = this.video.nativeElement.videoHeight;
    canvas.getContext('2d').drawImage(this.video.nativeElement, 0, 0, canvas.width, canvas.height);

    // convert image stored in canvas to base64 encoded image
    var imageData = canvas.toDataURL('image/jpeg');
    imageData = imageData.replace('data:image/jpeg;base64,', '');

    this.viewCtrl.dismiss(imageData);
  }

  dismiss() {
    this.viewCtrl.dismiss();
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
