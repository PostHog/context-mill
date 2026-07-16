import { describe, it, expect } from 'vitest';
import { generateManifest } from '../build-phases.js';

const uriSchema = {
    manifest_version: '1.0',
    scheme: 'posthog://',
    patterns: { skill: 'skills/{group}/{id}', doc: 'docs/{id}' },
};

const skill = (shortId, extra = {}) => ({
    id: `integration-v2-capture-${shortId}`,
    shortId,
    name: shortId,
    group: 'integration-v2/capture',
    description: `${shortId} description`,
    tags: [],
    ...extra,
});

const generate = (resources, docContents = {}) =>
    generateManifest({ resources, uriSchema, version: '1.2.3', docContents });

const ids = manifest => manifest.resources.map(r => r.id);

describe('generateManifest', () => {
    it('omits bundled variants, which ship inside their group JSON and have no zip to point at', () => {
        const manifest = generate([skill('django', { bundle: true }), skill('nextjs', { bundle: true })]);

        expect(manifest.resources).toEqual([]);
    });

    it('keeps an unbundled skill alongside bundled variants of the same group', () => {
        const manifest = generate([skill('django', { bundle: true }), skill('nextjs')]);

        expect(ids(manifest)).toEqual(['integration-v2-capture-nextjs']);
    });

    it('gives an unbundled skill a file and download url naming its own zip', () => {
        const [entry] = generate([skill('nextjs')]).resources;

        expect(entry.file).toBe('integration-v2-capture-nextjs.zip');
        expect(entry.downloadUrl).toMatch(/integration-v2-capture-nextjs\.zip$/);
        expect(entry.resource.text).toBe(entry.downloadUrl);
    });

    it('never emits a file for a resource the build does not ship as a zip', () => {
        const manifest = generate(
            [skill('django', { bundle: true }), skill('nextjs'), { id: 'guide', type: 'doc', name: 'Guide', tags: [] }],
            { guide: 'guide text' },
        );

        const shipped = new Set(['integration-v2-capture-nextjs.zip']);
        for (const entry of manifest.resources) {
            if (entry.file) {
                expect(shipped).toContain(entry.file);
            }
        }
    });

    it('inlines doc text instead of pointing at a zip', () => {
        const [entry] = generate([{ id: 'guide', type: 'doc', name: 'Guide', tags: [] }], { guide: 'guide text' })
            .resources;

        expect(entry.file).toBeUndefined();
        expect(entry.resource.mimeType).toBe('text/markdown');
        expect(entry.resource.text).toBe('guide text');
    });
});
