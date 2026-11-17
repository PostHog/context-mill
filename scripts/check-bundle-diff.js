#!/usr/bin/env node

/**
 * Fail when a build's file contents or executable bits differ from a baseline build in anything but the skill-menu's title/description/tags.
 * Permissions inside a zip are not compared.
 * Both builds must read the same inputs: a doc edited on posthog.com, or a generated file under example-apps/, shows as a difference.
 * Build this checkout first, with `git clean -Xn example-apps` listing nothing but `.env` files, then the baseline from a copy of its docs cache:
 * `npm run build && git worktree add /tmp/cm-main main && cp -R .docs-cache /tmp/cm-main/ && (cd /tmp/cm-main && npm install && npm run build)`,
 * then `npm run check:bundle-diff -- /tmp/cm-main/dist [dist]`.
 * With `--additive`, a file, a zip entry, a menu entry or a field the baseline lacks is allowed and counted;
 * anything the baseline has must still be there, unchanged. Use it for a release that only adds.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { contains } from './lib/additive-diff.js';

const MENU_METADATA = ['title', 'description', 'tags'];

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

/** Entry name -> content buffer for a zip, read from its central directory (zip mtimes are ignored). */
function readZip(buf) {
    let eocd = buf.length - 22;
    while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('not a zip archive');
    const count = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);
    const entries = {};
    for (let i = 0; i < count; i++) {
        const method = buf.readUInt16LE(offset + 10);
        const compressedSize = buf.readUInt32LE(offset + 20);
        const nameLength = buf.readUInt16LE(offset + 28);
        const extraLength = buf.readUInt16LE(offset + 30);
        const commentLength = buf.readUInt16LE(offset + 32);
        const localOffset = buf.readUInt32LE(offset + 42);
        const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength);
        offset += 46 + nameLength + extraLength + commentLength;
        if (name.endsWith('/')) continue;
        const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
        const data = buf.subarray(dataStart, dataStart + compressedSize);
        entries[name] = method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data);
    }
    return entries;
}

function stripMenuMetadata(node) {
    if (Array.isArray(node)) return node.map(stripMenuMetadata);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(
        Object.entries(node).filter(([k]) => !MENU_METADATA.includes(k)).map(([k, v]) => [k, stripMenuMetadata(v)]),
    );
}

/** A parsed JSON file, kept whole so an additive comparison can look inside it. */
class Json {
    constructor(value) {
        this.value = value;
    }
}

/** Comparable digest of one file: zips by their entries, manifests without the build timestamp, the menu without its metadata fields. */
function digest(name, buf) {
    const base = path.basename(name);
    if (base.endsWith('.zip')) {
        const entries = readZip(buf);
        return Object.fromEntries(Object.keys(entries).sort().map(n => [n, digest(n, entries[n])]));
    }
    if (base === 'manifest.json') {
        const { buildTimestamp: _ts, ...rest } = JSON.parse(buf.toString('utf8'));
        return new Json(rest);
    }
    if (base === 'skill-menu.json') {
        const menu = JSON.parse(buf.toString('utf8'));
        menu.categories = stripMenuMetadata(menu.categories);
        return new Json(menu);
    }
    return sha(buf);
}

function listFiles(root) {
    return fs.readdirSync(root, { recursive: true })
        .filter(rel => fs.statSync(path.join(root, rel)).isFile())
        .map(rel => rel.split(path.sep).join('/'))
        .sort();
}

const USAGE = 'Usage: node scripts/check-bundle-diff.js [--additive] <baseline-dist> [candidate-dist]';
const args = process.argv.slice(2);
const additive = args.includes('--additive');
const [baselineDir, candidateDir = 'dist'] = args.filter(arg => arg !== '--additive');
if (!baselineDir) {
    console.error(USAGE);
    process.exit(2);
}

for (const dir of [baselineDir, candidateDir]) {
    if (!fs.existsSync(dir)) {
        console.error(`No build output at ${dir}`);
        console.error(USAGE);
        process.exit(2);
    }
}

/** What only the candidate has. Counted in an additive comparison, a difference otherwise. */
const additions = [];
const add = (what, out) => (additive ? additions.push(what) : out.push(`${what} (added)`));

function diff(a, b, at, out) {
    if (a instanceof Json && b instanceof Json) {
        if (additive) contains(a.value, b.value, at, out, additions);
        else if (JSON.stringify(a.value) !== JSON.stringify(b.value)) out.push(at);
        return;
    }
    if (typeof a === 'string' || typeof b === 'string' || a instanceof Json || b instanceof Json) {
        if (a !== b) out.push(at);
        return;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in a)) add(`${at}!${key}`, out);
        else if (!(key in b)) out.push(`${at}!${key} (removed)`);
        else diff(a[key], b[key], `${at}!${key}`, out);
    }
}

const isExecutable = file => (fs.statSync(file).mode & 0o111) !== 0;

const baseline = listFiles(baselineDir);
const candidate = listFiles(candidateDir);
const changes = [];
for (const rel of new Set([...baseline, ...candidate])) {
    if (!baseline.includes(rel)) { add(rel, changes); continue; }
    if (!candidate.includes(rel)) { changes.push(`${rel} (removed)`); continue; }
    if (isExecutable(path.join(baselineDir, rel)) !== isExecutable(path.join(candidateDir, rel))) {
        changes.push(`${rel} (executable bit)`);
    }
    diff(
        digest(rel, fs.readFileSync(path.join(baselineDir, rel))),
        digest(rel, fs.readFileSync(path.join(candidateDir, rel))),
        rel,
        changes,
    );
}

if (changes.length > 0) {
    console.error(`Build output differs from ${baselineDir} beyond the skill-menu metadata fields:`);
    for (const change of changes) console.error(`  - ${change}`);
    process.exit(1);
}
if (additive) {
    console.log(`Nothing changed or removed beyond skill-menu ${MENU_METADATA.join('/')}; ${additions.length} additions (${candidate.length} files compared).`);
} else {
    console.log(`No differences beyond skill-menu ${MENU_METADATA.join('/')} (${candidate.length} files compared).`);
}
