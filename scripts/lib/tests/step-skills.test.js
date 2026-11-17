import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    collectCommandments,
    expandSkillGroups,
    generateSkill,
    loadCommandments,
    loadSkillsConfig,
    serializeSkill,
} from '../skill-generator.js';
import { writeManifestAndMenu } from '../build-phases.js';
import { composeStepSkill } from '../skill-composition.js';
import { buildIndexes, routeChange } from '../change-router.js';

const REPO_CONFIG_DIR = path.join(import.meta.dirname, '..', '..', '..', 'context');
const PAGE = 'https://posthog.com/docs';
const COMMANDMENTS = { commandments: { all: ['Never hardcode keys'], nextjs: ['Use the App Router conventions'] } };

const URI_SCHEMA = `
manifest_version: "1.0"
scheme: posthog://
patterns:
  skill: skills/{group}/{id}
  doc: docs/{id}
`;

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n\n?/;

/** A SKILL.md without its frontmatter. */
const skillBody = text => text.replace(FRONTMATTER, '');

/** A SKILL.md's frontmatter. */
const skillFrontmatter = text => FRONTMATTER.exec(text)?.[1] ?? '';

/** A variant table and a step skill written once for every framework. */
const config = (step = {}) => ({
    integration: {
        type: 'skill',
        template: 'description.md',
        products: ['error-tracking'],
        variants: [
            {
                id: 'next',
                display_name: 'Next.js',
                match: { framework: 'nextjs' },
                tags: ['nextjs'],
                docs_urls: [`${PAGE}/libraries/next-js.md`],
                docs: { 'error-tracking': [`${PAGE}/error-tracking/installation/nextjs.md`] },
            },
        ],
    },
    'integration/init': {
        type: 'docs-only',
        template: 'description.md',
        description: 'Initialize PostHog for {display_name}',
        category: 'integration-steps',
        tags: ['orchestrator', 'init'],
        shared_docs: [`${PAGE}/advanced/content-security-policy.md`],
        framework_references: 'integration',
        variants: [{ id: 'all', display_name: 'PostHog init step' }],
        ...step,
    },
});

let dir;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-skills-'));
    for (const [folder, template] of [
        ['integration', '# {display_name}\n\n{references}\n'],
        ['integration/init', '# Initialize PostHog for {display_name}\n\nSet the keys.\n\n## Reference\n\n{references}\n'],
    ]) {
        fs.mkdirSync(path.join(dir, 'skills', folder), { recursive: true });
        fs.writeFileSync(path.join(dir, 'skills', folder, 'description.md'), template);
    }
    fs.writeFileSync(path.join(dir, 'uri-schema.yaml'), URI_SCHEMA);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Builds every skill of a config with pages served from memory, and returns each one's files by path. */
async function build(groups) {
    const skills = expandSkillGroups(groups, dir);
    const outputDir = path.join(dir, 'out');
    const built = {};
    for (const skill of skills) {
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: dir,
            configDir: dir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: COMMANDMENTS,
            skillTemplate: skill._template,
            sharedDocs: skill._sharedDocs || [],
            fetchDocFn: url => Promise.resolve({ content: `# ${url}\n`, title: `Title of ${path.basename(url)}` }),
        });
        const root = path.join(outputDir, skill.id);
        built[skill.id] = {};
        for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const abs = path.join(entry.parentPath ?? entry.path, entry.name);
            built[skill.id][path.relative(root, abs)] = fs.readFileSync(abs, 'utf8');
        }
    }
    fs.rmSync(outputDir, { recursive: true, force: true });
    return built;
}

