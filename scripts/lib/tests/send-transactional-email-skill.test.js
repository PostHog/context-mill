import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS_URL = 'https://posthog.com/docs/workflows/transactional-email-api.md';
const DOCS_PAGE = '# Transactional email API\n\nSend one email to one person from your server code.\n';

async function buildSkill(outputDir) {
    vi.resetModules();
    vi.stubEnv('DOCS_CACHE_TTL_MS', '0');
    vi.stubGlobal('fetch', async (url) => {
        if (url !== DOCS_URL) return new Response('not found', { status: 404, statusText: 'Not Found' });
        return new Response(DOCS_PAGE, { status: 200 });
    });
    const { expandSkillGroups, generateSkill, loadSkillsConfig } = await import('../skill-generator.js');
    const skill = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR)
        .find((candidate) => candidate.id === 'omnibus-send-transactional-email');
    expect(skill).toBeDefined();

    await generateSkill({
        skill,
        version: 'test',
        repoRoot: process.cwd(),
        configDir: CONFIG_DIR,
        outputDir,
        skipPatterns: { global: [], examples: {} },
        commandmentsConfig: { commandments: {} },
        skillTemplate: skill._template,
        sharedDocs: skill._sharedDocs,
    });
    return join(outputDir, 'omnibus-send-transactional-email');
}

describe('send-transactional-email skill', () => {
    let outputDir;

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        if (outputDir) rmSync(outputDir, { recursive: true, force: true });
    });

    it('ships the transactional email API docs page as its reference', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'send-email-skill-'));

        const skillDir = await buildSkill(outputDir);

        const skillFile = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
        const referenceFile = join(skillDir, 'references', 'transactional-email-api.md');
        expect(skillFile).toMatch(/^---\nname: omnibus-send-transactional-email\n/);
        expect(skillFile).toContain('`references/transactional-email-api.md`');
        expect(existsSync(referenceFile)).toBe(true);
        expect(readFileSync(referenceFile, 'utf8')).toBe(DOCS_PAGE);
    });
});
