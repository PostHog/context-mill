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

        expect(firstStep).toContain('Upon completion, continue with:');
        expect(firstStep).toContain('[2-configure.md](2-configure.md)');
        expect(firstStep).toContain('Do not open or print value-bearing environment files');
        expect(firstStep).toContain('Prefer the Wizard `check_env_keys` tool');
        expect(firstStep).toContain('project token is a public client-side key, not a secret');
        expect(firstStep).toContain('Never expose a personal API key');
        expect(firstStep).toContain('`secretRef`');
        expect(firstStep).toContain('every existing environment file');
        expect(firstStep).toContain('do not assume `.env.local`');
        expect(firstStep).toContain('Do not call a configuration-writing tool');
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
        expect(verificationStep).toContain('Do not continue to Step 5');
        expect(verificationStep).toContain('defined production build is still classified as `not run`');
        expect(finalStep).toContain('`source-reviewed`');
        expect(finalStep).toContain('Use `verified` only when');
        expect(finalStep).toContain('personal data returned by MCP tools');
        expect(finalStep).toContain('report path supplied by the invoking program');
        expect(finalStep).toContain('Do not create or update a second report file');
        expect(finalStep).toContain('configuration steps already confirmed');
        expect(finalStep).not.toContain('Upon completion, continue with:');
    });
});
