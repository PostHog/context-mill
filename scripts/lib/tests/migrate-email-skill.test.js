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
const read = (file) => readFileSync(join(CONFIG_DIR, 'skills', 'migrate-email', 'references', file), 'utf8');

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
        ])('finds the key in %s only when it is set, and never prints it', (_name, envFile, count) => {
            expect(command).toBeDefined();
            const result = check(envFile);

            expect(result.stdout.trim()).toBe(count);
            expect(result.stdout).not.toContain('phs_');
            expect(result.stderr).toBe('');
        });

        it('ticks the phase only when the check found the key, and the report asks for a key that is not set', () => {
            expect(keyStep).toMatch(/A person who says they will add the key later has not set it/);
            expect(keyStep).toMatch(/Tick the phase in the plan file only when the check above found the key/);
            expect(keyStep).toMatch(/`- \[ \] key — not set: <why>`/);
            expect(read('7-report.md')).toMatch(/`POSTHOG_PROJECT_SECRET_API_KEY` in the env file when the plan says it is not set/);
        });
    });

    describe('what the run cannot finish before cutover', () => {
        it('asks for a last suppression import right before cutover, since the provider keeps adding entries', () => {
            expect(read('5-suppressions.md')).toMatch(/The provider keeps adding to its list while it sends/);
            expect(read('7-report.md')).toMatch(/import the entries the provider added to its suppression list since the export, right before cutover/);
        });

        it('lets a template made in PostHog become transactional only once its sender is verified', () => {
            const inventory = read('3-inventory.md');

            expect(inventory).toMatch(/PostHog makes a template transactional only once a verified sender covers its address/);
            expect(inventory).not.toMatch(/make it in PostHog from the provider's template, make it transactional, and give you/);
        });

        it('has the person confirm sends with content from the code, which the template tools do not show', () => {
            expect(read('2-preflight.md')).toMatch(/PostHog enables sends with content from the code separately/);
            expect(read('7-report.md')).toMatch(/sends with content from the code \(`html`, `text`, or `react`\) when a site that moves has them \(confirm with PostHog/);
        });
    });

    it('keeps a template site on Resend when it sets a reply-to, in either spelling', () => {
        const mapping = read('resend/mapping.md');

        expect(mapping).toMatch(/the site sets `from`, `replyTo` \/ `reply_to`, or `subject` next to it \|/);
        expect(mapping).toMatch(/A site that sets `from`, `replyTo` \/ `reply_to`, or `subject` next to `template` stays on Resend/);
    });

    it('publishes Resend and Statsig as wizard migrate subcommands in the menu the Wizard reads', async () => {
        const { generator, skills } = await loadSkills();
        const entries = generateCliEntries({ allSkills: skills.map(generator.serializeSkill) });
        const entryOf = (skillId) => entries.find((entry) => entry.skillId === skillId);

        expect(entryOf('migrate-email-resend')).toMatchObject({ role: 'command', parentCommand: 'migrate', command: 'resend' });
        expect(entryOf('migrate-statsig')).toMatchObject({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });
});
