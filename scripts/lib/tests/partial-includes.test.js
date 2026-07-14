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
});
