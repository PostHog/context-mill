import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, relative } from 'path';
import { tmpdir } from 'os';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS_PAGES = {
    'https://posthog.com/docs/workflows/transactional-emails.md': '# Transactional emails\n\nSend one email to one person.\n',
    'https://posthog.com/docs/workflows/transactional-emails/api.md': '# Send transactional emails with the API\n',
};
const REFERENCE_PATH = /references\/[A-Za-z0-9_./-]+\.md/g;
const PROVIDERS = ['resend', 'sendgrid', 'postmark', 'mailgun', 'loops', 'smtp', 'amazon-ses', 'brevo', 'mailjet'];
const PROVIDER_FILES = ['sdk-reference.md', 'mapping.md', 'account.md'];
const SDKS = ['node', 'python', 'go', 'ruby', 'php', 'dotnet', 'rust', 'elixir'];
// Resend's mapping belongs to the base PRs; SMTP stores no templates.
const TEMPLATES_IN_CODE = PROVIDERS.filter((provider) => !['resend', 'smtp'].includes(provider));

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

    describe('the rewrite for each PostHog SDK', () => {
        const REFERENCES = join(CONFIG_DIR, 'skills', 'migrate-email', 'references');
        const read = (file) => readFileSync(join(REFERENCES, file), 'utf8');

        it('bundles one rewrite file for each SDK', async () => {
            outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

            const skillDir = await buildSkill('migrate-email-resend', outputDir);

            for (const sdk of SDKS) {
                expect(existsSync(join(skillDir, 'references', `rewrite-${sdk}.md`)), sdk).toBe(true);
            }
        });

        it('has step 7 pick the rewrite file by the language of each site', () => {
            const rewriteStep = read('7-rewrite.md');

            for (const sdk of SDKS) expect(rewriteStep).toContain(`\`rewrite-${sdk}.md\``);
            expect(rewriteStep).not.toMatch(/```(js|ts|python|go|ruby|php|csharp|rust|elixir)\n/);
        });

        it.each(SDKS)('gives the %s rewrite the secret key, the provider header, and the check to run', (sdk) => {
            const rewrite = read(`rewrite-${sdk}.md`);

            for (const heading of ['## Install', '## The client', '## The send', '## The answer', '## Check']) {
                expect(rewrite).toContain(heading);
            }
            expect(rewrite).toContain('POSTHOG_PROJECT_SECRET_API_KEY');
            expect(rewrite).toMatch(/migrated_?[fF]rom|MigratedFrom/);
            expect(rewrite).not.toContain('Code around the send');
            expect(rewrite).toMatch(/[rR]eply_?[tT]o[^\n]*(list|once per address)/);
        });

        it('keeps the secret key off a reverse proxy for every SDK, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toMatch(/unless its host is a reverse proxy/);
            expect(rewriteStep).toMatch(/When the app's host is a reverse proxy, give email its own client with the host set to PostHog's own host/);
            expect(rewriteStep).toMatch(/leave the secret key off the app's existing client/);
        });

        it('lists the coarse error names once, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            for (const name of ['validation_error', 'missing_api_key', 'invalid_permission', 'not_found', 'concurrent_idempotent_requests', 'invalid_idempotent_request', 'rate_limit_exceeded', 'monthly_quota_exceeded', 'service_unavailable', 'application_error']) {
                expect(rewriteStep).toContain(`\`${name}\``);
            }
        });

        it('no longer keeps a send on Resend for its language alone', () => {
            const mapping = read('resend/mapping.md');

            expect(mapping).not.toMatch(/other than JavaScript or TypeScript/);
            expect(mapping).not.toMatch(/until the skill moves that language/);
        });
    });

    describe('templates stored at the provider', () => {
        const REFERENCES = join(CONFIG_DIR, 'skills', 'migrate-email', 'references');
        const read = (file) => readFileSync(join(REFERENCES, file), 'utf8');

        it('brings a template site into the code by default, in step 3', () => {
            const inventory = read('3-inventory.md');

            expect(inventory).toMatch(/A `template` site moves by bringing its email into the code/);
            expect(inventory).toContain('`template-to-code.md`');
            expect(inventory).toMatch(/### A template in PostHog, when the person asks for one/);
            expect(inventory).not.toMatch(/A `template` site moves only to a template made in PostHog/);
        });

        it('renders the email in each SDK language without a new dependency', () => {
            const toCode = read('template-to-code.md');

            for (const sdk of SDKS) expect(toCode, sdk).toContain(`| \`${sdk}\` |`);
            expect(toCode).toMatch(/Add no template engine or other dependency/);
            expect(toCode).toMatch(/React Email/);
        });

        it('escapes every HTML value the way the provider did, and never the text or subject', () => {
            const toCode = read('template-to-code.md');

            expect(toCode).toMatch(/Escape every value in the HTML part/);
            expect(toCode).toMatch(/Never escape a value in the text part or in the subject/);
            expect(toCode).toMatch(/carries text from a user, a form, or another service, escape it anyway/);
        });

        it('sends a template brought into the code in the code form, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toMatch(/For a provider template that moves into the code, read the rest of `template-to-code.md` first/);
            expect(rewriteStep).toMatch(/For a template brought into the code, the code renders them, and the send has no template data/);
        });

        it.each(TEMPLATES_IN_CODE)('has the %s mapping bring its templates into the code, with a template in PostHog only on request', (provider) => {
            const mapping = read(`${provider}/mapping.md`);

            expect(mapping).toContain('`template-to-code.md`');
            expect(mapping).toMatch(/### Templates made in PostHog\n\nOnly for a template the person asks to make in PostHog/);
            expect(mapping).not.toMatch(/moves only to a template (made in PostHog|the person makes)/);
            expect(read(`${provider}/account.md`)).not.toMatch(/Step 3 deletes once the site is classified/);
        });

        it('fills SendGrid substitutions in the code instead of keeping the site', () => {
            const mapping = read('sendgrid/mapping.md');

            expect(mapping).toMatch(/\| `substitutions` on a send with its own `subject` and `content` \| none: the code puts the values into the subject and the content before the send \|/);
            expect(mapping).not.toMatch(/\| `substitutions` \| none \| Always/);
        });

        it('brings a Postmark template into the code with its layout, raw values, and inlined CSS', () => {
            const mapping = read('postmark/mapping.md');
            const inCode = mapping.split('### Templates made in PostHog')[0];

            expect(inCode).toMatch(/the layout and the template come into the code as one email/);
            expect(inCode).toMatch(/\| `\{\{\{name\}\}\}`, `\{\{& name\}\}` \| The value as it is, unescaped/);
            expect(inCode).toMatch(/With `InlineCss` on, its default, write each `<style>` rule into the `style` attribute of the tags it matches/);
            expect(mapping).not.toMatch(/\| `InlineCss` \| none \| Never on its own\. It only shapes how Postmark renders its template, and the PostHog template holds its own HTML \|/);
        });

        it('fills the recipient variables of a mailgun send to one address in the code instead of keeping the site', () => {
            const mapping = read('mailgun/mapping.md');

            expect(mapping).toMatch(/\| `recipient-variables`, on a send with one address in `to` and its own `subject`, `text`, or `html` \| none: the code puts the values into the subject and the content before the send \|/);
            expect(mapping).toMatch(/\| `%unsubscribe_url%`, `%tag_unsubscribe_url%`, or `%mailing_list_unsubscribe_url%` in `subject`, `text`, or `html` \| none \| Always: Mailgun fills them at send time/);
            expect(mapping).not.toMatch(/\| `recipient-variables` \| none \| Always/);
        });

        it('brings every Loops email into the code, turning each LMX tag into HTML', () => {
            const mapping = read('loops/mapping.md');
            const lmx = mapping.match(/### From LMX to HTML\n([\s\S]*?)\n### /)?.[1] ?? '';
            const tags = ['Style', 'H1', 'H2', 'H3', 'Paragraph', 'Quote', 'CodeBlock', 'Button', 'Image', 'Divider', 'OrderedList', 'UnorderedList', 'ListItem', 'Columns', 'ColumnItem', 'Section', 'Component', 'Icons', 'Icon', 'Strong', 'Em', 'Underline', 'Code', 'Strike', 'Text', 'Link', 'Br'];

            expect(mapping).not.toMatch(/No Loops site moves to the code form/);
            for (const tag of tags) expect(lmx, tag).toMatch(new RegExp(`\`<${tag}[ />]`));
            expect(mapping).toMatch(/\| `transactionalId` \| the Loops email, brought into the code/);
        });

        it('renders an Amazon SES inline template in the code instead of a template made in PostHog', () => {
            const mapping = read('amazon-ses/mapping.md');

            expect(mapping).toMatch(/\| `Content.Template.TemplateContent` with `TemplateData` \| none: the code renders `TemplateData` into its `Subject`, `Html`, and `Text` before the send \|/);
            expect(mapping).not.toMatch(/\| `Content.Template.TemplateContent` \| a template made in PostHog \|/);
        });

        it('renders Brevo params in a send\'s own content in the code instead of keeping the site', () => {
            const mapping = read('brevo/mapping.md');

            expect(mapping).toMatch(/\| `params` on a send with its own `htmlContent` or `textContent` \| none: the code renders the content and the `subject` with `params` before the send \|/);
            expect(mapping).not.toMatch(/\| `params` without `templateId` \| none \| Always/);
        });

        it('renders Mailjet template language in the code, and blocks only where Mailjet blocked', () => {
            const mapping = read('mailjet/mapping.md');

            expect(mapping).toMatch(/\| `TemplateLanguage` \| none: with `true`, the code renders Mailjet's template language into the content before the send/);
            expect(mapping).not.toMatch(/PostHog's code form sends the content as it is/);
            expect(mapping).toMatch(/Without `TemplateErrorDeliver: true`, the render raises on a left-out value/);
            expect(mapping).toMatch(/With `TemplateErrorDeliver: true`, Mailjet sent the email anyway/);
        });
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
            const result = check(envFile);

            expect(result.stdout.trim()).toBe(count);
            expect(result.stdout).not.toContain('phs_');
            expect(result.stderr).toBe('');
        });

        it('ticks the phase only when the check found the key', () => {
            expect(command).toBeDefined();
            expect(keyStep).toMatch(/A person who says they will add the key later has not set it/);
            expect(keyStep).toMatch(/Tick the phase in the plan file only when the check above found the key/);
            expect(keyStep).toMatch(/`- \[ \] key — not set: <why>`/);
        });
    });

    describe('open and click tracking', () => {
        const REFERENCES = join(CONFIG_DIR, 'skills', 'migrate-email', 'references');
        const read = (file) => readFileSync(join(REFERENCES, file), 'utf8');

        it.each(PROVIDERS)('never maps %s open or click tracking onto engagement capture', (provider) => {
            const mapping = read(`${provider}/mapping.md`);

            expect(mapping).not.toMatch(/captureEngagement: false/);
            expect(mapping).not.toMatch(/turns off both/);
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
        expect(existsSync(join(skillDir, 'references', 'posthog-sdks.md'))).toBe(false);
        expect(existsSync(join(skillDir, 'references', 'template-to-code.md'))).toBe(true);
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
