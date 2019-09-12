import { Injectable } from '@angular/core';
import { ExpirySyncController } from '../app.expiry-sync-controller';
import { ProductEntry, Location, Setting, LocationSyncList, ProductEntrySyncList, Article, ArticleImage } from '../models';
import { ApiServer } from 'src/utils/api-server';
import * as moment from 'moment';
import 'moment/min/locales';
import { Mutex } from './mutex';
import { ExpirySync } from '../app.expiry-sync';
import { RecordNotFoundError } from 'src/utils/orm';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable()
export class SynchronizationHandler {
    syncMutex = new Mutex('sync');
    localChangesMutex = new Mutex('localChanges');

    // locally changed objects:
    private locallyChangedLocations: Location[];
    private locallyChangedEntries: ProductEntry[];

    // local locations that have been previously synced:
    private localLocations: Array<Location>;

    // remotely changed objects:
    private remotelyChangedLocations: LocationSyncList;
    private remotelyChangedEntries: ProductEntrySyncList;
    private updatedArticleIds: {[oldId: string]: string};

    private lastSync: Date;
    private beforeSync: Date;
    private afterSync: Date;

    // config to replace local default location with the one from the remote:
    private replaceDefaultLocationConfig: {
        localDefaultLocation: Location;
        remoteDefaultLocation: Location
    };

    constructor(private server: ApiServer) { }

    async mutexedSynchronize(skipAnyMutexes: boolean) {
        console.log('SYNC: Waiting for previous sync to finish...');
        if (!skipAnyMutexes) {
            await this.syncMutex.acquireFor(
                () => this.synchronize()
            );
        } else {
            await this.synchronize(true);
        }
        console.log('SYNC: Done');
    }

    async acquireLocalChangesMutex(showLoader = true) {
        const app = ExpirySync.getInstance();
        let task: Symbol;

        if (showLoader) {
            task = app.loadingStarted('Synchronizing');
        }

        await this.localChangesMutex.acquire();

        if (showLoader) {
            app.loadingDone(task);
        }
    }

    private async synchronize(skipLocalChangesMutexCheck = false) {
        if (!skipLocalChangesMutexCheck) {
            await this.localChangesMutex.acquire();
        }
        await this.retrieveLocalChanges();

        if (!skipLocalChangesMutexCheck) {
            await this.localChangesMutex.release();
        }

        this.beforeSync = new Date();

        await this.fetchServerChanges();
        await this.prepareDefaultLocationOverwrite();
        this.mergeServerChangesWithLocalChanges();

        await this.pushLocalChanges();

        this.afterSync = new Date();

        if (!skipLocalChangesMutexCheck) {
            await this.localChangesMutex.acquire();
        }
        await this.replaceDefaultLocationIfRequired();
        await this.storeServerChangesLocally();
        await this.markSynchronizationCompleted();
        if (!skipLocalChangesMutexCheck) {
            await this.localChangesMutex.release();
        }
    }

    /**
     * Get local changes from the db
     */
    private async retrieveLocalChanges() {
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
     * Under very specific circumstances remote and local default locations
     * should be merged.
     * This method prepares for this by setting the properties localDefaultLocation and
     * remoteDefaultLocation, which are checked later in the sync process.
     */
    private async prepareDefaultLocationOverwrite() {
        this.replaceDefaultLocationConfig = null;

        if (await Setting.cached('lastSync')) {
            // There already has been a first successfull sync
            // -> no merging
            return;
        }
        const defaultLocationName = await Location.defaultName();
        const localDefaultLocation = this.locallyChangedLocations.find(location =>
            location.name === defaultLocationName
        );
        if (!localDefaultLocation) {
            // local default location's name has changed
            // -> no merging
            return;
        }

        const remoteDefaultLocation = this.remotelyChangedLocations.locations.find(location =>
            location.name === defaultLocationName
        );
        if (!remoteDefaultLocation) {
            // no remote location with the same name found
            // -> no merging
            return;
        }

        this.replaceDefaultLocationConfig = { localDefaultLocation, remoteDefaultLocation };
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
            const fromTimeStamp = this.localLocations.some(
                localLocation => localLocation.id === location.id
            ) ? this.lastSync : null;
            try {
                currentEntriesSyncList = await location.fetchProductEntriesSyncList(fromTimeStamp);
            } catch (e) {
                if (e instanceof HttpErrorResponse && e.status === 404) {
                    // If the same user removed the location from another app instance
                    // it won't show up in deletedLocations above, but this call will fail
                    // -> add it to deleted locations here:
                    this.remotelyChangedLocations.deletedLocations.push(location);
                    continue;
                }
                throw e;
            }
            this.remotelyChangedEntries.productEntries.push(...currentEntriesSyncList.productEntries);
            this.remotelyChangedEntries.deletedProductEntries.push(...currentEntriesSyncList.deletedProductEntries);
        }

        this.remotelyChangedLocations.locations = this.remotelyChangedLocations.locations.filter(location =>
            !this.remotelyChangedLocations.deletedLocations.includes(location)
        );
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
            if (this.replaceDefaultLocationConfig && this.replaceDefaultLocationConfig.localDefaultLocation.id === location.id) {
                continue;
            }

            await location.storeOnServer();
        }

