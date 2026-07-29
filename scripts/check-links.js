#!/usr/bin/env node

/**
 * Check Links
 *
 * Validates every PostHog docs URL in the repo against live posthog.com.
 *
 * Two classes of URL, deliberately treated differently:
 *
 * - **Fetched** — `docs_urls` / `shared_docs` in skill configs, and `urls` in
 *   docs.yaml. These are pulled into skill ZIPs at build time, so a dead one is
 *   a broken release. Failures here are blocking.
 * - **Prose** — links in reference markdown and example-app READMEs. Nothing
 *   fetches them, but they are what an agent reading a skill will follow, so a
 *   dead one is still wrong. Reported, not blocking.
 *
 * The fetched set is read through the same expander the build uses, so the two
 * can't drift: `shared_docs` merging (group + variation) and the
 * string-or-{url,title} entry shape are handled in one place, not two.
 *
 * Usage:
 *   node scripts/check-links.js            # report; fail only on dead fetched URLs
 *   node scripts/check-links.js --strict   # also fail on redirects and dead prose links
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadDocsConfig } from './lib/build-phases.js';
import { loadAndExpandSkills } from './lib/skill-generator.js';
import { resolveRedirect, recoverMdUrl } from './lib/doc-fetcher.js';

const CONCURRENCY = 6;

// Directories worth scanning for prose links. example-apps READMEs point users
// at library docs; context/ holds the skill prose agents actually read.
const PROSE_ROOTS = ['context', 'example-apps', 'basics'];
const PROSE_ROOT_FILES = ['README.md', 'CONTRIBUTING.md', 'AGENTS.md'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.docs-cache', '.git']);

const URL_PATTERN = /https:\/\/posthog\.com\/docs[^\s"'`)\]<>]*/g;

/**
 * Collect the URLs the build actually fetches.
 */
function collectFetchedUrls(configDir) {
    const urls = new Map(); // url → Set of sources

    const add = (entry, source) => {
        const url = typeof entry === 'string' ? entry : entry?.url;
        if (!url) return;
        if (!urls.has(url)) urls.set(url, new Set());
        urls.get(url).add(source);
    };

    for (const doc of loadDocsConfig(configDir)) {
        for (const url of doc.urls || []) add(url, `docs.yaml (${doc.id})`);
    }

    const { skills } = loadAndExpandSkills({ configDir });
    for (const skill of skills) {
        for (const entry of skill.docs_urls || []) add(entry, `${skill.id} docs_urls`);
        for (const entry of skill._sharedDocs || []) add(entry, `${skill.id} shared_docs`);
    }

    return urls;
}

function* walkMarkdown(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walkMarkdown(full);
        } else if (entry.name.endsWith('.md')) {
            yield full;
        }
    }
}

/**
 * Pull posthog.com docs URLs out of markdown, skipping fenced code blocks —
 * a URL inside a snippet is illustrative, not a link to validate.
 */
function extractProseUrls(content) {
    const found = [];
    let inFence = false;
    for (const line of content.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        for (const match of line.matchAll(URL_PATTERN)) {
            // Markdown sentences leave punctuation glued to the URL.
            found.push(match[0].replace(/[.,;:!?]+$/, ''));
        }
    }
    return found;
}

function collectProseUrls(repoRoot) {
    const urls = new Map();
    const add = (url, source) => {
        if (!urls.has(url)) urls.set(url, new Set());
        urls.get(url).add(source);
    };

    const files = [
        ...PROSE_ROOTS.flatMap((root) => [...walkMarkdown(path.join(repoRoot, root))]),
        ...PROSE_ROOT_FILES.map((f) => path.join(repoRoot, f)).filter((f) => fs.existsSync(f)),
    ];

    for (const file of files) {
        const rel = path.relative(repoRoot, file);
        for (const url of extractProseUrls(fs.readFileSync(file, 'utf8'))) {
            add(url, rel);
        }
    }
    return urls;
}

