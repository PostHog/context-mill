#!/usr/bin/env node
/**
 * Verify a published mirror over HTTPS — the upload, the bucket policy, the CDN,
 * and the /latest pointer. The release workflow runs it against the versioned
 * prefix before the flip, and against /latest after.
 *
 *   node scripts/verify-mirror.js https://context-mill.posthog.com/v1.50.0
 *   node scripts/verify-mirror.js https://context-mill.posthog.com/latest --expect-version 1.50.0
 *
 * --expect-host separates the host URLs must DECLARE from the origin bytes are
 * FETCHED from, so a mirror is verifiable before its DNS record exists. The
 * declared-host assertion is unchanged; only the transport moves.
 */
import path from 'path';
import crypto from 'crypto';
import { REPO_URL } from './lib/constants.js';
import { collectDownloadUrls } from './mirror-dist.js';

const DEFAULT_CONCURRENCY = 16;
/** Enough to catch a systematically corrupt upload; hashing all 259 buys no more signal. */
const DEFAULT_CHECKSUM_SAMPLE = 5;
const REQUEST_TIMEOUT_MS = 15_000;

function splitBase(base) {
    const url = new URL(base.replace(/\/+$/, ''));
    return { origin: url.origin, prefix: url.pathname.replace(/\/+$/, '') };
}

