import { spawn } from 'child_process';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';


const expect = chai.use(chaiAsPromised).expect;

export class ServerUtils {
    private static singletonInstance: ServerUtils;

    public static singleton(): ServerUtils {
        if (!ServerUtils.singletonInstance) {
            ServerUtils.singletonInstance = new ServerUtils();
        }

        return ServerUtils.singletonInstance;
    }

    private async run(command: string) {
        const child = spawn(command);
        const exit = await new Promise(resolve => {
            child.on('exit', code => {
                resolve(code);
            });
        });

        await expect(exit).to.equal(0, 'Non zero exit code when executing: ' + command);
        console.log(`Command '${command}' successfuly executed.`);
    }

    public async runBackend() {
        await this.run('./e2e/support/scripts/run_server.sh');
    }

    public async runFrontend() {
        await this.run('./e2e/support/scripts/run_client.sh');
    }

    public async stopBackend() {
        await this.run('./e2e/support/scripts/stop_server.sh');
    }

    public async stopFrontend() {
        await this.run('./e2e/support/scripts/stop_client.sh');
    }
}
