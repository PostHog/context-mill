import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { buildAgents } from '../agent-generator.js';

const prompt = (frontmatter) => `---\n${frontmatter}\n---\n\n## Goal\n\nDo the thing.\n`;

describe('buildAgents flow frontmatter', () => {
    let tmpDir;
    let configDir;
    let distDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agents-test-'));
        configDir = join(tmpDir, 'context');
        distDir = join(tmpDir, 'dist');
        mkdirSync(join(configDir, 'agents', 'my-flow'), { recursive: true });
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    it('builds a prompt whose flow matches its folder', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task\nflow: my-flow'),
        );
        const { count } = buildAgents({ configDir, distDir, baseUrl: 'http://x' });
        expect(count).toBe(1);
        const menu = JSON.parse(readFileSync(join(distDir, 'agents', 'agent-menu.json'), 'utf8'));
        expect(menu.agents).toEqual([
            { id: 'task', flow: 'my-flow', downloadUrl: 'http://x/my-flow/task.md' },
        ]);
    });

    it('rejects a prompt missing the flow key — consumers filter by it', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task'),
        );
        expect(() => buildAgents({ configDir, distDir, baseUrl: 'http://x' })).toThrow(
            /missing the "flow:" frontmatter key/,
        );
    });

    it('rejects a prompt whose flow contradicts its folder', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task\nflow: other-flow'),
        );
        expect(() => buildAgents({ configDir, distDir, baseUrl: 'http://x' })).toThrow(
            /declares flow "other-flow"/,
        );
    });

    it('still ignores README.md files at both levels', () => {
        writeFileSync(join(configDir, 'agents', 'README.md'), '# docs');
        writeFileSync(join(configDir, 'agents', 'my-flow', 'README.md'), '# docs');
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task\nflow: my-flow'),
        );
        const { count } = buildAgents({ configDir, distDir, baseUrl: 'http://x' });
        expect(count).toBe(1);
        expect(existsSync(join(distDir, 'agents', 'my-flow', 'README.md'))).toBe(false);
    });
});
