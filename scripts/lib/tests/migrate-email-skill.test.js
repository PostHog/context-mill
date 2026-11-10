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

    describe('a Resend template brought into the code', () => {
        const REFERENCES = join(CONFIG_DIR, 'skills', 'migrate-email', 'references');
        const read = (file) => readFileSync(join(REFERENCES, file), 'utf8');

        it('makes the code the default in steps 3 and 7, with a template in PostHog only on request', () => {
            const inventory = read('3-inventory.md');
            const rewriteStep = read('7-rewrite.md');

            expect(inventory).toMatch(/A `template` site moves by bringing its email into the code/);
            expect(inventory).toMatch(/### A template in PostHog, when the person asks for one/);
            expect(inventory).not.toMatch(/A `template` site moves only to a template made in PostHog/);
            expect(rewriteStep).toMatch(/For a provider template that moves into the code, read the rest of `template-to-code.md` first/);
            expect(rewriteStep).toMatch(/For a template brought into the code, the code renders them, and the send has no template data/);
        });

        it('has the Resend mapping bring its templates into the code, with the Liquid form kept for PostHog templates', () => {
            const mapping = read('resend/mapping.md');

            expect(mapping).toContain('`template-to-code.md`');
            expect(mapping).toMatch(/### Templates made in PostHog\n\nOnly for a template the person asks to make in PostHog/);
            expect(mapping).not.toMatch(/moves only to a template (made in PostHog|the person makes)/);
            expect(mapping).toMatch(/`\{\{\{NAME\}\}\}` becomes `\{\{ variables\.NAME \}\}`/);
            expect(read('resend/account.md')).not.toMatch(/Step 3 deletes once the site is classified/);
        });

        it('escapes a Resend variable by the shared rule, and applies a fallback only to a missing value', () => {
            const mapping = read('resend/mapping.md');

            expect(mapping).toMatch(/\| `\{\{\{NAME\}\}\}` in the HTML \| The value\. Resend inserts it as it is and never escapes it, so it falls under the rule of `template-to-code\.md`/);
            expect(mapping).toMatch(/\| `\{\{\{NAME\}\}\}` in the subject or the text \| The value as it is, with no escaping \|/);
            expect(mapping).toMatch(/`""` renders as nothing, not as the fallback/);
        });

        it('writes a JavaScript or TypeScript email as a React Email component, unless the app runs its source without compiling JSX', () => {
            const guide = read('template-to-code.md');

            expect(guide).toMatch(/1\. \*\*React Email\*\*, for JavaScript or TypeScript\. It is the default there, also when the app has no React Email package yet/);
            expect(guide).toMatch(/Never add `@react-email\/components`: it is deprecated/);
            expect(guide).toMatch(/Use the string-built `node` row only when the part that sends can't take React Email: Node\.js runs its source as it is/);
            expect(guide).toMatch(/`emails\/<Name>Mail\.tsx` in TypeScript, or `emails\/<Name>Mail\.jsx` in JavaScript/);
            expect(read('rewrite-node.md')).toMatch(/For a site that renders a React Email component, also run the build/);
        });

        it('renders the HTML and the text part from one component, with a preview of every email on react-email 6', () => {
            const guide = read('template-to-code.md');

            expect(guide).toMatch(/the HTML with `render\(element\)` and the text with `toPlainText\(html\)`/);
            expect(guide).toMatch(/A React Email package without `toPlainText`, such as `@react-email\/render` before 1\.2, renders the text with `render\(element, \{ plainText: true \}\)`/);
            expect(guide).toMatch(/Add the preview only with `react-email` 6 or later/);
            expect(guide).toMatch(/`email dev --dir emails`/);
            expect(guide).toMatch(/only when it has a default export, and skips every folder whose name starts with `_`/);
            expect(guide).toMatch(/Set `PreviewProps` on the component/);
            expect(read('9-report.md')).toMatch(/look at it with the preview script/);
        });

        it('greets the recipient by name and records the greeting of every email', () => {
            const guide = read('template-to-code.md');

            expect(guide).toMatch(/Greet the recipient by the name the app knows them by at the site/);
            expect(guide).toMatch(/The name is a value the render takes, not a field of the send/);
            expect(guide).toMatch(/each email's greeting: the name it uses, or why it has none/);
        });

        it('imports render from react-email from version 6 on, and installs a renderer before it', () => {
            expect(read('resend/mapping.md')).toMatch(/`import \{ render \} from 'react-email'` from version 6 on/);
            expect(read('rewrite-node.md')).toMatch(/`render` from `react-email` from version 6 on/);
            expect(read('rewrite-node.md')).toMatch(/Add `@react-email\/render` when the app has an older React Email package that exports no `render`/);
        });

        it("names each line only the provider's own text part had, so the person decides whether the email needs it", () => {
            expect(read('template-to-code.md')).toMatch(/When the provider template had its own text part, compare it with the rendered one/);
            expect(read('9-report.md')).toMatch(/each line only the provider's text part had/);
        });

        it('lets only a component written for a template brought into the code add the text part', () => {
            expect(read('resend/mapping.md')).toMatch(/A template without `text` sends `html` only, unless the email is a React Email component/);
            expect(read('7-rewrite.md')).toMatch(/and the text part of a React Email component written for a template brought into the code/);
        });

        it("lets the site's own from, reply-to and subject win over the template's", () => {
            const mapping = read('resend/mapping.md');

            expect(mapping).toMatch(/A subject the site sets next to `template` wins/);
            expect(mapping).toMatch(/\*\*Templates brought into the code\.\*\*[^\n]*the site's own where it sets them, otherwise the template's/);
        });
    });

    describe('the rewrite for each PostHog SDK', () => {
        const SDKS = ['node', 'python', 'go', 'ruby', 'php', 'dotnet', 'rust', 'elixir'];
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
            expect(inventory).toMatch(/The site keeps the category of the workflow's email step: read the step.s `message_category_id` with `workflows-get`, and the category's key, type, name, and description with `message-categories-get`/);
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

        it('sends the category object and leaves the category out of a transactional send, in step 7', () => {
            const rewriteStep = read('7-rewrite.md');

            expect(rewriteStep).toMatch(/A site with a category passes it as the send's category, spelled as the rewrite file says under "The send", with the key, type, name, and description the plan notes, written exactly/);
            expect(rewriteStep).toMatch(/A site with a blank category leaves the category out/);
            expect(rewriteStep).toMatch(/unless its template key names a template made in PostHog: the send then follows that template's category, and PostHog refuses any other category, `transactional` included, with `category_mismatch`/);
            expect(rewriteStep).toMatch(/In a marketing site, the unsubscribe link that the provider filled becomes `\{\{ unsubscribe_url \}\}`\./);
            for (const code of ['category_mismatch', 'too_many_categories', 'unsubscribe_link_required', 'copies_not_allowed', 'recipient_opted_out']) expect(rewriteStep).toContain(`\`${code}\``);
            expect(rewriteStep).toMatch(/`recipient_opted_out`[^\n]*never retry/);
        });

        it("keeps the provider's unsubscribe link in a marketing email as PostHog's placeholder", () => {
            const guide = read('template-to-code.md');

            expect(guide).toMatch(/In a marketing email, the provider's unsubscribe link becomes `\{\{ unsubscribe_url \}\}`/);
            expect(guide).toMatch(/A function that replaces markers leaves `\{\{ unsubscribe_url \}\}` as it is/);
            expect(guide).toContain("in JSX text, `{'{{ unsubscribe_url }}'}`");
        });

        it('checks each key against the project in step 8 and reports in step 9 that every site kept its category', () => {
            expect(read('8-verify.md')).toMatch(/every site with a category passes the key, type, name, and description the plan notes/);
            expect(read('8-verify.md')).toMatch(/List the project's categories with `message-categories-list`: each key the plan doesn't mark as new must be in it, spelled the same, with the same type, name, and description, and each key it marks new must not be/);
            expect(read('8-verify.md')).toMatch(/When a key marked new is already in it with the site's type, ask the person whether the site uses that category, with its name and description copied exactly, or a key that isn't taken\. With the other type, ask them only for a key that isn't taken/);
            expect(read('8-verify.md')).toMatch(/Fix each site that fails, then run the check and the tests above again/);
            expect(read('8-verify.md')).toMatch(/category: <kept>\/<sites with a category> kept/);
            expect(read('9-report.md')).toMatch(/\| File \| Line \| Content \| Category \| Key \| Status \|/);
            expect(read('9-report.md')).toMatch(/opted out at <provider name>/);
            expect(read('9-report.md')).toMatch(/Under the table, list each category the plan marks new that a moved site uses, with its key, type, name, and description/);
            expect(read('9-report.md')).toMatch(/a category the plan marks new exists only after its first send, so make it in PostHog first, with the key, type, name, and description this report lists for it/);
            expect(read('9-report.md')).toMatch(/each category the code now defines \(the next send undoes a change to its name or description in PostHog, so change them in the code\)/);
            expect(read('9-report.md')).toMatch(/a branch for a suppressed or opted-out recipient/);
            expect(read('9-report.md')).toMatch(/each workflow email moved into the code \(the one item done at the deploy itself: turn off its email step in PostHog as the code goes live, or both send it\)/);
            expect(read('9-report.md')).toMatch(/check that it is transactional, or in the site's category/);
            expect(read('resend/mapping.md')).toMatch(/makes it transactional, or files it under the site's category/);
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

    it('publishes Resend and Statsig as wizard migrate subcommands', async () => {
        const { skills } = await loadSkills();
        const cliOf = (id) => skills.find((skill) => skill.id === id)?._cli;

        expect(cliOf('migrate-email-resend')).toEqual({ role: 'command', parentCommand: 'migrate', command: 'resend' });
        expect(cliOf('migrate-statsig')).toEqual({ role: 'command', parentCommand: 'migrate', command: 'statsig' });
    });
});
