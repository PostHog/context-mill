import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

const SHARED_DOCS = [
    'https://posthog.com/docs/metrics/start-here.md',
    'https://posthog.com/docs/metrics/basics.md',
    'https://posthog.com/docs/metrics/architecture.md',
];

describe('metrics skill', () => {
    it('collapses to one skill carrying every platform installation doc', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'metrics');

        expect(skills).toHaveLength(1);
        expect(skills[0]).toMatchObject({
            id: 'metrics',
            _category: 'metrics',
            display_name: 'Application Metrics',
            tags: ['metrics'],
            _sharedDocs: SHARED_DOCS,
        });
        expect(skills[0].docs_urls).toEqual([
            'https://posthog.com/docs/metrics/installation/javascript.md',
            'https://posthog.com/docs/metrics/installation/nodejs.md',
            'https://posthog.com/docs/metrics/installation/python.md',
            'https://posthog.com/docs/metrics/installation/kubernetes.md',
            'https://posthog.com/docs/metrics/installation/other.md',
        ]);
    });
});
