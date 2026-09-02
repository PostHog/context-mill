import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyMirror, parseSha256Sums, parseArgs } from '../../verify-mirror.js';
import { REPO_URL } from '../constants.js';

const VERSION = '1.50.0';
const HOST = 'https://context-mill.posthog.com';
const CDN = 'https://d111111abcdef8.cloudfront.net';
const VERSIONED = `${HOST}/v${VERSION}`;

const sha256 = body => crypto.createHash('sha256').update(body).digest('hex');

const skillMenu = (base = VERSIONED, version = VERSION) => ({
    version: '1.0',
    buildVersion: version,
    categories: {
        audit: [{ id: 'audit-events', name: 'Audit events', downloadUrl: `${base}/audit-events.zip` }],
    },
    cliEntries: [],
});

const agentMenu = (base = VERSIONED, version = VERSION) => ({
    version: '1.0',
    buildVersion: version,
    agents: [{ id: 'report', flow: 'integration-v2', downloadUrl: `${base}/agents-report.md` }],
});

/** An in-memory mirror over a fake fetch. `origin` is where requests must arrive. */
function makeMirror({ origin = HOST, menus = {}, overrides = {}, omitFromSums = [] } = {}) {
    const bodies = {
        'skill-menu.json': JSON.stringify(menus.skill ?? skillMenu()),
        'agent-menu.json': JSON.stringify(menus.agent ?? agentMenu()),
        'audit-events.zip': 'ZIPBYTES',
        'agents-report.md': '# report',
    };
    const sums = Object.entries(bodies)
        .filter(([name]) => !omitFromSums.includes(name))
        .map(([name, body]) => `${sha256(body)}  ${name}`)
        .join('\n');

    const routes = { ...bodies, SHA256SUMS: sums + '\n', ...overrides };
    const requested = [];

    const fetchImpl = async (url, options = {}) => {
        requested.push({ url, method: options.method ?? 'GET' });
        const { pathname } = new URL(url);
        if (!url.startsWith(origin)) return response(404, 'wrong origin');

        // /latest is the edge function's job; model it by serving both prefixes.
        const name = pathname.replace(`/v${VERSION}/`, '').replace('/latest/', '');
        const entry = routes[name];
        if (entry === undefined) return response(404, 'not found');
        if (typeof entry === 'object') return response(entry.status, entry.body ?? '');
        return response(200, entry);
    };

    return { fetchImpl, requested };
}

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body,
        arrayBuffer: async () => Buffer.from(body),
    };
}

const run = (options = {}) =>
    verifyMirror({ base: VERSIONED, checksumSample: 10, ...options });

