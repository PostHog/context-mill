import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS = 'https://posthog.com/docs/mcp-analytics';

const urlOf = (entry) => (typeof entry === 'string' ? entry : entry.url);

describe('mcp-analytics skill family', () => {
    const config = loadSkillsConfig(CONFIG_DIR);
    const variants = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'mcp-analytics');
    const urlsOf = (id) => variants.find((s) => s.id === id).docs_urls.map(urlOf);

    it('keeps the command skill (the variant the wizard installs by id) and the python variant', () => {
        expect(variants.map((s) => s.id).sort()).toEqual(['mcp-analytics', 'mcp-analytics-python']);
    });

    it.each([
        ['mcp-analytics', ['typescript', 'python', 'go']],
        ['mcp-analytics-python', ['python']],
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
});
