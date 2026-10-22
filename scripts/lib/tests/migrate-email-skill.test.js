import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS_URL = 'https://posthog.com/docs/workflows/transactional-email-api.md';
const DOCS_PAGE = '# Transactional email API\n\nSend one email to one person from your server code.\n';
const REFERENCE_PATH = /references\/[A-Za-z0-9_./-]+\.md/g;

async function loadSkills() {
    vi.resetModules();
    vi.stubEnv('DOCS_CACHE_TTL_MS', '0');
    vi.stubGlobal('fetch', async (url) => {
        if (url !== DOCS_URL) return new Response('not found', { status: 404, statusText: 'Not Found' });
        return new Response(DOCS_PAGE, { status: 200 });
    });
    const generator = await import('../skill-generator.js');
    const skills = generator.expandSkillGroups(generator.loadSkillsConfig(CONFIG_DIR), CONFIG_DIR);
    return { generator, skills };
}

async function buildSkill(skillId, outputDir) {
    const { generator, skills } = await loadSkills();
    const skill = skills.find((candidate) => candidate.id === skillId);
    expect(skill).toBeDefined();

    await generator.generateSkill({
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
    return join(outputDir, skillId);
}

function markdownFiles(dir) {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => join(entry.parentPath, entry.name));
}

function unresolvedReferences(skillDir) {
    const missing = [];
    for (const file of markdownFiles(skillDir)) {
        for (const reference of readFileSync(file, 'utf8').match(REFERENCE_PATH) ?? []) {
            if (!existsSync(join(skillDir, reference))) missing.push(`${relative(skillDir, file)} → ${reference}`);
        }
    }
    return missing;
}

describe('migrate-email skill', () => {
    let outputDir;

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        if (outputDir) rmSync(outputDir, { recursive: true, force: true });
    });

    it.each(['migrate-email-resend', 'migrate-statsig'])(
        'builds %s as a bundle whose every reference path resolves',
        async (skillId) => {
            outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

            const skillDir = await buildSkill(skillId, outputDir);

            expect(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).toMatch(new RegExp(`^---\\nname: ${skillId}\\n`));
            expect(unresolvedReferences(skillDir)).toEqual([]);
        },
    );

    it('bundles the send API reference and the Resend files without the send skill', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill('migrate-email-resend', outputDir);

        expect(readFileSync(join(skillDir, 'references', 'transactional-email-api.md'), 'utf8')).toBe(DOCS_PAGE);
        expect(existsSync(join(skillDir, 'references', 'resend', 'sdk-reference.md'))).toBe(true);
        expect(markdownFiles(skillDir).map((file) => readFileSync(file, 'utf8')).join('\n')).not.toMatch(/\{\{>|\{display_name\}|\{references\}/);
    });

    it('runs the rewrite and verify steps between the key and the report', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill('migrate-email-resend', outputDir);
        const workflow = readFileSync(join(skillDir, 'SKILL.md'), 'utf8').match(/^\d+\. `references\/[^`]+`/gm);

        expect(workflow.map((step) => step.replace(/^\d+\. /, ''))).toEqual([
            '`references/1-detect.md`',
            '`references/2-preflight.md`',
            '`references/3-inventory.md`',
            '`references/4-sender.md`',
            '`references/5-suppressions.md`',
            '`references/6-key.md`',
            '`references/7-rewrite.md`',
            '`references/8-verify.md`',
            '`references/9-report.md`',
        ]);
    });

    it('publishes Resend and Statsig as wizard migrate subcommands', async () => {
        const { skills } = await loadSkills();
        const cliOf = (id) => skills.find((skill) => skill.id === id)?._cli;

        expect(cliOf('migrate-email-resend')).toEqual({ role: 'command', parentCommand: 'migrate', command: 'resend' });
        expect(cliOf('migrate-statsig')).toEqual({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });
});
