import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { VARIANT_FILE, expandSkillGroups, generateSkill, loadSkillsConfig, serializeSkill } from '../skill-generator.js';
import { writeManifestAndMenu } from '../build-phases.js';

const REPO_CONFIG_DIR = path.join(import.meta.dirname, '..', '..', '..', 'context');

const URI_SCHEMA = `
manifest_version: "1.0"
scheme: posthog://
patterns:
  skill: skills/{group}/{id}
  doc: docs/{id}
`;

const PAGE = 'https://posthog.com/docs';

/** A variant table with one product and two variants of one framework. */
const table = (overrides = {}) => ({
    type: 'skill',
    template: 'description.md',
    products: ['error-tracking'],
    variants: [
        {
            id: 'app',
            display_name: 'App Router',
            default: true,
            tags: ['nextjs'],
            docs_urls: [`${PAGE}/libraries/next-js.md`],
            match: { framework: 'nextjs', frameworkVariant: 'app-router' },
            docs: { 'error-tracking': [`${PAGE}/error-tracking/installation/nextjs.md`] },
        },
    ],
    ...overrides,
});

const withVariant = changes => table({ variants: [{ ...table().variants[0], ...changes }] });

let dir;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'variant-table-'));
    fs.mkdirSync(path.join(dir, 'skills', 'integration'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', 'integration', 'description.md'), '# {display_name}\n\n{references}\n');
    fs.writeFileSync(path.join(dir, 'uri-schema.yaml'), URI_SCHEMA);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const expand = group => expandSkillGroups({ integration: group }, dir);

/** Builds one variant with pages served from memory, and returns its files by path. */
async function build(group) {
    const [skill] = expand(group);
    const outputDir = path.join(dir, 'out');
    await generateSkill({
        skill,
        version: 'test',
        repoRoot: dir,
        configDir: dir,
        outputDir,
        skipPatterns: { global: [], examples: {} },
        commandmentsConfig: { commandments: { nextjs: ['Use the App Router conventions'] } },
        skillTemplate: skill._template,
        sharedDocs: skill._sharedDocs || [],
        fetchDocFn: url => Promise.resolve({ content: `# ${url}\n`, title: `Title of ${path.basename(url)}` }),
    });
    const root = path.join(outputDir, skill.id);
    const files = {};
    for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const abs = path.join(entry.parentPath ?? entry.path, entry.name);
        files[path.relative(root, abs)] = fs.readFileSync(abs, 'utf8');
    }
    fs.rmSync(outputDir, { recursive: true, force: true });
    return files;
}

describe('a variant table', () => {
    it("writes each product's pages to a folder of their own and lists them in variant.json", async () => {
        const files = await build(table());

        expect(files['references/error-tracking/nextjs.md']).toBe(`# ${PAGE}/error-tracking/installation/nextjs.md\n`);
        expect(JSON.parse(files[VARIANT_FILE])).toEqual({
            id: 'app',
            displayName: 'App Router',
            match: { framework: 'nextjs', frameworkVariant: 'app-router' },
            rules: { file: 'references/COMMANDMENTS.md', description: 'Framework-specific rules the integration must follow' },
            products: {
                integration: [{ file: 'references/next-js.md', description: 'Title of next-js.md' }],
                'error-tracking': [{ file: 'references/error-tracking/nextjs.md', description: 'Title of nextjs.md' }],
            },
        });
    });

    it('leaves SKILL.md and the other files as they are without products', async () => {
        const { products: _products, ...plain } = table();
        const { docs: _docs, ...variant } = plain.variants[0];
        const before = await build({ ...plain, variants: [variant] });
        const after = await build(table());

        expect(after['SKILL.md']).toBe(before['SKILL.md']);
        for (const [file, text] of Object.entries(before)) expect(after[file], file).toBe(text);
        expect(Object.keys(after).filter(file => !(file in before)).sort()).toEqual([
            'references/error-tracking/nextjs.md',
            VARIANT_FILE,
        ]);
    });

    it('keeps a page apart from a variant page of the same name', async () => {
        const files = await build(withVariant({
            docs_urls: [`${PAGE}/libraries/react.md`],
            docs: { 'error-tracking': [`${PAGE}/error-tracking/installation/react.md`] },
        }));

        expect(files['references/react.md']).toBe(`# ${PAGE}/libraries/react.md\n`);
        expect(files['references/error-tracking/react.md']).toBe(`# ${PAGE}/error-tracking/installation/react.md\n`);
    });

    it('gives two pages of a folder that share a file name their parent part too, so neither replaces the other', async () => {
        const files = await build(withVariant({
            docs_urls: [`${PAGE}/error-tracking/installation/python.md`, `${PAGE}/libraries/python.md`, `${PAGE}/libraries/flask.md`],
            docs: { 'error-tracking': [`${PAGE}/error-tracking/installation/python.md`, `${PAGE}/libraries/python.md`] },
        }));

        expect(files['references/installation-python.md']).toBe(`# ${PAGE}/error-tracking/installation/python.md\n`);
        expect(files['references/libraries-python.md']).toBe(`# ${PAGE}/libraries/python.md\n`);
        expect(files['references/flask.md']).toBe(`# ${PAGE}/libraries/flask.md\n`);
        expect(files['references/python.md']).toBeUndefined();
        expect(files['references/error-tracking/installation-python.md']).toBe(`# ${PAGE}/error-tracking/installation/python.md\n`);
        expect(files['references/error-tracking/libraries-python.md']).toBe(`# ${PAGE}/libraries/python.md\n`);
        expect(JSON.parse(files[VARIANT_FILE]).products['error-tracking'].map(page => page.file)).toEqual([
            'references/error-tracking/installation-python.md',
            'references/error-tracking/libraries-python.md',
        ]);
        expect(files['SKILL.md']).toContain('- `references/installation-python.md` - Title of python.md\n- `references/libraries-python.md` - Title of python.md');
    });

    it.each([
        ['one page listed twice', [`${PAGE}/libraries/python.md`, `${PAGE}/libraries/python.md`], /would both be written as libraries-python\.md/],
        ['two pages that share their last two parts', ['https://posthog.com/docs/libraries/python.md', 'https://posthog.com/handbook/libraries/python.md'], /would both be written as libraries-python\.md/],
    ])('rejects %s, since the second would replace the first', (_, pages, message) => {
        expect(() => expand(withVariant({ docs_urls: pages }))).toThrow(message);
        expect(() => expand(withVariant({ docs: { 'error-tracking': pages } }))).toThrow(message);
    });

    it.each([
        ['a product with no pages and no gap', { docs: {} }, /no error-tracking pages/],
        ['a product with pages that is also a gap', { gaps: ['error-tracking'] }, /also named under gaps/],
        ['pages for a product the group does not list', { docs: { 'error-tracking': [`${PAGE}/a.md`], surveys: [`${PAGE}/b.md`] } }, /surveys is not in the group's products/],
        ['an empty page list', { docs: { 'error-tracking': [] } }, /non-empty list of pages/],
        ['a framework key beside match', { framework: 'nextjs' }, /name the framework under match/],
        ['a match that names no framework', { match: { frameworkVariant: 'app-router' } }, /match must name the framework/],
        ['a match value that is not a string', { match: { framework: 'nextjs', frameworkVariant: 4 } }, /match must map/],
        ['a match key that is not a trait name', { match: { framework: 'nextjs', 'framework-variant': 'app-router' } }, /match must map trait names/],
        // A match pair is published as a `key:value` tag, so a colon in the value would read as another key.
        ['a match value with a colon', { match: { framework: 'nextjs', frameworkVariant: 'app:router' } }, /match must map trait names/],
        ['a match that is a list', { match: ['nextjs'] }, /match must map trait names/],
        ['a match that is null', { match: null }, /match must map trait names/],
        ['an empty match value', { match: { framework: '' } }, /match must map trait names/],
        ['an empty list of match values', { match: { framework: 'nextjs', frameworkVariant: [] } }, /match must map trait names/],
        ['a match list with a member that is not a string', { match: { framework: 'nextjs', frameworkVariant: ['app-router', 4] } }, /match must map trait names/],
        ['a match list with an empty member', { match: { framework: 'nextjs', frameworkVariant: ['app-router', ''] } }, /match must map trait names/],
        ['a match list with a member that has a colon', { match: { framework: 'nextjs', frameworkVariant: ['app-router', 'pages:router'] } }, /match must map trait names/],
        ['a match list that holds a list', { match: { framework: 'nextjs', frameworkVariant: [['app-router']] } }, /match must map trait names/],
        ['a non-boolean default value', { default: 'true' }, /default must be a boolean/],
        ['a numeric default value', { default: 1 }, /default must be a boolean/],
        ['duplicate values inside a single match array', { match: { framework: 'nextjs', frameworkVariant: ['app-router', 'app-router'] } }, /duplicate values/],
    ])('rejects %s', (_, changes, message) => {
        expect(() => expand(withVariant(changes))).toThrow(message);
    });

    it('rejects duplicate values in a single match array and overlapping claims across non-framework variants', () => {
        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', match: { sdkPython: ['7', '7'] } },
                { id: 'v8', default: true, match: { sdkPython: '8' } },
            ],
        })).toThrow(/duplicate values/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v5', match: { sdkPython: '5' } },
                { id: 'v7', match: { sdkPython: ['5', '6', '7'] } },
                { id: 'v8', default: true, match: { sdkPython: '8' } },
            ],
        })).toThrow(/already claimed by variant "v5"/);
    });

    it('enforces default: true uniqueness per group/framework and requires exactly one default on sdk groups', () => {
        // Non-framework group cannot mark two variants as default.
        expect(() => expand({
            type: 'docs-only',
            variants: [
                { id: 'a', default: true, match: { sdkPython: '7' } },
                { id: 'b', default: true, match: { sdkPython: '8' } },
            ],
        })).toThrow(/at most one variant may set default: true/);

        // Framework group cannot mark two variants for the same framework as default.
        expect(() => expand(table({
            variants: [
                { ...table().variants[0], id: 'app', default: true, match: { framework: 'nextjs', frameworkVariant: 'app-router' } },
                { ...table().variants[0], id: 'pages', default: true, match: { framework: 'nextjs', frameworkVariant: 'pages-router' } },
            ],
        }))).toThrow(/already marks variant "app" as default/);

        // Framework group can still mark one default per distinct framework.
        expect(() => expand(table({
            variants: [
                { ...table().variants[0], id: 'next', default: true, match: { framework: 'nextjs' } },
                { ...table().variants[0], id: 'nuxt', default: true, match: { framework: 'nuxt' } },
            ],
        }))).not.toThrow();

        // Framework group rejects default: true when match.framework is missing.
        expect(() => expand(table({
            variants: [
                { ...table().variants[0], id: 'next', default: false, match: { framework: 'nextjs' } },
                { ...table().variants[0], id: 'headless', default: true, match: undefined },
            ],
        }))).toThrow(/default: true in a framework group requires match\.framework/);

        // Framework group catches duplicate defaults when match.framework is an array.
        expect(() => expand(table({
            variants: [
                { ...table().variants[0], id: 'shared', default: true, match: { framework: ['nextjs', 'nuxt'] } },
                { ...table().variants[0], id: 'next', default: true, match: { framework: 'nextjs' } },
            ],
        }))).toThrow(/framework "nextjs" already marks variant "shared" as default/);

        // SDK groups must mark exactly one variant with default: true.
        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', match: { sdkPython: ['6', '7'] } },
                { id: 'v8', match: { sdkPython: ['8'] } },
            ],
        })).toThrow(/sdk groups must mark exactly one variant with default: true/);

        // SDK variants must all declare one shared non-framework match key.
        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', match: { sdkPython: ['6', '7'] } },
                { id: 'v8', default: true },
            ],
        })).toThrow(/sdk variants must declare one shared non-framework match key/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', match: { sdkPython: ['6', '7'] } },
                { id: 'v8', default: true, match: { sdkPyhton: ['8'] } },
            ],
        })).toThrow(/sdk variants must declare one shared non-framework match key/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', match: { sdkPython: ['6', '7'] } },
                { id: 'v8', default: true, match: { sdkPython: ['8'], sdkNode: ['6'] } },
            ],
        })).toThrow(/sdk variants must declare one shared non-framework match key/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v8', default: true, match: { sdkPython: ['8'], framework: 'django' } },
            ],
        })).toThrow(/sdk variants must declare one shared non-framework match key/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v8', default: true, match: { framework: 'django' } },
            ],
        })).toThrow(/sdk variants must declare one shared non-framework match key/);

        // Invalid reference_version fails validation (empty and whitespace-only).
        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v0', reference_version: '', match: { sdkKmp: ['0'] } },
                { id: 'v1', default: true, match: { sdkKmp: ['1'] } },
            ],
        })).toThrow(/reference_version must be a non-empty string/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v0', reference_version: '   ', match: { sdkKmp: ['0'] } },
                { id: 'v1', default: true, match: { sdkKmp: ['1'] } },
            ],
        })).toThrow(/reference_version must be a non-empty string/);

        // A group under sdk/ is an sdk group even without an explicit category.
        expect(() => expandSkillGroups({
            'sdk/posthog-python': {
                type: 'docs-only',
                variants: [
                    { id: 'v7', match: { sdkPython: ['6', '7'] } },
                    { id: 'v8', match: { sdkPython: ['8'] } },
                ],
            },
        }, dir)).toThrow(/sdk groups must mark exactly one variant with default: true/);

        expect(() => expand({
            type: 'docs-only',
            category: 'sdk',
            variants: [
                { id: 'v7', default: false, match: { sdkPython: ['6', '7'] } },
                { id: 'v8', default: true, match: { sdkPython: ['8'] } },
            ],
        })).not.toThrow();
    });

    it('accepts a list of match values and keeps it through expansion and variant.json', async () => {
        const match = { framework: 'nextjs', frameworkVariant: ['app-router', 'pages-router'] };
        const [skill] = expand(withVariant({ match }));
        expect(skill.match).toEqual(match);
        expect(serializeSkill(skill).match).toEqual(match);
        const files = await build(withVariant({ match }));
        expect(JSON.parse(files[VARIANT_FILE]).match).toEqual(match);
    });

    it('accepts a product a variant declares as a gap', () => {
        expect(() => expand(withVariant({ docs: undefined, gaps: ['error-tracking'] }))).not.toThrow();
    });

    it('rejects docs on a group that declares no products', () => {
        const { products: _products, ...plain } = table();
        expect(() => expand(plain)).toThrow(/need the group to declare products/);
    });

    it('rejects integration as a product, since it is the variant pages', () => {
        expect(() => expand(table({ products: ['integration'] }))).toThrow(/not a product to list/);
    });

    it.each([
        ['an empty match object without products', { type: 'skill', template: 'description.md', variants: [{ id: 'v7', match: {} }] }, /match must map trait names/],
        ['a products group omitting framework in match', table({ variants: [{ ...table().variants[0], match: { sdkPython: '7' } }] }), /match must name the framework/],
        ['frameworkVariant without products or another framework variant', { type: 'skill', template: 'description.md', variants: [{ id: 'app', match: { frameworkVariant: 'app-router' } }] }, /match must name the framework/],
    ])('rejects %s', (_, group, message) => {
        expect(() => expand(group)).toThrow(message);
    });

    it.each([
        ['a product listed twice', ['error-tracking', 'error-tracking'], /products lists a name twice/],
        ['a product name that is not kebab-case', ['Error Tracking'], /must be a list of kebab-case names/],
        ['products that are not a list', 'error-tracking', /must be a list of kebab-case names/],
    ])('rejects %s', (_, products, message) => {
        expect(() => expand(table({ products }))).toThrow(message);
    });

    it('publishes one menu tag per value of a match list, in order, beside single-string keys', () => {
        writeManifestAndMenu({
            allSkills: expand(withVariant({ match: { frameworkVariant: ['app-router', 'pages-router'], framework: 'nextjs' } })).map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: '1.2.3',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const [entry] = Object.values(menu.categories).flat();

        expect(entry.tags).toEqual(['nextjs', 'framework:nextjs', 'frameworkVariant:app-router', 'frameworkVariant:pages-router', 'integration', 'default']);
        expect(entry.tags.some(tag => tag.includes('['))).toBe(false);
    });

    it('publishes match as key:value menu tags, the framework first however the row orders them', () => {
        writeManifestAndMenu({
            allSkills: expand(withVariant({ match: { frameworkVariant: 'app-router', framework: 'nextjs' } })).map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: '1.2.3',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const [entry] = Object.values(menu.categories).flat();

        expect(entry.tags).toEqual(['nextjs', 'framework:nextjs', 'frameworkVariant:app-router', 'integration', 'default']);
        expect(entry).not.toHaveProperty('framework');
        expect(entry).not.toHaveProperty('default');
    });
});

describe('a skill config', () => {
    it.each([
        ['variants_from', 'variants_from: integration\n'],
        ['packaging', 'packaging: bundle\nvariants:\n  - id: all\n'],
    ])('is refused when it still sets %s', (key, yaml) => {
        fs.mkdirSync(path.join(dir, 'skills', 'old-step'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'skills', 'old-step', 'config.yaml'), yaml);

        expect(() => loadSkillsConfig(dir)).toThrow(`${key} is no longer read`);
    });
});

describe('the integration variant table', () => {
    const config = loadSkillsConfig(REPO_CONFIG_DIR);
    const variants = config.integration.variants;

    /** The row or step variant a run on `framework` takes: the default, or the first when none is marked. */
    const defaultOf = (rows, framework) => {
        const family = rows.filter(row => row.match?.framework === framework);
        return family.find(row => row.default) ?? family[0];
    };

    it('lists the 3.7 error tracking page on the default Nuxt row, the page a Nuxt run reads', () => {
        const row = defaultOf(variants, 'nuxt');
        expect(row.id).toBe('nuxt-3-6');
        expect(row.docs['error-tracking']).toEqual([`${PAGE}/error-tracking/installation/nuxt-3-7.md`]);
    });

    it('names a framework variant only within a framework that has several', () => {
        const families = {};
        for (const variant of variants) {
            if (variant.match) (families[variant.match.framework] ??= []).push(variant);
        }
        for (const variant of variants.filter(v => v.match?.frameworkVariant)) {
            expect(families[variant.match.framework].length, variant.id).toBeGreaterThan(1);
        }
    });

    it('gives no two rows of a framework the same framework variant', () => {
        const seen = new Set();
        for (const variant of variants.filter(v => v.match?.frameworkVariant)) {
            const key = `${variant.match.framework}:${variant.match.frameworkVariant}`;
            expect(seen.has(key), key).toBe(false);
            seen.add(key);
        }
    });
});
