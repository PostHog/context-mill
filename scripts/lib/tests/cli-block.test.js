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
import { generateCliManifest, validateCliManifest } from '../build-phases.js';

const SCHEMA_PATH = join(
    import.meta.dirname,
    '../../../transformation-config/cli-manifest.schema.json',
);

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

    it('accepts a minimal command block with parentCommand and command', () => {
        const result = parseCliBlock(
            { role: 'command', parentCommand: 'audit', command: 'events' },
            'ctx',
        );
        expect(result).toEqual({ role: 'command', parentCommand: 'audit', command: 'events' });
    });

    it('accepts a flat command block with only command', () => {
        expect(parseCliBlock({ role: 'command', command: 'revenue' }, 'ctx')).toEqual({
            role: 'command',
            command: 'revenue',
        });
    });

    it('accepts a skill block with no command/parentCommand', () => {
        expect(parseCliBlock({ role: 'skill' }, 'ctx')).toEqual({ role: 'skill' });
    });

    it('accepts an internal block', () => {
        expect(parseCliBlock({ role: 'internal' }, 'ctx')).toEqual({ role: 'internal' });
    });

    it('throws when role is missing', () => {
        expect(() => parseCliBlock({ command: 'events' }, 'ctx')).toThrow(/cli\.role is required/);
    });

    it('throws on an unknown role value', () => {
        expect(() => parseCliBlock({ role: 'secret' }, 'ctx')).toThrow(/cli\.role must be one of/);
    });

    it('rejects non-object inputs', () => {
        expect(() => parseCliBlock('command', 'ctx')).toThrow(/must be an object/);
        expect(() => parseCliBlock(['command'], 'ctx')).toThrow(/must be an object/);
    });

    it('rejects empty-string command or parentCommand', () => {
        expect(() => parseCliBlock({ role: 'command', command: '' }, 'ctx')).toThrow(/cli\.command must be a non-empty string/);
        expect(() => parseCliBlock({ role: 'command', parentCommand: '' }, 'ctx')).toThrow(/cli\.parentCommand must be a non-empty string/);
    });

    it('rejects unknown keys in the block', () => {
        expect(() => parseCliBlock({ role: 'command', command: 'events', extra: true }, 'ctx')).toThrow(/unknown keys: extra/);
    });

    describe('naming convention enforcement', () => {
        it('rejects non-kebab-case command names', () => {
            expect(() => parseCliBlock({ role: 'command', command: 'CamelCase' }, 'ctx'))
                .toThrow(/must be kebab-case/);
            expect(() => parseCliBlock({ role: 'command', command: 'snake_case' }, 'ctx'))
                .toThrow(/must be kebab-case/);
            expect(() => parseCliBlock({ role: 'command', command: '1leading-digit' }, 'ctx'))
                .toThrow(/must be kebab-case/);
        });

        it('rejects too-short command names', () => {
            expect(() => parseCliBlock({ role: 'command', command: 'a' }, 'ctx'))
                .toThrow(/must be 2–20 characters/);
        });

        it('rejects too-long command names', () => {
            const longName = 'a-very-very-very-long-name';
            expect(() => parseCliBlock({ role: 'command', command: longName }, 'ctx'))
                .toThrow(/must be 2–20 characters/);
        });

        it('rejects yargs reserved words', () => {
            for (const word of ['help', 'version', 'completion']) {
                expect(() => parseCliBlock({ role: 'command', command: word }, 'ctx'))
                    .toThrow(/yargs reserved word/);
            }
        });

        it('rejects names that collide with internal wizard flags', () => {
            for (const flag of ['playground', 'benchmark', 'yara-report', 'local-mcp', 'ci', 'skill']) {
                expect(() => parseCliBlock({ role: 'command', command: flag }, 'ctx'))
                    .toThrow(/wizard internal flag/);
            }
        });

        it('applies the same checks to parentCommand', () => {
            expect(() => parseCliBlock({ role: 'command', parentCommand: 'help', command: 'events' }, 'ctx'))
                .toThrow(/yargs reserved word/);
            expect(() => parseCliBlock({ role: 'command', parentCommand: 'NotKebab', command: 'events' }, 'ctx'))
                .toThrow(/must be kebab-case/);
        });

        it('accepts hyphenated names within the 2-20 char range', () => {
            const result = parseCliBlock({
                role: 'command',
                parentCommand: 'audit',
                command: 'session-replay',
            }, 'ctx');
            expect(result.command).toBe('session-replay');
        });
    });
});

