#!/usr/bin/env node
/**
 * Fail the release if any menu references an asset the release doesn't have.
 *
 * Run after the upload steps in build-release.yml. It reads the built menus in
 * dist/, computes every asset they reference, and diffs that against the real
 * assets on the release tag (via `gh release view`). A missing asset — the
 * exact failure in PostHog/wizard#912 — exits non-zero and fails CI.
 *
 *   node scripts/verify-release-assets.js <release-tag>
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

import { expectedAssetsForMenu, findMissingAssets } from './lib/release-assets.js';

const tag = process.argv[2] || process.env.RELEASE_TAG;
if (!tag) {
    console.error('usage: verify-release-assets.js <release-tag>');
    process.exit(2);
}

const distDir = path.join(import.meta.dirname, '..', 'dist');
const expected = new Set();

// Agent menu + every prompt it references.
const agentMenuPath = path.join(distDir, 'agents', 'agent-menu.json');
if (fs.existsSync(agentMenuPath)) {
    const menu = JSON.parse(fs.readFileSync(agentMenuPath, 'utf8'));
    for (const name of expectedAssetsForMenu('agent-menu.json', menu.agents ?? [])) {
        expected.add(name);
    }
}

// Skill menu + every skill zip it references.
const skillMenuPath = path.join(distDir, 'skills', 'skill-menu.json');
if (fs.existsSync(skillMenuPath)) {
    const menu = JSON.parse(fs.readFileSync(skillMenuPath, 'utf8'));
    const entries = Object.values(menu.categories ?? {}).flat();
    for (const name of expectedAssetsForMenu('skill-menu.json', entries)) {
        expected.add(name);
    }
}

if (expected.size === 0) {
    console.error('❌ No menus found in dist/ — nothing to verify. Did the build run?');
    process.exit(1);
}

const actual = JSON.parse(
    execFileSync('gh', ['release', 'view', tag, '--json', 'assets'], { encoding: 'utf8' }),
).assets.map((asset) => asset.name);

const missing = findMissingAssets(expected, actual);
if (missing.length > 0) {
    console.error(
        `❌ Release ${tag} is missing ${missing.length} asset(s) referenced by its menus:`,
    );
    for (const name of missing) console.error(`   - ${name}`);
    process.exit(1);
}

console.log(`✓ Release ${tag} carries all ${expected.size} menu-referenced assets.`);
