import {
    StepDefinitionCode,
    Given as OriginalGiven,
    When as OriginalWhen,
    Then as OriginalThen,
    World
} from 'cucumber';

const patterns: { code: StepDefinitionCode, pattern: RegExp }[] = [];

export function Given(pattern: RegExp, code: StepDefinitionCode) {
    patterns.push({ code, pattern });
    OriginalGiven(pattern, code);
}

export function When(pattern: RegExp, code: StepDefinitionCode) {
    patterns.push({ code, pattern });
    OriginalWhen(pattern, code);
}

export function Then(pattern: RegExp, code: StepDefinitionCode) {
    patterns.push({ code, pattern });
    OriginalThen(pattern, code);
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
