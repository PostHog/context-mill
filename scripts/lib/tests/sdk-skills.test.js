import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    docCachePath,
    expandSkillGroups,
    extractMigrationChecklist,
    fetchDoc,
    generateAllSkills,
    generateSkill,
    generateSkillsByIds,
    loadCommandments,
    loadSkillsConfig,
    resolveDocUrl,
    runGenerate,
    serializeSkill,
} from '../skill-generator.js';
import { loadSkipPatterns } from '../example-processor.js';
import { buildResources, fetchDocContent } from '../../build.js';
import { partialRebuild, writeManifestAndMenu } from '../build-phases.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const REPO_CONFIG_DIR = path.join(REPO_ROOT, 'context');
// A synthetic config has no integration skills, so its build checks resolvability against no wizard picks.
const NO_WIZARD_PICKS = { frameworks: [], matchKeys: {}, taskSkills: [], packFamily: 'integration' };

const URI_SCHEMA = `
manifest_version: "1.0"
scheme: posthog://
patterns:
  skill: skills/{group}/{id}
  doc: docs/{id}
`;

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
let savedDocsBase;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-skills-'));
    savedDocsBase = process.env.POSTHOG_DOCS_BASE_URL;
    fs.writeFileSync(path.join(dir, 'uri-schema.yaml'), URI_SCHEMA);
});

afterEach(() => {
    vi.restoreAllMocks();
    if (savedDocsBase === undefined) delete process.env.POSTHOG_DOCS_BASE_URL;
    else process.env.POSTHOG_DOCS_BASE_URL = savedDocsBase;
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

    it.each([
        ['missing Checklist heading', '# Title\n\n## Before you upgrade\n\n- item\n'],
        ['empty Checklist section', '# Title\n\n## Checklist\n\nNothing to change.\n\n## Next\n\nText\n'],
        ['bold subheading without bullets', '# Title\n\n## Checklist\n\n**Before you upgrade**\n\n## Next\n\nText\n'],
    ])('returns null on %s so upstream formatting edits do not abort builds', (_, markdown) => {
        expect(extractMigrationChecklist(markdown)).toBeNull();
    });
});

