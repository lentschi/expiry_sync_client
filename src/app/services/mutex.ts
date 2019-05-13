import { Subject } from 'rxjs';

export class Mutex {
    private acquireRequests: Subject<void>[] = [];

    constructor(private name: string) {}

    async acquire() {
        // Add our acquire request:
        this.acquireRequests.push(new Subject<void>());

        // Wait for the acquire request PRIOR TO OURS to be released (if any):
        if (this.acquireRequests.length > 1) {
            await this.acquireRequests[this.acquireRequests.length - 2].toPromise();
        }
        console.log('--- Mutex acquired:', this.name);
    }

    async acquireFor(guardedPromise: Promise<any>, releaseOnError = true, rethrowError = true) {
        await this.acquire();

        let caughtError: Error;
        try {
            await guardedPromise;
        } catch (e) {
            caughtError = e;
        }

        if (caughtError) {
            if (releaseOnError) {
                this.release();
            }

            if (rethrowError) {
                throw caughtError;
            }
        } else {
            this.release();
        }
    }

    release() {
        if (this.acquireRequests.length === 0) {
            throw new Error('Tried to release mutex before locking it');
        }

        // Remove and release the first acquire request in the pipeline:
        const acquireRequest = this.acquireRequests.shift();
        acquireRequest.next();
        acquireRequest.complete();
        console.log('--- Mutex released:', this.name);
    }
}
