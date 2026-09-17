import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

const SHARED_DOCS = [
    'https://posthog.com/docs/distributed-tracing/start-here.md',
    'https://posthog.com/docs/distributed-tracing/basics.md',
];

describe('tracing skill family', () => {
    it('ships one variant per platform, each carrying its installation doc', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'tracing');

        expect(skills.map((s) => s.id).sort()).toEqual([
            'tracing-dotnet',
            'tracing-go',
            'tracing-java',
            'tracing-nextjs',
            'tracing-nodejs',
            'tracing-other',
            'tracing-php',
            'tracing-python',
            'tracing-ruby',
        ]);
        for (const s of skills) {
            expect(s._sharedDocs).toEqual(SHARED_DOCS);
        }
        const nodejs = skills.find((s) => s.id === 'tracing-nodejs');
        expect(nodejs.docs_urls).toEqual(['https://posthog.com/docs/distributed-tracing/installation/nodejs.md']);
    });
});