        this.updatedArticleIds = {};
        for (const entry of this.locallyChangedEntries) {
            if (this.replaceDefaultLocationConfig && this.replaceDefaultLocationConfig.localDefaultLocation.id === entry.locationId) {
                entry.location = this.replaceDefaultLocationConfig.remoteDefaultLocation;
                entry.locationId = this.replaceDefaultLocationConfig.remoteDefaultLocation.id;
            }

            const returnedEntry = await entry.storeOnServer();
            if (!entry.deletedAt && entry.articleId !== returnedEntry.articleId) {
                this.updatedArticleIds[entry.articleId] = returnedEntry.articleId;
            }
        }
    }

    private async replaceDefaultLocationIfRequired() {
        if (!this.replaceDefaultLocationConfig) {
            return;
        }

        const newDefaultLocation = <Location> this.replaceDefaultLocationConfig.localDefaultLocation.clone();
        newDefaultLocation.id = this.replaceDefaultLocationConfig.remoteDefaultLocation.id;
        await newDefaultLocation.save();

        await ProductEntry
            .all()
            .prefetch('location')
            .filter('locationId', '=', this.replaceDefaultLocationConfig.localDefaultLocation.id)
            .updateField('locationId', this.replaceDefaultLocationConfig.remoteDefaultLocation.id);

        await this.replaceDefaultLocationConfig.localDefaultLocation.delete();

    }

    /**
     * Update local records with remote changes (unless they have been
     * locally changed in the mean time)
     */
    private async storeServerChangesLocally() {
        let selectedLocation: Location;
        try {
            selectedLocation = <Location> await Location.findBy('isSelected', true);
        } catch (e) {
            if (!(e instanceof RecordNotFoundError)) {
                throw e;
            }
        }
        const locationsChangedInTheMeanTime = await Location.getOutOfSync();
        for (const location of this.remotelyChangedLocations.locations) {
            if (locationsChangedInTheMeanTime.some(currentLocation => currentLocation.id === location.id)) {
                continue; // skip, if location has changed in the mean time
            }

            // Server doesn't know which location was selected - ensure this stays the same as before:
            location.isSelected = selectedLocation && selectedLocation.id === location.id;

            await location.storeInLocalDb(this.afterSync);
        }

        for (const locationToDelete of this.remotelyChangedLocations.deletedLocations) {
            if (locationsChangedInTheMeanTime.some(currentLocation => currentLocation.id === locationToDelete.id)) {
                continue; // skip, if location has changed in the mean time
            }

            try {
                await locationToDelete.delete();
            } catch (e) {
                if (!(e instanceof RecordNotFoundError)) {
                    throw(e);
                }
            }

            // remove associated product entries:
            await ProductEntry
                .all()
                .filter('locationId', '=', locationToDelete.id)
                .prefetch('location')
                .delete();
        }

        const entriesChangedInTheMeanTime = await ProductEntry.getOutOfSync();
        for (const entryToSave of this.remotelyChangedEntries.productEntries) {
            if (entriesChangedInTheMeanTime.some(currentEntry => currentEntry.id === entryToSave.id)) {
                continue; // skip, if entry has changed in the mean time
            }
            await entryToSave.storeInLocalDb(this.afterSync);
        }

        for (const entryToDelete of this.remotelyChangedEntries.deletedProductEntries) {
            if (entriesChangedInTheMeanTime.some(currentEntry => currentEntry.id === entryToDelete.id)) {
                continue; // skip, if entry has changed in the mean time
            }

            try {
                await entryToDelete.delete();
            } catch (e) {
                if (!(e instanceof RecordNotFoundError)) {
                    throw(e);
                }
            }
        }

        for (const oldArticleId of Object.keys(this.updatedArticleIds)) {
            if (entriesChangedInTheMeanTime.some(currentEntry => currentEntry.article.id === oldArticleId)) {
                continue; // skip, if article has changed in the mean time
            }
            const newArticleId = this.updatedArticleIds[oldArticleId];
            await Article
                .all()
                .filter('id', '=', oldArticleId)
                .updateField('id', newArticleId);

            await ProductEntry
                .all()
                .prefetch('article')
                .filter('articleId', '=', oldArticleId)
                .updateField('articleId', newArticleId);

            await ArticleImage
                .all()
                .prefetch('article')
                .filter('articleId', '=', oldArticleId)
                .updateField('articleId', newArticleId);
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
