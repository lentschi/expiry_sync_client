import { Injectable } from '@angular/core';
import { ExpirySyncController } from '../app.expiry-sync-controller';
import { ProductEntry, Location, Setting, LocationSyncList, ProductEntrySyncList } from '../models';
import { ApiServer } from 'src/utils/api-server';
import * as moment from 'moment';
import 'moment/min/locales';

@Injectable()
export class SynchronizationHandler {
    private controller: ExpirySyncController;

    // locally changed objects:
    private locallyChangedLocations: Location[];
    private locallyChangedEntries: ProductEntry[];

    // local locations that have been previously synced:
    private localLocations: Array<Location>;

    // remotely changed objects:
    private remotelyChangedLocations: LocationSyncList;
    private remotelyChangedEntries: ProductEntrySyncList;

    private lastSync: Date;
    private beforeSync: Date;
    private afterSync: Date;

    constructor(private server: ApiServer) { }

    async mutexedSynchronize(controller: ExpirySyncController) {
        this.controller = controller;

        console.log('SYNC: Waiting for previous sync to finish...');
        await this.controller.completeSyncDone();
        await this.controller.setCompleteSyncDonePromise(
            this.synchronize()
        );
        console.log('SYNC: Done');
    }

    private async synchronize() {
        await this.controller.setSyncDonePromise(
            this.retrieveLocalChanges()
        );

        this.beforeSync = new Date();

        await this.fetchServerChanges();
        this.mergeServerChangesWithLocalChanges();

        await this.pushLocalChanges();

        this.afterSync = new Date();

        await this.controller.setSyncDonePromise((async () => {
            await this.storeServerChangesLocally();
            await this.markSynchronizationCompleted();
        })());
    }

    /**
     * Get local changes from the db
     */
    private async retrieveLocalChanges() {
        console.log('SYNC: Waiting for local changes to be completed...');
        await this.controller.localChangesDone();

        this.locallyChangedLocations = await Location.getOutOfSync(true);
        for (const location of this.locallyChangedLocations) {
            location.syncInProgress = true;
            location.inSync = true;
            await location.save();
        }

        this.locallyChangedEntries = await ProductEntry.getOutOfSync(true);
        for (const entry of this.locallyChangedEntries) {
            entry.syncInProgress = true;
            entry.inSync = true;
            await entry.save();
        }

        const lastSyncRfc2616 = Setting.cached('lastSync');
        this.lastSync = lastSyncRfc2616 !== '' ? new Date(lastSyncRfc2616) : null;

        this.localLocations = <Array<Location>>await Location
            .all()
            .filter('deletedAt', '=', null)
            .filter('lastSuccessfulSync', '!=', null)
            .list();
    }

    /**
     * Fetch changes since this.lastSync from server
     */
    private async fetchServerChanges() {
        const locations = [...this.localLocations];
        this.remotelyChangedLocations = await Location.fetchSyncList(this.lastSync);

        for (const remoteLocation of this.remotelyChangedLocations.locations) {
            if (!locations.some(currentLocation => currentLocation.id === remoteLocation.id)) {
                locations.push(remoteLocation);
            }
        }

        this.remotelyChangedEntries = {
            productEntries: [],
            deletedProductEntries: []
        };
        for (const location of locations) {
            let currentEntriesSyncList: ProductEntrySyncList;
            currentEntriesSyncList = await location.fetchProductEntriesSyncList(this.lastSync);
            this.remotelyChangedEntries.productEntries.push(...currentEntriesSyncList.productEntries);
            this.remotelyChangedEntries.deletedProductEntries.push(...currentEntriesSyncList.deletedProductEntries);
        }
    }

    /**
     * Merge remote changes with local changes
     * (Remove remote changes, if there are local changes overwriting those)
     */
    private mergeServerChangesWithLocalChanges() {
        for (const location of this.locallyChangedLocations) {
            let index = this.remotelyChangedLocations.locations.findIndex(currentLocation => currentLocation.id === location.id);
            if (index !== -1) {
                this.remotelyChangedLocations.locations.splice(index, 1);
            }

            index = this.remotelyChangedLocations.deletedLocations.findIndex(currentLocation => currentLocation.id === location.id);
            if (index !== -1) {
                this.remotelyChangedLocations.deletedLocations.splice(index, 1);
            }
        }

        for (const entry of this.locallyChangedEntries) {
            let index = this.remotelyChangedEntries.productEntries.findIndex(currentEntry => currentEntry.id === entry.id);
            if (index !== -1) {
                this.remotelyChangedEntries.productEntries.splice(index, 1);
            }

            index = this.remotelyChangedEntries.deletedProductEntries.findIndex(currentEntry => currentEntry.id === entry.id);
            if (index !== -1) {
                this.remotelyChangedEntries.deletedProductEntries.splice(index, 1);
            }
        }
    }

    /**
     * Push local changes to the server
     */
    private async pushLocalChanges() {
        for (const location of this.locallyChangedLocations) {
            await location.storeOnServer();
        }

        for (const entry of this.locallyChangedEntries) {
            await entry.storeOnServer();
        }
    }

    /**
     * Update local records with remote changes (unless they have been
     * locally changed in the mean time)
     */
    private async storeServerChangesLocally() {
        const locationsChangedInTheMeanTime = await Location.getOutOfSync();
        for (const location of this.remotelyChangedLocations.locations) {
            if (locationsChangedInTheMeanTime.some(currentLocation => currentLocation.id === location.id)) {
                continue; // skip, if location has changed in the mean time
            }
            await location.storeInLocalDb(this.afterSync);
        }

        const entriesChangedInTheMeanTime = await ProductEntry.getOutOfSync();
        for (const entry of this.remotelyChangedEntries.productEntries) {
            if (entriesChangedInTheMeanTime.some(currentEntry => currentEntry.id === entry.id)) {
                continue; // skip, if entry has changed in the mean time
            }
            await entry.storeInLocalDb(this.afterSync);
        }
    }

    /**
     * Mark all records as 'done with sync' and store the time of the
     * last successful sync in the db
     */
    private async markSynchronizationCompleted() {
        // Set all syncInProgress= false
        await Location.markAllSyncInProgressDone(this.afterSync);
        await ProductEntry.markAllSyncInProgressDone(this.afterSync);

        // Update last change:
        this.lastSync = moment(this.beforeSync).add(this.server.timeSkew, 'ms').toDate();
        await Setting.set('lastSync', ApiServer.dateToHttpDate(this.lastSync));
    }
}
