import { describe, it, expect } from 'vitest';
import { generateManifest } from '../build-phases.js';

const uriSchema = {
    manifest_version: '1.0',
    scheme: 'posthog://',
    patterns: { skill: 'skills/{group}/{id}', doc: 'docs/{id}' },
};

const skill = (shortId, extra = {}) => ({
    id: `logs-${shortId}`,
    shortId,
    name: shortId,
    group: 'logs',
    description: `${shortId} description`,
    tags: [],
    ...extra,
});

const generate = (resources, docContents = {}) =>
    generateManifest({ resources, uriSchema, version: '1.2.3', docContents });

const ids = manifest => manifest.resources.map(r => r.id);

describe('generateManifest', () => {
    it('lists every skill of a group', () => {
        const manifest = generate([skill('django'), skill('nextjs')]);

        expect(ids(manifest)).toEqual(['logs-django', 'logs-nextjs']);
    });

    it('gives a skill a file and download url naming its own zip', () => {
        const [entry] = generate([skill('nextjs')]).resources;

        expect(entry.file).toBe('logs-nextjs.zip');
        expect(entry.downloadUrl).toMatch(/logs-nextjs\.zip$/);
        expect(entry.resource.text).toBe(entry.downloadUrl);
    });

    it('inlines doc text instead of pointing at a zip', () => {
        const [entry] = generate([{ id: 'guide', type: 'doc', name: 'Guide', tags: [] }], { guide: 'guide text' })
            .resources;

        expect(entry.file).toBeUndefined();
        expect(entry.resource.mimeType).toBe('text/markdown');
        expect(entry.resource.text).toBe('guide text');
    });
});
