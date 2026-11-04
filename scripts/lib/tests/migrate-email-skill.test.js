import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join, relative } from 'path';
import { tmpdir } from 'os';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS_PAGES = {
    'https://posthog.com/docs/workflows/transactional-emails.md': '# Transactional emails\n\nSend one email to one person.\n',
    'https://posthog.com/docs/workflows/transactional-emails/api.md': '# Send transactional emails with the API\n',
};
const REFERENCE_PATH = /references\/[A-Za-z0-9_./-]+\.md/g;
const PROVIDERS = ['resend', 'sendgrid', 'postmark', 'mailgun'];
const PROVIDER_FILES = ['sdk-reference.md', 'mapping.md', 'account.md'];

async function loadSkills() {
    vi.resetModules();
    vi.stubEnv('DOCS_CACHE_TTL_MS', '0');
    vi.stubGlobal('fetch', async (url) => {
        if (!(url in DOCS_PAGES)) return new Response('not found', { status: 404, statusText: 'Not Found' });
        return new Response(DOCS_PAGES[url], { status: 200 });
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
        .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
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

    it('builds migrate-email-resend as a bundle whose every reference path resolves', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill('migrate-email-resend', outputDir);

        expect(readFileSync(join(skillDir, 'SKILL.md'), 'utf8')).toMatch(/^---\nname: migrate-email-resend\n/);
        expect(unresolvedReferences(skillDir)).toEqual([]);
    });

    it('bundles the transactional email docs and the Resend files', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill('migrate-email-resend', outputDir);

        expect(readFileSync(join(skillDir, 'references', 'transactional-emails.md'), 'utf8')).toBe(
            DOCS_PAGES['https://posthog.com/docs/workflows/transactional-emails.md'],
        );
        expect(readFileSync(join(skillDir, 'references', 'api.md'), 'utf8')).toBe(
            DOCS_PAGES['https://posthog.com/docs/workflows/transactional-emails/api.md'],
        );
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

    it.each(PROVIDERS)('builds migrate-email-%s with its provider files, the SDK file, and no other provider', async (provider) => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill(`migrate-email-${provider}`, outputDir);

        expect(unresolvedReferences(skillDir)).toEqual([]);
        for (const file of PROVIDER_FILES) {
            expect(existsSync(join(skillDir, 'references', provider, file))).toBe(true);
        }
        expect(existsSync(join(skillDir, 'references', 'posthog-sdks.md'))).toBe(true);
        const otherProviders = PROVIDERS.filter((other) => other !== provider);
        expect(otherProviders.filter((other) => existsSync(join(skillDir, 'references', other)))).toEqual([]);
    });

    it('names a migratedFrom value equal to the provider folder in each mapping', () => {
        for (const provider of PROVIDERS) {
            const mapping = readFileSync(join(CONFIG_DIR, 'skills', 'migrate-email', 'references', provider, 'mapping.md'), 'utf8');
            expect(mapping, provider).toContain(`migratedFrom: '${provider}'`);
        }
    });

    it('publishes each provider and Statsig as wizard migrate subcommands', async () => {
        const { skills } = await loadSkills();
        const cliOf = (id) => skills.find((skill) => skill.id === id)?._cli;

        for (const provider of PROVIDERS) {
            expect(cliOf(`migrate-email-${provider}`)).toEqual({ role: 'command', parentCommand: 'migrate', command: provider });
        }
        expect(cliOf('migrate-statsig')).toEqual({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });
});
