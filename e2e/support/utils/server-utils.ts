import { spawn } from 'child_process';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
// import * as util from 'util';


const expect = chai.use(chaiAsPromised).expect;

export class ServerUtils {
    public async runBackend() {
        const child = spawn('./e2e/support/scripts/run_server.sh');
        const exit = new Promise(resolve => {
            child.on('exit', code => {
                resolve(code);
            });
        });

        await expect(exit).to.eventually.equal(0);

        //   for await (const data of child.stdout) {
        //     console.log(`stdout from the child: ${data}`);
        //   }
        //   throw new Error('DONE');
        //   const spawnChildEvent = util.promisify(child.on);
        //   const code = await spawnChildEvent('exit');
        //   throw new Error('Exit code: ' + code);
    }

    public async runFrontend() {
        const child = spawn('./e2e/support/scripts/run_client.sh');
        const exit = new Promise(resolve => {
            child.on('exit', code => {
                resolve(code);
            });
        });

        await expect(exit).to.eventually.equal(0);
    }
}
