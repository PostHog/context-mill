#!/usr/bin/env node

/**
 * Compare two dist/ trees (current vs baseline) and produce a categorized
 * report of what changed. Designed for pre-release production review.
 *
 * Usage:
 *   node scripts/compare-dist.js [newDist] [oldDist]
 *   node scripts/compare-dist.js                  # defaults: dist vs dist-v1
 *   node scripts/compare-dist.js dist dist-v1
 *
 * It will:
 *   1. Unzip every <skill>.zip in both trees to temp dirs.
 *   2. Per skill, classify each file as: identical | added | removed |
 *      content-drift (prose-only) | structural (headers / code / links changed).
 *   3. Compare top-level manifest.json and push-manifest.json structurally.
 *   4. Compare the marketplace/ tree (no zips, just trees).
 *   5. Print a grouped, color-coded report.
 */

import { readdirSync, statSync, readFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const NEW_DIST = resolveArg(args[0] || 'dist');
const OLD_DIST = resolveArg(args[1] || 'dist-v1');

function resolveArg(p) {
    if (p.startsWith('/')) return p;
    return join(REPO_ROOT, p);
}

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function header(s) {
    console.log(`\n${c.bold}${c.cyan}═══ ${s} ═══${c.reset}`);
}

function subheader(s) {
    console.log(`\n${c.bold}${s}${c.reset}`);
}

function listFilesRecursive(dir) {
    const out = [];
    function walk(d) {
        if (!existsSync(d)) return;
        for (const name of readdirSync(d)) {
            if (name === '.DS_Store') continue;
            const full = join(d, name);
            const s = statSync(full);
            if (s.isDirectory()) walk(full);
            else out.push(relative(dir, full));
        }
    }
    walk(dir);
    return out.sort();
}

function listZips(skillsDir) {
    if (!existsSync(skillsDir)) return [];
    return readdirSync(skillsDir).filter(f => f.endsWith('.zip')).sort();
}

function unzipAll(skillsDir, destRoot) {
    mkdirSync(destRoot, { recursive: true });
    for (const zip of listZips(skillsDir)) {
        const name = zip.replace(/\.zip$/, '');
        const out = join(destRoot, name);
        mkdirSync(out, { recursive: true });
        execSync(`unzip -q -o "${join(skillsDir, zip)}" -d "${out}"`);
    }
}

/**
 * Classify a content diff between two text blobs.
 *
 *   identical      → byte-equal
 *   whitespace     → equal after trim+collapse-whitespace
 *   content-drift  → headers, code fences, link targets all match; only prose differs
 *   structural     → at least one of headers / code / links differs
 */
function classifyDiff(oldText, newText) {
    if (oldText === newText) return 'identical';

    const normWS = s => s.replace(/\s+/g, ' ').trim();
    if (normWS(oldText) === normWS(newText)) return 'whitespace';

    const headers = s => s.split('\n').filter(l => /^#{1,6}\s/.test(l)).map(l => l.trim());
    const codeFences = s => s.split('\n').filter(l => /^```/.test(l));
    const links = s => Array.from(s.matchAll(/\]\(([^)]+)\)/g)).map(m => m[1]);
    const codeBlocks = s => {
        const lines = s.split('\n');
        const blocks = [];
        let inBlock = false;
        let current = [];
        for (const line of lines) {
            if (/^```/.test(line)) {
                if (inBlock) {
                    blocks.push(current.join('\n'));
                    current = [];
                    inBlock = false;
                } else {
                    inBlock = true;
                }
            } else if (inBlock) {
                current.push(line);
            }
        }
        return blocks;
    };

    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

    const headersMatch = eq(headers(oldText), headers(newText));
    const fencesMatch = eq(codeFences(oldText), codeFences(newText));
    const linksMatch = eq(links(oldText), links(newText));
    const codeMatch = eq(codeBlocks(oldText), codeBlocks(newText));

    if (headersMatch && fencesMatch && linksMatch && codeMatch) return 'content-drift';
    return 'structural';
}

