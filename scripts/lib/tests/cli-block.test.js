import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
    parseCliBlock,
    resolveVariantCli,
    expandSkillGroups,
    serializeSkill,
} from '../skill-generator.js';
import { generateCliManifest } from '../build-phases.js';

function createFixture(tree, baseDir) {
    for (const [name, content] of Object.entries(tree)) {
        const fullPath = join(baseDir, name);
        if (typeof content === 'string') {
            writeFileSync(fullPath, content);
        } else {
            mkdirSync(fullPath, { recursive: true });
            createFixture(content, fullPath);
        }
    }
}

describe('parseCliBlock', () => {
    it('returns null when the block is absent', () => {
        expect(parseCliBlock(undefined, 'ctx')).toBeNull();
        expect(parseCliBlock(null, 'ctx')).toBeNull();
    });

    it('accepts a minimal public block with group and leaf', () => {
        const result = parseCliBlock({ surface: 'public', group: 'audit', leaf: 'events' }, 'ctx');
        expect(result).toEqual({ surface: 'public', group: 'audit', leaf: 'events' });
    });

    it('accepts a catalog block with no group/leaf', () => {
        expect(parseCliBlock({ surface: 'catalog' }, 'ctx')).toEqual({ surface: 'catalog' });
    });

    it('accepts an internal block', () => {
        expect(parseCliBlock({ surface: 'internal' }, 'ctx')).toEqual({ surface: 'internal' });
    });

    it('throws when surface is missing', () => {
        expect(() => parseCliBlock({ group: 'audit' }, 'ctx')).toThrow(/cli\.surface is required/);
    });

    it('throws on an unknown surface value', () => {
        expect(() => parseCliBlock({ surface: 'secret' }, 'ctx')).toThrow(/cli\.surface must be one of/);
    });

    it('rejects non-object inputs', () => {
        expect(() => parseCliBlock('public', 'ctx')).toThrow(/must be an object/);
        expect(() => parseCliBlock(['public'], 'ctx')).toThrow(/must be an object/);
    });

    it('rejects empty-string group or leaf', () => {
        expect(() => parseCliBlock({ surface: 'public', group: '' }, 'ctx')).toThrow(/cli\.group must be a non-empty string/);
        expect(() => parseCliBlock({ surface: 'public', leaf: '' }, 'ctx')).toThrow(/cli\.leaf must be a non-empty string/);
    });

    it('rejects unknown keys in the block', () => {
        expect(() => parseCliBlock({ surface: 'public', leaf: 'events', extra: true }, 'ctx')).toThrow(/unknown keys: extra/);
    });
});

describe('resolveVariantCli', () => {
    it('returns null when neither level declared a block', () => {
        expect(resolveVariantCli(null, null, { id: 'all' }, 'group-key')).toBeNull();
    });

    it('defaults leaf to the variant id for public surfaces', () => {
        const result = resolveVariantCli(
            { surface: 'public', group: 'migrate' },
            null,
            { id: 'statsig' },
            'migrate',
        );
        expect(result).toEqual({ surface: 'public', group: 'migrate', leaf: 'statsig' });
    });

    it('requires explicit leaf when variant id is "all"', () => {
        expect(() => resolveVariantCli({ surface: 'public', group: 'audit' }, null, { id: 'all' }, 'audit')).toThrow(/leaf is required at the group level/);
    });

    it('lets variant-level cli override group-level fields', () => {
        const merged = resolveVariantCli(
            { surface: 'public', group: 'audit', leaf: 'all' },
            { leaf: 'comprehensive' },
            { id: 'all' },
            'audit',
        );
        expect(merged).toEqual({ surface: 'public', group: 'audit', leaf: 'comprehensive' });
    });

    it('lets variant-level cli flip the surface from group default', () => {
        const merged = resolveVariantCli(
            { surface: 'public', group: 'audit', leaf: 'events' },
            { surface: 'catalog' },
            { id: 'all' },
            'audit-events',
        );
        expect(merged).toEqual({ surface: 'catalog', group: 'audit', leaf: 'events' });
    });
});

