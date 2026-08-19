import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { mirrorDist, githubBaseUrls } from '../../mirror-dist.js';
import { REPO_URL } from '../constants.js';

const VERSION = '1.46.0';
const GITHUB_BASE = `${REPO_URL}/releases/download/v${VERSION}`;
const MIRROR_BASE = 'https://context-mill.posthog.com/v1.46.0';

let dir;
const distDir = () => path.join(dir, 'dist');
const outDir = () => path.join(dir, 'dist-s3-flat');
const skillsDir = () => path.join(distDir(), 'skills');
const agentsDir = () => path.join(distDir(), 'agents');

const readOut = name => fs.readFileSync(path.join(outDir(), name), 'utf8');
const readOutJson = name => JSON.parse(readOut(name));
const outFiles = () => fs.readdirSync(outDir()).sort();

/** A manifest shaped like generateManifest's output: one skill, one inlined doc. */
const manifest = (base = GITHUB_BASE) => ({
    version: '1.0',
    buildVersion: VERSION,
    resources: [
        {
            id: 'audit-events',
            name: 'Audit events',
            file: 'audit-events.zip',
            downloadUrl: `${base}/audit-events.zip`,
            resource: { mimeType: 'text/plain', text: `${base}/audit-events.zip` },
        },
        {
            id: 'cloudflare-workers',
            name: 'Cloudflare Workers',
            // Docs inline prose here — it may legitimately mention github.com.
            resource: { mimeType: 'text/markdown', text: `See ${REPO_URL}/blob/main/README.md` },
        },
    ],
});

const skillMenu = (base = GITHUB_BASE) => ({
    version: '1.0',
    buildVersion: VERSION,
    categories: {
        audit: [
            { id: 'audit-events', name: 'Audit events', group: 'audit', downloadUrl: `${base}/audit-events.zip` },
            { id: 'integration-v2', name: 'Integration', group: 'integration-v2', bundle: true, downloadUrl: `${base}/integration-v2.json` },
        ],
    },
    cliEntries: [],
});

const agentMenu = (base = GITHUB_BASE) => ({
    version: '1.0',
    buildVersion: VERSION,
    agents: [{ id: 'report', flow: 'integration-v2', downloadUrl: `${base}/agents-integration-v2-report.md` }],
});

function writeDist({ base = GITHUB_BASE } = {}) {
    fs.mkdirSync(skillsDir(), { recursive: true });
    fs.mkdirSync(agentsDir(), { recursive: true });

    fs.writeFileSync(path.join(skillsDir(), 'manifest.json'), JSON.stringify(manifest(base), null, 2));
    fs.writeFileSync(path.join(skillsDir(), 'skill-menu.json'), JSON.stringify(skillMenu(base), null, 2));
    fs.writeFileSync(path.join(skillsDir(), 'audit-events.zip'), 'ZIPBYTES');
    fs.writeFileSync(path.join(skillsDir(), 'integration-v2.json'), JSON.stringify({ id: 'integration-v2', variants: {} }));
    // A release-asset doc whose prose mentions github.com on purpose.
    fs.writeFileSync(
        path.join(skillsDir(), 'cloudflare-workers.md'),
        `Clone it from ${REPO_URL}/releases/download/v1.0.0/thing.zip and go.`,
    );

    fs.writeFileSync(path.join(agentsDir(), 'agent-menu.json'), JSON.stringify(agentMenu(base), null, 2));
    fs.writeFileSync(path.join(agentsDir(), 'agents-integration-v2-report.md'), 'agent prompt');

    // Pushed to the skills / ai-plugin repos, never a release asset.
    fs.mkdirSync(path.join(distDir(), 'marketplace'), { recursive: true });
    fs.writeFileSync(path.join(distDir(), 'marketplace', 'plugin.json'), '{}');
}

