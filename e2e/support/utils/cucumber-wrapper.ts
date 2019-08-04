import {
    StepDefinitionCode,
    Given as OriginalGiven,
    When as OriginalWhen,
    Then as OriginalThen,
    World,
    StepDefinitionOptions
} from 'cucumber';

const patterns: { code: StepDefinitionCode, pattern: RegExp }[] = [];

function defineStep(
        definitionFunction: Function,
        pattern: RegExp,
        optionsOrCode: StepDefinitionOptions | StepDefinitionCode,
        code?: StepDefinitionCode) {
    if (typeof optionsOrCode === 'function') {
        patterns.push({ code: optionsOrCode, pattern });
        definitionFunction(pattern, optionsOrCode);
    } else {
        patterns.push({ code, pattern });
        definitionFunction(pattern, optionsOrCode, code);
    }
}

export function Given(pattern: RegExp, optionsOrCode: StepDefinitionOptions | StepDefinitionCode, code?: StepDefinitionCode) {
    defineStep(OriginalGiven, pattern, optionsOrCode, code);
}

export function When(pattern: RegExp, optionsOrCode: StepDefinitionOptions | StepDefinitionCode, code?: StepDefinitionCode) {
    defineStep(OriginalWhen, pattern, optionsOrCode, code);
}

export function Then(pattern: RegExp, optionsOrCode: StepDefinitionOptions | StepDefinitionCode, code?: StepDefinitionCode) {
    defineStep(OriginalThen, pattern, optionsOrCode, code);
}

export async function Step(world: World, step: string) {
    for (const patternConfig of patterns) {
        const md = step.match(patternConfig.pattern);
        if (md) {
            await patternConfig.code.apply(world, md.slice(1));
            return;
        }
    }

    throw new Error(`Pattern '${step}' doesn't match any known step.`);
}

export function cucumberPending(pendingMessage: string): string {
    console.error('PENDING: ' + pendingMessage);
    return 'pending;';
}
