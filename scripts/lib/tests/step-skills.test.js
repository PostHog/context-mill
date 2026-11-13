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
import { composeStepSkill, skillBody } from '../skill-composition.js';

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

/** A variant table, the step skill that borrows its matrix today, and the same step written once. */
const config = (step = {}) => ({
    integration: {
        type: 'skill',
        template: 'description.md',
        products: ['error-tracking'],
        variants: [
            {
                id: 'next',
                display_name: 'Next.js',
                framework: 'nextjs',
                tags: ['nextjs'],
                docs_urls: [`${PAGE}/libraries/next-js.md`],
                docs: { 'error-tracking': [`${PAGE}/error-tracking/installation/nextjs.md`] },
            },
        ],
    },
    'flow/init': {
        type: 'docs-only',
        template: 'description.md',
        description: 'Initialize PostHog',
        tags: ['orchestrator', 'init'],
        shared_docs: [`${PAGE}/advanced/content-security-policy.md`],
        variants_from: 'integration',
        packaging: 'bundle',
    },
    'integration/init': {
        type: 'docs-only',
        template: '../../flow/init/description.md',
        description: 'Initialize PostHog',
        category: 'integration-steps',
        tags: ['orchestrator', 'init'],
        shared_docs: [`${PAGE}/advanced/content-security-policy.md`],
        replaces: 'flow-init',
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
        ['flow/init', '# Initialize PostHog for {display_name}\n\nSet the keys.\n\n## Reference\n\n{references}\n'],
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

    it('completed from a pack, has the files of the variant it replaces', async () => {
        const built = await build(config());
        const composed = composeStepSkill({
            stepFiles: built['integration-init'],
            packFiles: built['integration-next'],
            product: 'integration',
        });
        const replaced = built['flow-init-next'];

        expect(Object.keys(composed).sort()).toEqual(Object.keys(replaced).sort());
        for (const [file, text] of Object.entries(replaced)) {
            if (file === 'SKILL.md') expect(skillBody(composed[file])).toBe(skillBody(text));
            else expect(composed[file], file).toBe(text);
        }
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

    it('publishes what it replaces and the product that completes it on its menu entry', async () => {
        writeManifestAndMenu({
            allSkills: expandSkillGroups(config(), dir).map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: '1.2.3',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const entry = Object.values(menu.categories).flat().find(e => e.id === 'integration-init');

        expect(entry).toMatchObject({ group: 'integration-init', replaces: 'flow-init', frameworkReferences: 'integration' });
        expect(entry.downloadUrl).toMatch(/\/integration-init\.zip$/);
    });

    it.each([
        ['a name nothing on the menu has', { replaces: 'flow-missing' }, /names no skill group or skill/],
        ['itself', { replaces: 'integration-init' }, /cannot replace itself/],
        ['a product no variant table has', { framework_references: 'surveys' }, /is no product of a variant table/],
        ['pages of its own beside the framework\'s', { variants: [{ id: 'all', display_name: 'Init', docs_urls: [`${PAGE}/a.md`] }] }, /ships its own pages as shared_docs/],
        ['several variants', { variants: [{ id: 'a', display_name: 'A' }, { id: 'b', display_name: 'B' }] }, /need exactly one variant/],
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

    it('lets a later file replace an earlier one of the same name, as the build does', () => {
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
    ])('fails when the pack %s', (_, packFiles, message) => {
        expect(() => composeStepSkill({ stepFiles: step('{framework_docs}\n'), packFiles, product: 'integration' })).toThrow(message);
    });
});

describe('the integration step skills', () => {
    const groups = loadSkillsConfig(REPO_CONFIG_DIR);
    const commandments = loadCommandments(REPO_CONFIG_DIR);
    const dashed = key => key.replace(/\//g, '-');
    const replacing = Object.entries(groups).filter(([, group]) => group.replaces);
    const replacedGroup = name => Object.entries(groups).find(([key]) => dashed(key) === name);
    const templateOf = (key, group) => path.resolve(REPO_CONFIG_DIR, 'skills', ...key.split('/'), group.template);

    it('replace fourteen skills', () => {
        expect(replacing.map(([key]) => dashed(key)).sort()).toEqual([
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
    });

    it.each(replacing)('%s reads from the template, the shared pages and the tags of the skill it replaces', (key, group) => {
        const [replacedKey, replaced] = replacedGroup(group.replaces);

        expect(templateOf(key, group)).toBe(templateOf(replacedKey, replaced));
        expect(group.shared_docs ?? []).toEqual(replaced.shared_docs ?? []);
        expect(group.tags).toEqual(replaced.tags);
        expect(group.category).toBe('integration-steps');
    });

    it.each(replacing.filter(([, group]) => !group.framework_references))('%s keeps the pages of the skill it replaces', (_, group) => {
        const [, replaced] = replacedGroup(group.replaces);
        expect(group.variants).toEqual(replaced.variants);
    });

    // A pack's rules are the variant's alone, so a step's own tags must select none for the two to read the same.
    it.each(replacing.filter(([, group]) => group.framework_references))('%s has tags that select no rules of their own', (_, group) => {
        expect(collectCommandments(group.tags, commandments)).toEqual(collectCommandments([], commandments));
    });

    it.each(replacing.filter(([, group]) => group.framework_references === 'integration'))(
        '%s replaces a skill that borrows the integration matrix',
        (_, group) => {
            expect(replacedGroup(group.replaces)[1].variants_from).toBe('integration');
        },
    );
});