/**
 * Classify one URL.
 *
 * MOVED-MD is the interesting verdict: the `.md` is a hard 404, but its HTML
 * sibling redirects and reveals where the page went. That's a build break
 * waiting to happen, and the report names the replacement URL.
 */
async function classify(url) {
    // Fragments aren't part of the path posthog.com routes on.
    const target = url.split('#')[0];
    try {
        const { finalUrl, status } = await resolveRedirect(target);
        if (status === 404) {
            const recovery = await recoverMdUrl(target).catch(() => null);
            if (recovery) return { verdict: 'MOVED-MD', url, suggestion: recovery.candidate };
            return { verdict: 'BROKEN', url };
        }
        if (status >= 400) return { verdict: 'BROKEN', url, status };
        if (finalUrl !== target) return { verdict: 'REDIRECT', url, suggestion: finalUrl };
        return { verdict: 'OK', url };
    } catch (error) {
        return { verdict: 'BROKEN', url, error: error.message };
    }
}

/**
 * Run `worker` over `items` with a bounded number in flight. Hand-rolled
 * because this is the only place in the repo that needs it and the dependency
 * list is deliberately short.
 */
async function pool(items, limit, worker) {
    const results = [];
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index]);
        }
    });
    await Promise.all(runners);
    return results;
}

function printGroup(label, results, sources) {
    const byVerdict = (v) => results.filter((r) => r.verdict === v);
    const broken = byVerdict('BROKEN');
    const moved = byVerdict('MOVED-MD');
    const redirected = byVerdict('REDIRECT');

    console.log(`\n${label}: ${results.length} URL(s) — ${byVerdict('OK').length} OK, ${redirected.length} redirect, ${moved.length} moved, ${broken.length} broken`);

    const show = (title, list) => {
        if (list.length === 0) return;
        console.log(`\n  ${title}`);
        for (const r of list) {
            console.log(`    ${r.url}`);
            if (r.suggestion) console.log(`      → ${r.suggestion}`);
            if (r.error) console.log(`      (${r.error})`);
            const from = [...(sources.get(r.url) ?? [])].slice(0, 3);
            if (from.length) console.log(`      in: ${from.join(', ')}`);
        }
    };

    show('MOVED — .md is 404 but the page redirected; repoint to:', moved);
    show('BROKEN — no live page found:', broken);
    show('REDIRECT — still works, but the config is stale:', redirected);

    return { broken, moved, redirected };
}

async function main() {
    const strict = process.argv.includes('--strict');
    const repoRoot = path.join(import.meta.dirname, '..');
    const configDir = path.join(repoRoot, 'context');

    const fetched = collectFetchedUrls(configDir);
    const proseAll = collectProseUrls(repoRoot);
    // A URL the build fetches is already covered; don't check it twice.
    for (const url of fetched.keys()) proseAll.delete(url);

    console.log(`Checking ${fetched.size} fetched URL(s) and ${proseAll.size} prose URL(s) against posthog.com...`);

    const fetchedResults = await pool([...fetched.keys()], CONCURRENCY, classify);
    const proseResults = await pool([...proseAll.keys()], CONCURRENCY, classify);

    const f = printGroup('Fetched (blocking)', fetchedResults, fetched);
    const p = printGroup('Prose (informational)', proseResults, proseAll);

    const blocking = f.broken.length + f.moved.length;
    const strictExtra = strict
        ? f.redirected.length + p.broken.length + p.moved.length + p.redirected.length
        : 0;

    console.log('');
    if (blocking + strictExtra === 0) {
        console.log('✓ All links resolve.');
        return;
    }
    if (blocking > 0) {
        console.error(`✗ ${blocking} fetched URL(s) will break the build.`);
    }
    if (strictExtra > 0) {
        console.error(`✗ ${strictExtra} additional issue(s) under --strict.`);
    }
    process.exitCode = 1;
}

// Only run when invoked as a script — the tests import the pure helpers below,
// and without this guard that import would kick off a few hundred live requests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(`[FATAL] check-links failed: ${error.message}`);
        process.exitCode = 1;
    });
}

export { extractProseUrls, classify, pool };
