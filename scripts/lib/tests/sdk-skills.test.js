import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    expandSkillGroups,
    extractMigrationChecklist,
    generateSkill,
} from '../skill-generator.js';

const SAMPLE_MIGRATION = `# Migrate the Python SDK from 7.x.x to 8.0.0

## On this page

- [Checklist](#checklist)

## Checklist

Read the checklist first, then the sections that apply to you.

**Before you upgrade**

- You use openfeature-provider-posthog below 0.2.0 → [Update OpenFeature](#update-openfeature)

**During your upgrade**

- You call Client or AsyncPosthog constructor arguments by position after host → [Fix removed APIs](#fix-removed-apis)

## Before you upgrade

Long prose that must not be inlined into SKILL.md.
`;

let dir;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-skills-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('extractMigrationChecklist', () => {
    it('extracts only the Checklist section bullets and excludes later body sections', () => {
        const checklist = extractMigrationChecklist(SAMPLE_MIGRATION);
        expect(checklist).toContain('**Before you upgrade**');
        expect(checklist).toContain('- You use openfeature-provider-posthog below 0.2.0');
        expect(checklist).toContain('- You call Client or AsyncPosthog constructor arguments');
        expect(checklist).not.toContain('Long prose that must not be inlined');
        expect(checklist).not.toContain('Read the checklist first');
    });
});

describe('non-framework SDK skill groups', () => {
    const sdkGroup = {
        type: 'docs-only',
        category: 'sdk',
        cli: { role: 'internal' },
        description: 'PostHog Python SDK {display_name} reference',
        variants: [
            {
                id: 'v7',
                display_name: '7.x.x',
                template: '../non-default-major.md',
                tags: ['sdk-python-7'],
                match: { posthogSdks: ['posthog@6', 'posthog@7'] },
                docs_urls: [
                    'https://posthog.com/docs/libraries/python/7.x.x.md',
                    'https://posthog.com/docs/libraries/python/migration.md',
                ],
            },
            {
                id: 'v8',
                default: true,
                display_name: '8.x.x',
                template: '../default-major.md',
                tags: ['sdk-python-8'],
                match: { posthogSdks: 'posthog@8' },
                docs_urls: ['https://posthog.com/docs/libraries/python/8.x.x.md'],
            },
        ],
    };

    beforeEach(() => {
        fs.mkdirSync(path.join(dir, 'skills', 'sdk', 'posthog-python'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'skills', 'sdk', 'non-default-major.md'),
            '# {display_name}\n\nSupports {supported_versions}.\n\n{references}\n\n## Rules\n{commandments}\n\n## Watchlist\n{migration_checklist}\n',
        );
        fs.writeFileSync(
            path.join(dir, 'skills', 'sdk', 'default-major.md'),
            '# {display_name}\n\n{references}\n\n## Rules\n{commandments}\n',
        );
    });

    it('reads {migration_checklist} from the variant\'s own references/<shortId>/migration.md over the group\'s', async () => {
        const localOnly = {
            ...sdkGroup,
            variants: [
                { ...sdkGroup.variants[0], docs_urls: ['https://posthog.com/docs/libraries/python/7.x.x.md'] },
                sdkGroup.variants[1],
            ],
        };
        const refsDir = path.join(dir, 'skills', 'sdk', 'posthog-python', 'references');
        fs.mkdirSync(path.join(refsDir, 'v7'), { recursive: true });
        fs.writeFileSync(path.join(refsDir, 'migration.md'), '# Group\n\n## Checklist\n\n- Group fallback item\n');
        fs.writeFileSync(path.join(refsDir, 'v7', 'migration.md'), '# Variant\n\n## Checklist\n\n- Variant local item\n');

        const [skill] = expandSkillGroups({ 'sdk/posthog-python': localOnly }, dir);
        const outputDir = path.join(dir, 'out-local');
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: dir,
            configDir: dir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: skill._template,
            sharedDocs: [],
            fetchDocFn: () => Promise.resolve({ content: '# 7.x.x\n', title: '7.x.x' }),
        });
        const renderedVariant = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(renderedVariant).toContain('- Variant local item');
        expect(renderedVariant).not.toContain('- Group fallback item');
    });

    it('substitutes placeholders in a single pass so $& / $` / {workflow} in docs or commandments never corrupt SKILL.md', async () => {
        const [skill] = expandSkillGroups({ 'sdk/posthog-python': sdkGroup }, dir);
        const outputDir = path.join(dir, 'out-dollar');
        const trickyMigration = '# Migrate\n\n## Checklist\n\n- Keep `$&`, `$` `, `$\'`, and `$1` plus literal `{workflow}` and `{references}` intact\n';
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: dir,
            configDir: dir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: {
                commandments: {
                    'sdk-python-7': ['Commandment with `$&` and `` $` `` and literal {migration_checklist}'],
                },
            },
            skillTemplate: skill._template,
            sharedDocs: [],
            fetchDocFn: (url) => Promise.resolve({
                content: url.endsWith('migration.md') ? trickyMigration : '# 7.x.x\n',
                title: 'Title with `$&`',
            }),
        });
        const rendered = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(rendered).toContain('Commandment with `$&` and `` $` `` and literal {migration_checklist}');
        expect(rendered).toContain('- Keep `$&`, `$` `, `$\'`, and `$1` plus literal `{workflow}` and `{references}` intact');
        expect(rendered).toContain('Title with `$&`');
    });
});
