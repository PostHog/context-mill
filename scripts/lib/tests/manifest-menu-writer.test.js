import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeManifestAndMenu } from '../build-phases.js';

const URI_SCHEMA = `
manifest_version: "1.0"
scheme: posthog://
patterns:
  skill: skills/{group}/{id}
  doc: docs/{id}
`;

const skill = (shortId, extra = {}) => ({
    id: `integration-v2-capture-${shortId}`,
    shortId,
    name: shortId,
    group: 'integration-v2/capture',
    description: `${shortId} description`,
    tags: [],
    ...extra,
});

let dir;
const configDir = () => path.join(dir, 'config');
const distDir = () => path.join(dir, 'dist');
const read = name => JSON.parse(fs.readFileSync(path.join(distDir(), 'skills', name), 'utf8'));

const write = allSkills =>
    writeManifestAndMenu({ allSkills, docContents: {}, distDir: distDir(), configDir: configDir(), version: '1.2.3' });

const menuEntries = () => Object.values(read('skill-menu.json').categories).flat();

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-menu-'));
    fs.mkdirSync(configDir(), { recursive: true });
    fs.writeFileSync(path.join(configDir(), 'uri-schema.yaml'), URI_SCHEMA);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('writeManifestAndMenu', () => {
    it('gives a bundled group one menu entry whose download url names the group JSON', () => {
        write([skill('django', { bundle: true }), skill('nextjs', { bundle: true })]);

        const [entry] = menuEntries();
        expect(entry.bundle).toBe(true);
        expect(entry.downloadUrl).toMatch(/\/integration-v2-capture\.json$/);
    });

    it('keeps bundled variants out of the manifest while the menu still lists every one', () => {
        write([skill('django', { bundle: true }), skill('nextjs', { bundle: true })]);

        expect(read('manifest.json').resources).toEqual([]);
        expect(menuEntries()[0].variants.map(v => v.id).sort()).toEqual([
            'integration-v2-capture-django',
            'integration-v2-capture-nextjs',
        ]);
    });

    it('still points an unbundled skill at its own zip', () => {
        write([skill('nextjs')]);

        const [entry] = menuEntries();
        expect(entry.bundle).toBeUndefined();
        expect(entry.downloadUrl).toMatch(/\/integration-v2-capture-nextjs\.zip$/);
    });

    it('emits one menu entry per framework for a multi-framework variant', () => {
        write([skill('python', { frameworks: ['python', 'django', 'flask'] })]);

        const entries = menuEntries();
        expect(entries.map(e => e.framework).sort()).toEqual(['django', 'flask', 'python']);
        expect(new Set(entries.map(e => e.id)).size).toBe(1);
        expect(new Set(entries.map(e => e.downloadUrl)).size).toBe(1);
    });

    it('an empty frameworks list falls back to a single bare entry', () => {
        write([skill('python', { frameworks: [] })]);

        const entries = menuEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].framework).toBeUndefined();
    });

    it('expands multi-framework variants inside a bundle the same way', () => {
        write([
            skill('python', { bundle: true, frameworks: ['django', 'flask'] }),
            skill('nodejs', { bundle: true, framework: 'nextjs' }),
        ]);

        const [entry] = menuEntries();
        expect(entry.variants).toEqual([
            { id: 'integration-v2-capture-python', framework: 'django' },
            { id: 'integration-v2-capture-python', framework: 'flask' },
            { id: 'integration-v2-capture-nodejs', framework: 'nextjs' },
        ]);
    });
});
