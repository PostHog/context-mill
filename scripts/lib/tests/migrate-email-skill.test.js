import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { generateCliEntries } from '../build-phases.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS_PAGES = {
    'https://posthog.com/docs/workflows/transactional-emails.md': '# Transactional emails\n\nSend one email to one person.\n',
    'https://posthog.com/docs/workflows/transactional-emails/api.md': '# Send transactional emails with the API\n',
};
const REFERENCE_PATH = /references\/[A-Za-z0-9_./-]+\.md/g;
const PROVIDERS = ['resend', 'loops'];
const PROVIDER_FILES = ['sdk-reference.md', 'mapping.md', 'account.md'];
const SDKS = ['node', 'python', 'go', 'ruby', 'php', 'dotnet', 'rust', 'elixir'];

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
        expect(existsSync(join(skillDir, 'references', 'template-to-code.md'))).toBe(true);
        expect(markdownFiles(skillDir).map((file) => readFileSync(file, 'utf8')).join('\n')).not.toMatch(/\{\{>|\{display_name\}|\{references\}/);
    });

    it('chains the steps from detection through rewrite and verify to the report', async () => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill('migrate-email-resend', outputDir);
        const visited = [];
        for (let step = '1-detect.md'; step && visited.length < 20; ) {
            visited.push(step);
            const text = readFileSync(join(skillDir, 'references', step), 'utf8');
            step = text.match(/\*\*Upon completion, continue with:\*\* \[[^\]]+\]\(([^)]+)\)/)?.[1];
        }

        expect(visited).toEqual([
            '1-detect.md',
            '2-preflight.md',
            '3-inventory.md',
            '4-sender.md',
            '5-suppressions.md',
            '6-key.md',
            '7-rewrite.md',
            '8-verify.md',
            '9-report.md',
        ]);
    });

    describe('the key check in step 6', () => {
        const keyStep = readFileSync(join(CONFIG_DIR, 'skills', 'migrate-email', 'references', '6-key.md'), 'utf8');
        const command = keyStep.match(/```bash\n(grep .+)\n```/)?.[1];
        let envDir;

        afterEach(() => {
            if (envDir) rmSync(envDir, { recursive: true, force: true });
            envDir = undefined;
        });

        function check(envFile) {
            envDir = mkdtempSync(join(tmpdir(), 'migrate-key-'));
            writeFileSync(join(envDir, '.env'), envFile);
            return spawnSync('bash', ['-c', command], { cwd: envDir, encoding: 'utf8' });
        }

        it.each([
            ['a plain key', 'POSTHOG_PROJECT_SECRET_API_KEY=phs_abc\n', '1'],
            ['an exported, spaced and double-quoted key', '  export POSTHOG_PROJECT_SECRET_API_KEY = "phs_abc"\n', '1'],
            ['a single-quoted key', "POSTHOG_PROJECT_SECRET_API_KEY='phs_abc'\n", '1'],
            ['a key after an empty line for it', 'POSTHOG_PROJECT_SECRET_API_KEY=\nPOSTHOG_PROJECT_SECRET_API_KEY=phs_abc\n', '1'],
            ['no line for the key', 'RESEND_API_KEY=re_abc\n', '0'],
            ['an empty key', 'POSTHOG_PROJECT_SECRET_API_KEY=\n', '0'],
            ['an empty quoted key', 'POSTHOG_PROJECT_SECRET_API_KEY=""\n', '0'],
            ['a commented-out line', '# POSTHOG_PROJECT_SECRET_API_KEY=phs_abc\n', '0'],
            ['a value that is only a comment', 'POSTHOG_PROJECT_SECRET_API_KEY= #phs_abc\n', '0'],
            ['a key overridden by a later empty line', 'POSTHOG_PROJECT_SECRET_API_KEY=phs_abc\nPOSTHOG_PROJECT_SECRET_API_KEY=\n', '0'],
            ['another variable ending in the name', 'OTHER_POSTHOG_PROJECT_SECRET_API_KEY=phs_abc\n', '0'],
            ['a placeholder in angle brackets', 'POSTHOG_PROJECT_SECRET_API_KEY=<phs_your_key>\n', '0'],
            ['a value with another prefix', 'POSTHOG_PROJECT_SECRET_API_KEY=xphs_abc\n', '0'],
            ['a value that starts with =', 'POSTHOG_PROJECT_SECRET_API_KEY==phs_abc\n', '0'],
        ])('finds the key in %s only when it is set, and never prints it', (_name, envFile, count) => {
            expect(command).toBeDefined();
            const result = check(envFile);

            expect(result.stdout.trim()).toBe(count);
            expect(result.stdout).not.toContain('phs_');
            expect(result.stderr).toBe('');
        });
    });

    it.each(PROVIDERS)('builds migrate-email-%s with its provider files, the rewrite files, and no other provider', async (provider) => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill(`migrate-email-${provider}`, outputDir);

        expect(unresolvedReferences(skillDir)).toEqual([]);
        for (const file of PROVIDER_FILES) {
            expect(existsSync(join(skillDir, 'references', provider, file))).toBe(true);
        }
        for (const sdk of SDKS) {
            expect(existsSync(join(skillDir, 'references', `rewrite-${sdk}.md`))).toBe(true);
        }
        expect(existsSync(join(skillDir, 'references', 'template-to-code.md'))).toBe(true);
        const otherProviders = PROVIDERS.filter((other) => other !== provider);
        expect(otherProviders.filter((other) => existsSync(join(skillDir, 'references', other)))).toEqual([]);
    });

    it('publishes each provider and Statsig as wizard migrate subcommands in the menu the Wizard reads', async () => {
        const { generator, skills } = await loadSkills();
        const entries = generateCliEntries({ allSkills: skills.map(generator.serializeSkill) });
        const entryOf = (skillId) => entries.find((entry) => entry.skillId === skillId);

        for (const provider of PROVIDERS) {
            expect(entryOf(`migrate-email-${provider}`), provider).toMatchObject({ role: 'command', parentCommand: 'migrate', command: provider });
        }
        expect(entryOf('migrate-statsig')).toMatchObject({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });
});
