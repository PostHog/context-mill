import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';

const { loadSkillsConfig } = require('../skill-generator.js');

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

describe('loadSkillsConfig', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('discovers a flat config with variants', () => {
        createFixture({
            skills: {
                integration: {
                    'config.yaml': yaml.dump({
                        type: 'example',
                        template: 'description.md',
                        variants: [{ id: 'django', display_name: 'Django' }],
                    }),
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config)).toEqual(['integration']);
        expect(config['integration'].variants).toHaveLength(1);
        expect(config['integration'].type).toBe('example');
    });

    it('skips configs without variants', () => {
        createFixture({
            skills: {
                'no-variants': {
                    'config.yaml': yaml.dump({
                        type: 'docs-only',
                        tags: ['test'],
                    }),
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config)).toEqual([]);
    });

    it('discovers nested configs independently (no inheritance)', () => {
        createFixture({
            skills: {
                'feature-flags': {
                    'config.yaml': yaml.dump({
                        type: 'docs-only',
                        tags: ['feature-flags'],
                    }),
                    installation: {
                        'config.yaml': yaml.dump({
                            type: 'docs-only',
                            tags: ['feature-flags', 'installation'],
                            variants: [{ id: 'react', display_name: 'React' }],
                        }),
                    },
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config)).toEqual(['feature-flags/installation']);
        const leaf = config['feature-flags/installation'];
        expect(leaf.type).toBe('docs-only');
        expect(leaf.tags).toEqual(['feature-flags', 'installation']);
        expect(leaf.variants).toHaveLength(1);
    });

    it('discovers configs at arbitrary depth', () => {
        createFixture({
            skills: {
                a: {
                    b: { c: { d: {
                        'config.yaml': yaml.dump({
                            type: 'docs-only',
                            variants: [{ id: 'deep', display_name: 'Deep' }],
                        }),
                    }}},
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config)).toEqual(['a/b/c/d']);
        expect(config['a/b/c/d'].type).toBe('docs-only');
    });

    it('ignores directories without config.yaml', () => {
        createFixture({
            skills: {
                'empty-dir': {},
                'has-config': {
                    'config.yaml': yaml.dump({
                        variants: [{ id: 'x', display_name: 'X' }],
                    }),
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config)).toEqual(['has-config']);
    });

    it('handles flat and nested siblings', () => {
        createFixture({
            skills: {
                integration: {
                    'config.yaml': yaml.dump({
                        type: 'example',
                        variants: [{ id: 'django', display_name: 'Django' }],
                    }),
                },
                'feature-flags': {
                    installation: {
                        'config.yaml': yaml.dump({
                            type: 'docs-only',
                            tags: ['feature-flags', 'installation'],
                            variants: [{ id: 'react', display_name: 'React' }],
                        }),
                    },
                },
            },
        }, tmpDir);
        const config = loadSkillsConfig(tmpDir);
        expect(Object.keys(config).sort()).toEqual([
            'feature-flags/installation',
            'integration',
        ]);
    });
});
