import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

// Step skills declare their variants literally (their docs differ from
// integration's), but the orchestrator resolves them per framework with no
// fallback. A variant added to integration and not copied here makes the
// orchestrator flow abort for that framework.
describe.each(['integration-v2/error-tracking-step', 'integration-v2/feature-flags-step'])(
    '%s',
    (stepSkillGroup) => {
        it('declares every integration variant, with the same framework', () => {
            const config = loadSkillsConfig(CONFIG_DIR);
            const keys = (group) => config[group].variants.map((v) => `${v.id}:${v.framework}`);

            expect(keys(stepSkillGroup)).toEqual(expect.arrayContaining(keys('integration')));
        });
    },
);
