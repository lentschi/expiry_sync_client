import * as lodash from 'lodash';

export class ScenarioMemory {
    private static singletonInstance: ScenarioMemory;
    private memory: { [key: string]: any } = {};

    public static singleton(): ScenarioMemory {
        if (!ScenarioMemory.singletonInstance) {
            ScenarioMemory.singletonInstance = new ScenarioMemory();
        }

        return ScenarioMemory.singletonInstance;
    }

    public amnesia() {
        this.memory = {};
    }

    public memorize(value: any, keys: string | string[]): any {
        value = lodash.cloneDeep(value);

        if (typeof keys === 'string') {
            keys = [keys];
        }

        for (const key of keys) {
            this.memory[key] = value;
        }

        return value;
    }

    public recall(key: string, throwErrorIfNotMemorized = true): any {
        if (throwErrorIfNotMemorized && !Object.keys(this.memory).includes(key)) {
            throw new Error(`I don't know what you mean by '${key}'`);
        }
        return lodash.cloneDeep(this.memory[key]);
    }

    public forget(key: string, throwErrorIfNotMemorized = false) {
        if (throwErrorIfNotMemorized && !Object.keys(this.memory).includes(key)) {
            throw new Error(`I don't know what you mean by '${key}'`);
        }
        delete this.memory[key];
    }
}
