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

    async function generate(docsUrls) {
        const config = {
            'sending-email': {
                type: 'skill',
                template: 'description.md',
                variants: [{ id: 'all', display_name: 'Sending email', docs_urls: docsUrls }],
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
        return join(outputDir, 'sending-email');
    }

    it('writes a fetched doc under the filename its entry names', async () => {
        const skillDir = await generate([
            { url: UPSTREAM_SKILL_URL, filename: 'upstream-skill.md', title: 'The upstream skill' },
        ]);

        const references = join(skillDir, 'references');
        expect(readFileSync(join(references, 'upstream-skill.md'), 'utf8')).toBe('# Upstream skill\n\nSteps');
        expect(existsSync(join(references, 'SKILL.md'))).toBe(false);
        expect(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).toContain(
            '- `references/upstream-skill.md` - The upstream skill',
        );
    });

    it.each(['nested/upstream-skill.md', '../upstream-skill.md', 'upstream-skill.txt', 'COMMANDMENTS.md'])(
        'refuses the filename %s',
        async (filename) => {
            await expect(generate([{ url: UPSTREAM_SKILL_URL, filename }])).rejects.toThrow(filename);
        },
    );

    it('refuses a filename another reference already uses', async () => {
        await expect(
            generate([
                { url: UPSTREAM_SKILL_URL, filename: 'upstream-skill.md' },
                { url: 'https://docs.example.test/other.md', filename: 'upstream-skill.md' },
            ]),
        ).rejects.toThrow('upstream-skill.md');
    });

    it('refuses a doc whose name from its URL another reference already uses', async () => {
        await expect(
            generate([
                { url: UPSTREAM_SKILL_URL, filename: 'upstream.md' },
                'https://docs.example.test/other/upstream.md',
            ]),
        ).rejects.toThrow('upstream.md');
    });
});
