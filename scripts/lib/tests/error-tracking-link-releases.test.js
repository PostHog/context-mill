import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const SEED = join(CONFIG_DIR, 'agents', 'error-tracking', 'setup-error-tracking.md');

// The error-tracking seed hands `error-tracking-link-releases-<variant>` to the link-releases task.
const VARIANTS = [
    { variant: 'python', display_name: 'Python' },
    { variant: 'ruby', display_name: 'Ruby' },
    { variant: 'php', display_name: 'PHP' },
];

describe('error-tracking-link-releases', () => {
    const skills = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR);

    it.each(VARIANTS)('expands the $variant variant the seed hands to link-releases', ({ variant, display_name }) => {
        expect(skills.find((skill) => skill.id === `error-tracking-link-releases-${variant}`)).toMatchObject({
            _shortId: variant,
            _category: 'error-tracking-link-releases',
            display_name,
            tags: ['error-tracking', 'releases', variant],
            docs_urls: [`https://posthog.com/docs/error-tracking/link-releases/${variant}.md`],
            _sharedDocs: ['https://posthog.com/docs/error-tracking/releases.md'],
            _cli: null,
        });
    });

    it('seeds link-releases with a variant the skill defines', () => {
        const seed = readFileSync(SEED, 'utf8');
        expect(seed).toContain('`error-tracking-link-releases-<variant>`');
        for (const { variant } of VARIANTS) expect(seed).toMatch(new RegExp(`→ \`${variant}\``));
    });
});
