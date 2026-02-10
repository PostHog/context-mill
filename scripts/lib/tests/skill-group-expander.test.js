import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const { expandSkillGroups } = require('../skill-generator.js');

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

describe('expandSkillGroups', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('derives id and category from flat key', () => {
        createFixture({
            skills: {
                integration: {
                    'description.md': '# Integration for {display_name}',
                },
            },
        }, tmpDir);
        const config = {
            integration: {
                type: 'example',
                template: 'description.md',
                variants: [{ id: 'django', display_name: 'Django' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0].id).toBe('integration-django');
        expect(skills[0]._shortId).toBe('django');
        expect(skills[0]._category).toBe('integration');
        expect(skills[0]._topic).toBeNull();
        expect(skills[0]._group).toBe('integration');
    });

    it('derives id with composite key prefix from nested key', () => {
        createFixture({
            skills: {
                'feature-flags': {
                    installation: {
                        'description.md': '# Installation guide for {display_name}',
                    },
                },
            },
        }, tmpDir);
        const config = {
            'feature-flags/installation': {
                type: 'docs-only',
                template: 'description.md',
                variants: [{ id: 'react', display_name: 'React' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0].id).toBe('feature-flags-installation-react');
        expect(skills[0]._shortId).toBe('react');
        expect(skills[0]._category).toBe('feature-flags');
        expect(skills[0]._topic).toBe('installation');
        expect(skills[0]._group).toBe('feature-flags/installation');
    });

    it('handles three-segment composite keys', () => {
        createFixture({
            skills: {
                'feature-flags': {
                    'best-practices': {
                        react: {
                            'description.md': '# Best practices for {display_name}',
                        },
                    },
                },
            },
        }, tmpDir);
        const config = {
            'feature-flags/best-practices/react': {
                type: 'docs-only',
                template: 'description.md',
                variants: [{ id: 'hooks', display_name: 'React Hooks' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0].id).toBe('feature-flags-best-practices-react-hooks');
        expect(skills[0]._category).toBe('feature-flags');
        expect(skills[0]._topic).toBe('best-practices/react');
        expect(skills[0]._group).toBe('feature-flags/best-practices/react');
    });

    it('uses category override when provided', () => {
        createFixture({
            skills: {
                'feature-flags': {
                    installation: {
                        'description.md': '# Installation for {display_name}',
                    },
                },
            },
        }, tmpDir);
        const config = {
            'feature-flags/installation': {
                type: 'docs-only',
                category: 'feature-flag',
                template: 'description.md',
                variants: [{ id: 'react', display_name: 'React' }],
            },
        };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills[0]._category).toBe('feature-flag');
        // id still uses composite key, not category
        expect(skills[0].id).toBe('feature-flags-installation-react');
    });
});
