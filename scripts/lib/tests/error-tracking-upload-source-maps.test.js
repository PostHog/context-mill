import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const SKILL_BODY = readFileSync(
    join(
        CONFIG_DIR,
        'skills',
        'error-tracking-upload-source-maps',
        'description.md',
    ),
    'utf8',
);

describe('error-tracking-upload-source-maps iOS variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR);
        const ios = skills.find((skill) => skill.id === 'error-tracking-upload-source-maps-ios');

        expect(ios).toMatchObject({
            id: 'error-tracking-upload-source-maps-ios',
            _shortId: 'ios',
            _category: 'error-tracking-upload-source-maps',
            _group: 'error-tracking-upload-source-maps',
            display_name: 'iOS',
            description: 'Upload dSYM debug symbols to PostHog Error Tracking for iOS',
            tags: ['error-tracking', 'source-maps', 'ios', 'swift'],
            docs_urls: ['https://posthog.com/docs/error-tracking/upload-source-maps/ios.md'],
            _sharedDocs: [
                'https://posthog.com/docs/error-tracking/upload-source-maps.md',
                'https://posthog.com/docs/error-tracking/upload-source-maps/cli.md',
            ],
            _cli: null,
        });
    });

    it('routes iOS build-time credentials through a gitignored xcconfig, not .env', () => {
        // iOS never loads a .env at build time — the secret must land in an
        // xcconfig surfaced to the Run Script phase, and the non-secret values
        // stay out of that file (host contains `//`, which comments in xcconfig).
        expect(SKILL_BODY).toMatch(/iOS \/ Xcode does NOT use `\.env`/);
        expect(SKILL_BODY).toMatch(/gitignored/);
        expect(SKILL_BODY).toContain('PostHog.xcconfig');
        expect(SKILL_BODY).toContain('POSTHOG_CLI_API_KEY = phx_');
        expect(SKILL_BODY).toMatch(
            /export POSTHOG_CLI_PROJECT_ID[\s\S]*export POSTHOG_CLI_HOST/,
        );
        // The secret write step must flag the iOS exception so the agent does
        // not fall back to the dotenv flow.
        expect(SKILL_BODY).toMatch(/\*\*iOS exception\*\*/);
    });
});