function isTextFile(path) {
    return /\.(md|json|txt|yaml|yml|js|ts|tsx|jsx|py|html|css)$/i.test(path);
}

function readMaybe(path) {
    try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function diffSkill(oldDir, newDir) {
    const oldFiles = listFilesRecursive(oldDir);
    const newFiles = listFilesRecursive(newDir);
    const oldSet = new Set(oldFiles);
    const newSet = new Set(newFiles);

    const added = newFiles.filter(f => !oldSet.has(f));
    const removed = oldFiles.filter(f => !newSet.has(f));
    const common = newFiles.filter(f => oldSet.has(f));

    const buckets = {
        identical: [],
        whitespace: [],
        'content-drift': [],
        structural: [],
        binary: [],
    };

    for (const f of common) {
        const oldP = join(oldDir, f);
        const newP = join(newDir, f);
        if (!isTextFile(f)) {
            const a = readFileSync(oldP);
            const b = readFileSync(newP);
            buckets[a.equals(b) ? 'identical' : 'binary'].push(f);
            continue;
        }
        const a = readMaybe(oldP);
        const b = readMaybe(newP);
        if (a === null || b === null) {
            buckets.binary.push(f);
            continue;
        }
        const cls = classifyDiff(a, b);
        buckets[cls].push(f);
    }

    return { added, removed, common, buckets };
}

function fmtFileList(label, files, color) {
    if (files.length === 0) return;
    console.log(`  ${color}${label} (${files.length}):${c.reset}`);
    for (const f of files) console.log(`    ${color}${f}${c.reset}`);
}

function compareSkillsTree(label, newRoot, oldRoot) {
    header(`${label}: skill ZIPs`);

    const newSkills = new Set(listZips(newRoot).map(z => z.replace(/\.zip$/, '')));
    const oldSkills = new Set(listZips(oldRoot).map(z => z.replace(/\.zip$/, '')));

    const added = [...newSkills].filter(s => !oldSkills.has(s)).sort();
    const removed = [...oldSkills].filter(s => !newSkills.has(s)).sort();
    const common = [...newSkills].filter(s => oldSkills.has(s)).sort();

    console.log(`  Old: ${oldSkills.size} skills   New: ${newSkills.size} skills   Shared: ${common.length}`);
    if (added.length) console.log(`  ${c.green}+ added skills:${c.reset} ${added.join(', ')}`);
    if (removed.length) console.log(`  ${c.red}- removed skills:${c.reset} ${removed.join(', ')}`);

    const newTmp = mkdtempSync(join(tmpdir(), 'cmp-new-'));
    const oldTmp = mkdtempSync(join(tmpdir(), 'cmp-old-'));
    unzipAll(newRoot, newTmp);
    unzipAll(oldRoot, oldTmp);

    const totals = {
        skillsTouched: 0,
        skillsClean: 0,
        added: 0,
        removed: 0,
        identical: 0,
        whitespace: 0,
        'content-drift': 0,
        structural: 0,
        binary: 0,
    };

    const perSkill = [];
    for (const skill of common) {
        const result = diffSkill(join(oldTmp, skill), join(newTmp, skill));
        const dirty =
            result.added.length +
            result.removed.length +
            result.buckets.structural.length +
            result.buckets['content-drift'].length;
        totals.added += result.added.length;
        totals.removed += result.removed.length;
        for (const k of Object.keys(result.buckets)) totals[k] += result.buckets[k].length;
        if (dirty === 0) totals.skillsClean++;
        else totals.skillsTouched++;
        perSkill.push({ skill, ...result, dirty });
    }

    subheader('Summary');
    console.log(`  ${c.green}Skills unchanged (only identical / whitespace):${c.reset} ${totals.skillsClean}`);
    console.log(`  ${c.yellow}Skills with changes:${c.reset} ${totals.skillsTouched}`);
    console.log(`    ${c.green}+ added files:${c.reset}        ${totals.added}`);
    console.log(`    ${c.red}- removed files:${c.reset}      ${totals.removed}`);
    console.log(`    ${c.blue}~ content-drift files:${c.reset}${totals['content-drift']}`);
    console.log(`    ${c.magenta}* structural changes:${c.reset}  ${totals.structural}`);
    console.log(`    ${c.dim}= identical files:${c.reset}    ${totals.identical}`);
    console.log(`    ${c.dim}~ whitespace-only:${c.reset}    ${totals.whitespace}`);
    if (totals.binary) console.log(`    ${c.dim}(binary changes:${c.reset} ${totals.binary})`);

    subheader('Per-skill detail (changed skills only)');
    for (const r of perSkill) {
        if (r.dirty === 0) continue;
        console.log(`\n  ${c.bold}${r.skill}${c.reset}`);
        fmtFileList('+ added', r.added, c.green);
        fmtFileList('- removed', r.removed, c.red);
        fmtFileList('* structural', r.buckets.structural, c.magenta);
        fmtFileList('~ content-drift', r.buckets['content-drift'], c.blue);
    }

    // Cleanup
    rmSync(newTmp, { recursive: true, force: true });
    rmSync(oldTmp, { recursive: true, force: true });

    return { totals, perSkill };
}

function compareTopLevelFile(label, newPath, oldPath) {
    if (!existsSync(newPath) || !existsSync(oldPath)) return;
    const a = readFileSync(oldPath, 'utf8');
    const b = readFileSync(newPath, 'utf8');
    if (a === b) {
        console.log(`  ${c.green}${label}: byte-identical${c.reset}`);
        return;
    }
    try {
        const aj = JSON.parse(a);
        const bj = JSON.parse(b);
        const aStr = JSON.stringify(aj, Object.keys(aj).sort(), 2);
        const bStr = JSON.stringify(bj, Object.keys(bj).sort(), 2);
        if (aStr === bStr) {
            console.log(`  ${c.green}${label}: structurally identical (formatting differs)${c.reset}`);
            return;
        }
        // Key-level diff
        const ak = new Set(Object.keys(aj));
        const bk = new Set(Object.keys(bj));
        const added = [...bk].filter(k => !ak.has(k));
        const removed = [...ak].filter(k => !bk.has(k));
        console.log(`  ${c.yellow}${label}: differs${c.reset}`);
        if (added.length) console.log(`    + new top-level keys: ${added.join(', ')}`);
        if (removed.length) console.log(`    - removed top-level keys: ${removed.join(', ')}`);
        // Compare resources arrays if present
        if (Array.isArray(aj.resources) && Array.isArray(bj.resources)) {
            const aIds = new Set(aj.resources.map(r => r.id));
            const bIds = new Set(bj.resources.map(r => r.id));
            const addedRes = [...bIds].filter(x => !aIds.has(x));
            const removedRes = [...aIds].filter(x => !bIds.has(x));
            if (addedRes.length) console.log(`    ${c.green}+ resources added:${c.reset} ${addedRes.join(', ')}`);
            if (removedRes.length) console.log(`    ${c.red}- resources removed:${c.reset} ${removedRes.join(', ')}`);
            // For shared resource ids, do a deep-but-shallow diff to spot field changes
            const shared = aj.resources.filter(r => bIds.has(r.id));
            let fieldChanges = 0;
            for (const oldR of shared) {
                const newR = bj.resources.find(r => r.id === oldR.id);
                if (JSON.stringify(oldR) !== JSON.stringify(newR)) fieldChanges++;
            }
            if (fieldChanges) console.log(`    ${c.yellow}~ resources with field changes:${c.reset} ${fieldChanges}`);
        }
    } catch {
        console.log(`  ${c.yellow}${label}: differs (non-JSON)${c.reset}`);
    }
}

function compareMarketplace(newRoot, oldRoot) {
    header('Marketplace tree');
    if (!existsSync(newRoot) || !existsSync(oldRoot)) {
        console.log('  (marketplace dir missing in one side)');
        return;
    }
    const newFiles = listFilesRecursive(newRoot);
    const oldFiles = listFilesRecursive(oldRoot);
    const oldSet = new Set(oldFiles);
    const newSet = new Set(newFiles);
    const added = newFiles.filter(f => !oldSet.has(f));
    const removed = oldFiles.filter(f => !newSet.has(f));
    const common = newFiles.filter(f => oldSet.has(f));

    let structural = 0, drift = 0, identical = 0, whitespace = 0, binary = 0;
    for (const f of common) {
        const oldP = join(oldRoot, f);
        const newP = join(newRoot, f);
        if (!isTextFile(f)) {
            const a = readFileSync(oldP);
            const b = readFileSync(newP);
            if (a.equals(b)) identical++; else binary++;
            continue;
        }
        const a = readMaybe(oldP);
        const b = readMaybe(newP);
        const cls = classifyDiff(a, b);
        if (cls === 'identical') identical++;
        else if (cls === 'whitespace') whitespace++;
        else if (cls === 'content-drift') drift++;
        else structural++;
    }

    console.log(`  Old: ${oldFiles.length} files   New: ${newFiles.length} files`);
    console.log(`    ${c.green}+ added:${c.reset}         ${added.length}`);
    console.log(`    ${c.red}- removed:${c.reset}       ${removed.length}`);
    console.log(`    ${c.magenta}* structural:${c.reset}    ${structural}`);
    console.log(`    ${c.blue}~ content-drift:${c.reset} ${drift}`);
    console.log(`    ${c.dim}= identical:${c.reset}     ${identical}`);
    console.log(`    ${c.dim}~ whitespace:${c.reset}    ${whitespace}`);
    if (binary) console.log(`    ${c.dim}binary diffs:${c.reset} ${binary}`);
}

function main() {
    console.log(`${c.bold}Comparing dist trees${c.reset}`);
    console.log(`  NEW: ${NEW_DIST}`);
    console.log(`  OLD: ${OLD_DIST}`);

    if (!existsSync(NEW_DIST)) { console.error(`NEW dir missing: ${NEW_DIST}`); process.exit(1); }
    if (!existsSync(OLD_DIST)) { console.error(`OLD dir missing: ${OLD_DIST}`); process.exit(1); }

    header('Top-level manifests');
    compareTopLevelFile('skills/manifest.json',
        join(NEW_DIST, 'skills', 'manifest.json'),
        join(OLD_DIST, 'skills', 'manifest.json'));
    compareTopLevelFile('push-manifest.json',
        join(NEW_DIST, 'push-manifest.json'),
        join(OLD_DIST, 'push-manifest.json'));

    compareSkillsTree('dist/skills/', join(NEW_DIST, 'skills'), join(OLD_DIST, 'skills'));
    compareMarketplace(join(NEW_DIST, 'marketplace'), join(OLD_DIST, 'marketplace'));

    header('Legend');
    console.log(`  ${c.green}+ added${c.reset}         a file exists in NEW but not OLD`);
    console.log(`  ${c.red}- removed${c.reset}       a file exists in OLD but not NEW`);
    console.log(`  ${c.magenta}* structural${c.reset}    headers / code blocks / link targets changed`);
    console.log(`  ${c.blue}~ content-drift${c.reset} only prose changed (rewording, no code/header/link changes)`);
    console.log(`  ${c.dim}= identical${c.reset}     byte-equal`);
    console.log(`  ${c.dim}~ whitespace${c.reset}    only whitespace differs`);
    console.log('');
    console.log(`${c.dim}For production review: ${c.reset}`);
    console.log(`  - structural changes (* magenta) are the ones to scrutinize.`);
    console.log(`  - content-drift (~ blue) is typically upstream doc rewording; review if conservative.`);
    console.log(`  - added/removed files in the same skill usually indicate a rename — confirm by spot-checking.`);
}

main();
