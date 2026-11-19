import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    it('throws when {migration_checklist} is used without a migration.md doc_url', async () => {
        const bad = {
            ...sdkGroup,
            variants: [{ ...sdkGroup.variants[0], docs_urls: ['https://posthog.com/docs/libraries/python/7.x.x.md'] }],
        };
        const [skill] = expandSkillGroups({ 'sdk/posthog-python': bad }, dir);
        await expect(
            generateSkill({
                skill,
                version: 'test',
                repoRoot: dir,
                configDir: dir,
                outputDir: path.join(dir, 'out'),
                skipPatterns: { global: [], examples: {} },
                commandmentsConfig: { commandments: {} },
                skillTemplate: skill._template,
                sharedDocs: [],
                fetchDocFn: () => Promise.resolve({ content: '# 7.x.x\n', title: '7.x.x' }),
            }),
        ).rejects.toThrow(/migration\.md/);
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
});

function assertTagRules(text, tag) {
    switch (tag) {
        case 'sdk-python-7':
            expect(text).toContain('posthog>=3,<8');
            expect(text).toContain('never upgrade to `8.x`');
            expect(text).toContain('posthog>=7.62.0,<8');
            expect(text).toContain('posthog.mcp');
            expect(text).toContain('posthog>=7.69.0,<8');
            expect(text).toContain('PosthogFlaskIntegration');
            expect(text).toContain('capture_exception(...)');
            expect(text).toContain('`0.1.x` supports Python `7.x` (`<8.0.0`)');
            expect(text).toContain('`0.2.x` supports `>=7.0.0,<9.0.0`');
            expect(text).toContain('Client.capture_ai()');
            expect(text).toContain('posthog.capture_ai()');
            expect(text).toContain('900 KiB');
            expect(text).toContain('references/7.x.x.md');
            expect(text).toContain('Client(api_key, host=...)');
            expect(text).toContain('Supported Python range: `posthog>=3,<8`. Reuse existing client initialization, stay on the installed major and never upgrade to `8.x`.');
            expect(text).toContain('MCP analytics (`posthog.mcp`): requires `posthog>=7.62.0,<8`. If the installed major is below 7, keep it and hand off naming `>=7.62.0`; if on 7.x range-bounded below 7.62.0, raise floor to `>=7.62.0,<8`; if hard-pinned below 7.62.0, keep pin and hand off naming `>=7.62.0`');
            expect(text).toContain('Framework exception middleware (`PosthogFlaskIntegration`, `PosthogASGIMiddleware`, `posthog.integrations.drf`): requires `posthog>=7.69.0,<8`. If the installed major is below 7, keep it and fall back to manual `capture_exception(...)`; if on 7.x range-bounded below 7.69.0, raise floor to `>=7.69.0,<8`; if hard-pinned below 7.69.0, keep pin and fall back to manual `capture_exception(...)`');
            expect(text).toContain('Feature floor — `openfeature-provider-posthog`: `0.1.x` supports');
            expect(text).toContain('exist in recent `7.x` releases. Use them instead of `capture()` for AI events over 900 KiB');
            expect(text).toContain('`capture()` with `$ai_*` or `posthog.ai` works across `7.x`');
            expect(text).toContain('Keep existing `Client(api_key, host=...)` positional/keyword call sites, and check `references/7.x.x.md` and the installed version');
            expect(text).toMatch(/`?Client\.capture_ai\(\)`?\s+and\s+`?posthog\.capture_ai\(\)`?\s+(?:exist|work)[^.\n]*\b7\.x\b/);
            expect(text).toMatch(/`?AsyncPosthog`?\s+lacks\s+`?capture_ai\(\)`?\s+in\s+`?7\.x`?/);
            expect(text).toMatch(/`?capture\(\)`?\s+with\s+`?\$ai_\*`?\s+or\s+`?posthog\.ai`?/);
            expect(text).not.toMatch(/\b8\.x(?:-only)?\s+`?capture_ai\(\)`?|inventing\s+8\.x|capture_ai\(\)[^.\n]*(?:only\s+in|added\s+in)\s+8\.x/i);
            break;
        case 'sdk-python-8':
            expect(text).toContain('posthog>=8,<9');
            expect(text).toContain('Default Python 8.x range: `posthog>=8,<9` (or exact pin shown in `references/8.x.x.md`)');
            expect(text).toContain('Constructor & options: use keyword arguments after `host` (`Client`/`AsyncPosthog`), event options rather than');
            expect(text).toContain('and `openfeature-provider-posthog>=0.2.0` when using OpenFeature');
            expect(text).toContain('AI events: use `capture_ai()` for `$ai_*` events when instrumenting 8.x manually (`references/8.x.x.md`)');
            expect(text).toContain('Framework integrations (`PosthogFlaskIntegration`, `PosthogASGIMiddleware`, `posthog.integrations.drf`, `posthog.mcp`) are all included in `8.x`');
            expect(text).toContain('references/8.x.x.md');
            expect(text).toContain('openfeature-provider-posthog>=0.2.0');
            expect(text).not.toContain('openfeature-provider-posthog>=0.2.1');
            expect(text).not.toContain('0.2.1');
            expect(text).toContain('capture_ai()');
            expect(text).toContain('use keyword arguments after `host`');
            expect(text).toContain('event options rather than `$process_person_profile` properties');
            expect(text).toContain('PosthogFlaskIntegration');
            expect(text).toContain('posthog.mcp');
            break;
        case 'sdk-node-5':
            expect(text).toContain('posthog-node@^5');
            expect(text).toContain('<6.0.0');
            expect(text).toContain('never upgrade to `6.x`');
            expect(text).toContain('positional `client.captureException(error, distinctId, additionalProperties)`');
            expect(text).toContain('captureExceptionImmediate(error, distinctId, additionalProperties)');
            expect(text).toContain('never pass an options object `{ distinctId }` as the second argument');
            expect(text.replace('never pass an options object `{ distinctId }` as the second argument', '')).not.toMatch(/\{\s*distinctId\b/);
            expect(text).not.toContain('TypeScript requires the options object form');
            expect(text).not.toMatch(/captureException\(err,\s*distinctId\)[^.\n]*fails/i);
            expect(text).toContain('@posthog/mcp@^1.3.0');
            expect(text).toContain('>=0.18.0');
            expect(text).toContain('Supported Node.js range: `posthog-node` 4.x or 5.x (`>=4.0.0 <6.0.0`). Stay on the installed major, reuse existing `new PostHog(...)`, and never upgrade to `6.x`.');
            expect(text).toContain('Exception capture signature: on 5.x, call positional `client.captureException(error, distinctId, additionalProperties)`');
            expect(text).toContain('(it fails TypeScript on 5.x or sends the object as `distinctId`)');
            expect(text).toContain('both `@posthog/mcp@^1.3.0` (floor `>=0.18.0`) and `@posthog/ai@^8.21.0` declare `peerDependencies: { "posthog-node": "^5.0.0 || ^6.0.0" }`');
            expect(text).toContain('work cleanly with `posthog-node@^5` without crossing majors; on `4.x` do not install them, and report `posthog-node@^5` as their minimum.');
            expect(text).toContain('`@posthog/convex`, `@posthog/next`, and `@posthog/nuxt` also target 5.x');
            expect(text).toContain('@posthog/ai@^8.21.0');
            break;
        case 'sdk-node-6':
            expect(text).toContain('posthog-node@^6');
            expect(text).toContain('Default Node.js 6.x range: `posthog-node@^6`');
            expect(text).toContain('client.captureException(error, { distinctId, properties, ... })');
            expect(text).toContain('Exception capture signature: on 6.x, TypeScript requires the options object form `client.captureException(error, { distinctId, properties, ... })` (`captureException(err, distinctId)` positional fails TS compilation on 6.x)');
            expect(text).toContain('`@posthog/mcp@^1.3.0` and `@posthog/ai@^8.21.0` both support `posthog-node@^6` (`^5.0.0 || ^6.0.0`)');
            expect(text).toContain('Event options & AI lane: use event options (`process_person_profile`, etc.) and `captureAi()` / `captureAiImmediate()` for `$ai_*` events per `references/6.x.x.md`');
            expect(text).toContain('@posthog/mcp@^1.3.0');
            expect(text).toContain('process_person_profile');
            expect(text).not.toContain('processPersonProfile');
            expect(text).toContain('captureAi()');
            expect(text).toContain('captureAiImmediate()');
            expect(text).toContain('@posthog/ai@^8.21.0');
            expect(text).toContain('references/6.x.x.md');
            break;
        case 'sdk-go-1':
            expect(text).toContain('github.com/posthog/posthog-go');
            expect(text).toContain('< v2.0.0');
            expect(text).toContain('Stay on `v1`');
            expect(text).toContain('Supported Go 1.x module: `github.com/posthog/posthog-go` (`< v2.0.0`). Stay on `v1`, reuse existing `posthog.NewWithConfig(...)`, and keep `import');
            expect(text).toContain('Feature floor — MCP analytics (`posthogmcpsdk`): requires `github.com/posthog/posthog-go/posthogmcpsdk >= v1.34.0` (`< v2`)');
            expect(text).toContain('or the 2.x `(Client, error)` return signature on `posthog.New(...)` when staying on `v1`');
            expect(text).toContain('import "github.com/posthog/posthog-go"');
            expect(text).toContain('posthogmcpsdk');
            expect(text).toContain('v1.34.0');
            expect(text).toContain('github.com/posthog/posthog-go/posthogmcpsdk >= v1.34.0');
            expect(text).toContain('Do NOT use `v2` module paths (`/v2`, `/posthogmcpsdk/v2`, `/otel/v2`)');
            expect(
                text.replace('Do NOT use `v2` module paths (`/v2`, `/posthogmcpsdk/v2`, `/otel/v2`)', ''),
            ).not.toMatch(/\/v2\b/);
            expect(text).not.toContain('github.com/posthog/posthog-go/v2');
            expect(text).not.toContain('github.com/posthog/posthog-go/posthogmcpsdk/v2');
            expect(text).not.toContain('github.com/posthog/posthog-go/otel/v2');
            break;
        case 'sdk-go-2':
            expect(text).toContain('github.com/posthog/posthog-go/v2');
            expect(text).not.toContain('.../posthogmcpsdk/v2');
            expect(text).toContain('github.com/posthog/posthog-go/v2/posthogmcp');
            expect(text).toContain('github.com/posthog/posthog-go/posthogmcpsdk/v2');
            expect(text).toContain('github.com/posthog/posthog-go/posthogmcpgo/v2');
            expect(text).toContain('github.com/posthog/posthog-go/otel/v2');
            expect(text).toContain('`posthog.New(...)` returns `(Client, error)`');
            expect(text).toContain('Default Go 2.x module: `github.com/posthog/posthog-go/v2` (`go get github.com/posthog/posthog-go/v2`)');
            expect(text).toContain('Import `"github.com/posthog/posthog-go/v2"` (package name remains `posthog`)');
            expect(text).toContain('Companion modules move in lockstep on v2:');
            expect(text).toContain('`posthog.New(...)` returns `(Client, error)` in 2.x — always check `err`');
            break;
        case 'sdk-rust-0':
            expect(text).toContain('posthog-rs');
            expect(text).toContain('< 1.0.0');
            expect(text).toContain('Import `posthog_rs` and stay on `0.x`');
            expect(text).toContain('Supported Rust 0.x crate: `posthog-rs` (`< 1.0.0`)');
            expect(text).toContain('`0.x` enables TLS by default');
            expect(text).toContain('MCP analytics (`posthog_rs::mcp`): requires `posthog-rs >= 0.29.0, < 1.0.0` with `--features mcp` (and `rmcp >= 3.7`)');
            expect(text).toContain('NO `tls` Cargo feature — do NOT pass `--features tls` on `0.x`');
            expect(text.replace('do NOT pass `--features tls`', '')).not.toMatch(/--features\b[^`\n]*\btls\b/i);
            expect(text).toContain('posthog_rs::mcp');
            expect(text).toContain('0.29.0');
            expect(text).toContain('posthog-rs >= 0.29.0, < 1.0.0');
            expect(text).toContain('--features mcp');
            expect(text).not.toContain('cargo add posthog@1');
            expect(text).not.toContain('use posthog::');
            break;
        case 'sdk-rust-1':
            expect(text).not.toContain('`import posthog`');
            expect(text).toContain('cargo add posthog@1');
            expect(text).toContain('use posthog::...');
            expect(text).toContain('use posthog_rs::...');
            expect(text).toMatch(/using `--no-default-features` MUST include `--features tls` to send over HTTPS/);
            expect(text).not.toMatch(/MUST NOT include `--features tls`/);
            expect(text).toContain('Default Rust 1.x crate: `posthog = "1"` (`cargo add posthog@1`, `use posthog::...`)');
            expect(text).toContain('When keeping existing `posthog-rs = "1"` (which forwards to `posthog` 1.x), keep `use posthog_rs::...` unless `Cargo.toml` depends directly on `posthog`');
            expect(text).toContain('TLS & async features: on `1.x`, sync/blocking clients using `--no-default-features` MUST include `--features tls` to send over HTTPS (`capture-v1` feature is gone in `1.x`)');
            expect(text).toContain('`posthog::mcp` (or `posthog_rs::mcp` when keeping `posthog-rs = "1"`) is enabled via `--features mcp`');
            expect(text).toContain('use `capture_ai*` for `$ai_*` events and `Event::insert_option` for event options per `references/1.x.x.md`');
            expect(text).toContain('`capture_ai*` for `$ai_*` events');
            expect(text).toContain('`Event::insert_option` for event options');
            expect(text).toContain('posthog::mcp');
            expect(text).toContain('posthog_rs::mcp');
            expect(text).toContain('references/1.x.x.md');
            break;
        case 'python':
            expect(text).toContain('Install dependencies with `pip install posthog` or `pip install -r requirements.txt`, keeping the installed SDK major on existing PostHog setups or using the default docs pin on new setups, and do NOT use unquoted version specifiers like `>=` directly in shell commands. To keep a range, write it into `requirements.txt` and run `pip install -r requirements.txt`');
            expect(text).toContain('PosthogFlaskIntegration (posthog.integrations.flask), PosthogASGIMiddleware (posthog.integrations.asgi), and the Django REST Framework exception handler (posthog.integrations.drf) need posthog 7.69.0 or later - when adding one to an existing 7.x setup, require >=7.69.0,<8 (or keep a hard pin and use manual capture_exception); on new installs follow the default major docs pin');
            expect(text).not.toContain('at the version the Python SDK docs pin');
            expect(text).not.toContain('when you add one, require at least that version');
            break;
        case 'javascript_node':
            expect(text).toContain('Add posthog.captureException(...) in the application\'s error handler (e.g., Express error middleware, Fastify setErrorHandler, Koa app.on(\'error\')), matching the active posthog-node major (options form `(err, { distinctId, properties })` in 6.x; positional `(err, distinctId, additionalProperties)` in 5.x)');
            break;
        case 'go':
            expect(text).toContain('posthog-go is the Go SDK package; use `github.com/posthog/posthog-go/v2` (2.x) for new installs and stay on `github.com/posthog/posthog-go` (1.x) when already installed');
            expect(text).not.toContain('install it with `go get github.com/posthog/posthog-go`');
            break;
        case 'rust':
            expect(text).not.toContain('`import posthog`');
            expect(text).not.toContain('add it with `cargo add posthog-rs`');
            expect(text).toContain('cargo add posthog@1');
            expect(text).toContain('use posthog::...');
            expect(text).toContain('use posthog_rs::...');
            expect(text).toContain('On new Rust setups use the `posthog` 1.x crate (`cargo add posthog@1` and `use posthog::...`); when `posthog-rs` (`0.x` or `1.x` forwarding) is already installed, keep `posthog-rs` (`use posthog_rs::...`) and reuse its existing client');
            break;
        default:
            throw new Error(`Unhandled tag assertion: ${tag}`);
    }
}

describe('checked-in context/skills/sdk configs and commandments', () => {
    const config = loadSkillsConfig(REPO_CONFIG_DIR);
    const allSkills = expandSkillGroups(config, REPO_CONFIG_DIR);
    const commandmentsConfig = loadCommandments(REPO_CONFIG_DIR);
    const { commandments } = commandmentsConfig;
    const skipPatterns = loadSkipPatterns(path.join(REPO_CONFIG_DIR, 'skip-patterns.yaml'));

    it.each([
        [
            'sdk/posthog-python',
            'sdkPython',
            '/docs/libraries/python/',
            [
                { shortId: 'v7', major: '7', supported: ['3', '4', '5', '6', '7'], tag: 'sdk-python-7', isDefault: false },
                { shortId: 'v8', major: '8', supported: ['8'], tag: 'sdk-python-8', isDefault: true },
            ],
        ],
        [
            'sdk/posthog-node',
            'sdkNode',
            '/docs/libraries/node/',
            [
                { shortId: 'v5', major: '5', supported: ['4', '5'], tag: 'sdk-node-5', isDefault: false },
                { shortId: 'v6', major: '6', supported: ['6'], tag: 'sdk-node-6', isDefault: true },
            ],
        ],
        [
            'sdk/posthog-go',
            'sdkGo',
            '/docs/libraries/go/',
            [
                { shortId: 'v1', major: '1', tag: 'sdk-go-1', supported: ['1'], isDefault: false },
                { shortId: 'v2', major: '2', tag: 'sdk-go-2', supported: ['2'], isDefault: true },
            ],
        ],
        [
            'sdk/posthog-rust',
            'sdkRust',
            '/docs/libraries/rust/',
            [
                { shortId: 'v0', major: '0', supported: ['0'], tag: 'sdk-rust-0', isDefault: false },
                { shortId: 'v1', major: '1', tag: 'sdk-rust-1', supported: ['1'], isDefault: true },
            ],
        ],
    ])('%s defines exact majors with tags, one default, docs_urls, and rendered SKILL.md output', async (groupKey, matchKey, docsPathPrefix, expectedVariants) => {
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
            expect(s.tags).toContain(spec.tag);
            expect(s.id).not.toMatch(/\b(old|new|prev|current)\b/);

            const expectedDocs = spec.isDefault
                ? [`${expectedDocsOriginPrefix}${spec.major}.x.x.md`]
                : [`${expectedDocsOriginPrefix}${spec.major}.x.x.md`, `${expectedDocsOriginPrefix}migration.md`];
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
            assertTagRules(commandments[spec.tag].join('\n'), spec.tag);
            assertTagRules(rendered, spec.tag);
            expect(rendered).toContain(`- \`references/${spec.major}.x.x.md\``);
            if (!spec.isDefault) {
                expect(rendered).toContain('- `references/migration.md`');
                expect(rendered).toContain('- You use openfeature-provider-posthog below 0.2.0');
            } else {
                expect(rendered).not.toContain('references/migration.md');
            }
            expect(rendered).not.toMatch(/\{(display_name|supported_versions|references|commandments|migration_checklist)\}/);
            if (!spec.isDefault) {
                const label = spec.supported.length === 1 ? 'major' : 'majors';
                expect(rendered).toContain(`This skill supports ${label} ${spec.supported.join(', ')}.`);
                expect(rendered).toContain(`The bundled reference is written for the newest of them, **${spec.major}.x.x**.`);
            }
        }
    });

    it.each([
        ['integration-python', 'python'],
        ['integration-javascript_node', 'javascript_node'],
        ['integration-go', 'go'],
        ['integration-rust', 'rust'],
    ])('%s renders %s major-preservation commandments into SKILL.md', async (skillId, tag) => {
        const skill = allSkills.find((s) => s.id === skillId);
        expect(skill).toBeDefined();
        expect(skill.tags).toContain(tag);

        const outputDir = path.join(dir, 'checked-in-integration-out');
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: REPO_ROOT,
            configDir: REPO_CONFIG_DIR,
            outputDir,
            skipPatterns,
            commandmentsConfig,
            skillTemplate: skill._template,
            sharedDocs: skill._sharedDocs || [],
            fetchDocFn: (url) => Promise.resolve({
                content: `# ${path.basename(url)}\n`,
                title: path.basename(url),
            }),
        });

        const rendered = fs.readFileSync(path.join(outputDir, skill.id, 'SKILL.md'), 'utf8');
        assertTagRules(commandments[tag].join('\n'), tag);
        assertTagRules(rendered, tag);
    });

    it('keeps non-default-major.md free of known syntax errors', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        expect(nonDefaultMd).not.toContain('<<M+1>');
        expect(nonDefaultMd).toContain('`<M+1`');
        expect(nonDefaultMd).toContain('`"=X.Y.Z"` in `Cargo.toml`');
    });

    it('states the supported versions and the lower-major rule in non-default-major.md', () => {
        const nonDefaultMd = fs.readFileSync(path.join(REPO_CONFIG_DIR, 'skills', 'sdk', 'non-default-major.md'), 'utf8');
        expect(nonDefaultMd).toContain('This skill supports {supported_versions}. The bundled reference is written for the newest of them, **{display_name}**.');
        expect(nonDefaultMd).toContain('never raise the dependency across a major version');
        expect(nonDefaultMd).toContain('## Projects on a lower major than the reference');
        expect(nonDefaultMd).toContain('signatures can differ');
        expect(nonDefaultMd).toContain('read the installed package\'s own source or types (`site-packages/posthog`, `node_modules/posthog-node`');
        expect(nonDefaultMd).toContain('When a feature\'s minimum version is above the installed major, use the fallback or report the minimum version. Do not upgrade to reach it.');
    });

    it('renders every checked-in older SDK skill with its supported majors and reference version', async () => {
        const python = allSkills.find((s) => s.id === 'sdk-posthog-python-v7');
        expect(python.match).toEqual({ sdkPython: ['3', '4', '5', '6', '7'] });
        const node = allSkills.find((s) => s.id === 'sdk-posthog-node-v5');
        expect(node.match).toEqual({ sdkNode: ['4', '5'] });
        const outputDir = path.join(dir, 'supported-out');
        await generateSkill({
            skill: python,
            version: 'test',
            repoRoot: REPO_ROOT,
            configDir: REPO_CONFIG_DIR,
            outputDir,
            skipPatterns,
            commandmentsConfig,
            skillTemplate: python._template,
            sharedDocs: [],
            fetchDocFn: (url) => Promise.resolve({ content: url.endsWith('migration.md') ? SAMPLE_MIGRATION : '# x\n', title: 'x' }),
        });
        const rendered = fs.readFileSync(path.join(outputDir, python.id, 'SKILL.md'), 'utf8');
        expect(rendered).toContain('This skill supports majors 3, 4, 5, 6, 7. The bundled reference is written for the newest of them, **7.x.x**.');

    });
});
