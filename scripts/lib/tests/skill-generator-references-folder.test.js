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
                type: 'docs-only',
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
            workflows: [],
        });

        const generatedRef = join(outputDir, 'integration', 'references', 'product-analytics.md');
        const generatedSkill = join(outputDir, 'integration', 'SKILL.md');

        expect(existsSync(generatedRef)).toBe(true);
        expect(readFileSync(generatedRef, 'utf8')).toBe('# Product analytics best practices\n\nDetails');
        expect(readFileSync(generatedSkill, 'utf8')).toContain('references/product-analytics.md');
    });
});