describe('expandSkillGroups with cli blocks', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'cli-block-test-'));
        mkdirSync(join(tmpDir, 'skills'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('attaches resolved cli to single-variant audit skills', () => {
        createFixture({
            skills: {
                'audit-events': { 'description.md': '# Audit events' },
            },
        }, tmpDir);
        const config = {
            'audit-events': {
                type: 'docs-only',
                template: 'description.md',
                cli: { surface: 'public', group: 'audit', leaf: 'events' },
                variants: [{ id: 'all', display_name: 'PostHog audit — events' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].id).toBe('audit-events');
        expect(skills[0]._cli).toEqual({ surface: 'public', group: 'audit', leaf: 'events' });
    });

    it('defaults leaf to variant id for migrate-style user-pick families', () => {
        createFixture({
            skills: {
                migrate: { 'description.md': '# Migrate' },
            },
        }, tmpDir);
        const config = {
            migrate: {
                type: 'docs-only',
                template: 'description.md',
                cli: { surface: 'public', group: 'migrate' },
                variants: [
                    { id: 'statsig', display_name: 'Statsig → PostHog' },
                    { id: 'amplitude', display_name: 'Amplitude → PostHog' },
                ],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0]._cli).toEqual({ surface: 'public', group: 'migrate', leaf: 'statsig' });
        expect(skills[1]._cli).toEqual({ surface: 'public', group: 'migrate', leaf: 'amplitude' });
    });

    it('leaves _cli null when no cli block is declared', () => {
        createFixture({
            skills: {
                integration: { 'description.md': '# Integration' },
            },
        }, tmpDir);
        const config = {
            integration: {
                type: 'docs-only',
                template: 'description.md',
                variants: [{ id: 'django', display_name: 'Django' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0]._cli).toBeNull();
    });

    it('serializeSkill includes cli when present and omits when absent', () => {
        createFixture({
            skills: {
                'audit-events': { 'description.md': '# Audit events' },
                integration: { 'description.md': '# Integration' },
            },
        }, tmpDir);
        const config = {
            'audit-events': {
                type: 'docs-only',
                template: 'description.md',
                cli: { surface: 'public', group: 'audit', leaf: 'events' },
                variants: [{ id: 'all', display_name: 'PostHog audit — events' }],
            },
            integration: {
                type: 'docs-only',
                template: 'description.md',
                variants: [{ id: 'django', display_name: 'Django' }],
            },
        };
        const expanded = expandSkillGroups(config, tmpDir);
        const tagged = expanded.find(s => s.id === 'audit-events');
        const untagged = expanded.find(s => s.id === 'integration-django');
        expect(serializeSkill(tagged).cli).toEqual({ surface: 'public', group: 'audit', leaf: 'events' });
        expect(serializeSkill(untagged)).not.toHaveProperty('cli');
    });
});

describe('generateCliManifest', () => {
    const baseManifest = {
        version: '1.0',
        buildVersion: 'test',
        buildTimestamp: '2026-06-08T00:00:00.000Z',
    };

    it('emits only skills with a cli block', () => {
        const skills = [
            { id: 'integration-django', displayName: 'Django', description: 'd' },
            { id: 'audit-events', displayName: 'Audit events', description: 'a',
              cli: { surface: 'public', group: 'audit', leaf: 'events' } },
        ];
        const manifest = generateCliManifest({ allSkills: skills, manifest: baseManifest });
        expect(manifest.entries).toHaveLength(1);
        expect(manifest.entries[0].skillId).toBe('audit-events');
    });

    it('carries version + buildVersion + buildTimestamp through', () => {
        const manifest = generateCliManifest({ allSkills: [], manifest: baseManifest });
        expect(manifest).toMatchObject({
            version: '1.0',
            buildVersion: 'test',
            buildTimestamp: '2026-06-08T00:00:00.000Z',
            entries: [],
        });
    });

    it('omits group and leaf when not set on the cli block', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'doctor', displayName: 'Doctor', description: 'd',
                  cli: { surface: 'catalog' } },
            ],
            manifest: baseManifest,
        });
        expect(manifest.entries[0]).toEqual({
            skillId: 'doctor',
            surface: 'catalog',
            displayName: 'Doctor',
            description: 'd',
        });
    });

    it('sorts entries by surface, then group, then leaf', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'b-cat', displayName: 'B', description: 'd', cli: { surface: 'catalog' } },
                { id: 'a-int', displayName: 'A', description: 'd', cli: { surface: 'internal' } },
                { id: 'audit-events', displayName: 'AE', description: 'd',
                  cli: { surface: 'public', group: 'audit', leaf: 'events' } },
                { id: 'audit-all', displayName: 'A', description: 'd',
                  cli: { surface: 'public', group: 'audit', leaf: 'all' } },
                { id: 'revenue', displayName: 'R', description: 'd',
                  cli: { surface: 'public', leaf: 'revenue' } },
            ],
            manifest: baseManifest,
        });
        const order = manifest.entries.map(e => e.skillId);
        // public (no group sorts before grouped 'audit'), then catalog, then internal
        expect(order).toEqual(['revenue', 'audit-all', 'audit-events', 'b-cat', 'a-int']);
    });
});
