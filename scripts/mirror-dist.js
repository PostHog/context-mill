#!/usr/bin/env node
/**
 * Rewrite the GitHub release URLs baked into a built `dist/` so the same bytes
 * can be served from the S3 + CloudFront mirror, then flatten the result to the
 * release asset namespace.
 *
 *   BUILD_VERSION=1.46.0 node scripts/mirror-dist.js \
 *     --base https://context-mill.posthog.com/v1.46.0
 *
 * Reads `dist/`, writes `dist-s3-flat/`. Never mutates `dist/` — the GitHub
 * release assets must stay byte-identical to what was already uploaded.
 *
 * Why a rewrite rather than a second build: the build fetches live doc content
 * over the network, so re-running it with a different base URL can produce
 * different doc text for the same version tag. A fallback origin that silently
 * serves different bytes than the primary is worse than no fallback.
 *
 * The output mirrors the GitHub release asset set exactly, plus `SHA256SUMS`.
 * Two deliberate asymmetries:
 *
 *   - `manifest.json` is rewritten but NOT emitted as a flat file. It is not a
 *     GitHub release asset (verify with `gh release view --json assets`); it
 *     only ships inside `skills-mcp-resources.zip`. Emitting it here would make
 *     the two origins' filename sets diverge.
 *   - `skills-mcp-resources.zip` is the one file that is NOT byte-identical
 *     across origins, because the manifest embedded in it carries the mirror's
 *     URLs. Every other zip and markdown file is copied verbatim.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { REPO_URL } from './lib/constants.js';
import { createBundledArchive } from './lib/build-phases.js';

/**
 * Files in `dist/skills/` that are not part of the release asset namespace.
 * `manifest.json` ships only inside the bundle; `skill-menu.json` is uploaded
 * explicitly by the release workflow and rewritten separately here.
 */
const NON_BUNDLE_MEMBER_JSON = new Set(['manifest.json', 'skill-menu.json']);

/**
 * Every GitHub release base URL a build could have baked in.
 *
 * `resolveBaseDownloadUrl` (build-phases.js) emits the pinned form when
 * BUILD_VERSION is a real version and the `latest` form otherwise. Release
 * builds always pin, but rewriting both keeps a `dev` build from silently
 * producing a mirror that still points at GitHub.
 */
export function githubBaseUrls(version) {
    return [
        `${REPO_URL}/releases/download/v${version}`,
        `${REPO_URL}/releases/latest/download`,
    ];
}

/** Replace every known GitHub base with `to`. Plain string swaps — no regex escaping games. */
function rewriteUrls(text, froms, to) {
    return froms.reduce((acc, from) => acc.split(from).join(to), text);
}

/** Collect every URL-bearing field we expect to point at the mirror after a rewrite. */
function collectDownloadUrls({ manifest, skillMenu, agentMenu }) {
    const urls = [];
    for (const resource of manifest?.resources ?? []) {
        if (resource.downloadUrl) urls.push(resource.downloadUrl);
        // Skill resources repeat the URL as their resource text; docs inline prose there instead.
        if (resource.file && resource.resource?.text) urls.push(resource.resource.text);
    }
    for (const entries of Object.values(skillMenu?.categories ?? {})) {
        for (const entry of entries) if (entry.downloadUrl) urls.push(entry.downloadUrl);
    }
    for (const agent of agentMenu?.agents ?? []) {
        if (agent.downloadUrl) urls.push(agent.downloadUrl);
    }
    return urls;
}

/**
 * Build `outDir` from `distDir`. Returns { files, bundleRebuilt } for callers
 * that want to assert on the result.
 */
