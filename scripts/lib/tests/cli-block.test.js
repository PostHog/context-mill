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
import { generateHatEntries, toLegacyCliEntries } from '../build-phases.js';

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

    it('accepts a minimal hat block with parentHat and hat', () => {
        const result = parseCliBlock(
            { role: 'hat', parentHat: 'audit', hat: 'events' },
            'ctx',
        );
        expect(result).toEqual({ role: 'hat', parentHat: 'audit', hat: 'events' });
    });

    it('accepts a flat hat block with only hat', () => {
        expect(parseCliBlock({ role: 'hat', hat: 'revenue' }, 'ctx')).toEqual({
            role: 'hat',
            hat: 'revenue',
        });
    });

    it('accepts a skill block with no hat/parentHat', () => {
        expect(parseCliBlock({ role: 'skill' }, 'ctx')).toEqual({ role: 'skill' });
    });

    it('accepts an internal block', () => {
        expect(parseCliBlock({ role: 'internal' }, 'ctx')).toEqual({ role: 'internal' });
    });

    it('throws when role is missing', () => {
        expect(() => parseCliBlock({ hat: 'events' }, 'ctx')).toThrow(/cli\.role is required/);
    });

    it('throws on an unknown role value', () => {
        expect(() => parseCliBlock({ role: 'secret' }, 'ctx')).toThrow(/cli\.role must be one of/);
    });

    it('rejects non-object inputs', () => {
        expect(() => parseCliBlock('hat', 'ctx')).toThrow(/must be an object/);
        expect(() => parseCliBlock(['hat'], 'ctx')).toThrow(/must be an object/);
    });

    it('rejects empty-string hat or parentHat', () => {
        expect(() => parseCliBlock({ role: 'hat', hat: '' }, 'ctx')).toThrow(/cli\.hat must be a non-empty string/);
        expect(() => parseCliBlock({ role: 'hat', parentHat: '' }, 'ctx')).toThrow(/cli\.parentHat must be a non-empty string/);
    });

    it('rejects unknown keys in the block', () => {
        expect(() => parseCliBlock({ role: 'hat', hat: 'events', extra: true }, 'ctx')).toThrow(/unknown keys: extra/);
    });

    describe('legacy command spellings', () => {
        it('normalizes role: command to role: hat', () => {
            expect(parseCliBlock({ role: 'command', command: 'events' }, 'ctx')).toEqual({
                role: 'hat',
                hat: 'events',
            });
        });

        it('normalizes command/parentCommand to hat/parentHat', () => {
            expect(
                parseCliBlock({ role: 'command', parentCommand: 'audit', command: 'events' }, 'ctx'),
            ).toEqual({ role: 'hat', parentHat: 'audit', hat: 'events' });
        });
    });

    describe('naming convention enforcement', () => {
        it('rejects non-kebab-case hat names', () => {
            expect(() => parseCliBlock({ role: 'hat', hat: 'CamelCase' }, 'ctx'))
                .toThrow(/must be kebab-case/);
            expect(() => parseCliBlock({ role: 'hat', hat: 'snake_case' }, 'ctx'))
                .toThrow(/must be kebab-case/);
            expect(() => parseCliBlock({ role: 'hat', hat: '1leading-digit' }, 'ctx'))
                .toThrow(/must be kebab-case/);
        });

        it('rejects too-short hat names', () => {
            expect(() => parseCliBlock({ role: 'hat', hat: 'a' }, 'ctx'))
                .toThrow(/must be 2–20 characters/);
        });

        it('rejects too-long hat names', () => {
            const longName = 'a-very-very-very-long-name';
            expect(() => parseCliBlock({ role: 'hat', hat: longName }, 'ctx'))
                .toThrow(/must be 2–20 characters/);
        });

        it('rejects yargs reserved words', () => {
            for (const word of ['help', 'version', 'completion']) {
                expect(() => parseCliBlock({ role: 'hat', hat: word }, 'ctx'))
                    .toThrow(/yargs reserved word/);
            }
        });

        it('rejects names that collide with internal wizard flags', () => {
            for (const flag of ['playground', 'benchmark', 'yara-report', 'local-mcp', 'ci', 'skill']) {
                expect(() => parseCliBlock({ role: 'hat', hat: flag }, 'ctx'))
                    .toThrow(/wizard internal flag/);
            }
        });

        it('applies the same checks to parentHat', () => {
            expect(() => parseCliBlock({ role: 'hat', parentHat: 'help', hat: 'events' }, 'ctx'))
                .toThrow(/yargs reserved word/);
            expect(() => parseCliBlock({ role: 'hat', parentHat: 'NotKebab', hat: 'events' }, 'ctx'))
                .toThrow(/must be kebab-case/);
        });

        it('accepts hyphenated names within the 2-20 char range', () => {
            const result = parseCliBlock({
                role: 'hat',
                parentHat: 'audit',
                hat: 'session-replay',
            }, 'ctx');
            expect(result.hat).toBe('session-replay');
        });
    });
});

