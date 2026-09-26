import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { tmpdir } from 'os';

import { buildAgents } from '../agent-generator.js';
import { REPO_URL } from '../constants.js';

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
            { id: 'task', flow: 'my-flow', downloadUrl: 'http://x/agents-my-flow-task.md' },
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

    it('rejects a runner-seeded task in a flow with no sink to wait for it', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'warehouse.md'),
            prompt('type: warehouse\nflow: my-flow\nrunnerSeeded: true'),
        );
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'report.md'),
            prompt('type: report\nflow: my-flow'),
        );
        expect(() => buildAgents({ configDir, distDir, baseUrl: 'http://x' })).toThrow(
            /runner-seeded warehouse but no agent marked "sink: true"/,
        );
    });

    it('accepts a runner-seeded task once a sink waits for it', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'warehouse.md'),
            prompt('type: warehouse\nflow: my-flow\nrunnerSeeded: true'),
        );
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'report.md'),
            prompt('type: report\nflow: my-flow\nsink: true'),
        );
        expect(buildAgents({ configDir, distDir, baseUrl: 'http://x' }).count).toBe(2);
    });

    it('leaves a flow with no runner-seeded task alone', () => {
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task\nflow: my-flow'),
        );
        expect(buildAgents({ configDir, distDir, baseUrl: 'http://x' }).count).toBe(1);
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

describe('buildAgents download URLs', () => {
    let tmpDir;
    let configDir;
    let distDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'agents-url-test-'));
        configDir = join(tmpDir, 'context');
        distDir = join(tmpDir, 'dist');
        mkdirSync(join(configDir, 'agents', 'my-flow'), { recursive: true });
        writeFileSync(
            join(configDir, 'agents', 'my-flow', 'task.md'),
            prompt('type: task\nflow: my-flow'),
        );
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    const menuOf = () =>
        JSON.parse(readFileSync(join(distDir, 'agents', 'agent-menu.json'), 'utf8'));

    it('pins a versioned build to its own release', () => {
        buildAgents({ configDir, distDir, version: '1.47.0' });
        expect(menuOf().agents[0].downloadUrl).toBe(
            `${REPO_URL}/releases/download/v1.47.0/agents-my-flow-task.md`,
        );
    });

    it('points an unversioned build at the files it just wrote', () => {
        const { baseUrl } = buildAgents({ configDir, distDir });
        const url = menuOf().agents[0].downloadUrl;
        expect(baseUrl).toBe(pathToFileURL(join(distDir, 'agents')).href);
        expect(url).toBe(pathToFileURL(join(distDir, 'agents', 'agents-my-flow-task.md')).href);
        expect(existsSync(fileURLToPath(url))).toBe(true);
    });
});