/** Run `task` over `items` with at most `limit` in flight, preserving order. */
async function pooled(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await task(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

/** One retry on 5xx or a dropped connection. Never on 4xx — that is the real failure. */
async function request(fetchImpl, url, { method = 'GET' } = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetchImpl(url, {
                method,
                redirect: 'follow',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (response.status >= 500 && attempt === 0) continue;
            return { ok: response.ok, status: response.status, response };
        } catch (error) {
            if (attempt === 0) continue;
            return { ok: false, status: 0, error: error.message ?? String(error) };
        }
    }
    return { ok: false, status: 0, error: 'exhausted retries' };
}

/** Parse `<sha256>  <filename>` lines, ignoring anything else. */
export function parseSha256Sums(text) {
    const sums = new Map();
    for (const line of text.split('\n')) {
        const match = line.match(/^([0-9a-f]{64})\s+(.+)$/);
        if (match) sums.set(match[2], match[1]);
    }
    return sums;
}

/** Collects failures rather than throwing, so one run reports every problem. */
export async function verifyMirror({
    base,
    expectVersion = null,
    expectHost = null,
    concurrency = DEFAULT_CONCURRENCY,
    checksumSample = DEFAULT_CHECKSUM_SAMPLE,
    fetchImpl = fetch,
    log = () => {},
}) {
    const failures = [];
    const fail = message => failures.push(message);

    const { origin, prefix } = splitBase(base);
    // What URLs must say vs. where bytes come from. Equal unless --expect-host.
    const declaredOrigin = expectHost ? `https://${expectHost}` : origin;
    const toFetchable = url =>
        declaredOrigin === origin ? url : origin + url.slice(declaredOrigin.length);

    const fetchJson = async name => {
        const url = `${origin}${prefix}/${name}`;
        const { ok, status, response, error } = await request(fetchImpl, url);
        if (!ok) {
            fail(`${name}: expected 200, got ${error ? `${error}` : status} (${url})`);
            return null;
        }
        try {
            return JSON.parse(await response.text());
        } catch (parseError) {
            fail(`${name}: served but not valid JSON — ${parseError.message}`);
            return null;
        }
    };

    const [skillMenu, agentMenu] = await Promise.all([
        fetchJson('skill-menu.json'),
        fetchJson('agent-menu.json'),
    ]);
    if (!skillMenu || !agentMenu) return { ok: false, failures, checked: 0 };

    // Disagreeing menus mean two builds got mixed into one prefix.
    const buildVersion = skillMenu.buildVersion;
    if (!buildVersion) fail('skill-menu.json has no buildVersion');
    if (agentMenu.buildVersion !== buildVersion) {
        fail(
            `menus disagree on version: skill-menu.json says ${buildVersion}, ` +
                `agent-menu.json says ${agentMenu.buildVersion}`,
        );
    }
    if (expectVersion && buildVersion !== expectVersion) {
        fail(`expected buildVersion ${expectVersion}, served menu says ${buildVersion}`);
    }
    if (failures.length > 0) return { ok: false, failures, checked: 0 };

    // Asset URLs always name an immutable prefix, so only /latest has to derive it
    // from the menu. Reading a prefix directly also covers dry runs, which upload
    // to v0.0.0-dryrun-<run_id> where prefix and version differ on purpose.
    const versionedBase =
        prefix === '/latest' ? `${declaredOrigin}/v${buildVersion}` : `${declaredOrigin}${prefix}`;
    log(`menu buildVersion ${buildVersion}; asset URLs must live under ${versionedBase}/`);

    const urls = collectDownloadUrls({ skillMenu, agentMenu });
    if (urls.length === 0) fail('menus contain no download URLs at all');

    // A mirrored menu pointing back at GitHub rescues the menu fetch and loses
    // every asset fetch — the exact failure this origin exists to prevent.
    const github = urls.filter(url => url.includes(`${REPO_URL}/releases`));
    if (github.length > 0) {
        fail(`${github.length} download URL(s) still point at GitHub, e.g. ${github[0]}`);
    }

    const stray = urls.filter(url => !url.startsWith(`${versionedBase}/`));
    if (stray.length > 0) {
        fail(`${stray.length} download URL(s) are not under ${versionedBase}/, e.g. ${stray[0]}`);
    }

    // SHA256SUMS is the release's own inventory: the complete object set, and a
    // superset of what the menus reference.
    const sumsResponse = await request(fetchImpl, toFetchable(`${versionedBase}/SHA256SUMS`));
    let sums = new Map();
    if (!sumsResponse.ok) {
        fail(`SHA256SUMS: expected 200, got ${sumsResponse.error ?? sumsResponse.status}`);
    } else {
        sums = parseSha256Sums(await sumsResponse.response.text());
        if (sums.size === 0) fail('SHA256SUMS is present but contains no usable entries');
    }

    const missing = urls
        .map(url => path.posix.basename(new URL(url).pathname))
        .filter(name => sums.size > 0 && !sums.has(name));
    if (missing.length > 0) {
        fail(`${missing.length} referenced file(s) absent from SHA256SUMS, e.g. ${missing[0]}`);
    }

    const objectUrls = [...sums.keys()].map(name => `${versionedBase}/${name}`);
    const probes = await pooled(objectUrls, concurrency, async url => {
        const result = await request(fetchImpl, toFetchable(url), { method: 'HEAD' });
        return { url, ...result };
    });
    const unreachable = probes.filter(probe => !probe.ok);
    for (const probe of unreachable.slice(0, 5)) {
        fail(`unreachable: ${probe.url} → ${probe.error ?? probe.status}`);
    }
    if (unreachable.length > 5) {
        fail(`…and ${unreachable.length - 5} more unreachable object(s)`);
    }

    // Evenly spaced over the sorted inventory, so a failure is reproducible.
    const names = [...sums.keys()].sort();
    const sampleCount = Math.min(checksumSample, names.length);
    const sample = Array.from(
        { length: sampleCount },
        (_, i) => names[Math.floor((i * names.length) / sampleCount)],
    );
    await pooled(sample, concurrency, async name => {
        const url = toFetchable(`${versionedBase}/${name}`);
        const result = await request(fetchImpl, url);
        if (!result.ok) return;
        const body = Buffer.from(await result.response.arrayBuffer());
        const digest = crypto.createHash('sha256').update(body).digest('hex');
        if (digest !== sums.get(name)) {
            fail(`checksum mismatch for ${name}: SHA256SUMS says ${sums.get(name)}, got ${digest}`);
        }
    });

    log(
        `checked ${urls.length} menu URLs, ${objectUrls.length} objects, ` +
            `${sample.length} checksums`,
    );
    return { ok: failures.length === 0, failures, checked: objectUrls.length, buildVersion };
}

const USAGE =
    'usage: node scripts/verify-mirror.js <base> [--expect-version <v>] ' +
    '[--expect-host <host>] [--concurrency <n>] [--checksum-sample <n>]';

/** Positional base plus `--flag value` pairs, in any order. */
export function parseArgs(argv) {
    const flags = new Map();
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) {
            positional.push(argv[i]);
            continue;
        }
        const value = argv[i + 1];
        if (value === undefined || value.startsWith('--')) {
            throw new Error(`${argv[i]} needs a value\n${USAGE}`);
        }
        flags.set(argv[i].slice(2), value);
        i++;
    }
    const [base] = positional;
    if (!base) throw new Error(USAGE);

    // Absent vs. zero, so --checksum-sample 0 switches the content check off.
    const number = (name, fallback) => {
        if (!flags.has(name)) return fallback;
        const parsed = Number(flags.get(name));
        if (!Number.isInteger(parsed) || parsed < 0) {
            throw new Error(`--${name} must be a non-negative integer`);
        }
        return parsed;
    };
    return {
        base,
        expectVersion: flags.get('expect-version') ?? null,
        expectHost: flags.get('expect-host') ?? null,
        concurrency: number('concurrency', DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY,
        checksumSample: number('checksum-sample', DEFAULT_CHECKSUM_SAMPLE),
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    const options = parseArgs(process.argv.slice(2));
    const { ok, failures, checked } = await verifyMirror({
        ...options,
        log: message => console.log(message),
    });
    if (!ok) {
        console.error(`\nMirror verification FAILED for ${options.base}:`);
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }
    console.log(`Mirror verified: ${options.base} (${checked} objects reachable)`);
}
