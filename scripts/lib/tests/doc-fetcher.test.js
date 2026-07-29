import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

// doc-fetcher reads DOCS_CACHE_DIR / DOCS_CACHE_TTL_MS at module load, so the
// module is imported fresh per test with the env already pointed at a temp dir.
// Without this the suite would read and write the real .docs-cache/.
let tmpCache;
let fetcher;

async function loadFetcher({ ttlMs = 60_000 } = {}) {
    process.env.DOCS_CACHE_DIR = tmpCache;
    process.env.DOCS_CACHE_TTL_MS = String(ttlMs);
    vi.resetModules();
    return import('../doc-fetcher.js');
}

/** Minimal stand-in for a fetch Response. */
function res({ status = 200, body = '', headers = {}, url } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: '',
        url,
        headers: new Headers(headers),
        body: { cancel: () => {} },
        text: async () => body,
    };
}

const MD = '# Some doc\n\nBody text.';

/** Route table fake. Values may be a response or a fn(url, opts). */
function fakeFetch(routes) {
    return vi.fn(async (url, opts) => {
        const route = routes[url];
        if (!route) return res({ status: 404, url });
        return typeof route === 'function' ? route(url, opts) : route;
    });
}

function cacheFileFor(url) {
    return join(tmpCache, `${crypto.createHash('sha256').update(url).digest('hex')}.json`);
}

beforeEach(async () => {
    tmpCache = mkdtempSync(join(tmpdir(), 'doc-cache-'));
    fetcher = await loadFetcher();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    rmSync(tmpCache, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.DOCS_CACHE_DIR;
    delete process.env.DOCS_CACHE_TTL_MS;
});

describe('url helpers', () => {
    it('converts between .md and html forms', () => {
        const { mdToHtmlUrl, htmlToMdUrl } = fetcher;
        expect(mdToHtmlUrl('https://posthog.com/docs/a/b.md')).toBe('https://posthog.com/docs/a/b');
        expect(mdToHtmlUrl('https://posthog.com/docs/a/b')).toBeNull();
        expect(htmlToMdUrl('https://posthog.com/docs/a/b')).toBe('https://posthog.com/docs/a/b.md');
        expect(htmlToMdUrl('https://posthog.com/docs/a/b.md')).toBeNull();
    });

    it('appends .md after stripping a trailing slash', () => {
        // Redirect targets often come back with a trailing slash; the generated
        // markdown file has no slash before its extension.
        expect(fetcher.htmlToMdUrl('https://posthog.com/docs/a/b/')).toBe('https://posthog.com/docs/a/b.md');
    });

    it('only treats posthog.com as recoverable', () => {
        const { isRecoverableHost } = fetcher;
        expect(isRecoverableHost('https://posthog.com/docs/a.md')).toBe(true);
        expect(isRecoverableHost('https://www.posthog.com/docs/a.md')).toBe(true);
        expect(isRecoverableHost('https://raw.githubusercontent.com/x/README.md')).toBe(false);
    });
});

describe('fetchDoc — happy path', () => {
    it('returns content and title, and caches under the requested URL', async () => {
        const url = 'https://posthog.com/docs/a.md';
        vi.stubGlobal('fetch', fakeFetch({ [url]: res({ body: MD, url }) }));

        const result = await fetcher.fetchDoc(url);

        expect(result.content).toBe(MD);
        expect(result.title).toBe('Some doc');
        expect(result.via).toBe('direct');
        expect(fetcher.getRedirectReport()).toEqual([]);
        expect(readdirSync(tmpCache)).toHaveLength(1);
        expect(JSON.parse(readFileSync(cacheFileFor(url), 'utf8')).url).toBe(url);
    });

    it('records a silently-followed redirect as drift', async () => {
        // This is the llm-analytics case: fetch follows the 308 itself and the
        // build succeeds, so without this report the config never gets fixed.
        const url = 'https://posthog.com/docs/llm-analytics/basics.md';
        const final = 'https://posthog.com/docs/ai-observability/basics.md';
        vi.stubGlobal('fetch', fakeFetch({ [url]: res({ body: MD, url: final }) }));

        const result = await fetcher.fetchDoc(url);

        expect(result.via).toBe('redirect');
        expect(fetcher.getRedirectReport()).toEqual([
            { requested: url, final, via: 'redirect' },
        ]);
        // Cached under the requested URL, not the resolved one — the lookup
        // side only ever knows what the config says.
        expect(JSON.parse(readFileSync(cacheFileFor(url), 'utf8')).finalUrl).toBe(final);
    });

    it('re-reports drift on a cache hit', async () => {
        const url = 'https://posthog.com/docs/llm-analytics/basics.md';
        const final = 'https://posthog.com/docs/ai-observability/basics.md';
        const fetchMock = fakeFetch({ [url]: res({ body: MD, url: final }) });
        vi.stubGlobal('fetch', fetchMock);

        await fetcher.fetchDoc(url);
        fetcher.resetRedirectReport();
        await fetcher.fetchDoc(url);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetcher.getRedirectReport()).toEqual([
            { requested: url, final, via: 'redirect' },
        ]);
    });
});