describe('resolveVariantCli', () => {
    it('returns null when neither level declared a block', () => {
        expect(resolveVariantCli(null, null, { id: 'all' }, 'group-key')).toBeNull();
    });

    it('defaults command to the variant id for the command role', () => {
        const result = resolveVariantCli(
            { role: 'command', parentCommand: 'migrate' },
            null,
            { id: 'statsig' },
            'migrate',
        );
        expect(result).toEqual({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });

    it('requires explicit command when variant id is "all"', () => {
        expect(() =>
            resolveVariantCli({ role: 'command', parentCommand: 'audit' }, null, { id: 'all' }, 'audit'),
        ).toThrow(/command is required at the group level/);
    });

    it('validates the variant id when it is used as the fallback command', () => {
        // A reserved word or non-kebab id must be rejected even though it was
        // never typed as an explicit command.
        expect(() =>
            resolveVariantCli({ role: 'command', parentCommand: 'audit' }, null, { id: 'help' }, 'audit'),
        ).toThrow(/yargs reserved word/);
        expect(() =>
            resolveVariantCli({ role: 'command', parentCommand: 'migrate' }, null, { id: 'CamelCase' }, 'migrate'),
        ).toThrow(/must be kebab-case/);
    });

    it('lets variant-level cli override group-level fields', () => {
        const merged = resolveVariantCli(
            { role: 'command', parentCommand: 'audit', command: 'all' },
            { command: 'comprehensive' },
            { id: 'all' },
            'audit',
        );
        expect(merged).toEqual({ role: 'command', parentCommand: 'audit', command: 'comprehensive' });
    });

    it('lets variant-level cli flip the role from the group default', () => {
        const merged = resolveVariantCli(
            { role: 'command', parentCommand: 'audit', command: 'events' },
            { role: 'skill' },
            { id: 'all' },
            'audit-events',
        );
        expect(merged).toEqual({ role: 'skill', parentCommand: 'audit', command: 'events' });
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
                cli: { role: 'command', parentCommand: 'audit', command: 'events' },
                variants: [{ id: 'all', display_name: 'PostHog audit — events' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].id).toBe('audit-events');
        expect(skills[0]._cli).toEqual({
            role: 'command',
            parentCommand: 'audit',
            command: 'events',
        });
    });

    it('defaults command to variant id for migrate-style user-pick families', () => {
        createFixture({
            skills: {
                migrate: { 'description.md': '# Migrate' },
            },
        }, tmpDir);
        const config = {
            migrate: {
                type: 'docs-only',
                template: 'description.md',
                cli: { role: 'command', parentCommand: 'migrate' },
                variants: [
                    { id: 'statsig', display_name: 'Statsig → PostHog' },
                    { id: 'amplitude', display_name: 'Amplitude → PostHog' },
                ],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0]._cli).toEqual({
            role: 'command',
            parentCommand: 'migrate',
            command: 'statsig',
        });
        expect(skills[1]._cli).toEqual({
            role: 'command',
            parentCommand: 'migrate',
            command: 'amplitude',
        });
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
                cli: { role: 'command', parentCommand: 'audit', command: 'events' },
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
        expect(serializeSkill(tagged).cli).toEqual({
            role: 'command',
            parentCommand: 'audit',
            command: 'events',
        });
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
              cli: { role: 'command', parentCommand: 'audit', command: 'events' } },
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

    it('omits command and parentCommand when not set on the cli block', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'doctor', displayName: 'Doctor', description: 'd',
                  cli: { role: 'skill' } },
            ],
            manifest: baseManifest,
        });
        expect(manifest.entries[0]).toEqual({
            skillId: 'doctor',
            role: 'skill',
            displayName: 'Doctor',
            description: 'd',
        });
    });

    it('sorts entries by role, then parentCommand, then command', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'b-skill', displayName: 'B', description: 'd', cli: { role: 'skill' } },
                { id: 'a-int', displayName: 'A', description: 'd', cli: { role: 'internal' } },
                { id: 'audit-events', displayName: 'AE', description: 'd',
                  cli: { role: 'command', parentCommand: 'audit', command: 'events' } },
                { id: 'audit-all', displayName: 'A', description: 'd',
                  cli: { role: 'command', parentCommand: 'audit', command: 'all' } },
                { id: 'revenue', displayName: 'R', description: 'd',
                  cli: { role: 'command', command: 'revenue' } },
            ],
            manifest: baseManifest,
        });
        const order = manifest.entries.map(e => e.skillId);
        // command flat (no parent) sorts before grouped 'audit', then skill, then internal
        expect(order).toEqual(['revenue', 'audit-all', 'audit-events', 'b-skill', 'a-int']);
    });

    it('carries recommended:true through into the entry', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'audit-all', displayName: 'Audit', description: 'd',
                  cli: { role: 'command', parentCommand: 'audit', command: 'all', recommended: true } },
            ],
            manifest: baseManifest,
        });
        expect(manifest.entries[0]).toMatchObject({
            skillId: 'audit-all',
            parentCommand: 'audit',
            command: 'all',
            recommended: true,
        });
    });

    it('throws when a family has more than one recommended leaf', () => {
        expect(() =>
            generateCliManifest({
                allSkills: [
                    { id: 'audit-all', displayName: 'A', description: 'd',
                      cli: { role: 'command', parentCommand: 'audit', command: 'all', recommended: true } },
                    { id: 'audit-events', displayName: 'AE', description: 'd',
                      cli: { role: 'command', parentCommand: 'audit', command: 'events', recommended: true } },
                ],
                manifest: baseManifest,
            }),
        ).toThrow(/Family "audit" has more than one cli\.recommended leaf/);
    });

    it('throws when recommended is set on a flat command with no parentCommand', () => {
        expect(() =>
            generateCliManifest({
                allSkills: [
                    { id: 'revenue', displayName: 'R', description: 'd',
                      cli: { role: 'command', command: 'revenue', recommended: true } },
                ],
                manifest: baseManifest,
            }),
        ).toThrow(/only valid on a leaf inside a family/);
    });
});