describe('resolveVariantCli', () => {
    it('returns null when neither level declared a block', () => {
        expect(resolveVariantCli(null, null, { id: 'all' }, 'group-key')).toBeNull();
    });

    it('defaults hat to the variant id for the hat role', () => {
        const result = resolveVariantCli(
            { role: 'hat', parentHat: 'migrate' },
            null,
            { id: 'statsig' },
            'migrate',
        );
        expect(result).toEqual({ role: 'hat', parentHat: 'migrate', hat: 'statsig' });
    });

    it('requires explicit hat when variant id is "all"', () => {
        expect(() =>
            resolveVariantCli({ role: 'hat', parentHat: 'audit' }, null, { id: 'all' }, 'audit'),
        ).toThrow(/hat is required at the group level/);
    });

    it('validates the variant id when it is used as the fallback hat', () => {
        // A reserved word or non-kebab id must be rejected even though it was
        // never typed as an explicit hat.
        expect(() =>
            resolveVariantCli({ role: 'hat', parentHat: 'audit' }, null, { id: 'help' }, 'audit'),
        ).toThrow(/yargs reserved word/);
        expect(() =>
            resolveVariantCli({ role: 'hat', parentHat: 'migrate' }, null, { id: 'CamelCase' }, 'migrate'),
        ).toThrow(/must be kebab-case/);
    });

    it('lets variant-level cli override group-level fields', () => {
        const merged = resolveVariantCli(
            { role: 'hat', parentHat: 'audit', hat: 'all' },
            { hat: 'comprehensive' },
            { id: 'all' },
            'audit',
        );
        expect(merged).toEqual({ role: 'hat', parentHat: 'audit', hat: 'comprehensive' });
    });

    it('lets variant-level cli flip the role from the group default', () => {
        const merged = resolveVariantCli(
            { role: 'hat', parentHat: 'audit', hat: 'events' },
            { role: 'skill' },
            { id: 'all' },
            'audit-events',
        );
        expect(merged).toEqual({ role: 'skill', parentHat: 'audit', hat: 'events' });
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
                cli: { role: 'hat', parentHat: 'audit', hat: 'events' },
                variants: [{ id: 'all', display_name: 'PostHog audit — events' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].id).toBe('audit-events');
        expect(skills[0]._cli).toEqual({
            role: 'hat',
            parentHat: 'audit',
            hat: 'events',
        });
    });

    it('defaults hat to variant id for migrate-style user-pick families', () => {
        createFixture({
            skills: {
                migrate: { 'description.md': '# Migrate' },
            },
        }, tmpDir);
        const config = {
            migrate: {
                type: 'docs-only',
                template: 'description.md',
                cli: { role: 'hat', parentHat: 'migrate' },
                variants: [
                    { id: 'statsig', display_name: 'Statsig → PostHog' },
                    { id: 'amplitude', display_name: 'Amplitude → PostHog' },
                ],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0]._cli).toEqual({
            role: 'hat',
            parentHat: 'migrate',
            hat: 'statsig',
        });
        expect(skills[1]._cli).toEqual({
            role: 'hat',
            parentHat: 'migrate',
            hat: 'amplitude',
        });
    });

    it('normalizes a legacy command block to the hat shape', () => {
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
        expect(skills[0]._cli).toEqual({
            role: 'hat',
            parentHat: 'audit',
            hat: 'events',
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
                cli: { role: 'hat', parentHat: 'audit', hat: 'events' },
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
            role: 'hat',
            parentHat: 'audit',
            hat: 'events',
        });
        expect(serializeSkill(untagged)).not.toHaveProperty('cli');
    });
});

