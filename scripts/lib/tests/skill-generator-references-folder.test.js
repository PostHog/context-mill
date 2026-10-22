import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { expandSkillGroups, generateSkill } from '../skill-generator.js';

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

describe('generateSkill local references', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('copies source references folder into generated references', async () => {
        createFixture({
            skills: {
                integration: {
                    'description.md': '# Integration\n\n## Reference files\n\n{references}\n',
                    references: {
                        'product-analytics.md': '# Product analytics best practices\n\nDetails',
                    },
                },
            },
        }, tmpDir);

        const config = {
            integration: {
                type: 'skill',
                template: 'description.md',
                variants: [{ id: 'all', display_name: 'Integration' }],
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
            sharedDocs: skill._sharedDocs || [],
        });

        const generatedRef = join(outputDir, 'integration', 'references', 'product-analytics.md');
        const generatedSkill = join(outputDir, 'integration', 'SKILL.md');

        expect(existsSync(generatedRef)).toBe(true);
        expect(readFileSync(generatedRef, 'utf8')).toBe('# Product analytics best practices\n\nDetails');
        expect(readFileSync(generatedSkill, 'utf8')).toContain('references/product-analytics.md');
    });

    it("ships a variant's own reference folder and no other variant's", async () => {
        createFixture({
            skills: {
                migrate: {
                    'description.md': '# Migrate\n\n{references}\n',
                    references: {
                        '1-presence.md': '---\nnext_step: null\n---\n\n# Presence\n\nRead `references/<variant-id>/mapping.md`.',
                        statsig: { 'mapping.md': '# Statsig mapping' },
                        amplitude: { 'mapping.md': '# Amplitude mapping' },
                    },
                },
            },
        }, tmpDir);

        const config = {
            migrate: {
                type: 'skill',
                template: 'description.md',
                variants: [
                    { id: 'statsig', display_name: 'Statsig' },
                    { id: 'amplitude', display_name: 'Amplitude' },
                ],
            },
        };

        const statsig = expandSkillGroups(config, tmpDir).find((skill) => skill.id === 'migrate-statsig');
        const outputDir = join(tmpDir, 'out');

        await generateSkill({
            skill: statsig,
            version: 'test',
            repoRoot: tmpDir,
            configDir: tmpDir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: statsig._template,
            sharedDocs: [],
        });

        const references = join(outputDir, 'migrate-statsig', 'references');
        expect(readFileSync(join(references, 'statsig', 'mapping.md'), 'utf8')).toBe('# Statsig mapping');
        expect(existsSync(join(references, 'amplitude'))).toBe(false);
        expect(readFileSync(join(outputDir, 'migrate-statsig', 'SKILL.md'), 'utf8'))
            .toContain('`references/statsig/mapping.md`');
    });
});
