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

    it('flattens the matching variant subdirectory into references/ and skips siblings', async () => {
        createFixture({
            skills: {
                migrate: {
                    'description.md': '# Migrate\n\n{references}\n',
                    references: {
                        '1-presence.md': '---\nnext_step: null\n---\n\n# Step 1\n',
                        mixpanel: {
                            'sdk-reference.md': '# Mixpanel SDK reference\n\nDetails',
                            'mapping.md': '# Mixpanel mapping\n\nMore details',
                        },
                        statsig: {
                            'sdk-reference.md': '# Statsig SDK reference\n\nShould not appear in mixpanel zip',
                        },
                    },
                },
            },
        }, tmpDir);

        const config = {
            migrate: {
                type: 'skill',
                template: 'description.md',
                variants: [
                    { id: 'mixpanel', display_name: 'Mixpanel → PostHog' },
                    { id: 'statsig', display_name: 'Statsig → PostHog' },
                ],
            },
        };

        const skills = expandSkillGroups(config, tmpDir);
        const mixpanelSkill = skills.find(s => s._shortId === 'mixpanel');
        const outputDir = join(tmpDir, 'out');

        await generateSkill({
            skill: mixpanelSkill,
            version: 'test',
            repoRoot: tmpDir,
            configDir: tmpDir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: mixpanelSkill._template,
            sharedDocs: [],
        });

        const skillDir = join(outputDir, 'migrate-mixpanel', 'references');

        // Top-level workflow file always ships
        expect(existsSync(join(skillDir, '1-presence.md'))).toBe(true);

        // Variant files are flattened directly into references/ (Agent Skill spec: flat references/)
        expect(existsSync(join(skillDir, 'sdk-reference.md'))).toBe(true);
        expect(existsSync(join(skillDir, 'mapping.md'))).toBe(true);
        expect(readFileSync(join(skillDir, 'sdk-reference.md'), 'utf8'))
            .toBe('# Mixpanel SDK reference\n\nDetails');

        // No variant-namespaced subdir is emitted
        expect(existsSync(join(skillDir, 'mixpanel'))).toBe(false);
        expect(existsSync(join(skillDir, 'statsig'))).toBe(false);

        // SKILL.md lists files by their flat name
        const generatedSkill = readFileSync(join(outputDir, 'migrate-mixpanel', 'SKILL.md'), 'utf8');
        expect(generatedSkill).toContain('references/sdk-reference.md');
        expect(generatedSkill).toContain('references/mapping.md');
        expect(generatedSkill).not.toContain('references/mixpanel/');
        expect(generatedSkill).not.toContain('references/statsig');
    });

    it('throws when a variant file shadows a shared step file', async () => {
        createFixture({
            skills: {
                migrate: {
                    'description.md': '# Migrate\n\n{references}\n',
                    references: {
                        '1-presence.md': '---\nnext_step: null\n---\n\n# Step 1\n',
                        mixpanel: {
                            '1-presence.md': '# Variant file shadowing shared step',
                        },
                    },
                },
            },
        }, tmpDir);

        const config = {
            migrate: {
                type: 'skill',
                template: 'description.md',
                variants: [{ id: 'mixpanel', display_name: 'Mixpanel → PostHog' }],
            },
        };

        const skill = expandSkillGroups(config, tmpDir).find(s => s._shortId === 'mixpanel');
        const outputDir = join(tmpDir, 'out');

        await expect(generateSkill({
            skill,
            version: 'test',
            repoRoot: tmpDir,
            configDir: tmpDir,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: skill._template,
            sharedDocs: [],
        })).rejects.toThrow(/collision/i);
    });
});