describe('fetchDoc — .md 404 recovery', () => {
    it('recovers via the HTML sibling redirect', async () => {
        // The real /docs/logs/debug-logs-mcp.md case.
        const dead = 'https://posthog.com/docs/logs/debug-logs-mcp.md';
        const html = 'https://posthog.com/docs/logs/debug-logs-mcp';
        const movedHtml = 'https://posthog.com/docs/logs/surfaces/mcp';
        const live = 'https://posthog.com/docs/logs/surfaces/mcp.md';

        const fetchMock = fakeFetch({
            [dead]: res({ status: 404, url: dead }),
            [html]: res({ status: 301, headers: { location: movedHtml }, url: html }),
            [movedHtml]: res({ status: 200, url: movedHtml }),
            [live]: res({ body: MD, url: live }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetcher.fetchDoc(dead);

        expect(result.content).toBe(MD);
        expect(result.via).toBe('md-recovery');
        expect(result.finalUrl).toBe(live);
        expect(fetcher.getRedirectReport()).toEqual([
            { requested: dead, final: live, via: 'md-recovery' },
        ]);
        // The probe must not follow redirects itself — reading Location is the
        // whole point.
        const probeCall = fetchMock.mock.calls.find(([u]) => u === html);
        expect(probeCall[1]).toMatchObject({ redirect: 'manual' });
    });

    it('throws naming both URLs when the recovered page is also missing', async () => {
        const dead = 'https://posthog.com/docs/a.md';
        const html = 'https://posthog.com/docs/a';
        const movedHtml = 'https://posthog.com/docs/b';

        vi.stubGlobal('fetch', fakeFetch({
            [dead]: res({ status: 404, url: dead }),
            [html]: res({ status: 301, headers: { location: movedHtml }, url: html }),
            [movedHtml]: res({ status: 200, url: movedHtml }),
            // https://posthog.com/docs/b.md is absent → 404 from the fake
        }));

        await expect(fetcher.fetchDoc(dead)).rejects.toThrow(/docs\/b\.md is not available/);
        expect(readdirSync(tmpCache)).toHaveLength(0);
    });

    it('gives up when the HTML sibling does not redirect', async () => {
        const dead = 'https://posthog.com/docs/gone.md';
        vi.stubGlobal('fetch', fakeFetch({
            [dead]: res({ status: 404, url: dead }),
            'https://posthog.com/docs/gone': res({ status: 404, url: 'https://posthog.com/docs/gone' }),
        }));

        await expect(fetcher.fetchDoc(dead)).rejects.toThrow(/HTTP 404/);
    });

    it('does not probe non-posthog hosts', async () => {
        const url = 'https://raw.githubusercontent.com/PostHog/x/main/README.md';
        const fetchMock = fakeFetch({ [url]: res({ status: 404, url }) });
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetcher.fetchDoc(url)).rejects.toThrow(/HTTP 404/);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries when the probe itself fails at the network level', async () => {
        // One flaky probe must not permanently turn a recoverable move into a
        // hard build failure.
        const dead = 'https://posthog.com/docs/a.md';
        const html = 'https://posthog.com/docs/a';
        let probeAttempts = 0;

        vi.stubGlobal('fetch', fakeFetch({
            [dead]: res({ status: 404, url: dead }),
            [html]: () => {
                probeAttempts++;
                if (probeAttempts === 1) throw new TypeError('fetch failed');
                return res({ status: 301, headers: { location: 'https://posthog.com/docs/c' }, url: html });
            },
            'https://posthog.com/docs/c': res({ status: 200 }),
            'https://posthog.com/docs/c.md': res({ body: MD }),
        }));

        const result = await fetcher.fetchDoc(dead, { backoff: [0, 0] });

        expect(probeAttempts).toBe(2);
        expect(result.via).toBe('md-recovery');
    });
});

describe('resolveRedirect safety', () => {
    it('throws on a redirect cycle', async () => {
        const a = 'https://posthog.com/docs/a';
        const b = 'https://posthog.com/docs/b';
        vi.stubGlobal('fetch', fakeFetch({
            [a]: res({ status: 301, headers: { location: b }, url: a }),
            [b]: res({ status: 301, headers: { location: a }, url: b }),
        }));

        await expect(fetcher.resolveRedirect(a)).rejects.toThrow(/Redirect loop/);
    });

    it('throws when the chain exceeds maxHops', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const n = Number(new URL(url).pathname.split('/').pop());
            return res({ status: 301, headers: { location: `https://posthog.com/docs/${n + 1}` }, url });
        }));

        await expect(
            fetcher.resolveRedirect('https://posthog.com/docs/0', { maxHops: 3 }),
        ).rejects.toThrow(/Too many redirects/);
    });

    it('returns null recovery when the redirect points back at the same doc', async () => {
        const dead = 'https://posthog.com/docs/a.md';
        const html = 'https://posthog.com/docs/a';
        vi.stubGlobal('fetch', fakeFetch({
            [dead]: res({ status: 404, url: dead }),
            // /docs/a → /docs/a/ → back to the same .md candidate
            [html]: res({ status: 301, headers: { location: 'https://posthog.com/docs/a/' }, url: html }),
            'https://posthog.com/docs/a/': res({ status: 200 }),
        }));

        await expect(fetcher.recoverMdUrl(dead)).resolves.toBeNull();
    });
});