describe('a step skill written once for every framework', () => {
    it('leaves the framework name, its pages and its rules for the consumer, and ships no rules of its own', async () => {
        const step = (await build(config()))['integration-init'];

        expect(Object.keys(step).sort()).toEqual(['SKILL.md', 'references/content-security-policy.md']);
        expect(skillFrontmatter(step['SKILL.md'])).toContain('description: Initialize PostHog for {framework_name}');
        expect(skillBody(step['SKILL.md'])).toBe(
            [
                '# Initialize PostHog for {framework_name}',
                '',
                'Set the keys.',
                '',
                '## Reference',
                '',
                '{framework_docs}',
                '- `references/content-security-policy.md` - Title of content-security-policy.md',
                '{framework_rules}',
                '',
            ].join('\n'),
        );
    });

    it('completed from a pack, names the framework and lists its pages and its rules beside its own', async () => {
        const built = await build(config());
        const composed = composeStepSkill({
            stepFiles: built['integration-init'],
            packFiles: built['integration-next'],
            product: 'integration',
        });

        expect(Object.keys(composed).sort()).toEqual([
            'SKILL.md',
            'references/COMMANDMENTS.md',
            'references/content-security-policy.md',
            'references/next-js.md',
        ]);
        expect(composed['references/next-js.md']).toBe(built['integration-next']['references/next-js.md']);
        expect(composed['references/COMMANDMENTS.md']).toBe(built['integration-next']['references/COMMANDMENTS.md']);
        expect(skillBody(composed['SKILL.md'])).toBe(
            [
                '# Initialize PostHog for Next.js',
                '',
                'Set the keys.',
                '',
                '## Reference',
                '',
                '- `references/next-js.md` - Title of next-js.md',
                '- `references/content-security-policy.md` - Title of content-security-policy.md',
                '- `references/COMMANDMENTS.md` - Framework-specific rules the integration must follow',
                '',
            ].join('\n'),
        );
    });

    it('is rebuilt by the dev server when its template changes', () => {
        const skills = expandSkillGroups(config(), dir);
        const skillsDir = path.join(dir, 'skills');
        const indexes = buildIndexes({ skills, configDir: dir });

        const decision = routeChange({
            event: 'change',
            absPath: path.join(skillsDir, 'integration', 'init', 'description.md'),
            indexes,
            paths: { repoRoot: dir, skillsDir, exampleAppsDir: path.join(dir, 'example-apps') },
        });

        expect([...decision.ids]).toEqual(['integration-init']);
    });

    it('takes another product\'s pages from the folder the pack keeps them in', async () => {
        const built = await build(config({ framework_references: 'error-tracking' }));
        const composed = composeStepSkill({
            stepFiles: built['integration-init'],
            packFiles: built['integration-next'],
            product: 'error-tracking',
        });

        expect(composed['references/nextjs.md']).toBe(`# ${PAGE}/error-tracking/installation/nextjs.md\n`);
        expect(composed['references/next-js.md']).toBeUndefined();
        expect(composed['SKILL.md']).toContain('- `references/nextjs.md` - Title of nextjs.md\n- `references/content-security-policy.md`');
    });

    it('publishes the product that completes it on its menu entry', async () => {
        writeManifestAndMenu({
            allSkills: expandSkillGroups(config(), dir).map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: '1.2.3',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const entry = Object.values(menu.categories).flat().find(e => e.id === 'integration-init');

        expect(entry).toMatchObject({ frameworkReferences: 'integration' });
        expect(entry.tags).toContain('integration-init');
        expect(entry.downloadUrl).toMatch(/\/integration-init\.zip$/);
    });

    it.each([
        ['a product no variant table has', { framework_references: 'surveys' }, /is no product of a variant table/],
        ['pages of its own beside the framework\'s', { variants: [{ id: 'all', display_name: 'Init', docs_urls: [`${PAGE}/a.md`] }] }, /ships its own pages as shared_docs/],
        ['several variants', { variants: [{ id: 'a', display_name: 'A' }, { id: 'b', display_name: 'B' }] }, /needs exactly one variant/],
        ['one variant that is not named all', { variants: [{ id: 'next', display_name: 'Init' }] }, /needs exactly one variant, with id "all"/],
    ])('rejects a step skill that names %s', (_, step, message) => {
        expect(() => expandSkillGroups(config(step), dir)).toThrow(message);
    });
});

describe('composeStepSkill', () => {
    const pack = (variant, files = {}) => ({
        'variant.json': JSON.stringify({ id: 'next', displayName: 'Next.js', rules: null, products: {}, ...variant }),
        ...files,
    });
    const step = (body, files = {}) => ({ 'SKILL.md': `---\nname: step\n---\n\n${body}`, ...files });

    it('drops a placeholder line when the pack has nothing for it', () => {
        const composed = composeStepSkill({
            stepFiles: step('## Reference\n\n{framework_docs}\n- `references/own.md` - Own\n{framework_rules}\n'),
            packFiles: pack({ products: { integration: [] } }),
            product: 'integration',
        });

        expect(skillBody(composed['SKILL.md'])).toBe('## Reference\n\n- `references/own.md` - Own\n');
    });

    it('lets a later file replace an earlier one of the same name', () => {
        const composed = composeStepSkill({
            stepFiles: step('{framework_docs}\n', { 'references/shared.md': 'the step page' }),
            packFiles: pack(
                {
                    products: {
                        integration: [
                            { file: 'references/a/ios.md', description: 'First' },
                            { file: 'references/ios.md', description: 'Second' },
                            { file: 'references/shared.md', description: 'Third' },
                        ],
                    },
                },
                { 'references/a/ios.md': 'first', 'references/ios.md': 'second', 'references/shared.md': 'the pack page' },
            ),
            product: 'integration',
        });

        expect(composed['references/ios.md']).toBe('second');
        expect(composed['references/shared.md']).toBe('the step page');
        expect(skillBody(composed['SKILL.md'])).toBe(
            '- `references/ios.md` - First\n- `references/ios.md` - Second\n- `references/shared.md` - Third\n',
        );
    });

    it.each([
        ['has no variant.json', { 'SKILL.md': '' }, /has no variant\.json/],
        ['lists no pages for the product', pack({ products: {} }), /lists no integration pages/],
        ['lists a page it does not ship', pack({ products: { integration: [{ file: 'references/gone.md', description: 'Gone' }] } }), /does not ship it/],
        // A consumer's install scan reads lowercase extensions and skips dotfiles.
        ['lists a page with an uppercase extension', pack({ products: { integration: [{ file: 'references/page.MD', description: 'Page' }] } }, { 'references/page.MD': 'x' }), /Unusable reference name/],
        ['lists a page that is a dotfile', pack({ products: { integration: [{ file: 'references/.page.md', description: 'Page' }] } }, { 'references/.page.md': 'x' }), /Unusable reference name/],
        ['lists a page outside the pack', pack({ products: { integration: [{ file: '../page.md', description: 'Page' }] } }, { '../page.md': 'x' }), /Unusable reference name/],
    ])('fails when the pack %s', (_, packFiles, message) => {
        expect(() => composeStepSkill({ stepFiles: step('{framework_docs}\n'), packFiles, product: 'integration' })).toThrow(message);
    });
});

describe('the integration step skills', () => {
    const groups = loadSkillsConfig(REPO_CONFIG_DIR);
    const commandments = loadCommandments(REPO_CONFIG_DIR);
    const dashed = key => key.replace(/\//g, '-');
    const steps = Object.entries(groups).filter(([, group]) => group.category === 'integration-steps');

    it('are fourteen skills, each written once', () => {
        expect(steps.map(([key]) => dashed(key)).sort()).toEqual([
            'integration-build',
            'integration-capture',
            'integration-dashboard',
            'integration-error-tracking',
            'integration-feature-flags',
            'integration-identify',
            'integration-init',
            'integration-insight',
            'integration-install',
            'integration-mcp',
            'integration-notebook',
            'integration-report',
            'integration-session-replay',
            'integration-warehouse',
        ]);
        for (const [key, group] of steps) {
            expect(group.variants.map(variant => variant.id), key).toEqual(['all']);
        }
    });

    it.each(steps)('%s keeps its template in its own folder', (key, group) => {
        expect(group.template).toBe('description.md');
        expect(fs.existsSync(path.join(REPO_CONFIG_DIR, 'skills', ...key.split('/'), group.template))).toBe(true);
    });

    // A step completed from a pack lists the pack's pages where its template says `{references}`.
    it.each(steps.filter(([, group]) => group.framework_references))('%s lists its references in its template', (key, group) => {
        const template = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', ...key.split('/'), group.template), 'utf8');
        expect(template).toContain('{references}');
    });

    // The menu shows a description as written, so a framework's name in it would stay a placeholder.
    it.each(steps.filter(([, group]) => group.framework_references))('%s has a description that names no framework', (_, group) => {
        expect(group.description).not.toContain('{display_name}');
    });

    // A pack's rules are the variant's alone, so a step's own tags select none.
    it.each(steps.filter(([, group]) => group.framework_references))('%s has tags that select no rules of their own', (_, group) => {
        expect(collectCommandments(group.tags, commandments)).toEqual(collectCommandments([], commandments));
    });
});
