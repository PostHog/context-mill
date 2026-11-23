import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { expandSkillGroups, generateSkill, expandPartials } from '../skill-generator.js';

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

describe('expandPartials', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'partials-test-'));
        mkdirSync(join(tmpDir, 'shared'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('replaces a {{> name}} directive with the partial body, frontmatter stripped', () => {
        writeFileSync(
            join(tmpDir, 'shared', 'mcp-tool-calling.md'),
            '---\ntitle: How to call PostHog MCP tools\n---\n\nRun `info` before `call`.\n',
        );

        const out = expandPartials('Before.\n\n{{> mcp-tool-calling}}\n\nAfter.', tmpDir);

        expect(out).toContain('Run `info` before `call`.');
        expect(out).not.toContain('{{>');
        expect(out).not.toContain('title: How to call');
        expect(out).toContain('Before.');
        expect(out).toContain('After.');
    });

    it('throws when the referenced partial does not exist', () => {
        expect(() => expandPartials('{{> missing-partial}}', tmpDir)).toThrow(/missing-partial/);
    });

    it('keeps a column-0 include unindented', () => {
        writeFileSync(join(tmpDir, 'shared', 'x.md'), 'Line one.\nLine two.\n');
        const out = expandPartials('Before.\n{{> x}}\nAfter.', tmpDir);
        expect(out).toBe('Before.\nLine one.\nLine two.\nAfter.');
    });

    it('leaves inline {{> ...}} that is not on its own line untouched', () => {
        writeFileSync(join(tmpDir, 'shared', 'x.md'), 'PARTIAL BODY');
        const out = expandPartials('text {{> x}} still text', tmpDir);
        expect(out).toBe('text {{> x}} still text');
    });
});

describe('generateSkill partial expansion', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'partials-skill-test-'));
        mkdirSync(join(tmpDir, 'skills'));
        mkdirSync(join(tmpDir, 'shared'));
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('expands partials in copied reference files', async () => {
        createFixture({
            shared: {
                'mcp-tool-calling.md': '---\ntitle: MCP\n---\n\nThe canonical MCP grammar.\n',
            },
            skills: {
                integration: {
                    'description.md': '# Integration\n\n{references}\n',
                    references: {
                        '4-conclude.md': '---\nnext_step: null\n---\n\n# Conclude\n\n{{> mcp-tool-calling}}\n',
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

        const conclude = readFileSync(join(outputDir, 'integration', 'references', '4-conclude.md'), 'utf8');
        expect(conclude).toContain('The canonical MCP grammar.');
        expect(conclude).not.toContain('{{>');
    });

    it('nests an indented include under the list item it sits in', async () => {
        createFixture({
            shared: {
                'credentials.md': '- Token bullet.\n\n- Host bullet.\n',
            },
            skills: {
                setup: {
                    'description.md': '# Setup\n\n- Set up environment variables:\n  - Check existing env files.\n  {{> credentials}}\n  - Write the env file.\n',
                },
            },
        }, tmpDir);

        const config = {
            setup: {
                type: 'skill',
                template: 'description.md',
                variants: [{ id: 'all', display_name: 'Setup' }],
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

        const skillMd = readFileSync(join(outputDir, 'setup', 'SKILL.md'), 'utf8');
        expect(skillMd).toContain(
            '- Set up environment variables:\n'
            + '  - Check existing env files.\n'
            + '  - Token bullet.\n'
            + '\n'
            + '  - Host bullet.\n'
            + '  - Write the env file.\n',
        );
    });
});