describe('generateHatEntries', () => {
    it('emits only skills with a cli block', () => {
        const skills = [
            { id: 'integration-django', displayName: 'Django', description: 'd' },
            { id: 'audit-events', displayName: 'Audit events', description: 'a',
              cli: { role: 'hat', parentHat: 'audit', hat: 'events' } },
        ];
        const entries = generateHatEntries({ allSkills: skills });
        expect(entries).toHaveLength(1);
        expect(entries[0].skillId).toBe('audit-events');
    });

    it('returns an empty array when no skills declare a cli block', () => {
        const entries = generateHatEntries({ allSkills: [] });
        expect(entries).toEqual([]);
    });

    it('omits hat and parentHat when not set on the cli block', () => {
        const entries = generateHatEntries({
            allSkills: [
                { id: 'doctor', displayName: 'Doctor', description: 'd',
                  cli: { role: 'skill' } },
            ],
        });
        expect(entries[0]).toEqual({
            skillId: 'doctor',
            role: 'skill',
            displayName: 'Doctor',
            description: 'd',
        });
    });

    it('sorts entries by role, then parentHat, then hat', () => {
        const entries = generateHatEntries({
            allSkills: [
                { id: 'b-skill', displayName: 'B', description: 'd', cli: { role: 'skill' } },
                { id: 'a-int', displayName: 'A', description: 'd', cli: { role: 'internal' } },
                { id: 'audit-events', displayName: 'AE', description: 'd',
                  cli: { role: 'hat', parentHat: 'audit', hat: 'events' } },
                { id: 'audit-all', displayName: 'A', description: 'd',
                  cli: { role: 'hat', parentHat: 'audit', hat: 'all' } },
                { id: 'revenue', displayName: 'R', description: 'd',
                  cli: { role: 'hat', hat: 'revenue' } },
            ],
        });
        const order = entries.map(e => e.skillId);
        // hat flat (no parent) sorts before grouped 'audit', then skill, then internal
        expect(order).toEqual(['revenue', 'audit-all', 'audit-events', 'b-skill', 'a-int']);
    });

    it('carries default:true through into the entry', () => {
        const entries = generateHatEntries({
            allSkills: [
                { id: 'audit-all', displayName: 'Audit', description: 'd',
                  cli: { role: 'hat', parentHat: 'audit', hat: 'all', default: true } },
            ],
        });
        expect(entries[0]).toMatchObject({
            skillId: 'audit-all',
            parentHat: 'audit',
            hat: 'all',
            default: true,
        });
    });

    it('throws when a family has more than one default leaf', () => {
        expect(() =>
            generateHatEntries({
                allSkills: [
                    { id: 'audit-all', displayName: 'A', description: 'd',
                      cli: { role: 'hat', parentHat: 'audit', hat: 'all', default: true } },
                    { id: 'audit-events', displayName: 'AE', description: 'd',
                      cli: { role: 'hat', parentHat: 'audit', hat: 'events', default: true } },
                ],
            }),
        ).toThrow(/Family "audit" has more than one cli\.default leaf/);
    });

    it('throws when default is set on a flat hat with no parentHat', () => {
        expect(() =>
            generateHatEntries({
                allSkills: [
                    { id: 'revenue', displayName: 'R', description: 'd',
                      cli: { role: 'hat', hat: 'revenue', default: true } },
                ],
            }),
        ).toThrow(/only valid on a leaf inside a family/);
    });
});

describe('toLegacyCliEntries', () => {
    it('projects hat entries back into the pre-rename command shape', () => {
        const hatEntries = generateHatEntries({
            allSkills: [
                { id: 'audit-all', displayName: 'A', description: 'd',
                  cli: { role: 'hat', parentHat: 'audit', hat: 'all', default: true } },
                { id: 'doctor', displayName: 'Doctor', description: 'd',
                  cli: { role: 'skill' } },
            ],
        });
        expect(toLegacyCliEntries(hatEntries)).toEqual([
            {
                skillId: 'audit-all',
                role: 'command',
                parentCommand: 'audit',
                command: 'all',
                default: true,
                displayName: 'A',
                description: 'd',
            },
            {
                skillId: 'doctor',
                role: 'skill',
                displayName: 'Doctor',
                description: 'd',
            },
        ]);
    });
});