describe('content guard', () => {
    it('rejects HTML served from a .md URL and caches nothing', async () => {
        // A soft 404 (200 + HTML shell) would otherwise be written into
        // references/<name>.md and shipped inside the skill ZIP.
        const url = 'https://posthog.com/docs/a.md';
        vi.stubGlobal('fetch', fakeFetch({
            [url]: res({ body: '<!DOCTYPE html><html><body>Not found</body></html>', url }),
        }));

        await expect(fetcher.fetchDoc(url)).rejects.toThrow(/Expected markdown/);
        expect(readdirSync(tmpCache)).toHaveLength(0);
    });

    it('rejects on content-type alone', async () => {
        const url = 'https://posthog.com/docs/a.md';
        vi.stubGlobal('fetch', fakeFetch({
            [url]: res({ body: 'plain text', headers: { 'content-type': 'text/html; charset=utf-8' }, url }),
        }));

        await expect(fetcher.fetchDoc(url)).rejects.toThrow(/Expected markdown/);
    });
});

describe('retries and stale-cache fallback', () => {
    it('retries a 500 and then falls back to an expired cache entry', async () => {
        const url = 'https://posthog.com/docs/a.md';
        // TTL of 1ms means the entry written below is already stale.
        fetcher = await loadFetcher({ ttlMs: 1 });
        writeFileSync(cacheFileFor(url), JSON.stringify({
            v: 2, url, title: 'Cached', content: '# Cached', finalUrl: url, via: 'direct',
            fetchedAt: Date.now() - 60_000,
        }));

        const fetchMock = fakeFetch({ [url]: res({ status: 500, url }) });
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetcher.fetchDoc(url, { backoff: [0, 0] });

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(result.content).toBe('# Cached');
    });

    it('ignores cache entries from an older schema version', async () => {
        const url = 'https://posthog.com/docs/a.md';
        writeFileSync(cacheFileFor(url), JSON.stringify({
            url, title: 'Old', content: '# Old', fetchedAt: Date.now(),
        }));

        vi.stubGlobal('fetch', fakeFetch({ [url]: res({ body: MD, url }) }));
        const result = await fetcher.fetchDoc(url);

        expect(result.content).toBe(MD);
    });
});
