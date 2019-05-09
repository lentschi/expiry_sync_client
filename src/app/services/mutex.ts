import { Subject } from 'rxjs';

export class Mutex {
    private acquireRequests: Subject<void>[] = [];

    async acquire() {
        // Add our acquire request:
        this.acquireRequests.push(new Subject<void>());

        // Wait for the acquire request PRIOR TO OURS to be released (if any):
        if (this.acquireRequests.length > 1) {
            await this.acquireRequests[this.acquireRequests.length - 2].toPromise();
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
    }
}
