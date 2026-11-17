import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

import { watchSkillSources } from '../dev-watcher.js';

const REAL_CONTEXT = join(import.meta.dirname, '..', '..', '..', 'context');

describe('watchSkillSources', () => {
    let repoRoot;
    let watcher;

    function write(relPath, content) {
        mkdirSync(dirname(join(repoRoot, relPath)), { recursive: true });
        writeFileSync(join(repoRoot, relPath), content);
    }

    function builtSkillMd(id) {
        return execFileSync('unzip', ['-p', join(repoRoot, 'dist', 'skills', `${id}.zip`), 'SKILL.md'], { encoding: 'utf8' });
    }

    beforeEach(() => {
        repoRoot = mkdtempSync(join(tmpdir(), 'dev-watcher-test-'));
        write('context/uri-schema.yaml', readFileSync(join(REAL_CONTEXT, 'uri-schema.yaml'), 'utf8'));
        write('context/commandments.yaml', 'commandments: {}\n');
        write('context/skip-patterns.yaml', 'global: {}\n');
        write('context/skills/setup/config.yaml', 'type: skill\ntemplate: description.md\nvariants:\n  - id: all\n    display_name: Setup\n');
        write('context/skills/setup/description.md', '# Setup\n\n- Set up environment variables:\n  {{> credentials}}\n');
        write('context/shared/credentials.md', '- Old token bullet.\n');
    });

    afterEach(async () => {
        await watcher?.close();
        rmSync(repoRoot, { recursive: true, force: true });
    });

    it('rebuilds a skill when a shared partial it includes changes', async () => {
        watcher = await watchSkillSources({ repoRoot, distDir: join(repoRoot, 'dist'), version: 'test', log: () => {} });

        write('context/shared/credentials.md', '- New token bullet.\n');

        await vi.waitFor(
            () => expect(builtSkillMd('setup')).toContain('- Set up environment variables:\n  - New token bullet.'),
            { timeout: 4000, interval: 100 },
        );
    });
});
