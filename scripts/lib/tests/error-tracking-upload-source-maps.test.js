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

    it('pins the verified iOS upload pipeline so agents cannot re-hallucinate it', () => {
        // Every assertion below is a mistake an agent actually made in a live
        // run (2026-07-15) before the skill pinned the correct form.

        // 1. The canonical upload path is the SDK's bundled script, with
        //    source bundling on — otherwise traces resolve names but no code.
        expect(SKILL_BODY).toContain('upload-symbols.sh');
        expect(SKILL_BODY).toContain('POSTHOG_INCLUDE_SOURCE=1');

        // 2. The only real CLI command (agent invented `posthog-cli upload ios`
        //    with --api-key/--dsym-path flags).
        expect(SKILL_BODY).toContain('posthog-cli dsym upload');
        expect(SKILL_BODY).toContain('no `posthog-cli upload ios` subcommand');

        // 3. API host, not the SDK's ingestion host.
        expect(SKILL_BODY).toMatch(/`\*\.i\.posthog\.com` ingestion host/);

        // 4. Build-settings prerequisites for the upload phase.
        expect(SKILL_BODY).toContain('ENABLE_USER_SCRIPT_SANDBOXING = NO');
        expect(SKILL_BODY).toContain('dwarf-with-dsym');

        // 5. Swift test affordance uses captureException; capture(error)
        //    does not compile.
        expect(SKILL_BODY).toContain('PostHogSDK.shared.captureException(error)');

        // CocoaPods base-config chaining — overwriting the Pods xcconfig
        // breaks the build.
        expect(SKILL_BODY).toContain('#include?');

        // 6. Second live run (same day) inverted the chain via a Podfile
        //    post_install hook, got the relative path wrong, and never re-ran
        //    pod install — credentials silently vanished. Pin the direction,
        //    the path arithmetic, and the debugging affordances.
        expect(SKILL_BODY).toContain('Do NOT invert');
        expect(SKILL_BODY).toContain('`../../../`, not `../../`');
        expect(SKILL_BODY).toContain('~/.posthog');
        expect(SKILL_BODY).toContain(
            'xcodebuild -showBuildSettings -configuration Release | grep POSTHOG_CLI_API_KEY',
        );
        expect(SKILL_BODY).toContain(
            '`POSTHOG_INCLUDE_SOURCE=1` prefix is REQUIRED',
        );
    });
});
