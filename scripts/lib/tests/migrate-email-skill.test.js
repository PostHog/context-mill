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
const PROVIDERS = ['resend', 'sendgrid'];
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

const STEP_SECTION = /(?:Step (\d)|`(\d)-[a-z-]+\.md`)(?: says| does)? under "([^"]+)"/g;

function unresolvedStepSections(skillDir) {
    const referencesDir = join(skillDir, 'references');
    const headingsOf = (number) => {
        const step = readdirSync(referencesDir).find((name) => name.startsWith(`${number}-`) && name.endsWith('.md'));
        return step ? [...readFileSync(join(referencesDir, step), 'utf8').matchAll(/^#+ (.+)$/gm)].map((match) => match[1].trim()) : [];
    };
    const missing = [];
    for (const file of markdownFiles(skillDir)) {
        for (const [, stepNumber, fileNumber, section] of readFileSync(file, 'utf8').matchAll(STEP_SECTION)) {
            const headings = headingsOf(stepNumber ?? fileNumber);
            if (!headings.some((heading) => heading === section || heading.startsWith(`${section},`))) {
                missing.push(`${relative(skillDir, file)} → Step ${stepNumber ?? fileNumber}, "${section}"`);
            }
        }
    }
    return missing;
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

    describe('a marketing email', () => {
        const REFERENCES = join(CONFIG_DIR, 'skills', 'migrate-email', 'references');
        const read = (file) => readFileSync(join(REFERENCES, file), 'utf8');
        const SEND_CATEGORY = {
            node: "`category: { key, type: 'marketing', name, description }`",
            python: '`category=MessageCategory(key=..., type="marketing", name=..., description=...)`',
            go: '`Category: posthog.MessageCategory{Key, Type: posthog.MessageCategoryMarketing, Name, Description}`',
            ruby: "`category: PostHog::Emails::MessageCategory.new(key:, type: 'marketing', name:, description:)`",
            php: "`'category' => ['key' => ..., 'type' => 'marketing', 'name' => ..., 'description' => ...]`",
            dotnet: '`Category = new MessageCategory { Key, Type = MessageCategoryType.Marketing, Name, Description }`',
            rust: '`.category(MessageCategory::new(key, MessageCategoryType::Marketing, name).description(...))`',
            elixir: '`category: %PostHog.Emails.MessageCategory{key: ..., type: :marketing, name: ..., description: ...}`',
        };

        it("records each site's category in step 3, copied exactly from the project's message categories", () => {
            const inventory = read('3-inventory.md');

            expect(inventory).toContain('`message-categories-list`');
            expect(inventory).toMatch(/\| site \| file \| line \| language \| sends \| content \| category \| from \| moves \| reason \|/);
            expect(inventory).toMatch(/The category: blank for no category, or the key of the category its email is filed under in PostHog/);
            expect(inventory).toMatch(/When the person asks to move an email that a PostHog workflow sends into the code, the site is the code they name to send it/);
            expect(inventory).toMatch(/The site keeps the category of the workflow's email step: read the step.s `message_category_id` and `message_category_type` with `workflows-get`, and the category's key, type, name, and description with `message-categories-get`/);
            expect(inventory).toMatch(/A step without a category leaves the site's category blank/);
            expect(inventory).toMatch(/Copy an existing category's key, type, name, and description exactly: a key spelled another way makes a new category that no recipient opted out of/);
            expect(inventory).toMatch(/The first send creates a new category, so make none yourself/);
            expect(inventory).toMatch(/for each category key, note its type, name, and description, and mark it new when it is not in PostHog yet/);
            for (const reason of ['no unsubscribe link', 'no category named', 'no message category tools', 'copies_not_allowed']) expect(inventory).toContain(`the reason is \`${reason}\``);
        });

        it.each(Object.entries(SEND_CATEGORY))('passes the category object in the %s code send and names an opted-out recipient', (sdk, category) => {
            const rewrite = read(`rewrite-${sdk}.md`);

            expect(rewrite.split('## The send')[1].split('## The answer')[0]).toContain(category);
            expect(rewrite).toContain('recipient_opted_out');
        });

        it('moves only a transactional site to a template made in PostHog, and checks only code-form categories', () => {
            const inventory = read('3-inventory.md');
            const section = inventory.split('### A template in PostHog')[1]?.split('\n## ')[0] ?? '';
            const turnAway = section.indexOf('A marketing email can\'t become one');
            const makeRequest = section.indexOf('Ask the person once, for every transactional one, to make it in PostHog');
            expect(section).toMatch(/Get its content as "Classify each site" says above, and decide the kind of each template the person wants made in PostHog from it, as "The category of each site" below says\. When the person can't give the content, the site stays, and the reason is `template content not checked`/);
            expect(section).toMatch(/Tell the person once, for every marketing one, and ask whether each moves into the code, with the plan and the check of the paragraphs above, or stays, with the reason `kept on <provider name> for now`/);
            expect(section).toMatch(/Ask the person once, for every transactional one, to make it in PostHog from the provider's template and give you its template ID/);
            expect(turnAway).toBeGreaterThan(-1);
            expect(makeRequest).toBeGreaterThan(turnAway);
            expect(read('7-rewrite.md')).toMatch(/- a code-form site with a category: the code send takes a category\./);
            expect(read('8-verify.md')).toMatch(/Check that every site with a category that sends in the code form passes the key, type, name, and description the plan notes/);
            expect(read('8-verify.md')).toMatch(/A site with a blank category, or one that sends a template made in PostHog, passes none\./);
        });

        it("takes a moved workflow email's kind from the step's saved type, which PostHog sends by", () => {
            const inventory = read('3-inventory.md');

            expect(inventory).toMatch(/read the step's `message_category_id` and `message_category_type` with `workflows-get`/);
            expect(inventory).toContain('the reason is `workflow step type differs from its category`');
        });

        it('keeps a site with a category when the project refuses categories on code sends, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toContain('`categories_not_enabled`');
            expect(rewriteStep).toContain('`moves: no — code-send categories are off`');
        });

        it("checks a marketing site's placeholder as the href of a link, as PostHog does, in step 8", () => {
            expect(read('8-verify.md')).toContain('`<a href="{{ unsubscribe_url }}">`');
        });

        it('refuses a new category key that the project already has, in step 3', () => {
            expect(read('3-inventory.md')).toMatch(/A new key must not be in that list, whatever its category's type: when it is, ask them for another\./);
        });

        it('sends the category object and leaves the category out of a transactional send, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toMatch(/A site with a category that sends in the code form passes it as the send's category, spelled as the rewrite file says under "The send", with the key, type, name, and description the plan notes, written exactly/);
            expect(rewriteStep).toMatch(/A site that sends a template made in PostHog is transactional and passes no category/);
            expect(rewriteStep).toMatch(/A site with a blank category leaves the category out/);
            expect(rewriteStep).toMatch(/unless its template key names a template made in PostHog: the send then follows that template's category, and PostHog refuses any other category, and `transactional` too when the template has a category, with `category_mismatch`/);
            expect(rewriteStep).toMatch(/The template form is transactional, and PostHog refuses a send in either form that names a template in a `marketing` category with `marketing_template`\./);
            expect(rewriteStep).toMatch(/In a marketing site, the unsubscribe link that the provider filled becomes `\{\{ unsubscribe_url \}\}`\./);
            for (const code of ['category_mismatch', 'too_many_categories', 'unsubscribe_link_required', 'copies_not_allowed', 'recipient_opted_out']) expect(rewriteStep).toContain(`\`${code}\``);
            expect(rewriteStep).toMatch(/`recipient_opted_out`[^\n]*never retry/);
        });

        it('says a send only creates or restores a category, and names its 400 refusals by code, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toMatch(/PostHog finds the project's category by its key, and creates it when there is none or restores it when it was deleted\. It uses the name and description only when it creates the category, and otherwise leaves the category as it is: rename a category in PostHog, not in the code\./);
            expect(rewriteStep).toMatch(/The refusals `category_mismatch`, `too_many_categories`, `unsubscribe_link_required`, `copies_not_allowed`, and `marketing_template` come back as API errors with the status 400 and the name `validation_error`\./);
        });

        it("keeps the provider's unsubscribe link in a marketing email as PostHog's placeholder", () => {
            const guide = read('template-to-code.md');

            expect(guide).toMatch(/In a marketing email, the provider's unsubscribe link becomes `\{\{ unsubscribe_url \}\}`/);
            expect(guide).toMatch(/A function that replaces markers leaves `\{\{ unsubscribe_url \}\}` as it is/);
            expect(guide).toContain("in JSX text, `{'{{ unsubscribe_url }}'}`");
        });

        it('checks each key against the project in step 8 and reports in step 9 that every site kept its category', () => {
            expect(read('8-verify.md')).toMatch(/List the project's categories with `message-categories-list`: each key the plan doesn't mark as new must be in it, spelled the same, with the same type\. Otherwise the send makes a new category that no recipient opted out of, or fails with `category_mismatch` for the other type\./);
            expect(read('8-verify.md')).toMatch(/Fix each site that fails, then run this step's checks again from the top/);
            expect(read('8-verify.md')).toMatch(/When no site moved in Step 7, tick the phase with `nothing to check`/);
            expect(read('8-verify.md')).toMatch(/category: <kept>\/<sites with a category> kept/);
            expect(read('9-report.md')).toMatch(/\| File \| Line \| Content \| Category \| Key \| Status \|/);
            expect(read('9-report.md')).toMatch(/opted out at <provider name>/);
            expect(read('9-report.md')).toMatch(/Under the table, list each category the plan marks new that a moved site uses, with its key, type, name, and description/);
            expect(read('9-report.md')).toMatch(/a category the plan marks new exists only after its first send, so make it in PostHog first, with the key, type, name, and description this report lists for it/);
            expect(read('9-report.md')).toMatch(/a branch for a suppressed or opted-out recipient/);
            expect(read('9-report.md')).toMatch(/each workflow email moved into the code \(the one item done at the deploy itself: turn off its email step in PostHog as the code goes live, or both send it\)/);
            expect(read('9-report.md')).toMatch(/check that it is transactional, sends from a verified sender/);
            expect(read('resend/mapping.md')).toMatch(/makes it transactional once a verified sender covers its address/);
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

    it('keeps the hidden preview block of an old React Email release out of the text part', () => {
        const templateToCode = readFileSync(join(CONFIG_DIR, 'skills', 'migrate-email', 'references', 'template-to-code.md'), 'utf8');
        const fallback = templateToCode.split('\n').find((line) => line.includes('has no `useTitleTag` prop'));

        expect(fallback).toBeDefined();
        expect(fallback).toContain('data-skip-in-text="true"');
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
        const bundledProviders = readdirSync(join(skillDir, 'references'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
        expect(bundledProviders).toEqual([provider]);
    });

    it.each(PROVIDERS)('points each "Step N says under" reference in migrate-email-%s to a section that step has', async (provider) => {
        outputDir = mkdtempSync(join(tmpdir(), 'migrate-skill-'));

        const skillDir = await buildSkill(`migrate-email-${provider}`, outputDir);

        expect(unresolvedStepSections(skillDir)).toEqual([]);
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