describe('fetchDoc with POSTHOG_DOCS_BASE_URL', () => {
    it('bypasses .docs-cache reads/writes, rejects on HTTP errors without stale cache fallback, keeps non-posthog.com URLs unchanged, and reuses memoryCache', async () => {
        const overrideRequests = [];
        const externalRequests = [];
        const overrideServer = http.createServer((req, res) => {
            overrideRequests.push(req.url);
            if (req.url === '/__test__/override-missing-fresh.md' || req.url === '/__test__/override-missing-stale.md') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/markdown' });
            res.end(`# Preview ${req.url}\n\nPreview body\n`);
        });
        const externalServer = http.createServer((req, res) => {
            externalRequests.push(req.url);
            res.writeHead(200, { 'Content-Type': 'text/markdown' });
            res.end('# External Doc\n\nExternal body\n');
        });
        await Promise.all([
            new Promise((resolve) => overrideServer.listen(0, '127.0.0.1', resolve)),
            new Promise((resolve) => externalServer.listen(0, '127.0.0.1', resolve)),
        ]);
        const { port: overridePort } = overrideServer.address();
        const { port: externalPort } = externalServer.address();

        const seededUrl = 'https://posthog.com/__test__/override-seeded.md';
        const unseededUrl = 'https://posthog.com/__test__/override-unseeded.md';
        const defaultOptsUrl = 'https://posthog.com/__test__/override-default-opts.md';
        const missingFreshUrl = 'https://posthog.com/__test__/override-missing-fresh.md';
        const missingStaleUrl = 'https://posthog.com/__test__/override-missing-stale.md';
        const externalUrl = `http://127.0.0.1:${externalPort}/external.md`;
        const seededCacheFile = docCachePath(seededUrl);
        const unseededCacheFile = docCachePath(unseededUrl);
        const defaultOptsCacheFile = docCachePath(defaultOptsUrl);
        const missingFreshCacheFile = docCachePath(missingFreshUrl);
        const missingStaleCacheFile = docCachePath(missingStaleUrl);
        const externalCacheFile = docCachePath(externalUrl);
        const seededEntry = JSON.stringify({
            url: seededUrl,
            title: 'Cached Title',
            content: '# Cached Title\n\nStale body\n',
            fetchedAt: Date.now(),
        });
        const missingFreshEntry = JSON.stringify({
            url: missingFreshUrl,
            title: 'Cached Fresh',
            content: '# Cached Fresh\n\nShould not fall back\n',
            fetchedAt: Date.now(),
        });
        const missingStaleEntry = JSON.stringify({
            url: missingStaleUrl,
            title: 'Cached Stale',
            content: '# Cached Stale\n\nShould not fall back\n',
            fetchedAt: 0,
        });

        try {
            fs.mkdirSync(path.dirname(seededCacheFile), { recursive: true });
            fs.writeFileSync(seededCacheFile, seededEntry);
            fs.writeFileSync(missingFreshCacheFile, missingFreshEntry);
            fs.writeFileSync(missingStaleCacheFile, missingStaleEntry);
            fs.rmSync(unseededCacheFile, { force: true });
            fs.rmSync(defaultOptsCacheFile, { force: true });

            process.env.POSTHOG_DOCS_BASE_URL = `http://127.0.0.1:${overridePort}/`;
            const memoryCache = new Map();

            // Ignores fresh .docs-cache entry and leaves it untouched.
            const seededRes = await fetchDoc(seededUrl, { memoryCache });
            expect(seededRes.content).toContain('# Preview /__test__/override-seeded.md');
            expect(fs.readFileSync(seededCacheFile, 'utf8')).toBe(seededEntry);

            // Rejects on HTTP 404 without falling back to fresh or stale .docs-cache entries.
            await expect(fetchDoc(missingFreshUrl, { memoryCache })).rejects.toThrow(/HTTP 404/);
            await expect(fetchDoc(missingStaleUrl, { memoryCache })).rejects.toThrow(/HTTP 404/);
            expect(fs.readFileSync(missingFreshCacheFile, 'utf8')).toBe(missingFreshEntry);
            expect(fs.readFileSync(missingStaleCacheFile, 'utf8')).toBe(missingStaleEntry);
            expect(memoryCache.has(`http://127.0.0.1:${overridePort}/__test__/override-missing-fresh.md`)).toBe(false);
            expect(memoryCache.has(`http://127.0.0.1:${overridePort}/__test__/override-missing-stale.md`)).toBe(false);

            // Does not write preview response to .docs-cache and hits memoryCache on repeat fetch.
            const unseededRes1 = await fetchDoc(unseededUrl, { memoryCache });
            const unseededRes2 = await fetchDoc(unseededUrl, { memoryCache });
            expect(unseededRes1.content).toContain('# Preview /__test__/override-unseeded.md');
            expect(unseededRes2.content).toContain('# Preview /__test__/override-unseeded.md');
            expect(fs.existsSync(unseededCacheFile)).toBe(false);

            // Leaving options unset uses the default `{ memoryCache } = {}` parameter cleanly.
            const defaultOptsRes = await fetchDoc(defaultOptsUrl);
            expect(defaultOptsRes.content).toContain('# Preview /__test__/override-default-opts.md');
            expect(fs.existsSync(defaultOptsCacheFile)).toBe(false);

            expect(overrideRequests).toEqual([
                '/__test__/override-seeded.md',
                '/__test__/override-missing-fresh.md',
                '/__test__/override-missing-stale.md',
                '/__test__/override-unseeded.md',
                '/__test__/override-default-opts.md',
            ]);

            // Non-posthog.com URL bypasses POSTHOG_DOCS_BASE_URL override.
            const extRes = await fetchDoc(externalUrl, { memoryCache });
            expect(extRes.content).toContain('# External Doc');
            expect(externalRequests).toEqual(['/external.md']);
            expect(overrideRequests).toHaveLength(5);
            // Non-overridden: skips memoryCache, writes .docs-cache, and a repeat call reuses disk without HTTP.
            expect(memoryCache.has(externalUrl)).toBe(false);
            expect(fs.existsSync(externalCacheFile)).toBe(true);
            const extRes2 = await fetchDoc(externalUrl, { memoryCache });
            expect(extRes2).toEqual(extRes);
            expect(externalRequests).toEqual(['/external.md']);
            expect(memoryCache.has(externalUrl)).toBe(false);

            // Origin-prefix lookalike also stays un-overridden.
            expect(resolveDocUrl('https://posthog.com.evil.example/docs/a.md')).toEqual({
                fetchUrl: 'https://posthog.com.evil.example/docs/a.md',
                overridden: false,
            });
        } finally {
            fs.rmSync(seededCacheFile, { force: true });
            fs.rmSync(unseededCacheFile, { force: true });
            fs.rmSync(defaultOptsCacheFile, { force: true });
            fs.rmSync(missingFreshCacheFile, { force: true });
            fs.rmSync(missingStaleCacheFile, { force: true });
            fs.rmSync(externalCacheFile, { force: true });
            await Promise.all([
                new Promise((resolve) => overrideServer.close(resolve)),
                new Promise((resolve) => externalServer.close(resolve)),
            ]);
        }
    });

    it('resolveDocUrl ignores whitespace-only overrides, leaves invalid URLs alone, and keeps query and hash when overriding', () => {
        const saved = process.env.POSTHOG_DOCS_BASE_URL;
        try {
            process.env.POSTHOG_DOCS_BASE_URL = '   ';
            expect(resolveDocUrl('https://posthog.com/docs/a.md')).toEqual({
                fetchUrl: 'https://posthog.com/docs/a.md',
                overridden: false,
            });

            process.env.POSTHOG_DOCS_BASE_URL = 'http://localhost:3000/';
            expect(resolveDocUrl('not a url')).toEqual({ fetchUrl: 'not a url', overridden: false });
            expect(resolveDocUrl('https://posthog.com/docs/a.md?v=1#top')).toEqual({
                fetchUrl: 'http://localhost:3000/docs/a.md?v=1#top',
                overridden: true,
            });
        } finally {
            if (saved === undefined) delete process.env.POSTHOG_DOCS_BASE_URL;
            else process.env.POSTHOG_DOCS_BASE_URL = saved;
        }
    });

    it('shares caller and build-runner memoryCache across runGenerate, generateAllSkills, generateSkillsByIds, fetchDocContent, and buildResources', async () => {
        const requests = [];
        const server = http.createServer((req, res) => {
            requests.push(req.url);
            res.writeHead(200, { 'Content-Type': 'text/markdown' });
            res.end('# Shared Preview\n\nBody\n');
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        const sharedUrl = 'https://posthog.com/__test__/shared-across-skills.md';
        const docUrl2 = 'https://posthog.com/__test__/shared-build-only.md';
        const docUrl3 = 'https://posthog.com/__test__/shared-default-opts.md';

        try {
            fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'skills', 'demo', 'description.md'), '# {display_name}\n\n{references}\n');
            fs.writeFileSync(path.join(dir, 'skills', 'demo', 'config.yaml'), [
                'type: docs-only',
                'template: description.md',
                'variants:',
                `  - id: one`,
                '    display_name: One',
                `    docs_urls: [${sharedUrl}]`,
                `  - id: two`,
                '    display_name: Two',
                `    docs_urls: [${sharedUrl}]`,
            ].join('\n'));
            fs.writeFileSync(path.join(dir, 'commandments.yaml'), 'commandments: {}\n');
            fs.writeFileSync(path.join(dir, 'skip-patterns.yaml'), 'global: []\nexamples: {}\n');
            fs.writeFileSync(path.join(dir, 'docs.yaml'), `docs:\n  - id: guide\n    name: Guide\n    description: Guide\n    urls:\n      - ${sharedUrl}\n`);
            fs.writeFileSync(path.join(dir, 'marketplace.yaml'), [
                'target_repo: PostHog/skills',
                'mega_plugin:',
                '  name: posthog-all',
                '  destination: skills/posthog/all',
                '  keywords: [posthog]',
                'plugins:',
                '  demo:',
                '    name: posthog-demo',
                '    destination: skills/posthog/demo',
                '    keywords: [posthog]',
            ].join('\n'));

            process.env.POSTHOG_DOCS_BASE_URL = `http://127.0.0.1:${port}/`;

            // 1. runGenerate forwards caller-supplied memoryCache.
            const skills = expandSkillGroups(loadSkillsConfig(dir), dir);
            const runCache = new Map();
            await runGenerate({
                skills,
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-run'),
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: { commandments: {} },
                memoryCache: runCache,
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);
            expect(runCache.size).toBe(1);

            // 2. generateAllSkills forwards caller-supplied memoryCache.
            requests.length = 0;
            const allCache = new Map();
            await generateAllSkills({
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-all'),
                version: 'test',
                memoryCache: allCache,
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);
            expect(allCache.size).toBe(1);

            // 3. generateSkillsByIds forwards caller-supplied memoryCache.
            requests.length = 0;
            const partialCache = new Map();
            await generateSkillsByIds({
                ids: ['demo-one', 'demo-two'],
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-partial'),
                version: 'test',
                memoryCache: partialCache,
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);
            expect(partialCache.size).toBe(1);

            // 4. fetchDocContent forwards caller-supplied memoryCache across repeated URLs.
            requests.length = 0;
            const docCache = new Map();
            const content = await fetchDocContent({ urls: [docUrl2, docUrl2] }, { memoryCache: docCache });
            expect(content).toContain('# Shared Preview');
            expect(requests).toEqual(['/__test__/shared-build-only.md']);
            expect(docCache.size).toBe(1);

            // 4b. fetchDocContent leaves options defaulted (`{ memoryCache } = {}`) when omitted.
            requests.length = 0;
            const defaultDocContent = await fetchDocContent({ urls: [docUrl2, docUrl3] });
            expect(defaultDocContent).toBe('# Shared Preview\n\nBody\n\n\n---\n\n# Shared Preview\n\nBody\n');
            expect(requests).toEqual(['/__test__/shared-build-only.md', '/__test__/shared-default-opts.md']);

            // 5. buildResources creates one memoryCache and shares it across generateAllSkills + fetchDocContent.
            requests.length = 0;
            await buildResources({
                repoRoot: dir,
                configDir: dir,
                distDir: path.join(dir, 'dist'),
                version: 'test',
                wizardPicks: NO_WIZARD_PICKS,
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);

            // 6. Leaving memoryCache unset uses runGenerate's shared default Map across runGenerate, generateAllSkills, generateSkillsByIds, and partialRebuild.
            requests.length = 0;
            await runGenerate({
                skills,
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-run-default'),
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: { commandments: {} },
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);

            requests.length = 0;
            await generateAllSkills({
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-all-default'),
                version: 'test',
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);

            requests.length = 0;
            await generateSkillsByIds({
                ids: ['demo-one', 'demo-two'],
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-partial-default'),
                version: 'test',
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);

            requests.length = 0;
            await partialRebuild({
                ids: ['demo-one', 'demo-two'],
                repoRoot: dir,
                configDir: dir,
                distDir: path.join(dir, 'dist-partial'),
                version: 'test',
                docContents: {},
                log: () => {},
            });
            expect(requests).toEqual(['/__test__/shared-across-skills.md']);
        } finally {
            fs.rmSync(docCachePath(sharedUrl), { force: true });
            fs.rmSync(docCachePath(docUrl2), { force: true });
            fs.rmSync(docCachePath(docUrl3), { force: true });
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('skips the missing-tags warning for match-only skills, cleans skills-temp on error, and allows non-file argv[1] on import', async () => {
        fs.mkdirSync(path.join(dir, 'skills', 'sdk', 'tagless-sdk'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'skills', 'sdk', 'tagless-sdk', 'tpl.md'), '# {display_name}\n\n{references}\n');
        fs.writeFileSync(path.join(dir, 'skills', 'sdk', 'tagless-sdk', 'config.yaml'), [
            'type: docs-only',
            'category: sdk',
            'cli:',
            '  role: internal',
            'template: tpl.md',
            'variants:',
            '  - id: v1',
            '    default: true',
            '    display_name: 1.x',
            '    match: { sdkNode: ["1"] }',
        ].join('\n'));
        fs.mkdirSync(path.join(dir, 'skills', 'plain-tagless'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'skills', 'plain-tagless', 'tpl.md'), '# Plain\n');
        fs.writeFileSync(path.join(dir, 'skills', 'plain-tagless', 'config.yaml'), [
            'type: docs-only',
            'template: tpl.md',
            'variants:',
            '  - id: all',
            '    display_name: Plain',
        ].join('\n'));
        fs.writeFileSync(path.join(dir, 'commandments.yaml'), 'commandments: {}\n');
        fs.writeFileSync(path.join(dir, 'skip-patterns.yaml'), 'global: []\nexamples: {}\n');
        fs.writeFileSync(path.join(dir, 'docs.yaml'), 'docs: []\n');
        fs.writeFileSync(path.join(dir, 'marketplace.yaml'), [
            'target_repo: PostHog/skills',
            'mega_plugin:',
            '  name: posthog-all',
            '  destination: skills/posthog/all',
            '  keywords: [posthog]',
            'plugins:',
            '  plain:',
            '    name: posthog-plain',
            '    destination: skills/posthog/plain',
            '    keywords: [posthog]',
        ].join('\n'));

        const distDir = path.join(dir, 'dist');
        const tempDir = path.join(distDir, 'skills-temp');
        fs.mkdirSync(path.join(tempDir, 'stale-orphan'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'stale-orphan', 'SKILL.md'), 'stale');
        fs.mkdirSync(path.join(tempDir, 'sdk-tagless-sdk-v1'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'sdk-tagless-sdk-v1', 'stale-leak.md'), 'leaked');

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            await buildResources({
                repoRoot: dir,
                configDir: dir,
                distDir,
                version: 'test',
                wizardPicks: NO_WIZARD_PICKS,
            });
            const tagWarns = warnSpy.mock.calls.map((c) => c.join(' ')).filter((line) => line.includes('has no tags'));
            expect(tagWarns.some((line) => line.includes('Skill "plain-tagless" has no tags'))).toBe(true);
            expect(tagWarns.some((line) => line.includes('sdk-tagless-sdk-v1'))).toBe(false);
            expect(fs.existsSync(tempDir)).toBe(false);
            const zipBytes = fs.readFileSync(path.join(distDir, 'skills', 'sdk-tagless-sdk-v1.zip'));
            expect(zipBytes.includes(Buffer.from('stale-leak.md'))).toBe(false);
        } finally {
            warnSpy.mockRestore();
        }

        // A failing build (e.g., invalid marketplace config) still clears dist/skills-temp in finally.
        fs.writeFileSync(path.join(dir, 'marketplace.yaml'), 'plugins: null\n');
        await expect(buildResources({
            repoRoot: dir,
            configDir: dir,
            distDir,
            version: 'test',
        })).rejects.toThrow();
        expect(fs.existsSync(tempDir)).toBe(false);

        // Programmatic import succeeds even when process.argv[1] does not point to an existing file.
        const out = execFileSync(
            process.execPath,
            ['-e', "import('./scripts/build.js').then((m) => process.stdout.write(typeof m.buildResources))", 'nonexistent-entry.js'],
            { cwd: REPO_ROOT, encoding: 'utf8' },
        );
        expect(out).toBe('function');
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
                match: { sdkPython: ['6', '7'] },
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
                match: { sdkPython: '8' },
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

    it('accepts exact-major match keys without requiring framework and preserves match order without framework: undefined', () => {
        const skills = expandSkillGroups({ 'sdk/posthog-python': sdkGroup }, dir);
        expect(skills.map((s) => s.id)).toEqual(['sdk-posthog-python-v7', 'sdk-posthog-python-v8']);
        expect(skills[0].match).toEqual({ sdkPython: ['6', '7'] });
        expect(skills[1].match).toEqual({ sdkPython: '8' });
        expect('framework' in skills[0].match).toBe(false);
    });

    it('rejects mixed groups where one variant omits framework while another sets it', () => {
        const mixed = {
            ...sdkGroup,
            variants: [
                { ...sdkGroup.variants[0], match: { framework: 'django' } },
                sdkGroup.variants[1],
            ],
        };
        expect(() => expandSkillGroups({ 'sdk/posthog-python': mixed }, dir)).toThrow(/match must name the framework/);
    });

    it('inlines the migration checklist into non-default SKILL.md and emits sdk<Lang>:<M> menu tags', async () => {
        const skills = expandSkillGroups({ 'sdk/posthog-python': sdkGroup }, dir);
        const outputDir = path.join(dir, 'out');
        for (const skill of skills) {
            await generateSkill({
                skill,
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir,
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: {
                    commandments: {
                        'sdk-python-7': [
                            'Python 7 floor: mcp-analytics >= 7.62.0',
                            'Python 7 signature: keep positional Client(api_key, host=...)',
                        ],
                        'sdk-python-8': ['Python 8 rule'],
                    },
                },
                skillTemplate: skill._template,
                sharedDocs: [],
                fetchDocFn: (url) => Promise.resolve({
                    content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : `# ${url}\n`,
                    title: path.basename(url),
                }),
            });
        }
        const v7Skill = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(v7Skill).toContain('Python 7 floor: mcp-analytics >= 7.62.0');
        expect(v7Skill).toContain('Python 7 signature: keep positional Client(api_key, host=...)');
        expect(v7Skill).toContain('- You use openfeature-provider-posthog below 0.2.0');
        expect(v7Skill).not.toContain('{migration_checklist}');

        writeManifestAndMenu({
            allSkills: skills.map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, 'dist'),
            configDir: dir,
            version: 'test',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
        const entries = menu.categories['sdk/posthog-python'];
        expect(entries.map((e) => e.tags)).toEqual([
            ['sdk-python-7', 'sdkPython:6', 'sdkPython:7', 'sdk-posthog-python'],
            ['sdk-python-8', 'sdkPython:8', 'sdk-posthog-python', 'default'],
        ]);
    });

    it('falls back cleanly without throwing when {migration_checklist} has no migration.md', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const backfilled = {
            ...sdkGroup,
            variants: [
                { ...sdkGroup.variants[0], docs_urls: ['https://posthog.com/docs/libraries/python/7.x.x.md'] },
                sdkGroup.variants[1],
            ],
        };
        const [skill] = expandSkillGroups({ 'sdk/posthog-python': backfilled }, dir);
        const outputDir = path.join(dir, 'out');
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
        const v7Skill = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no migration.md found'));
        expect(v7Skill).not.toContain('{migration_checklist}');
        expect(v7Skill).not.toContain('references/migration.md');
        expect(v7Skill).toContain('No migration guide bundled for this version');
    });

    it('reads {migration_checklist} from checked-in local references/<shortId>/migration.md or references/migration.md when docs_urls omits migration.md', async () => {
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

        // Removing the variant-specific migration.md falls back to group-level references/migration.md.
        fs.rmSync(path.join(refsDir, 'v7'), { recursive: true, force: true });
        const outputDir2 = path.join(dir, 'out-local-group');
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: dir,
            configDir: dir,
            outputDir: outputDir2,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: skill._template,
            sharedDocs: [],
            fetchDocFn: () => Promise.resolve({ content: '# 7.x.x\n', title: '7.x.x' }),
        });
        const renderedGroup = fs.readFileSync(path.join(outputDir2, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(renderedGroup).toContain('- Group fallback item');
    });

    it('throws a clear error if a template uses {supported_versions} when match has zero values or mixed keys', async () => {
        const [baseSkill] = expandSkillGroups({ 'sdk/posthog-python': sdkGroup }, dir);
        await expect(
            generateSkill({
                skill: { ...baseSkill, match: {} },
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-empty-match'),
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: { commandments: {} },
                skillTemplate: baseSkill._template,
                sharedDocs: [],
                fetchDocFn: (url) => Promise.resolve({ content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : '# 7.x.x\n', title: 'doc' }),
            }),
        ).rejects.toThrow(/supported_versions.*no values/);

        await expect(
            generateSkill({
                skill: { ...baseSkill, match: { sdkPython: '7', sdkNode: '5' } },
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out-mixed-match'),
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: { commandments: {} },
                skillTemplate: baseSkill._template,
                sharedDocs: [],
                fetchDocFn: (url) => Promise.resolve({ content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : '# 7.x.x\n', title: 'doc' }),
            }),
        ).rejects.toThrow(/supported_versions.*mixes multiple keys/);
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

    it('warns with the skill id and links references/migration.md when migration.md omits Checklist bullets', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const [skill] = expandSkillGroups({ 'sdk/posthog-python': sdkGroup }, dir);
        const outputDir = path.join(dir, 'out');
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
            fetchDocFn: (url) => Promise.resolve({
                content: url.endsWith('migration.md') ? '# Migration\n\nNo checklist heading yet.\n' : '# 7.x.x\n',
                title: path.basename(url),
            }),
        });
        const v7Skill = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skill "sdk-posthog-python-v7"'));
        expect(v7Skill).toContain('## Watchlist\n_See `references/migration.md` for the breaking-change checklist._');
        expect(v7Skill).not.toContain('{migration_checklist}');
    });

    it('renders thin doc wrappers cleanly when {commandments} is omitted from the template', async () => {
        const thin = {
            ...sdkGroup,
            variants: sdkGroup.variants.map(({ tags: _tags, ...variant }) => variant),
        };
        fs.writeFileSync(
            path.join(dir, 'skills', 'sdk', 'non-default-major.md'),
            '# {display_name}\n\nSupports {supported_versions}.\n\n{references}\n\n## Watchlist\n{migration_checklist}\n',
        );
        fs.writeFileSync(
            path.join(dir, 'skills', 'sdk', 'default-major.md'),
            '# {display_name}\n\n{references}\n',
        );
        const skills = expandSkillGroups({ 'sdk/posthog-python': thin }, dir);
        const outputDir = path.join(dir, 'out-thin');
        for (const skill of skills) {
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
                fetchDocFn: (url) => Promise.resolve({
                    content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : `# ${url}\n`,
                    title: path.basename(url),
                }),
            });
        }
        const renderedV7 = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v7', 'SKILL.md'), 'utf8');
        const renderedV8 = fs.readFileSync(path.join(outputDir, 'sdk-posthog-python-v8', 'SKILL.md'), 'utf8');
        expect(renderedV7).toContain('- You use openfeature-provider-posthog below 0.2.0');
        expect(renderedV7).not.toContain('{commandments}');
        expect(renderedV8).not.toContain('{commandments}');
    });
});

describe('checked-in context/skills/sdk configs and commandments', () => {
    const config = loadSkillsConfig(REPO_CONFIG_DIR);
    const allSkills = expandSkillGroups(config, REPO_CONFIG_DIR);
    const commandmentsConfig = loadCommandments(REPO_CONFIG_DIR);
    const { commandments } = commandmentsConfig;
    const skipPatterns = loadSkipPatterns(path.join(REPO_CONFIG_DIR, 'skip-patterns.yaml'));

    const SDK_SPECS = [
        [
            'sdk/posthog-python',
            'sdkPython',
            '/docs/libraries/python/',
            [
                { shortId: 'v7', major: '7', supported: ['3', '4', '5', '6', '7'], isDefault: false, docFile: '7.x.x.md' },
                { shortId: 'v8', major: '8', supported: ['8'], isDefault: true, docFile: '8.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-node',
            'sdkNode',
            '/docs/libraries/node/',
            [
                { shortId: 'v5', major: '5', supported: ['4', '5'], isDefault: false, docFile: '5.x.x.md' },
                { shortId: 'v6', major: '6', supported: ['6'], isDefault: true, docFile: '6.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-go',
            'sdkGo',
            '/docs/libraries/go/',
            [
                { shortId: 'v1', major: '1', supported: ['1'], isDefault: false, docFile: '1.x.x.md' },
                { shortId: 'v2', major: '2', supported: ['2'], isDefault: true, docFile: '2.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-rust',
            'sdkRust',
            '/docs/libraries/rust/',
            [
                { shortId: 'v0', major: '0', supported: ['0'], isDefault: false, docFile: '0.x.x.md' },
                { shortId: 'v1', major: '1', supported: ['1'], isDefault: true, docFile: '1.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-ios',
            'sdkIos',
            '/docs/libraries/ios/',
            [
                { shortId: 'v3', major: '3', supported: ['3'], isDefault: false, docFile: '3.x.x.md' },
                { shortId: 'v4', major: '4', supported: ['4'], isDefault: true, docFile: '4.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-android',
            'sdkAndroid',
            '/docs/libraries/android/',
            [
                { shortId: 'v3', major: '3', supported: ['3'], isDefault: false, docFile: '3.x.x.md' },
                { shortId: 'v4', major: '4', supported: ['4'], isDefault: true, docFile: '4.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-flutter',
            'sdkFlutter',
            '/docs/libraries/flutter/',
            [
                { shortId: 'v5', major: '5', supported: ['4', '5'], isDefault: false, docFile: '5.x.x.md' },
                { shortId: 'v6', major: '6', supported: ['6'], isDefault: true, docFile: '6.x.x.md' },
            ],
        ],
        [
            'sdk/posthog-kmp',
            'sdkKmp',
            '/docs/libraries/',
            [
                { shortId: 'v0', major: '0', supported: ['0'], isDefault: false, docFile: 'kmp.md', localMigration: true, referenceVersion: '1.x' },
                { shortId: 'v1', major: '1', supported: ['1'], isDefault: true, docFile: 'kmp.md' },
            ],
        ],
    ];

    it('keeps no per-variant sdk-*-<N> commandment blocks, covers every on-disk sdk group, and ships thin doc-wrapper SDK templates', () => {
        const sdkKeys = Object.keys(commandments).filter((k) => /^sdk-[a-z0-9-]+-\d+$/.test(k));
        expect(sdkKeys).toEqual([]);

        const sdkRoot = path.join(REPO_CONFIG_DIR, 'skills', 'sdk');
        const onDiskSdkGroups = fs.readdirSync(sdkRoot, { withFileTypes: true })
            .filter((d) => d.isDirectory() && fs.existsSync(path.join(sdkRoot, d.name, 'config.yaml')))
            .map((d) => `sdk/${d.name}`)
            .sort();
        expect(SDK_SPECS.map(([groupKey]) => groupKey).sort()).toEqual(onDiskSdkGroups);

        const defaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'default-major.md'), 'utf8');
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        expect(defaultMd).not.toContain('{commandments}');
        expect(defaultMd).not.toMatch(/^## Guidelines\b/m);
        expect(nonDefaultMd).not.toContain('{commandments}');
        expect(nonDefaultMd).not.toMatch(/^## Guidelines\b/m);
        expect(nonDefaultMd).toContain('{migration_checklist}');
    });

    it.each(SDK_SPECS)('%s defines exact majors without sdk-*-<N> tags, one default, docs_urls, and thin rendered SKILL.md output', async (groupKey, matchKey, docsPathPrefix, expectedVariants) => {
        const groupSkills = allSkills.filter((s) => s._group === groupKey);
        expect(groupSkills.map((s) => s._shortId)).toEqual(expectedVariants.map((v) => v.shortId));

        const defaults = groupSkills.filter((s) => s.default);
        expect(defaults.map((s) => s._shortId)).toEqual(expectedVariants.filter((v) => v.isDefault).map((v) => v.shortId));

        const expectedDocsOriginPrefix = `https://posthog.com${docsPathPrefix}`;
        const outputDir = path.join(dir, 'checked-in-out');

        for (const [index, spec] of expectedVariants.entries()) {
            const s = groupSkills[index];
            expect(s._cli).toEqual({ role: 'internal' });
            expect(Boolean(s.default)).toBe(spec.isDefault);
            expect(s.match).toEqual({ [matchKey]: spec.supported });
            expect(s.match[matchKey]).toContain(spec.major);
            expect(s.tags).toEqual([]);
            expect(s.id).not.toMatch(/\b(old|new|prev|current)\b/);

            const expectedDocs = spec.isDefault || spec.localMigration
                ? [`${expectedDocsOriginPrefix}${spec.docFile}`]
                : [`${expectedDocsOriginPrefix}${spec.docFile}`, `${expectedDocsOriginPrefix}migration.md`];
            expect(s.docs_urls.length).toBeGreaterThan(0);
            for (const url of s.docs_urls) {
                expect(url).toMatch(new RegExp(`^https://posthog\\.com${docsPathPrefix}`));
            }
            expect(s.docs_urls).toEqual(expectedDocs);

            await generateSkill({
                skill: s,
                version: 'test',
                repoRoot: REPO_ROOT,
                configDir: REPO_CONFIG_DIR,
                outputDir,
                skipPatterns,
                commandmentsConfig,
                skillTemplate: s._template,
                sharedDocs: s._sharedDocs || [],
                fetchDocFn: (url) => {
                    if (!url.startsWith(expectedDocsOriginPrefix)) {
                        throw new Error(`Unexpected docs URL for ${groupKey}: ${url}`);
                    }
                    return Promise.resolve({
                        content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : `# ${path.basename(url)}\n`,
                        title: path.basename(url),
                    });
                },
            });

            const rendered = fs.readFileSync(path.join(outputDir, s.id, 'SKILL.md'), 'utf8');
            expect(rendered).toContain(`- \`references/${spec.docFile}\``);
            expect(rendered).not.toMatch(/^## Guidelines\b/m);
            if (!spec.isDefault) {
                if (spec.localMigration) {
                    expect(rendered).toContain(`- \`references/${spec.shortId}/migration.md\``);
                    expect(rendered).toContain('- You construct `PostHogConfig(...)`, `CaptureOptions(...)`, or `SessionRecordingConfig(...)`');
                    expect(rendered).toContain('references/*/migration.md');
                    expect(rendered).toContain('`references/kmp.md`');
                } else {
                    expect(rendered).toContain('- `references/migration.md`');
                    expect(rendered).toContain('- You use openfeature-provider-posthog below 0.2.0');
                }
                expect(rendered).toContain('## Projects on a lower major or minor than the reference');
            } else {
                expect(rendered).not.toContain('migration.md');
            }
            expect(rendered).not.toMatch(/\{(display_name|reference_version|supported_versions|supported_versions_note|references|commandments|migration_checklist)\}/);
            if (!spec.isDefault) {
                const expectedRefVersion = spec.referenceVersion || s.display_name;
                expect(rendered).toContain(`older than the reference (${expectedRefVersion})`);
                expect(rendered).toContain(`and the ${expectedRefVersion} reference below before writing code:`);
                if (spec.referenceVersion) {
                    expect(rendered).not.toContain(`older than the reference (${s.display_name})`);
                    expect(rendered).not.toContain(`and the ${s.display_name} reference below before writing code:`);
                }
                if (spec.supported.length === 1) {
                    const expectedScope = spec.supported[0] === '0' ? '0.x' : `major ${spec.supported[0]}`;
                    expect(rendered).toContain(`This skill supports ${expectedScope}.`);
                    const expectedDisplay = s.display_name;
                    if (spec.referenceVersion) {
                        expect(rendered).toContain(`No archived **${expectedDisplay}** reference page exists`);
                        expect(rendered).toContain(`bundled reference targets **${spec.referenceVersion}**`);
                        expect(rendered).not.toContain('covers the latest **0.x** release');
                        expect(rendered).not.toContain('Cargo treats');
                    } else {
                        expect(rendered).toContain(`The bundled reference covers the latest **${expectedDisplay}** release`);
                        if (matchKey === 'sdkRust' && spec.supported[0] === '0') {
                            expect(rendered).toContain('Cargo treats each `0.y` minor as breaking');
                        } else {
                            expect(rendered).not.toContain('Cargo treats');
                        }
                    }
                    expect(rendered).not.toContain('newest of them');
                    expect(rendered).not.toContain('one of these majors installed');
                    expect(rendered).not.toContain('major 0');
                    expect(rendered).not.toContain("lower than the reference's (0.x.x)");
                } else {
                    expect(rendered).toContain(`This skill supports majors ${spec.supported.join(', ')}.`);
                    expect(rendered).toContain(`The bundled reference is written for the newest of them, **${s.display_name}**; the project already has one of these majors installed`);
                }
            }
        }

        writeManifestAndMenu({
            allSkills: groupSkills.map(serializeSkill),
            docContents: {},
            distDir: path.join(dir, `menu-${matchKey}`),
            configDir: REPO_CONFIG_DIR,
            version: 'test',
        });
        const menu = JSON.parse(fs.readFileSync(path.join(dir, `menu-${matchKey}`, 'skills', 'skill-menu.json'), 'utf8'));
        const entries = menu.categories[groupKey];
        for (const [index, spec] of expectedVariants.entries()) {
            const expectedMenuTags = [
                ...spec.supported.map((v) => `${matchKey}:${v}`),
                groupKey.replace(/\//g, '-'),
                ...(spec.isDefault ? ['default'] : []),
            ];
            expect(entries[index].tags).toEqual(expectedMenuTags);
        }
    });

    it('states the supported versions and the lower-major rule in non-default-major.md', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        expect(nonDefaultMd).toContain('This skill supports {supported_versions}. {supported_versions_note}');
        expect(nonDefaultMd).toContain('never raise the dependency across a major version');
    });

    it('puts the precedence rule over the framework rules ahead of every section in non-default-major.md', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        const intro = nonDefaultMd.slice(0, nonDefaultMd.indexOf('\n## '));
        expect(intro).toContain('**This skill wins over the framework rules and product docs.**');
        expect(intro).toContain('Where they name an API, integration, or version the installed SDK lacks');
        expect(intro).toContain('a framework rule to register `PosthogFlaskIntegration` on posthog 7.40 becomes manual request context plus `capture_exception` in the app\'s error handlers');
        expect(nonDefaultMd).toContain('Bundled product docs and `EXAMPLE.md` target the latest SDK major. Follow them for the implementation pattern');
    });

    it('carries the existing-install rules in the SDK skill templates', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        const section = nonDefaultMd.slice(nonDefaultMd.indexOf('## On an existing install'), nonDefaultMd.indexOf('## Breaking-change watchlist'));
        for (const rule of [
            '**Keep the major and its pins.**',
            '**Use the call shape of the installed major.**',
            '**Fall back when an integration is missing.**',
            '**Prefer module-level helpers.**',
            '**Keep `identify()` where it still exists.**',
            'Keep the Go module path and the Rust crate name of the installed major.',
            '**Check after install.**',
        ]) {
            expect(section).toContain(rule);
        }
        const defaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'default-major.md'), 'utf8');
        expect(defaultMd).toContain('## On an existing install');
        expect(defaultMd).toContain('keep its major and any exact pin');
        expect(nonDefaultMd).toContain('(`references/*.x.x.md` or `references/kmp.md`)');
        expect(nonDefaultMd).toContain('spot-search `references/migration.md` or `references/*/migration.md` (when present)');
    });

    it('makes the installed-package check an ordered step before the first edit on a lower major', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        const start = nonDefaultMd.indexOf('## Projects on a lower major or minor than the reference');
        const end = nonDefaultMd.indexOf('## Reading bundled product docs on this major');
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        // The rule sits ahead of every other section, so an agent reads it before the docs guidance.
        expect(nonDefaultMd.indexOf('\n## ')).toBe(start - 1);
    });

    it('renders every checked-in older SDK skill with its supported majors and reference version', async () => {
        const python = allSkills.find((s) => s.id === 'sdk-posthog-python-v7');
        expect(python.match).toEqual({ sdkPython: ['3', '4', '5', '6', '7'] });
        const node = allSkills.find((s) => s.id === 'sdk-posthog-node-v5');
        expect(node.match).toEqual({ sdkNode: ['4', '5'] });
        const go = allSkills.find((s) => s.id === 'sdk-posthog-go-v1');
        expect(go.match).toEqual({ sdkGo: ['1'] });
        const rust = allSkills.find((s) => s.id === 'sdk-posthog-rust-v0');
        expect(rust.match).toEqual({ sdkRust: ['0'] });

        const outputDir = path.join(dir, 'supported-out');
        for (const skill of [python, go, rust]) {
            await generateSkill({
                skill,
                version: 'test',
                repoRoot: REPO_ROOT,
                configDir: REPO_CONFIG_DIR,
                outputDir,
                skipPatterns,
                commandmentsConfig,
                skillTemplate: skill._template,
                sharedDocs: [],
                fetchDocFn: (url) => Promise.resolve({ content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : '# x\n', title: 'x' }),
            });
        }

        const renderedPy = fs.readFileSync(path.join(outputDir, python.id, 'SKILL.md'), 'utf8');
        expect(renderedPy).toContain('This skill supports majors 3, 4, 5, 6, 7. The bundled reference is written for the newest of them, **7.x.x**;');

        const renderedGo = fs.readFileSync(path.join(outputDir, go.id, 'SKILL.md'), 'utf8');
        expect(renderedGo).toContain('This skill supports major 1. The bundled reference covers the latest **1.x.x** release, and the project already has major 1 installed (older `1.x` minors can still differ from the reference).');
        expect(renderedGo).not.toContain('newest of them');

        const renderedRust = fs.readFileSync(path.join(outputDir, rust.id, 'SKILL.md'), 'utf8');
        expect(renderedRust).toContain('This skill supports 0.x. The bundled reference covers the latest **0.x.x** release, and the project already uses `0.x`');
        expect(renderedRust).not.toContain('major 0');
        expect(renderedRust).not.toContain('newest of them');
        expect(renderedRust).not.toContain('installed major is lower than the reference\'s (0.x.x)');
    });

    it('gates Cargo 0.y wording to sdkRust and renders installedScope across reference_version shapes', async () => {
        const outputDir = path.join(dir, 'note-shapes-out');
        const nonDefaultTemplate = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        const synthetic = [
            {
                id: 'sdk-non-rust-v0',
                _shortId: 'v0',
                _category: 'sdk',
                _group: 'sdk/non-rust',
                display_name: '0.x',
                description: 'Non-Rust 0.x',
                match: { sdkGo: ['0'] },
                docs_urls: ['https://posthog.com/docs/libraries/go.md'],
                type: 'docs-only',
            },
            {
                id: 'sdk-ref-multi',
                _shortId: 'v0',
                _category: 'sdk',
                _group: 'sdk/ref-multi',
                display_name: '1.x',
                reference_version: '2.x',
                description: 'Multi-major with reference_version',
                match: { sdkKmp: ['0', '1'] },
                docs_urls: ['https://posthog.com/docs/libraries/kmp.md'],
                type: 'docs-only',
            },
            {
                id: 'sdk-ref-nonzero',
                _shortId: 'v2',
                _category: 'sdk',
                _group: 'sdk/ref-nonzero',
                display_name: '2.x',
                reference_version: '3.x',
                description: 'Non-zero major with reference_version',
                match: { sdkKmp: ['2'] },
                docs_urls: ['https://posthog.com/docs/libraries/kmp.md'],
                type: 'docs-only',
            },
        ];
        for (const skill of synthetic) {
            await generateSkill({
                skill,
                version: 'test',
                repoRoot: REPO_ROOT,
                configDir: REPO_CONFIG_DIR,
                outputDir,
                skipPatterns,
                commandmentsConfig,
                skillTemplate: nonDefaultTemplate,
                sharedDocs: [],
                fetchDocFn: () => Promise.resolve({ content: '# x\n', title: 'x' }),
            });
        }
        const nonRust = fs.readFileSync(path.join(outputDir, 'sdk-non-rust-v0', 'SKILL.md'), 'utf8');
        expect(nonRust).toContain('the project already uses `0.x` (older `0.x` minors can still differ from the reference).');
        expect(nonRust).not.toContain('Cargo treats');

        const refMulti = fs.readFileSync(path.join(outputDir, 'sdk-ref-multi', 'SKILL.md'), 'utf8');
        expect(refMulti).toContain('targets **2.x** while the project already uses one of majors 0, 1.');

        const refNonZero = fs.readFileSync(path.join(outputDir, 'sdk-ref-nonzero', 'SKILL.md'), 'utf8');
        expect(refNonZero).toContain('targets **3.x** while the project already uses major 2.');
    });

    const API_NOTES_FACTS = [
        ['sdk-posthog-python-v7', ['PosthogFlaskIntegration', '7.69.0', '5.4', '6.0.0', 'early 3.x', '`from posthog import new_context, identify_context`']],
        ['sdk-posthog-python-v8', ['PosthogFlaskIntegration', '`identify()` does not exist']],
        ['sdk-posthog-node-v5', ['5.2.1', '`withContext`', 'captureException(err, distinctId, additionalProperties)']],
        ['sdk-posthog-node-v6', ['captureException(err, { distinctId, properties })']],
        ['sdk-posthog-go-v1', ['`github.com/posthog/posthog-go/otel`', '`github.com/posthog/posthog-go/posthogmcpsdk`']],
        ['sdk-posthog-go-v2', ['`github.com/posthog/posthog-go/v2`', '`github.com/posthog/posthog-go/otel/v2`']],
        ['sdk-posthog-rust-v0', ['`posthog-rs`', '`tls`', '`client.capture(event).await`']],
        ['sdk-posthog-rust-v1', ['`cargo add posthog@1`', '`use posthog::...`', '`tls`']],
        ['sdk-posthog-ios-v3', ["pod 'PostHog'", 'Xcode 26', '`capture(...)`']],
        ['sdk-posthog-ios-v4', ['Swift Package Manager only', 'Xcode 26']],
        ['sdk-posthog-android-v3', ['com.posthog:posthog-android', 'PostHogAndroidConfig(apiKey = ...)']],
        ['sdk-posthog-android-v4', ['com.posthog:posthog-android:4.+', 'getFeatureFlagResult']],
        ['sdk-posthog-flutter-v5', ['posthog_flutter', 'com.posthog.posthog.API_KEY', 'Flutter 3.41+']],
        ['sdk-posthog-flutter-v6', ['Flutter 3.41.0+', 'com.posthog.posthog.PROJECT_TOKEN']],
        ['sdk-posthog-kmp-v0', ['PostHogConfig(projectToken =', 'CaptureOptions(groups =']],
        ['sdk-posthog-kmp-v1', ['PostHogConfig("<token>") {', 'captureScreenViews']],
    ];

    it('covers every disk-loaded sdk variant in API_NOTES_FACTS', () => {
        const diskSdkIds = allSkills.filter((s) => s._category === 'sdk').map((s) => s.id).sort();
        expect(API_NOTES_FACTS.map(([id]) => id).sort()).toEqual(diskSdkIds);
    });

    it.each(API_NOTES_FACTS)('%s ships its version facts in references/<variant>/api-notes.md', async (skillId, facts) => {
        const skill = allSkills.find((s) => s.id === skillId);
        const outputDir = path.join(dir, 'api-notes-out');
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: REPO_ROOT,
            configDir: REPO_CONFIG_DIR,
            outputDir,
            skipPatterns,
            commandmentsConfig,
            skillTemplate: skill._template,
            sharedDocs: [],
            fetchDocFn: (url) => Promise.resolve({ content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : '# x\n', title: 'x' }),
        });
        const file = path.join(outputDir, skill.id, 'references', skill._shortId, 'api-notes.md');
        const text = fs.readFileSync(file, 'utf8');
        for (const fact of facts) expect(text).toContain(fact);
        const rendered = fs.readFileSync(path.join(outputDir, skill.id, 'SKILL.md'), 'utf8');
        expect(rendered).toContain(`references/${skill._shortId}/api-notes.md`);
        expect(rendered).toContain('`api-notes.md`');
    });
});
