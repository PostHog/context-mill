import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

describe('error-tracking-upload-source-maps Android variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR);
        const android = skills.find((skill) => skill.id === 'error-tracking-upload-source-maps-android');

        expect(android).toMatchObject({
            id: 'error-tracking-upload-source-maps-android',
            _shortId: 'android',
            _category: 'error-tracking-upload-source-maps',
            _group: 'error-tracking-upload-source-maps',
            display_name: 'Android',
            description: 'Upload ProGuard / R8 mapping files to PostHog Error Tracking for Android',
            tags: ['error-tracking', 'source-maps', 'android', 'java', 'kotlin'],
            docs_urls: ['https://posthog.com/docs/error-tracking/upload-mappings/android.md'],
            _sharedDocs: [
                'https://posthog.com/docs/error-tracking/upload-source-maps.md',
                'https://posthog.com/docs/error-tracking/upload-source-maps/cli.md',
            ],
            _cli: null,
        });
    });
});
