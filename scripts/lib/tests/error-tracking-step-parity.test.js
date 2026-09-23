import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

// error-tracking-step declares its variants literally (its docs differ from
// integration's), but the orchestrator resolves it per framework with no
// fallback. A variant added to integration and not copied here makes the
// default orchestrator flow abort for that framework.
describe('integration-v2/error-tracking-step', () => {
    it('declares every integration variant, with the same framework', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const keys = (group) => config[group].variants.map((v) => `${v.id}:${v.framework}`);

        expect(keys('integration-v2/error-tracking-step')).toEqual(
            expect.arrayContaining(keys('integration')),
        );
    });
});
