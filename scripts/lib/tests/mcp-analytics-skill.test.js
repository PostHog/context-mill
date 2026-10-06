import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS = 'https://posthog.com/docs/mcp-analytics';
const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Ruby'];
const REDIRECTED = ['custom-servers.md', 'installation.md'];
const REPORT_FILE = 'posthog-mcp-analytics-report.md';

const urlOf = (entry) => (typeof entry === 'string' ? entry : entry.url);

describe('mcp-analytics skill family', () => {
    const config = loadSkillsConfig(CONFIG_DIR);
    const variants = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'mcp-analytics');
    const urlsOf = (id) => variants.find((s) => s.id === id).docs_urls.map(urlOf);

    it('keeps the command skill (the variant the wizard installs by id) and the per-language variants', () => {
        expect(variants.map((s) => s.id).sort()).toEqual([
            'mcp-analytics',
            'mcp-analytics-python',
            'mcp-analytics-ruby',
        ]);
    });

    it.each([
        ['mcp-analytics', ['typescript', 'python', 'go', 'ruby']],
        ['mcp-analytics-python', ['python']],
        ['mcp-analytics-ruby', ['ruby']],
    ])('%s bundles the per-language installation pages %j', (id, languages) => {
        expect(urlsOf(id)).toEqual(
            expect.arrayContaining(languages.map((language) => `${DOCS}/installation/${language}.md`)),
        );
    });

    it.each(variants.flatMap((s) => REDIRECTED.map((page) => [s.id, page])))('%s links no redirected page %s', (id, page) => {
        expect(urlsOf(id)).not.toContain(`${DOCS}/${page}`);
    });

    // The generator names each reference after the last URL path segment, so
    // `installation/python.md` and `libraries/python.md` would overwrite each other.
    it.each(variants.map((s) => [s.id]))('%s bundles every doc under a distinct filename', (id) => {
        const filenames = urlsOf(id).map((url) => url.split('/').pop());
        expect(new Set(filenames).size).toBe(filenames.length);
    });

    it.each(LANGUAGES)('the command skill description names %s', (language) => {
        const command = variants.find((s) => s.id === 'mcp-analytics');
        expect(command.description).toContain(language);
        expect(command.display_name).toContain(language);
    });
});

describe('mcp-analytics instructions', () => {
    const [skill] = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR).filter(
        (s) => s.id === 'mcp-analytics',
    );
    const text = skill._template;
    const steps = text.split(/^### (?=STEP \d)/m).slice(1);
    const abortSection = text.slice(text.indexOf('### Abort cases'), text.indexOf('## Instructions'));
    const bundled = [...skill.docs_urls, ...skill._sharedDocs].map((entry) => urlOf(entry).split('/').pop());

    it('has seven steps', () => {
        expect(steps.map((step) => step.slice(0, 6))).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `STEP ${n}`));
    });

    // A language part opens with a `#### Go` heading or a bold `**Go` lead.
    it.each(steps.flatMap((step) => ['Go', 'Ruby'].map((language) => [step.slice(0, 6), language, step])))(
        '%s has a %s part',
        (_step, language, step) => {
            expect(step).toMatch(new RegExp(`^(#### ${language}$|\\s*(- )?\\*\\*${language}\\b)`, 'm'));
        },
    );

    it('lists every [ABORT] reason the steps emit in the abort cases', () => {
        const emitted = [...text.matchAll(/`\[ABORT\] ([^`<]+)`/g)].map(([, reason]) => reason);
        const listed = [...abortSection.matchAll(/^- `\[ABORT\] ([^`]+)`/gm)].map(([, reason]) => reason);
        expect(emitted.length).toBeGreaterThan(0);
        expect(listed).toEqual(expect.arrayContaining(emitted));
    });

    it('points only at reference files the skill bundles', () => {
        const named = [...text.matchAll(/`([\w./-]+\.md)`/g)].map(([, file]) => file).filter((f) => f !== REPORT_FILE);
        expect(named.length).toBeGreaterThan(0);
        expect(bundled).toEqual(expect.arrayContaining(named));
    });

    it.each(REDIRECTED)('never names the redirected page %s', (page) => {
        expect(text).not.toContain(page);
    });

    it.each(LANGUAGES)('the unsupported-language abort lists %s as supported', (language) => {
        const line = abortSection.split('\n').find((l) => l.startsWith('- `[ABORT] unsupported language for mcp analytics`'));
        expect(line, 'abort cases list `[ABORT] unsupported language for mcp analytics`').toBeDefined();
        expect(line).toContain(language);
    });

    it('names Rust, not Ruby, as an unsupported language', () => {
        const examples = text.match(/written in anything else \(([^)]*)\)/)?.[1];
        expect(examples, 'guardrail lists examples as "written in anything else (...)"').toBeDefined();
        expect(examples).toContain('Rust');
        expect(examples).not.toContain('Ruby');
    });

    // Each SDK's minimum version, read wherever the package name is followed by a version.
    it.each([
        ['@posthog/mcp', /@posthog\/mcp[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '0.18.0'],
        ['posthog (Python)', /(?<![\w/@-])posthog(?![\w/-])[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '7.62.0'],
        ['posthogmcpsdk', /posthogmcpsdk[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '1.33.0'],
        ['posthog-ruby', /posthog-ruby[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '3.26.2'],
    ])('states one floor for %s', (_sdk, pattern, floor) => {
        expect([...new Set([...text.matchAll(pattern)].map(([, version]) => version))]).toEqual([floor]);
    });

    it('TypeScript Path C delivers conversation handles', () => {
        const start = text.indexOf('**Path C — custom dispatcher:**');
        const pathC = text.slice(start, text.indexOf('**Path D', start));
        expect(pathC).toContain('posthog.prepareToolResult(result, prepared)');
        expect(pathC).not.toMatch(/[Cc]onversation[- ]id[^.]*(isn't|not) available/);
    });

    it.each([
        ['Ruby is reported as experimental', 'experimental and not officially supported'],
        ['the notice goes in the wizard report', REPORT_FILE],
        ['Ruby is never called production-ready', 'never describe the Ruby setup as production-ready'],
        ['the Ruby warning stays on', "Never suppress the gem's experimental warning"],
        ['Ruby reads the token without raising', 'ENV["POSTHOG_PROJECT_TOKEN"]'],
        ['Python P2 prepares each call', 'posthog.prepare_tool_call(name, arguments)'],
        ['Python P2 delivers the conversation handle', 'posthog.prepare_tool_result(result, prepared)'],
        ['Go offers the opt-in missing-capability tool', 'WithMissingCapabilityTool'],
        ['Go reports unknown tools', '`$mcp_unknown_tool`'],
        ['Go reports input_required rounds', '`$mcp_input_required`'],
        ['Go tidies go.mod', '`go mod tidy`'],
    ])('%s', (_claim, needle) => {
        expect(text).toContain(needle);
    });
});
