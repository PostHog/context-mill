/**
 * Doc Fetcher
 *
 * Fetches PostHog docs `.md` pages for the skill build, with an on-disk cache,
 * retries, and recovery when a page moves.
 *
 * Split out of skill-generator.js so `check-links.js` can reuse the redirect
 * resolution without loading the YAML/template machinery.
 *
 * ## Why the recovery path exists
 *
 * posthog.com serves each docs page twice: the HTML route, and a `.md` sibling
 * generated at build time from the built HTML. They are separate files, and
 * redirects in vercel.json are matched against literal paths — so a redirect
 * written for `/docs/a/b` does not match `/docs/a/b.md`. When a page moves, the
 * HTML redirects and the `.md` 404s, which used to fail the whole build.
 *
 * Splat-style redirects (`/docs/x/:path*`) do match the `.md` form, so some
 * moves are followed silently by `fetch`'s default `redirect: 'follow'`. Those
 * are recorded in the redirect report rather than warned about individually, so
 * configs can be repointed instead of drifting indefinitely.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// On-disk doc cache. posthog.com serves the .md docs slowly and drops
// connections under the build's ~50-fetch burst, which used to kill the
// whole build (and the dev server with it) on a single transient failure.
// Entries live for DOCS_CACHE_TTL_MS (default 24h, 0 disables); an expired
// entry is still kept as a stale fallback when every retry fails.
const DOC_CACHE_DIR = process.env.DOCS_CACHE_DIR
    ?? path.join(import.meta.dirname, '..', '..', '.docs-cache');
const DOC_CACHE_TTL_MS = process.env.DOCS_CACHE_TTL_MS !== undefined
    ? Number(process.env.DOCS_CACHE_TTL_MS)
    : 24 * 60 * 60 * 1000;
const FETCH_RETRIES = 3;
const FETCH_BACKOFF_MS = [1_000, 4_000];

// Bumped when the cache entry shape changes; older entries are ignored.
const CACHE_VERSION = 2;

const RECOVERABLE_HOSTS = new Set(['posthog.com', 'www.posthog.com']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Convert a string to sentence case, preserving proper nouns
 */
function toSentenceCase(str) {
    if (!str) return str;

    // Proper nouns to preserve
    const properNouns = [
        'PostHog', 'Next.js', 'React', 'JavaScript', 'TypeScript',
        'Node.js', 'API', 'SDK', 'SSR', 'SPA', 'URL', 'HTML', 'CSS',
    ];

    // Lowercase everything first
    let result = str.toLowerCase();

    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // Restore proper nouns
    for (const noun of properNouns) {
        const regex = new RegExp(noun, 'gi');
        result = result.replace(regex, noun);
    }

    return result;
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? toSentenceCase(match[1].trim()) : null;
}

/**
 * Infer a description from URL path
 * e.g., /docs/libraries/next-js → "PostHog integration documentation for Next.js"
 */
function inferDescription(url) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);

        // Remove .md extension from last part
        const lastPart = pathParts[pathParts.length - 1]?.replace('.md', '') || '';

        // Convert kebab-case to readable
        const readable = lastPart.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (pathParts.includes('libraries') || pathParts.includes('docs')) {
            return `PostHog documentation for ${readable}`;
        }

        return `PostHog documentation: ${readable}`;
    } catch (e) {
        return 'PostHog documentation';
    }
}

/**
 * Strip the `.md` suffix to get the HTML route posthog.com redirects are
 * written against. Returns null when the URL is not a `.md` page.
 */
function mdToHtmlUrl(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.pathname.endsWith('.md')) return null;
        parsed.pathname = parsed.pathname.slice(0, -3);
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Append `.md` to an HTML route. Returns null when it already has one.
 */
function htmlToMdUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('.md')) return null;
        // Trailing slashes come back from some redirect targets; the generated
        // markdown file has no slash before its extension.
        parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}.md`;
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Recovery only makes sense for posthog.com, where the `.md` files are
 * generated siblings of HTML pages. A `.md` on any other host (a GitHub raw
 * README, say) has no extensionless twin, so probing would just waste a
 * request on a 404 page.
 */
function isRecoverableHost(url) {
    try {
        return RECOVERABLE_HOSTS.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

// Redirects observed during this process, so the build can report which
// configured URLs have drifted from where the docs actually live.
let redirectReport = [];

function recordRedirect(entry) {
    if (entry.requested === entry.final) return;
    if (redirectReport.some((r) => r.requested === entry.requested)) return;
    redirectReport.push(entry);
}

function getRedirectReport() {
    return [...redirectReport];
}

function resetRedirectReport() {
    redirectReport = [];
}

function docCachePath(url) {
    const key = crypto.createHash('sha256').update(url).digest('hex');
    return path.join(DOC_CACHE_DIR, `${key}.json`);
}

function readDocCache(url) {
    if (DOC_CACHE_TTL_MS <= 0) return null;
    try {
        const entry = JSON.parse(fs.readFileSync(docCachePath(url), 'utf8'));
        if (entry?.v !== CACHE_VERSION) return null;
        if (entry?.url !== url || typeof entry?.content !== 'string') return null;
        return { ...entry, fresh: Date.now() - entry.fetchedAt < DOC_CACHE_TTL_MS };
    } catch {
        return null;
    }
}

function writeDocCache(url, { content, title, finalUrl, via }) {
    if (DOC_CACHE_TTL_MS <= 0) return;
    try {
        fs.mkdirSync(DOC_CACHE_DIR, { recursive: true });
        fs.writeFileSync(docCachePath(url), JSON.stringify({
            v: CACHE_VERSION,
            url,
            title,
            content,
            finalUrl: finalUrl ?? url,
            via: via ?? 'direct',
            fetchedAt: Date.now(),
        }));
    } catch {
        // Cache writes are best-effort; the fetch result is still returned.
    }
}

/**
 * A `.md` URL that returns an HTML page means posthog.com served a soft 404 (or
 * an error shell) with a 200. Writing that into references/<name>.md would ship
 * a full HTML document inside the skill ZIP, silently — so treat it as a hard
 * failure rather than content.
 */
function assertMarkdown(url, contentType, content) {
    if (!url.endsWith('.md')) return;
    const looksHtml = /^\s*(<!doctype html|<html)/i.test(content)
        || (contentType ?? '').toLowerCase().startsWith('text/html');
    if (!looksHtml) return;
    const error = new Error(`Expected markdown from ${url} but got HTML — the page has probably moved or was deleted`);
    error.retryable = false;
    throw error;
}

/**
 * Walk a redirect chain by hand, reading `Location` headers.
 *
 * Node exposes `Location` under `redirect: 'manual'` (browsers do not), which
 * is what lets us discover where a moved page went instead of just landing on
 * it. Response bodies are cancelled on every hop — undici holds the socket open
 * otherwise, and the build issues these in bursts.
 */
async function resolveRedirect(url, { maxHops = 5, method = 'HEAD', fetchImpl } = {}) {
    const doFetch = fetchImpl ?? globalThis.fetch;
    const hops = [];
    const seen = new Set([url]);
    let current = url;

    for (let hop = 0; hop <= maxHops; hop++) {
        let response = await doFetch(current, { method, redirect: 'manual' });
        // Some CDNs reject HEAD outright; fall back to GET for this hop.
        if (response.status === 405 && method === 'HEAD') {
            response.body?.cancel?.();
            response = await doFetch(current, { method: 'GET', redirect: 'manual' });
        }
        response.body?.cancel?.();

        if (!REDIRECT_STATUSES.has(response.status)) {
            return { finalUrl: current, status: response.status, hops };
        }

        const location = response.headers?.get?.('location');
        if (!location) {
            return { finalUrl: current, status: response.status, hops };
        }

        const next = new URL(location, current).toString();
        hops.push({ from: current, to: next, status: response.status });

        if (seen.has(next)) {
            throw new Error(`Redirect loop resolving ${url} (revisited ${next})`);
        }
        seen.add(next);
        current = next;
    }

    throw new Error(`Too many redirects resolving ${url} (over ${maxHops} hops)`);
}

/**
 * Given a `.md` URL that 404s, ask its HTML sibling where the page went and
 * translate the answer back into a `.md` URL.
 *
 * Returns null when there is nothing to recover — the page is genuinely gone,
 * the host has no HTML twin, or the redirect points back at the original.
 */
async function recoverMdUrl(url, { fetchImpl } = {}) {
    if (!isRecoverableHost(url)) return null;
    const htmlUrl = mdToHtmlUrl(url);
    if (!htmlUrl) return null;

    const { finalUrl, hops } = await resolveRedirect(htmlUrl, { fetchImpl });
    if (finalUrl === htmlUrl) return null;

    const candidate = htmlToMdUrl(finalUrl);
    if (!candidate || candidate === url) return null;

    return { candidate, hops };
}

async function readDoc(response, url) {
    const content = await response.text();
    assertMarkdown(url, response.headers?.get?.('content-type'), content);
    return { content, title: extractTitle(content) || inferDescription(url) };
}

async function fetchDocOnce(url, { fetchImpl } = {}) {
    const doFetch = fetchImpl ?? globalThis.fetch;
    const response = await doFetch(url);

    if (response.ok) {
        const doc = await readDoc(response, url);
        const finalUrl = response.url || url;
        if (finalUrl !== url) {
            recordRedirect({ requested: url, final: finalUrl, via: 'redirect' });
        }
        return { ...doc, requestedUrl: url, finalUrl, via: finalUrl === url ? 'direct' : 'redirect' };
    }

    if (response.status !== 404) {
        const error = new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
        // Deterministic client errors won't change on retry.
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
    }

    // A 404 on a .md may just mean the page moved and only the HTML route got a
    // redirect. Ask the HTML sibling before giving up.
    let recovery = null;
    try {
        recovery = await recoverMdUrl(url, { fetchImpl });
    } catch (probeError) {
        // A network blip while probing shouldn't permanently convert a
        // recoverable move into a hard build failure — let the retry loop try
        // the whole recovery again.
        const error = new Error(`Failed to fetch ${url}: HTTP 404; probing for a redirect failed: ${probeError.message}`);
        error.retryable = true;
        throw error;
    }

    if (recovery) {
        const recovered = await doFetch(recovery.candidate);
        if (recovered.ok) {
            const doc = await readDoc(recovered, recovery.candidate);
            recordRedirect({ requested: url, final: recovery.candidate, via: 'md-recovery' });
            console.warn(`    WARN: doc moved, update this URL in config: ${url} → ${recovery.candidate}`);
            return {
                ...doc,
                requestedUrl: url,
                finalUrl: recovery.candidate,
                via: 'md-recovery',
            };
        }
        recovered.body?.cancel?.();
    }

    const detail = recovery
        ? `; its HTML route redirects, but ${recovery.candidate} is not available either`
        : '';
    const error = new Error(`Failed to fetch ${url}: HTTP 404 ${response.statusText}${detail}`);
    error.retryable = false;
    throw error;
}

/**
 * Fetch markdown content from a URL, with an on-disk cache and retries.
 * Returns both content and inferred metadata. Logs `Fetching doc:` only
 * on a real network fetch — cache hits are silent.
 */
async function fetchDoc(url, { fetchImpl, backoff = FETCH_BACKOFF_MS } = {}) {
    const cached = readDocCache(url);
    if (cached?.fresh) {
        // Re-record on every hit, otherwise a URL that drifted would only be
        // reported on the one build per day that missed the cache.
        if (cached.finalUrl && cached.finalUrl !== url) {
            recordRedirect({ requested: url, final: cached.finalUrl, via: cached.via ?? 'redirect' });
        }
        return { content: cached.content, title: cached.title, url, finalUrl: cached.finalUrl ?? url, via: cached.via ?? 'direct' };
    }

    console.log(`  Fetching doc: ${url}`);
    let lastError;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
        try {
            const result = await fetchDocOnce(url, { fetchImpl });
            writeDocCache(url, result);
            return { ...result, url };
        } catch (error) {
            lastError = error;
            // Network-level failures (undici "fetch failed") have no
            // `retryable` flag — treat them as retryable.
            if (error.retryable === false || attempt === FETCH_RETRIES) break;
            const delay = backoff[attempt - 1] ?? backoff.at(-1) ?? 0;
            console.log(`    retrying in ${delay / 1000}s (${error.message ?? error})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    if (cached) {
        const ageMinutes = Math.round((Date.now() - cached.fetchedAt) / 60_000);
        console.warn(`    WARN: using stale cached copy (${ageMinutes}m old) after fetch failure: ${url}`);
        return { content: cached.content, title: cached.title, url, finalUrl: cached.finalUrl ?? url, via: cached.via ?? 'direct' };
    }
    throw lastError;
}

export {
    fetchDoc,
    fetchDocOnce,
    resolveRedirect,
    recoverMdUrl,
    mdToHtmlUrl,
    htmlToMdUrl,
    isRecoverableHost,
    getRedirectReport,
    resetRedirectReport,
    extractTitle,
    inferDescription,
    toSentenceCase,
};
