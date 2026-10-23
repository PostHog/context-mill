#!/usr/bin/env node

/**
 * Fail when a build's output differs from a baseline build in anything but the skill-menu's title/description/tags.
 * Baseline from main: `git worktree add /tmp/cm-main main && (cd /tmp/cm-main && npm install && npm run build)`,
 * then `npm run build && npm run check:bundle-diff -- /tmp/cm-main/dist [dist]`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

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

/** Comparable digest of one file: zips by their entries, manifests without the build timestamp, the menu without its metadata fields. */
function digest(name, buf) {
    const base = path.basename(name);
    if (base.endsWith('.zip')) {
        const entries = readZip(buf);
        return Object.fromEntries(Object.keys(entries).sort().map(n => [n, digest(n, entries[n])]));
    }
    if (base === 'manifest.json') {
        const { buildTimestamp: _ts, ...rest } = JSON.parse(buf.toString('utf8'));
        return sha(JSON.stringify(rest));
    }
    if (base === 'skill-menu.json') {
        const menu = JSON.parse(buf.toString('utf8'));
        menu.categories = stripMenuMetadata(menu.categories);
        return sha(JSON.stringify(menu));
    }
    return sha(buf);
}

function listFiles(root) {
    return fs.readdirSync(root, { recursive: true })
        .filter(rel => fs.statSync(path.join(root, rel)).isFile())
        .map(rel => rel.split(path.sep).join('/'))
        .sort();
}

function diff(a, b, at, out) {
    if (typeof a === 'string' || typeof b === 'string') {
        if (a !== b) out.push(at);
        return;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in a)) out.push(`${at}!${key} (added)`);
        else if (!(key in b)) out.push(`${at}!${key} (removed)`);
        else diff(a[key], b[key], `${at}!${key}`, out);
    }
}

const [baselineDir, candidateDir = 'dist'] = process.argv.slice(2);
if (!baselineDir) {
    console.error('Usage: node scripts/check-bundle-diff.js <baseline-dist> [candidate-dist]');
    process.exit(2);
}

const baseline = listFiles(baselineDir);
const candidate = listFiles(candidateDir);
const changes = [];
for (const rel of new Set([...baseline, ...candidate])) {
    if (!baseline.includes(rel)) { changes.push(`${rel} (added)`); continue; }
    if (!candidate.includes(rel)) { changes.push(`${rel} (removed)`); continue; }
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
console.log(`No differences beyond skill-menu ${MENU_METADATA.join('/')} (${candidate.length} files compared).`);
