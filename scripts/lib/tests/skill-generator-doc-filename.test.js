import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.hoisted(() => {
    process.env.DOCS_CACHE_TTL_MS = '0';
});

import { expandSkillGroups, generateSkill } from '../skill-generator.js';

const UPSTREAM_SKILL_URL = 'https://docs.example.test/skills/sending-email/SKILL.md';

describe('generateSkill doc filename', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills', 'sending-email'), { recursive: true });
        writeFileSync(
            join(tmpDir, 'skills', 'sending-email', 'description.md'),
            '# Sending email\n\n## Reference files\n\n{references}\n',
        );
        vi.stubGlobal('fetch', vi.fn(async () => new Response('# Upstream skill\n\nSteps')));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes a fetched doc under the filename its entry names', async () => {
        const config = {
            'sending-email': {
                type: 'skill',
                template: 'description.md',
                variants: [{
                    id: 'all',
                    display_name: 'Sending email',
                    docs_urls: [{ url: UPSTREAM_SKILL_URL, filename: 'upstream-skill.md', title: 'The upstream skill' }],
                }],
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

        const references = join(outputDir, 'sending-email', 'references');
        expect(readFileSync(join(references, 'upstream-skill.md'), 'utf8')).toBe('# Upstream skill\n\nSteps');
        expect(existsSync(join(references, 'SKILL.md'))).toBe(false);
        expect(readFileSync(join(outputDir, 'sending-email', 'SKILL.md'), 'utf8')).toContain(
            '- `references/upstream-skill.md` - The upstream skill',
        );
    });
});
