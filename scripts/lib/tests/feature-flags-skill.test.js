import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

import {
    expandSkillGroups,
    generateSkill,
    loadSkillsConfig,
} from '../skill-generator.js';

const REPO_ROOT = process.cwd();
const CONFIG_DIR = path.join(REPO_ROOT, 'context');
const FEATURE_FLAGS_DIR = path.join(CONFIG_DIR, 'skills', 'feature-flags');
const WORKFLOW_FILES = [
    '1-assess.md',
    '2-configure.md',
    '3-implement.md',
    '4-verify.md',
    '5-report.md',
];

const temporaryDirectories = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

function loadFeatureFlagSkills() {
    const config = loadSkillsConfig(CONFIG_DIR);
    return expandSkillGroups(config, CONFIG_DIR)
        .filter((skill) => skill._group === 'feature-flags');
}

describe('feature-flags skill contract', () => {
    it('assigns browser and server runtime rules to JavaScript variants', () => {
        const skills = loadFeatureFlagSkills();
        const byShortId = Object.fromEntries(
            skills.map((skill) => [skill._shortId, skill]),
        );

        expect(byShortId.react.tags).toEqual([
            'feature-flags',
            'react',
            'javascript',
            'javascript_web',
        ]);
        expect(byShortId.nextjs.tags).toEqual([
            'feature-flags',
            'nextjs',
            'nextjs-feature-flags',
            'react',
            'javascript',
            'javascript_web',
            'javascript_node',
        ]);
        expect(byShortId.web.tags).toEqual([
            'feature-flags',
            'javascript',
            'javascript_web',
        ]);
        expect(byShortId.nodejs.tags).toEqual([
            'feature-flags',
            'javascript',
            'javascript_node',
        ]);
    });

    it('generates an ordered Next.js workflow with browser and server safety rules', async () => {
        const nextjs = loadFeatureFlagSkills()
            .find((skill) => skill._shortId === 'nextjs');
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-flags-skill-'));
        temporaryDirectories.push(outputDir);

        const commandmentsConfig = yaml.load(
            fs.readFileSync(path.join(CONFIG_DIR, 'commandments.yaml'), 'utf8'),
        );
        const skillTemplate = fs.readFileSync(
            path.join(FEATURE_FLAGS_DIR, 'description.md'),
            'utf8',
        );

        await generateSkill({
            skill: {
                ...nextjs,
                docs_urls: [],
            },
            version: 'test',
            repoRoot: REPO_ROOT,
            configDir: CONFIG_DIR,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig,
            skillTemplate,
            sharedDocs: [],
        });

        const generatedDir = path.join(outputDir, 'feature-flags-nextjs');
        const generatedSkill = fs.readFileSync(
            path.join(generatedDir, 'SKILL.md'),
            'utf8',
        );
        const generatedRules = fs.readFileSync(
            path.join(generatedDir, 'references', 'COMMANDMENTS.md'),
            'utf8',
        );

        for (const [index, filename] of WORKFLOW_FILES.entries()) {
            expect(generatedSkill).toContain(
                `${index + 1}. \`references/${filename}\``,
            );
            expect(
                fs.existsSync(path.join(generatedDir, 'references', filename)),
            ).toBe(true);
        }

        expect(generatedSkill).toContain('1-assess.md` - Assess the app and choose a use case');
        expect(generatedSkill).toContain('Start here');
        expect(generatedRules).toContain('NEVER send PII in posthog.capture() event properties');
        expect(generatedRules).toContain('posthog-node is the Node.js server-side SDK package name');
        expect(generatedRules).toContain('call posthog-node evaluateFlags() once');
        expect(generatedRules).not.toContain('call getAllFlags() or getFeatureFlag()');

        const firstStep = fs.readFileSync(
            path.join(generatedDir, 'references', '1-assess.md'),
            'utf8',
        );
        const finalStep = fs.readFileSync(
            path.join(generatedDir, 'references', '5-report.md'),
            'utf8',
        );
        const verificationStep = fs.readFileSync(
            path.join(generatedDir, 'references', '4-verify.md'),
            'utf8',
        );
        const implementationStep = fs.readFileSync(
            path.join(generatedDir, 'references', '3-implement.md'),
            'utf8',
        );
        const configurationStep = fs.readFileSync(
            path.join(generatedDir, 'references', '2-configure.md'),
            'utf8',
        );

        expect(firstStep).toContain('Upon completion, continue with:');
        expect(firstStep).toContain('[2-configure.md](2-configure.md)');
        // Wizard maps these reason prefixes to actionable error outros. Keep
        // this cross-repo contract in sync with featureFlagsConfig.abortCases.
        expect(firstStep).toContain(
            '[ABORT] A working PostHog SDK integration is required.',
        );
        expect(firstStep).toContain(
            '[ABORT] The selected feature flag skill does not match this application.',
        );
        expect(configurationStep).toContain(
            '[ABORT] PostHog feature flag access is required.',
        );
        expect(firstStep).toContain('Do not open or print value-bearing environment files');
        expect(firstStep).toContain('Prefer the Wizard `check_env_keys` tool');
        expect(firstStep).toContain('project token is a public client-side key, not a secret');
        expect(firstStep).toContain('Never expose a personal API key');
        expect(firstStep).toContain('`secretRef`');
        expect(firstStep).toContain('every existing environment file');
        expect(firstStep).toContain('do not assume `.env.local`');
        expect(firstStep).toContain('Do not call a configuration-writing tool');
        expect(firstStep).toContain('selected skill ID and its version');
        expect(firstStep).toContain('local or published Context Mill menu');
        expect(firstStep).toContain('mark the source as unavailable');
        expect(firstStep).toContain('Inspect the current working tree');
        expect(firstStep).toContain('Ask for confirmation in one interaction');
        expect(firstStep).toContain('Do not invent and implement a demonstration feature without confirmation');
        expect(firstStep).toContain('Do not continue to Step 2 until the user has confirmed');
        expect(configurationStep).toContain('explicit zero-percent rollout');
        expect(configurationStep).toContain("never omit release conditions or rely on the tool's default");
        expect(configurationStep).toContain('`filters.groups` with `rollout_percentage: 0`');
        expect(configurationStep).toContain('Read every newly created flag back immediately');
        expect(configurationStep).toContain('If the safe state cannot be restored and confirmed, stop');
        expect(configurationStep).toContain('When reusing an existing flag that already reaches users');
        expect(configurationStep).toContain('Do not continue to application changes');
        expect(implementationStep).toContain('check every response or SDK result');
        expect(implementationStep).toContain('non-2xx response');
        expect(implementationStep).toContain('capturing a success event');
        expect(verificationStep).toContain('standard production build');
        expect(verificationStep).toContain('A type check is not a substitute');
        expect(verificationStep).toContain('framework-unsupported configuration patterns');
        expect(verificationStep).toContain('failed requests cannot update successful UI state');
        expect(verificationStep).toContain('emit success events');
        expect(verificationStep).not.toContain('hardcoded PostHog configuration');
        expect(verificationStep).toContain('does not count as executing that path');
        expect(verificationStep).toContain('record its exact active state and release conditions');
        expect(verificationStep).toContain('restore the exact prior state');
        expect(verificationStep).toContain('retain the restoration evidence');
        expect(verificationStep).toContain('confirm the restored state with a read-back');
        expect(verificationStep).toContain('Do not continue to Step 5');
        expect(verificationStep).toContain('defined production build is still classified as `not run`');
        expect(verificationStep).toContain('temporary flag-state restoration is unverified');
        expect(finalStep).toContain('`source-reviewed`');
        expect(finalStep).toContain('Use `verified` only when');
        expect(finalStep).toContain('selected skill ID and version');
        expect(finalStep).toContain('A localhost or local development URL');
        expect(finalStep).toContain('A menu category does not prove the skill was published');
        expect(finalStep).toContain('mark the source as unavailable instead of inferring it');
        expect(finalStep).toContain('A passing build does not prove that linting');
        expect(finalStep).toContain('Never infer that a linter ran');
        expect(finalStep).toContain('temporary flag-state restoration');
        expect(finalStep).toContain('personal data returned by MCP tools');
        expect(finalStep).toContain('report path supplied by the invoking program');
        expect(finalStep).toContain('Do not create or update a second report file');
        expect(finalStep).toContain('configuration steps already confirmed');
        expect(finalStep).not.toContain('Upon completion, continue with:');
    });
});
