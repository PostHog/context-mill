import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeBundles } from '../build-phases.js';

// Two variants of one bundled group, plus an unbundled skill that must stay a zip.
const skill = (shortId, bundle = true) => ({
    id: `capture-${shortId}`,
    shortId,
    group: 'capture',
    bundle,
});

let dir;
const sourceDir = () => path.join(dir, 'src');
const skillsDir = () => path.join(dir, 'skills');
const readBundle = () =>
    JSON.parse(fs.readFileSync(path.join(skillsDir(), 'capture.json'), 'utf8'));

function writeVariantSource(shortId, contents) {
    const variantDir = path.join(sourceDir(), `capture-${shortId}`);
    fs.mkdirSync(path.join(variantDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(variantDir, 'SKILL.md'), contents);
    fs.writeFileSync(path.join(variantDir, 'references', `${shortId}.md`), `${shortId} docs`);
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-writer-'));
    fs.mkdirSync(skillsDir(), { recursive: true });
    writeVariantSource('django', 'django v1');
    writeVariantSource('nextjs', 'nextjs v1');
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('writeBundles', () => {
    it('writes one JSON per group holding every variant, keyed by short id', () => {
        writeBundles({
            skills: [skill('django'), skill('nextjs')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });

        const bundle = readBundle();
        expect(bundle.id).toBe('capture');
        expect(Object.keys(bundle.variants).sort()).toEqual(['django', 'nextjs']);
        expect(bundle.variants.django['SKILL.md']).toBe('django v1');
        expect(bundle.variants.django['references/django.md']).toBe('django docs');
    });

    it('leaves an unbundled skill out of the bundle entirely', () => {
        writeBundles({
            skills: [skill('django'), skill('nextjs', false)],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });

        expect(Object.keys(readBundle().variants)).toEqual(['django']);
    });

    it('merges a rebuilt variant into the group without dropping the others', () => {
        writeBundles({
            skills: [skill('django'), skill('nextjs')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });
        writeVariantSource('django', 'django v2');

        // The dev server rebuilds only the variant whose source changed.
        writeBundles({
            skills: [skill('django')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
            merge: true,
        });

        const bundle = readBundle();
        expect(Object.keys(bundle.variants).sort()).toEqual(['django', 'nextjs']);
        expect(bundle.variants.django['SKILL.md']).toBe('django v2');
        expect(bundle.variants.nextjs['SKILL.md']).toBe('nextjs v1');
    });

    it('drops a removed variant on a full write', () => {
        writeBundles({
            skills: [skill('django'), skill('nextjs')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });

        writeBundles({
            skills: [skill('django')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });

        expect(Object.keys(readBundle().variants)).toEqual(['django']);
    });

    it('rejects duplicate variant ids instead of silently overwriting', () => {
        expect(() =>
            writeBundles({
                skills: [skill('django'), skill('django')],
                sourceDir: sourceDir(),
                skillsDir: skillsDir(),
            }),
        ).toThrow('duplicate variant id "django"');
    });

    it('returns the written bundles so the caller can archive them', () => {
        const artifacts = writeBundles({
            skills: [skill('django')],
            sourceDir: sourceDir(),
            skillsDir: skillsDir(),
        });

        expect(Object.keys(artifacts)).toEqual(['capture.json']);
        expect(JSON.parse(artifacts['capture.json'].toString()).id).toBe('capture');
    });
});