describe('validateCliManifest (manifest matches published schema)', () => {
    const baseManifest = {
        version: '1.0',
        buildVersion: 'test',
        buildTimestamp: '2026-06-08T00:00:00.000Z',
    };

    it('accepts a manifest the emitter actually produces', () => {
        const manifest = generateCliManifest({
            allSkills: [
                { id: 'revenue-analytics-setup', displayName: 'Revenue', description: 'd',
                  cli: { role: 'command', command: 'revenue-analytics' } },
                { id: 'audit', displayName: 'Audit', description: 'd',
                  cli: { role: 'command', parentCommand: 'audit', command: 'all', recommended: true } },
                { id: 'audit-events', displayName: 'Audit events', description: 'd',
                  cli: { role: 'command', parentCommand: 'audit', command: 'events' } },
            ],
            manifest: baseManifest,
        });
        expect(() => validateCliManifest(manifest, SCHEMA_PATH)).not.toThrow();
    });

    it('accepts an empty manifest', () => {
        const manifest = generateCliManifest({ allSkills: [], manifest: baseManifest });
        expect(() => validateCliManifest(manifest, SCHEMA_PATH)).not.toThrow();
    });

    it('rejects an entry missing a required field', () => {
        const bad = {
            ...baseManifest,
            entries: [{ skillId: 'x', role: 'command', command: 'events' }], // no displayName/description
        };
        expect(() => validateCliManifest(bad, SCHEMA_PATH)).toThrow(/failed validation/);
    });

    it('rejects an entry with an unknown field (additionalProperties: false)', () => {
        const bad = {
            ...baseManifest,
            entries: [{
                skillId: 'x', role: 'command', command: 'events',
                displayName: 'X', description: 'd', surprise: true,
            }],
        };
        expect(() => validateCliManifest(bad, SCHEMA_PATH)).toThrow(/failed validation/);
    });

    it('rejects a role outside the enum', () => {
        const bad = {
            ...baseManifest,
            entries: [{
                skillId: 'x', role: 'banana',
                displayName: 'X', description: 'd',
            }],
        };
        expect(() => validateCliManifest(bad, SCHEMA_PATH)).toThrow(/failed validation/);
    });

    it('rejects a command-role entry with no command (if/then rule)', () => {
        const bad = {
            ...baseManifest,
            entries: [{
                skillId: 'x', role: 'command',
                displayName: 'X', description: 'd',
            }],
        };
        expect(() => validateCliManifest(bad, SCHEMA_PATH)).toThrow(/failed validation/);
    });

    it('allows a skill-role entry with no command', () => {
        const ok = {
            ...baseManifest,
            entries: [{
                skillId: 'x', role: 'skill',
                displayName: 'X', description: 'd',
            }],
        };
        expect(() => validateCliManifest(ok, SCHEMA_PATH)).not.toThrow();
    });
});
