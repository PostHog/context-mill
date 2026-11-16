import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.hoisted(() => {
    process.env.DOCS_CACHE_TTL_MS = '0';
});

import { expandSkillGroups, generateSkill, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const UPSTREAM_SKILL = '---\nname: sending-transactional-emails\n---\n\n# Upstream skill\n';

describe('the built sending-transactional-emails skill', () => {
    let outputDir;

    beforeEach(() => {
        outputDir = mkdtempSync(join(tmpdir(), 'sending-transactional-emails-'));
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url) =>
                new Response(String(url).endsWith('/sending-transactional-emails/SKILL.md') ? UPSTREAM_SKILL : `# ${url}\n`),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(outputDir, { recursive: true, force: true });
    });

    async function build() {
        const config = loadSkillsConfig(CONFIG_DIR);
        const [skill] = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'sending-transactional-emails');
        await generateSkill({
            skill,
            version: 'test',
            repoRoot: process.cwd(),
            configDir: CONFIG_DIR,
            outputDir,
            skipPatterns: { global: [], examples: {} },
            commandmentsConfig: { commandments: {} },
            skillTemplate: skill._template,
            sharedDocs: skill._sharedDocs || [],
        });
        return join(outputDir, 'sending-transactional-emails');
    }

    it('packages the PostHog skill as a reference, not as a second SKILL.md', async () => {
        const skillDir = await build();

        expect(readFileSync(join(skillDir, 'references', 'sending-transactional-emails.md'), 'utf8')).toBe(UPSTREAM_SKILL);
        expect(existsSync(join(skillDir, 'references', 'SKILL.md'))).toBe(false);
    });

    it('names only reference files the package holds', async () => {
        const skillDir = await build();
        const named = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').match(/references\/[\w.-]+\.md/g);

        expect(named).toContain('references/sending-transactional-emails.md');
        for (const reference of new Set(named)) {
            expect(existsSync(join(skillDir, reference)), reference).toBe(true);
        }
    });

    it('emits only the [ABORT] reasons the Wizard program matches', async () => {
        const skillDir = await build();
        const reasons = [...readFileSync(join(skillDir, 'SKILL.md'), 'utf8').matchAll(/\[ABORT\] ([^`\n]+)/g)].map(
            (match) => match[1].trim(),
        );

        expect(new Set(reasons)).toEqual(new Set(['no server code found', 'transactional email api not enabled']));
    });
});
