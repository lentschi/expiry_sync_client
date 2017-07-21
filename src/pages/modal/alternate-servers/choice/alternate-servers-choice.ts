import { ExpirySyncController } from '../../../../app/app.expiry-sync-controller';
import { ExpirySync } from '../../../../app/app.expiry-sync';
import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';
import { ApiServer, ApiServerCall } from '../../../../app/utils/api-server';
import { UiHelper } from '../../../../app/utils/ui-helper';
import { AlternateServer } from './alternate-server';
import { Setting } from '../../../../app/models';
import { TranslateService } from '@ngx-translate/core';


@Component({
  templateUrl: 'alternate-servers-choice.html'
})
export class AlternateServersChoiceModal extends ExpirySyncController {
  alternateServers:Array<AlternateServer>;
  private app:ExpirySync;

  constructor(private viewCtrl:ViewController, private uiHelper:UiHelper, translate:TranslateService) {
    super(translate);
    this.app = ExpirySync.getInstance();
    this.populateList();
  }

  private async populateList() {
    await this.viewChangeOccurred();

    this.alternateServers = [];

    // add the default server up front:
    const defaultServer = new AlternateServer();
    defaultServer.name = await this.translate('Standard');
    defaultServer.description = await this.translate('Simple server by the app publisher; no barcode data available (except for data provided by the community)');
    defaultServer.url = Setting.cached('host');
    this.alternateServers.push(defaultServer);

    // add alternate servers suggested by current server:
    const task = this.app.loadingStarted('Loading alternate servers', null, true);
    try {
      const serversData = await ApiServer.call(ApiServerCall.getAlternateServers);
      for (let serverData of serversData.alternate_servers) {
        this.alternateServers.push(AlternateServer.fromServerData(serverData));
      }
    }
    catch(e) {
      console.error(e);
      this.uiHelper.errorToast(await this.translate('We have trouble connecting to the server you chose. Are you connected to the internet?')); // TODO: hide this
    }
    this.app.loadingDone(task);


    // add the offline mode:
    const offlineMode = new AlternateServer();
    offlineMode.name = await this.translate('Offline mode');
    offlineMode.description = await this.translate("Entries won't sync with the server. When scanning product barcodes, data will only be downloaded (from the default server).");
    this.alternateServers.push(offlineMode);
  }

  async serverTapped(server:AlternateServer) {
    if (!await this.uiHelper.confirm(await this.translate('Are you sure about your choice?'))) {
      return;
    }
    let serverSelected = false;
    if (server.url) {
      await Setting.set('host', server.url.replace(/\/$/, ''));
      serverSelected = true;
    }
    else {
      await Setting.set('offlineMode', '1');
    }
    this.uiHelper.toast(await this.translate('Server chosen.'));
    this.viewCtrl.dismiss(serverSelected);
  }
}
