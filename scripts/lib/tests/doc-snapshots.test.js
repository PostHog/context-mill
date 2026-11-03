import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { loadDoc } from '../skill-generator.js';

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
