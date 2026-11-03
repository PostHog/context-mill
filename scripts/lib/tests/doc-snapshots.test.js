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
        for (const file of configs) {
            const config = yaml.load(fs.readFileSync(file, 'utf8'));
            for (const variant of config?.variants ?? []) {
                for (const entry of variant.docs_urls ?? []) {
                    const url = typeof entry === 'string' ? entry : entry.url;
                    if (!/^https?:\/\//.test(url)) local.push(url);
                }
            }
        }
        expect(local.length).toBeGreaterThan(0);
        for (const entry of local) {
            expect(fs.existsSync(path.join(repoRoot, entry)), entry).toBe(true);
        }
    });
});
