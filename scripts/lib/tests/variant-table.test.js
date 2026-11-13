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
            framework: 'nextjs',
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

    it.each([
        ['a product with no pages and no gap', { docs: {} }, /no error-tracking pages/],
        ['a product with pages that is also a gap', { gaps: ['error-tracking'] }, /also named under gaps/],
        ['pages for a product the group does not list', { docs: { 'error-tracking': [`${PAGE}/a.md`], surveys: [`${PAGE}/b.md`] } }, /surveys is not in the group's products/],
        ['an empty page list', { docs: { 'error-tracking': [] } }, /non-empty list of pages/],
        ['a match framework that differs from the framework', { match: { framework: 'react' } }, /differs from framework/],
        ['a match value that is not a string', { match: { frameworkVariant: 4 } }, /match must map/],
        ['a match key that is not a trait name', { match: { 'framework-variant': 'app-router' } }, /match must map trait names/],
    ])('rejects %s', (_, changes, message) => {
        expect(() => expand(withVariant(changes))).toThrow(message);
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

    it('publishes match as key:value menu tags, after the framework tag', () => {
        writeManifestAndMenu({
            allSkills: expand(table()).map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: '1.2.3',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const [entry] = Object.values(menu.categories).flat();

        expect(entry.tags).toEqual(['nextjs', 'framework:nextjs', 'frameworkVariant:app-router', 'integration', 'default']);
        expect(entry).toMatchObject({ framework: 'nextjs', default: true });
    });
});

describe('the integration variant table', () => {
    const config = loadSkillsConfig(REPO_CONFIG_DIR);
    const variants = config.integration.variants;
    const byId = group => Object.fromEntries(config[group].variants.map(variant => [variant.id, variant]));

    // The step skills these pages come from keep shipping them, so a run reads the same pages from either place.
    it.each([
        ['error-tracking', 'integration-v2/error-tracking-step'],
        ['feature-flags', 'integration-v2/feature-flags-step'],
    ])("lists each variant's %s pages as its step skill ships them", (product, group) => {
        const step = byId(group);
        for (const variant of variants) {
            expect(variant.docs[product], variant.id).toEqual(step[variant.id].docs_urls);
        }
    });

    it('names a framework variant only within a framework that has several', () => {
        const families = {};
        for (const variant of variants) {
            if (variant.framework) (families[variant.framework] ??= []).push(variant);
        }
        for (const variant of variants.filter(v => v.match?.frameworkVariant)) {
            expect(families[variant.framework].length, variant.id).toBeGreaterThan(1);
        }
    });

    it('gives no two rows of a framework the same framework variant', () => {
        const seen = new Set();
        for (const variant of variants.filter(v => v.match?.frameworkVariant)) {
            const key = `${variant.framework}:${variant.match.frameworkVariant}`;
            expect(seen.has(key), key).toBe(false);
            seen.add(key);
        }
    });
});
