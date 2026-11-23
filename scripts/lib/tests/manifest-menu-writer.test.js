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
    id: `logs-${shortId}`,
    shortId,
    name: shortId,
    group: 'logs',
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
    it('lists every skill in the manifest and on the menu, each pointing at its own zip', () => {
        write([skill('django'), skill('nextjs')]);

        expect(read('manifest.json').resources.map(r => r.id)).toEqual(['logs-django', 'logs-nextjs']);
        expect(menuEntries().map(entry => entry.downloadUrl)).toEqual([
            expect.stringMatching(/\/logs-django\.zip$/),
            expect.stringMatching(/\/logs-nextjs\.zip$/),
        ]);
    });

    it('publishes title, description and tags, adding the match keys, group and default without touching the skill', () => {
        const rails = skill('rails', { displayName: 'Ruby on Rails', match: { framework: 'rails' }, default: true, tags: ['ruby-on-rails'] });
        write([rails]);

        const [entry] = menuEntries();
        expect(entry).toMatchObject({ title: 'Ruby on Rails', description: 'rails description' });
        expect(entry.tags).toEqual(['ruby-on-rails', 'framework:rails', 'logs', 'default']);
        expect(rails.tags).toEqual(['ruby-on-rails']);
    });

    it('adds no default tag to a skill that is not its group\'s default', () => {
        write([skill('django', { match: { framework: 'django' } })]);

        expect(menuEntries()[0].tags).toEqual(['framework:django', 'logs']);
    });

    it('says which projects a skill serves in its tags alone', () => {
        write([skill('rails', { match: { framework: 'rails' }, default: true })]);

        expect(Object.keys(menuEntries()[0]).sort()).toEqual(['description', 'downloadUrl', 'id', 'name', 'tags', 'title']);
    });
});
