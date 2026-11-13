#!/usr/bin/env node

/**
 * Check a build's repackaged step skills against the skills they replace.
 * A menu entry with `replaces` stands in for a skill, or for every variant of a skill group.
 * For each one, and for each variant, the files a consumer gets must be the files the replaced skill ships:
 * the same paths with the same bytes, and the same SKILL.md but for the `name` in its frontmatter.
 * An entry with `frameworkReferences` is first completed from the variant's pack, as its consumer does.
 * Run it after a build: `npm run build && npm run check:repackaged-skills -- [dist]`.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { composeStepSkill, skillBody, skillFrontmatter } from './lib/skill-composition.js';

const USAGE = 'Usage: node scripts/check-repackaged-skills.js [dist]';
const [distDir = 'dist'] = process.argv.slice(2);
const skillsDir = path.join(distDir, 'skills');
if (!fs.existsSync(path.join(skillsDir, 'skill-menu.json'))) {
    console.error(`No skill menu at ${skillsDir}`);
    console.error(USAGE);
    process.exit(2);
}

/** Entry name -> text for a zip, read from its central directory. */
function readZip(file) {
    const buf = fs.readFileSync(file);
    let eocd = buf.length - 22;
    while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error(`${file} is not a zip archive`);
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
        entries[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    return entries;
}

const menu = JSON.parse(fs.readFileSync(path.join(skillsDir, 'skill-menu.json'), 'utf8'));
const entries = Object.values(menu.categories).flat();
const zipOf = id => readZip(path.join(skillsDir, `${id}.zip`));

/** The packs, by the variant id they were built from. */
const packs = new Map();
for (const entry of entries.filter(e => e.group === 'integration')) {
    const files = zipOf(entry.id);
    if (files['variant.json']) packs.set(JSON.parse(files['variant.json']).id, files);
}

/** The files of every variant a name stands for: one skill under `all`, or each variant of a group by its short id. */
function replacedVariants(name) {
    const bundle = entries.find(e => e.bundle && e.id === name);
    if (bundle) return JSON.parse(fs.readFileSync(path.join(skillsDir, `${name}.json`), 'utf8')).variants;
    const family = entries.filter(e => !e.bundle && e.group === name);
    if (family.length === 1 && family[0].id === name) return { all: zipOf(name) };
    return Object.fromEntries(family.map(e => [e.id.slice(name.length + 1), zipOf(e.id)]));
}

const differences = [];
let compared = 0;

function compare(label, replaced, replacement) {
    compared++;
    for (const file of new Set([...Object.keys(replaced), ...Object.keys(replacement)])) {
        if (!(file in replacement)) differences.push(`${label}: ${file} is missing`);
        else if (!(file in replaced)) differences.push(`${label}: ${file} is new`);
        else if (file === 'SKILL.md') {
            if (skillBody(replaced[file]) !== skillBody(replacement[file])) differences.push(`${label}: SKILL.md reads differently`);
            if (skillFrontmatter(replaced[file]) !== skillFrontmatter(replacement[file])) differences.push(`${label}: SKILL.md frontmatter differs`);
        } else if (replaced[file] !== replacement[file]) differences.push(`${label}: ${file} differs`);
    }
}

const replacements = entries.filter(e => e.replaces);
for (const entry of replacements) {
    const stepFiles = zipOf(entry.id);
    const variants = replacedVariants(entry.replaces);
    if (Object.keys(variants).length === 0) {
        differences.push(`${entry.id}: nothing on the menu is named ${entry.replaces}`);
        continue;
    }
    for (const [variant, replaced] of Object.entries(variants)) {
        const label = `${entry.id} for ${entry.replaces}${variant === 'all' ? '' : `-${variant}`}`;
        if (!entry.frameworkReferences) {
            compare(label, replaced, stepFiles);
            continue;
        }
        const packFiles = packs.get(variant);
        if (!packFiles) {
            differences.push(`${label}: no pack for the variant`);
            continue;
        }
        try {
            compare(label, replaced, composeStepSkill({ stepFiles, packFiles, product: entry.frameworkReferences }));
        } catch (error) {
            differences.push(`${label}: ${error.message}`);
        }
    }
}

if (replacements.length === 0) {
    console.error('The menu has no entry with `replaces`, so there is nothing to check.');
    process.exit(1);
}
if (differences.length > 0) {
    console.error(`${differences.length} differences between the repackaged skills and the skills they replace:`);
    for (const difference of differences) console.error(`  - ${difference}`);
    process.exit(1);
}
console.log(`${replacements.length} repackaged skills match the skills they replace, across ${compared} skill and variant pairs.`);
