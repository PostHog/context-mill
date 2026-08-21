import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

const SHARED_DOCS = [
    'https://posthog.com/docs/metrics/start-here.md',
    'https://posthog.com/docs/metrics/basics.md',
    'https://posthog.com/docs/metrics/architecture.md',
];

describe('metrics skill family', () => {
    it('ships one variant per platform, each carrying its installation doc', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'metrics');

        expect(skills.map((s) => s.id).sort()).toEqual([
            'metrics-javascript',
            'metrics-kubernetes',
            'metrics-nodejs',
            'metrics-other',
            'metrics-python',
        ]);
        for (const s of skills) {
            expect(s._sharedDocs).toEqual(SHARED_DOCS);
        }
        const python = skills.find((s) => s.id === 'metrics-python');
        expect(python.docs_urls).toEqual(['https://posthog.com/docs/metrics/installation/python.md']);
    });
});