const run = () => mirrorDist({ distDir: distDir(), outDir: outDir(), to: MIRROR_BASE, version: VERSION });

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-dist-'));
    writeDist();
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('mirrorDist', () => {
    it('rewrites every download URL in skill-menu.json to the mirror base', async () => {
        await run();

        const entries = readOutJson('skill-menu.json').categories.audit;
        expect(entries.map(e => e.downloadUrl)).toEqual([
            `${MIRROR_BASE}/audit-events.zip`,
            `${MIRROR_BASE}/integration-v2.json`,
        ]);
    });

    it('rewrites agent-menu.json download URLs', async () => {
        await run();

        expect(readOutJson('agent-menu.json').agents[0].downloadUrl).toBe(
            `${MIRROR_BASE}/agents-integration-v2-report.md`,
        );
    });

    it('rewrites the manifest but does not emit it — it is not a release asset', async () => {
        const { manifest: rewritten } = await run();

        expect(rewritten.resources[0].downloadUrl).toBe(`${MIRROR_BASE}/audit-events.zip`);
        expect(rewritten.resources[0].resource.text).toBe(`${MIRROR_BASE}/audit-events.zip`);
        expect(outFiles()).not.toContain('manifest.json');
    });

    it('emits exactly the release asset namespace plus SHA256SUMS', async () => {
        await run();

        expect(outFiles()).toEqual([
            'SHA256SUMS',
            'agent-menu.json',
            'agents-integration-v2-report.md',
            'audit-events.zip',
            'cloudflare-workers.md',
            'integration-v2.json',
            'skill-menu.json',
            'skills-mcp-resources.zip',
        ]);
    });

    it('leaves doc markdown untouched even when it mentions github.com', async () => {
        await run();

        const doc = readOut('cloudflare-workers.md');
        expect(doc).toContain(`${REPO_URL}/releases/download/v1.0.0/thing.zip`);
        expect(doc).toBe(fs.readFileSync(path.join(skillsDir(), 'cloudflare-workers.md'), 'utf8'));
    });

    it('copies skill zips byte-for-byte', async () => {
        await run();

        expect(readOut('audit-events.zip')).toBe('ZIPBYTES');
    });

    it('never mutates dist/', async () => {
        const before = fs.readFileSync(path.join(skillsDir(), 'skill-menu.json'), 'utf8');
        await run();

        expect(fs.readFileSync(path.join(skillsDir(), 'skill-menu.json'), 'utf8')).toBe(before);
        expect(before).toContain(GITHUB_BASE);
    });

    it('skips dist/marketplace/', async () => {
        await run();

        expect(outFiles()).not.toContain('plugin.json');
    });

    it('writes a SHA256SUMS line per emitted file', async () => {
        await run();

        const lines = readOut('SHA256SUMS').trim().split('\n');
        const names = lines.map(l => l.split(/\s+/)[1]).sort();
        expect(names).toEqual(outFiles().filter(n => n !== 'SHA256SUMS'));
        for (const line of lines) expect(line).toMatch(/^[0-9a-f]{64} {2}\S/);
    });

    it('throws when a GitHub release URL survives the rewrite', async () => {
        // A base the rewriter does not know about: a different version's pinned URL.
        const strayBase = `${REPO_URL}/releases/download/v9.9.9`;
        fs.writeFileSync(
            path.join(skillsDir(), 'skill-menu.json'),
            JSON.stringify(skillMenu(strayBase), null, 2),
        );

        await expect(run()).rejects.toThrow(/still points at GitHub/);
    });

    it('throws when a build already used SKILLS_BASE_URL, so nothing was rewritten', async () => {
        // No github.com URL to find, but the URLs point somewhere that is not the
        // mirror — the guard that only greps for github.com would pass this.
        writeDist({ base: 'http://localhost:8080' });

        await expect(run()).rejects.toThrow(/do not point at/);
    });

    it('throws on a basename collision between skills and agents', async () => {
        fs.writeFileSync(path.join(agentsDir(), 'agents-collide.md'), 'agent');
        fs.writeFileSync(path.join(skillsDir(), 'agents-collide.md'), 'doc');

        await expect(run()).rejects.toThrow(/collision/i);
    });

    it('rewrites the latest-download base too, not just the pinned one', async () => {
        writeDist({ base: `${REPO_URL}/releases/latest/download` });
        await run();

        expect(readOutJson('skill-menu.json').categories.audit[0].downloadUrl).toBe(
            `${MIRROR_BASE}/audit-events.zip`,
        );
    });

    it('tolerates a trailing slash on the target base', async () => {
        await mirrorDist({ distDir: distDir(), outDir: outDir(), to: `${MIRROR_BASE}/`, version: VERSION });

        expect(readOutJson('skill-menu.json').categories.audit[0].downloadUrl).toBe(
            `${MIRROR_BASE}/audit-events.zip`,
        );
    });
});

describe('githubBaseUrls', () => {
    it('covers both forms resolveBaseDownloadUrl can emit', () => {
        expect(githubBaseUrls('1.46.0')).toEqual([
            `${REPO_URL}/releases/download/v1.46.0`,
            `${REPO_URL}/releases/latest/download`,
        ]);
    });
});