describe('verifyMirror', () => {
    it('passes on a well-formed mirror', async () => {
        const { fetchImpl } = makeMirror();
        const result = await run({ fetchImpl });
        expect(result.failures).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.checked).toBe(4);
    });

    it('probes every object in SHA256SUMS, not just the ones a menu references', async () => {
        const { fetchImpl, requested } = makeMirror();
        await run({ fetchImpl });
        const headed = requested.filter(r => r.method === 'HEAD').map(r => r.url);
        expect(headed).toContain(`${VERSIONED}/skill-menu.json`);
        expect(headed).toContain(`${VERSIONED}/audit-events.zip`);
    });

    it('fails when a download URL still points at GitHub', async () => {
        const { fetchImpl } = makeMirror({
            menus: { skill: skillMenu(`${REPO_URL}/releases/download/v${VERSION}`) },
        });
        const result = await run({ fetchImpl });
        expect(result.ok).toBe(false);
        expect(result.failures.join(' ')).toContain('still point at GitHub');
    });

    it('fails when a menu carries a previous version’s asset URLs', async () => {
        const { fetchImpl } = makeMirror({
            menus: { skill: skillMenu(`${HOST}/v1.49.0`) },
        });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain(`not under ${VERSIONED}/`);
    });

    it('fails when the served version is not the expected one', async () => {
        const { fetchImpl } = makeMirror();
        const result = await run({ fetchImpl, expectVersion: '1.51.0' });
        expect(result.failures).toEqual([
            'expected buildVersion 1.51.0, served menu says 1.50.0',
        ]);
    });

    it('fails when the two menus disagree about the version', async () => {
        const { fetchImpl } = makeMirror({
            menus: { agent: agentMenu(VERSIONED, '1.49.0') },
        });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain('menus disagree on version');
    });

    it('fails when a referenced file is absent from SHA256SUMS', async () => {
        const { fetchImpl } = makeMirror({ omitFromSums: ['audit-events.zip'] });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain('absent from SHA256SUMS');
    });

    it('fails when an object in the inventory is unreachable', async () => {
        const { fetchImpl } = makeMirror({ overrides: { 'audit-events.zip': { status: 404 } } });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain('unreachable');
    });

    it('fails when fetched bytes do not match their checksum', async () => {
        const { fetchImpl } = makeMirror({
            overrides: { 'audit-events.zip': { status: 200, body: 'TAMPERED' } },
        });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain('checksum mismatch for audit-events.zip');
    });

    it('fails loudly when a menu is missing rather than reporting success', async () => {
        const { fetchImpl } = makeMirror({ overrides: { 'agent-menu.json': { status: 404 } } });
        const result = await run({ fetchImpl });
        expect(result.ok).toBe(false);
        expect(result.failures.join(' ')).toContain('agent-menu.json: expected 200, got 404');
    });

    it('fails when a menu is served but is not valid JSON', async () => {
        const { fetchImpl } = makeMirror({
            overrides: { 'skill-menu.json': { status: 200, body: '<html>nope' } },
        });
        const result = await run({ fetchImpl });
        expect(result.failures.join(' ')).toContain('not valid JSON');
    });

    it('accepts a /latest base, whose menu points at the versioned prefix', async () => {
        const { fetchImpl } = makeMirror();
        const result = await run({
            fetchImpl,
            base: `${HOST}/latest`,
            expectVersion: VERSION,
        });
        expect(result.failures).toEqual([]);
        expect(result.buildVersion).toBe(VERSION);
    });

    it('verifies a dry-run prefix, where the prefix and the version differ on purpose', async () => {
        const dryRunBase = `${HOST}/v0.0.0-dryrun-42`;
        const { fetchImpl } = makeMirror({
            menus: { skill: skillMenu(dryRunBase), agent: agentMenu(dryRunBase) },
        });
        // URLs declare the dry-run prefix while the fake serves the versioned one.
        const result = await verifyMirror({
            base: dryRunBase,
            checksumSample: 0,
            fetchImpl: async (url, options) =>
                fetchImpl(url.replace('/v0.0.0-dryrun-42/', `/v${VERSION}/`), options),
        });
        expect(result.failures).toEqual([]);
    });

    it('retries once through a transient 5xx', async () => {
        const { fetchImpl } = makeMirror();
        let failuresLeft = 1;
        const flaky = async (url, options) => {
            if (url.endsWith('audit-events.zip') && failuresLeft-- > 0) return response(503, '');
            return fetchImpl(url, options);
        };
        const result = await run({ fetchImpl: flaky });
        expect(result.failures).toEqual([]);
    });

    it('does not retry a 404, which is a real failure rather than a blip', async () => {
        const { fetchImpl, requested } = makeMirror({
            overrides: { 'audit-events.zip': { status: 404 } },
        });
        await run({ fetchImpl });
        // Scoped to HEAD: the checksum sample refetches, which is not a retry.
        const attempts = requested.filter(
            r => r.url.endsWith('audit-events.zip') && r.method === 'HEAD',
        );
        expect(attempts).toHaveLength(1);
    });

    describe('--expect-host', () => {
        it('checks URLs against the declared host while fetching from another origin', async () => {
            const { fetchImpl, requested } = makeMirror({ origin: CDN });
            const result = await run({
                fetchImpl,
                base: `${CDN}/v${VERSION}`,
                expectHost: 'context-mill.posthog.com',
            });
            expect(result.failures).toEqual([]);
            expect(requested.every(r => r.url.startsWith(CDN))).toBe(true);
        });

        // The action always passes --expect-host, empty once DNS resolves.
        it('treats an empty expect-host as no override', async () => {
            const { fetchImpl } = makeMirror();
            const result = await run({ fetchImpl, expectHost: '' });
            expect(result.failures).toEqual([]);
        });

        it('still rejects a bad rewrite — the host assertion is not relaxed', async () => {
            const { fetchImpl } = makeMirror({ origin: CDN, menus: { skill: skillMenu(`${CDN}/v${VERSION}`) } });
            const result = await run({
                fetchImpl,
                base: `${CDN}/v${VERSION}`,
                expectHost: 'context-mill.posthog.com',
            });
            expect(result.failures.join(' ')).toContain(`not under ${VERSIONED}/`);
        });
    });
});

describe('parseSha256Sums', () => {
    it('reads well-formed lines and ignores anything else', () => {
        const sums = parseSha256Sums(`${'a'.repeat(64)}  one.zip\n\ngarbage\n${'b'.repeat(64)}  two.md\n`);
        expect([...sums.keys()]).toEqual(['one.zip', 'two.md']);
    });
});

describe('parseArgs', () => {
    it('accepts the positional base before or after flags', () => {
        expect(parseArgs(['--expect-version', '1.50.0', VERSIONED]).base).toBe(VERSIONED);
        expect(parseArgs([VERSIONED, '--expect-version', '1.50.0']).expectVersion).toBe('1.50.0');
    });

    it('accepts an empty --expect-host, which the composite action always passes', () => {
        expect(parseArgs([VERSIONED, '--expect-host', '']).expectHost).toBe('');
        expect(parseArgs([VERSIONED, '--expect-host', '']).base).toBe(VERSIONED);
    });

    it('lets --checksum-sample 0 switch off the content check', () => {
        expect(parseArgs([VERSIONED, '--checksum-sample', '0']).checksumSample).toBe(0);
    });

    it('rejects a flag with no value instead of silently consuming the next flag', () => {
        expect(() => parseArgs([VERSIONED, '--expect-version', '--concurrency', '4'])).toThrow(
            /needs a value/,
        );
    });

    it('requires a base', () => {
        expect(() => parseArgs(['--expect-version', '1.50.0'])).toThrow(/usage/);
    });
});
