import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS = 'https://posthog.com/docs/mcp-analytics';
const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Ruby'];

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

    it.each(variants.map((s) => [s.id]))('%s links no page that now redirects', (id) => {
        const urls = urlsOf(id);
        expect(urls).not.toContain(`${DOCS}/custom-servers.md`);
        expect(urls).not.toContain(`${DOCS}/installation.md`);
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

    it('supports Ruby and keeps Rust unsupported', () => {
        const unsupported = abortSection.match(/^- `\[ABORT\] unsupported language for mcp analytics`.*$/m)[0];
        for (const language of LANGUAGES) expect(unsupported).toContain(language);
        const examples = text.match(/written in anything else \(([^)]*)\)/)[1];
        expect(examples).toContain('Rust');
        expect(examples).not.toContain('Ruby');
    });

    it('makes the agent report the Ruby SDK as experimental and keep its warning', () => {
        expect(text).toContain('experimental and not officially supported');
        expect(text).toContain('posthog-mcp-analytics-report.md');
        expect(text).toContain('production-ready');
        expect(text).toMatch(/[Nn]ever suppress the gem's experimental warning/);
    });

    it('describes the current Go SDK', () => {
        expect(text).toContain('WithMissingCapabilityTool');
        expect(text).toContain('`$mcp_unknown_tool`');
        expect(text).toContain('`$mcp_input_required`');
        expect(text).toContain('v1.33.0');
        expect(text).not.toMatch(/Go SDK has no[^.]*missing-capability/);
    });
});
