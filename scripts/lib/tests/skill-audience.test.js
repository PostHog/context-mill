import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';

import { expandSkillGroups, generateSkill, parseAudience } from '../skill-generator.js';

const VARIANTS = [{ id: 'all', display_name: 'all supported platforms' }];

describe('skill audience', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it.each([
        ['no audience', {}, null],
        ['a customer skill', { audience: 'customer' }, { audience: 'customer' }],
        ['an internal skill', { audience: 'internal' }, { audience: 'internal' }],
        [
            'a customer skill behind a flag',
            { audience: 'customer', feature_flag: 'metrics' },
            { audience: 'customer', featureFlag: 'metrics' },
        ],
    ])('reads %s', (_name, group, expected) => {
        expect(parseAudience(group, 'ctx')).toEqual(expected);
    });

    it.each([
        ['an unknown audience', { audience: 'everyone' }, /audience must be one of/],
        ['a flag with no audience', { feature_flag: 'metrics' }, /feature_flag needs an audience/],
        ['a flag on an internal skill', { audience: 'internal', feature_flag: 'metrics' }, /only a customer skill/],
        ['an empty flag', { audience: 'customer', feature_flag: '' }, /non-empty string/],
    ])('rejects %s', (_name, group, message) => {
        expect(() => parseAudience(group, 'ctx')).toThrow(message);
    });

    it('rejects an omnibus skill that names no audience', () => {
        const config = { 'omnibus/instrument-example': { type: 'skill', variants: VARIANTS } };

        expect(() => expandSkillGroups(config, tmpDir)).toThrow(/omnibus skill must set audience/);
    });

    it('writes the audience and the flag into the SKILL.md frontmatter', async () => {
        mkdirSync(join(tmpDir, 'skills', 'omnibus', 'instrument-example'), { recursive: true });
        writeFileSync(join(tmpDir, 'skills', 'omnibus', 'instrument-example', 'description.md'), '# Example\n');
        const config = {
            'omnibus/instrument-example': {
                type: 'skill',
                template: 'description.md',
                description: 'An example skill.',
                audience: 'customer',
                feature_flag: 'example-flag',
                variants: VARIANTS,
            },
        };
        const skill = expandSkillGroups(config, tmpDir)[0];
        const outputDir = join(tmpDir, 'out');

        await generateSkill({
            skill,
            version: 'test',
            repoRoot: tmpDir,
            configDir: tmpDir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: skill._template,
            sharedDocs: [],
        });

        const { data } = matter(readFileSync(join(outputDir, skill.id, 'SKILL.md'), 'utf8'));
        expect(data.metadata).toMatchObject({ audience: 'customer', feature_flag: 'example-flag' });
    });
});
