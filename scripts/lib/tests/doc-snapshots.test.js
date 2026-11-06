import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { loadDoc, expandSkillGroups } from '../skill-generator.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

describe('loadDoc', () => {
    it('reads a repo-relative snapshot and takes its title from the first heading', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-snapshots-'));
        fs.mkdirSync(path.join(dir, 'context', 'docs-snapshots', 'legacy'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'context', 'docs-snapshots', 'legacy', 'go.md'), '# Go\n\nInstall posthog-go.\n');
        try {
            const doc = await loadDoc('context/docs-snapshots/legacy/go.md', dir);
            expect(doc.title).toBe('Go');
            expect(doc.content).toContain('Install posthog-go.');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('fails the build on a missing snapshot or a path outside the repo', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-snapshots-'));
        try {
            await expect(loadDoc('context/docs-snapshots/legacy/nope.md', dir)).rejects.toThrow(/not found/);
            await expect(loadDoc('../outside.md', dir)).rejects.toThrow(/escapes the repo/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('docs snapshots referenced by the skill configs', () => {
    // A renamed or deleted snapshot would otherwise surface only when a release build runs.
    it('exist in the repo', () => {
        const configs = fs.readdirSync(path.join(repoRoot, 'context', 'skills'), { recursive: true })
            .filter(name => String(name).endsWith('config.yaml'))
            .map(name => path.join(repoRoot, 'context', 'skills', String(name)));
        const local = [];
        const collect = (entries) => {
            for (const entry of entries ?? []) {
                const url = typeof entry === 'string' ? entry : entry.url;
                if (!/^https?:\/\//.test(url)) local.push(url);
            }
        };
        for (const file of configs) {
            const config = yaml.load(fs.readFileSync(file, 'utf8'));
            collect(config?.shared_docs);
            for (const variant of config?.variants ?? []) {
                collect(variant.docs_urls);
                collect(variant.shared_docs);
            }
        }
        expect(local.length).toBeGreaterThan(0);
        for (const entry of local) {
            expect(fs.existsSync(path.join(repoRoot, entry)), entry).toBe(true);
        }
    });
});

describe('the legacy SDK pages are read from the snapshots everywhere', () => {
    const LIVE = [
        'https://posthog.com/docs/libraries/python.md',
        'https://posthog.com/docs/references/posthog-python.md',
        'https://posthog.com/docs/libraries/node.md',
        'https://posthog.com/docs/references/posthog-node.md',
        'https://posthog.com/docs/libraries/go.md',
        'https://posthog.com/docs/libraries/rust.md',
        'https://posthog.com/docs/libraries/ios.md',
        'https://posthog.com/docs/libraries/ios/usage.md',
        'https://posthog.com/docs/libraries/ios/configuration.md',
        'https://posthog.com/docs/libraries/android.md',
        'https://posthog.com/docs/libraries/flutter.md',
        'https://posthog.com/docs/libraries/django.md',
        'https://posthog.com/docs/libraries/flask.md',
        'https://posthog.com/docs/feature-flags/installation/android.md',
        'https://posthog.com/docs/feature-flags/installation/ios.md',
        'https://posthog.com/docs/error-tracking/installation/ios.md',
        'https://posthog.com/docs/logs/installation/ios.md',
        'https://posthog.com/docs/error-tracking/installation/android.md',
        'https://posthog.com/docs/logs/installation/android.md',
        'https://posthog.com/docs/error-tracking/upload-mappings/android.md',
        'https://posthog.com/docs/feature-flags/installation/flutter.md',
        'https://posthog.com/docs/error-tracking/installation/flutter.md',
        'https://posthog.com/docs/logs/installation/flutter.md',
    ];

    // Those pages move to the capture v1 majors on release day; a skill fetching one live would flip with them.
    it('no skill config fetches one of the snapshotted pages live', () => {
        const configs = fs.readdirSync(path.join(repoRoot, 'context', 'skills'), { recursive: true })
            .filter(name => String(name).endsWith('config.yaml'))
            .map(name => fs.readFileSync(path.join(repoRoot, 'context', 'skills', String(name)), 'utf8'));
        for (const url of LIVE) {
            const offenders = configs.filter(text => text.includes(`- ${url}`));
            expect(offenders, url).toEqual([]);
        }
    });
});

describe('a snapshot keeps its own file name', async () => {
    const { urlToFilename } = await import('../skill-generator.js');
    it('uses the basename for a repo path and the last URL segment for a page', () => {
        expect(urlToFilename('context/docs-snapshots/legacy/usage.md')).toBe('usage.md');
        expect(urlToFilename('https://posthog.com/docs/libraries/ios/usage.md')).toBe('usage.md');
    });
});

describe('a variant shared doc', () => {
    const LIVE_FLAGS = 'https://posthog.com/docs/feature-flags/adding-feature-flag-code.md';
    const SNAPSHOT_FLAGS = 'context/docs-snapshots/legacy/feature-flags/adding-feature-flag-code.md';
    const BEST = 'https://posthog.com/docs/feature-flags/best-practices.md';

    it('replaces the group one with the same file name, in place', () => {
        const [legacy, other] = expandSkillGroups({
            flags: {
                shared_docs: [LIVE_FLAGS, BEST],
                variants: [
                    { id: 'legacy', display_name: 'Legacy', shared_docs: [SNAPSHOT_FLAGS, 'context/extra.md'] },
                    { id: 'other', display_name: 'Other' },
                ],
            },
        }, repoRoot);
        expect(legacy._sharedDocs).toEqual([SNAPSHOT_FLAGS, BEST, 'context/extra.md']);
        expect(other._sharedDocs).toEqual([LIVE_FLAGS, BEST]);
    });

    // The live page moves to posthog-android 4.0 and posthog-ios 4.0 on release day; these variants install 3.x.
    it.each([
        ['android', 'android'],
        ['ios', 'swift'],
    ])('gives the %s flag variants the 3.x flag code page', (standalone, step) => {
        for (const [config, id] of [['feature-flags', standalone], ['integration-v2/feature-flags-step', step]]) {
            const file = path.join(repoRoot, 'context', 'skills', config, 'config.yaml');
            const group = yaml.load(fs.readFileSync(file, 'utf8'));
            const skills = expandSkillGroups({ [config]: group }, path.join(repoRoot, 'context'));
            const variant = skills.find(skill => skill._shortId === id);
            expect(variant._sharedDocs, config).toContain(SNAPSHOT_FLAGS);
            expect(variant._sharedDocs, config).not.toContain(LIVE_FLAGS);
        }
    });
});
