import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const { loadSkillTemplate } = require('../skill-generator.js');

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

describe('loadSkillTemplate', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('loads template from the config directory', () => {
        createFixture({
            skills: {
                integration: {
                    'description.md': '# Integration for {display_name}',
                },
            },
        }, tmpDir);
        const content = loadSkillTemplate(tmpDir, 'integration', 'description.md');
        expect(content).toBe('# Integration for {display_name}');
    });

    it('loads template from nested directory using composite key', () => {
        createFixture({
            skills: {
                'feature-flags': {
                    installation: {
                        'description.md': '# Installation guide for {display_name}',
                    },
                },
            },
        }, tmpDir);
        const content = loadSkillTemplate(tmpDir, 'feature-flags/installation', 'description.md');
        expect(content).toBe('# Installation guide for {display_name}');
    });

    it('throws when template is not found', () => {
        createFixture({
            skills: {
                integration: {},
            },
        }, tmpDir);
        expect(() => {
            loadSkillTemplate(tmpDir, 'integration', 'description.md');
        }).toThrow(/not found/);
    });
});