export async function mirrorDist({ distDir, outDir, to, version }) {
    if (!to) throw new Error('mirrorDist requires a target base URL');
    if (!version) throw new Error('mirrorDist requires a version');

    const base = to.replace(/\/+$/, '');
    const froms = githubBaseUrls(version);
    const skillsDir = path.join(distDir, 'skills');
    const agentsDir = path.join(distDir, 'agents');

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    // Flattening two source directories into one can collide (an agent asset and
    // a skill asset sharing a basename). Silently overwriting would drop a
    // release asset, so refuse instead.
    const claimed = new Map();
    const claim = (name, from) => {
        if (claimed.has(name)) {
            throw new Error(
                `Filename collision flattening the mirror: "${name}" comes from both ` +
                    `${claimed.get(name)} and ${from}`,
            );
        }
        claimed.set(name, from);
        return path.join(outDir, name);
    };

    const readJson = src => JSON.parse(fs.readFileSync(src, 'utf8'));

    /** Rewrite a JSON file's URLs and write it flat. Parses after replacing so a
     *  malformed result fails here rather than at a consumer. */
    const rewriteJsonToOut = src => {
        const rewritten = rewriteUrls(fs.readFileSync(src, 'utf8'), froms, base);
        const parsed = JSON.parse(rewritten);
        fs.writeFileSync(claim(path.basename(src), src), JSON.stringify(parsed, null, 2) + '\n');
        return parsed;
    };

    const copyFlat = (dir, filter) => {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir).sort()) {
            const src = path.join(dir, name);
            if (!fs.statSync(src).isFile() || !filter(name)) continue;
            fs.copyFileSync(src, claim(name, src));
        }
    };

    // manifest.json is rewritten in memory only — see the header comment.
    const manifest = JSON.parse(
        rewriteUrls(fs.readFileSync(path.join(skillsDir, 'manifest.json'), 'utf8'), froms, base),
    );
    const skillMenu = rewriteJsonToOut(path.join(skillsDir, 'skill-menu.json'));
    const agentMenu = rewriteJsonToOut(path.join(agentsDir, 'agent-menu.json'));

    // Everything else is copied byte-for-byte. Doc markdown in dist/skills/ is
    // fetched prose that may legitimately mention github.com — never rewrite it.
    copyFlat(skillsDir, name => {
        if (name.endsWith('.zip')) return true;
        if (name.endsWith('.md')) return true;
        return name.endsWith('.json') && !NON_BUNDLE_MEMBER_JSON.has(name);
    });
    copyFlat(agentsDir, name => name.startsWith('agents-') && name.endsWith('.md'));
    // dist/marketplace/ is pushed to the skills / ai-plugin repos, not released here.

    // Rebuild the bundle around the rewritten manifest. Reusing createBundledArchive
    // keeps one code path for the bundle's shape; its members are every skill zip
    // plus every bundled-group JSON, exactly as scripts/build.js assembles them.
    const bundleMembers = {};
    for (const name of fs.readdirSync(skillsDir).sort()) {
        const src = path.join(skillsDir, name);
        if (!fs.statSync(src).isFile()) continue;
        const isMember =
            name.endsWith('.zip') || (name.endsWith('.json') && !NON_BUNDLE_MEMBER_JSON.has(name));
        if (isMember) bundleMembers[name] = fs.readFileSync(src);
    }
    await createBundledArchive(
        claim('skills-mcp-resources.zip', 'rebuilt from the rewritten manifest'),
        manifest,
        bundleMembers,
    );

    // Guard 1: nothing may still point at GitHub releases.
    for (const name of fs.readdirSync(outDir)) {
        if (!name.endsWith('.json')) continue;
        const text = fs.readFileSync(path.join(outDir, name), 'utf8');
        if (text.includes(`${REPO_URL}/releases`)) {
            throw new Error(`${name} still points at GitHub after rewrite — the mirror would be broken`);
        }
    }

    // Guard 2: and every URL that should have moved actually did. This catches
    // the case Guard 1 cannot — a build made with SKILLS_BASE_URL already set,
    // where no github.com URL was ever present to rewrite.
    const stray = collectDownloadUrls({ manifest, skillMenu, agentMenu }).filter(
        url => !url.startsWith(`${base}/`),
    );
    if (stray.length > 0) {
        throw new Error(
            `${stray.length} download URL(s) do not point at ${base} after rewrite, e.g. ${stray[0]}`,
        );
    }

    // Lets a consumer detect a torn or tampered fetch from either origin.
    const files = fs.readdirSync(outDir).sort();
    const sums = files
        .map(name => {
            const hash = crypto
                .createHash('sha256')
                .update(fs.readFileSync(path.join(outDir, name)))
                .digest('hex');
            return `${hash}  ${name}`;
        })
        .join('\n');
    fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), sums + '\n');

    return { files: [...files, 'SHA256SUMS'].sort(), manifest, skillMenu, agentMenu };
}

function parseArgs(argv) {
    const baseIndex = argv.indexOf('--base');
    const base = baseIndex !== -1 ? argv[baseIndex + 1] : null;
    const version = process.env.BUILD_VERSION;
    if (!base || !version) {
        throw new Error(
            'usage: BUILD_VERSION=<version> node scripts/mirror-dist.js --base <url>',
        );
    }
    return { base, version };
}

// Only run when invoked directly, so tests can import mirrorDist.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    const { base, version } = parseArgs(process.argv);
    const repoRoot = path.join(import.meta.dirname, '..');
    const outDir = path.join(repoRoot, 'dist-s3-flat');
    const { files } = await mirrorDist({
        distDir: path.join(repoRoot, 'dist'),
        outDir,
        to: base,
        version,
    });
    console.log(`Mirror ready: ${files.length} files in dist-s3-flat/ → ${base}`);
}
