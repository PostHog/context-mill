#!/usr/bin/env node

/**
 * Build PostHog Docs Skills
 *
 * Fetches https://posthog.com/llms.txt, groups pages by section (## heading),
 * fetches all page content in parallel, and generates one skill directory per
 * section under dist/skills/posthog-{section}/.
 *
 * Usage:
 *   node scripts/build-docs-skills.js
 *   node scripts/build-docs-skills.js feature-flags product-analytics
 *   node scripts/build-docs-skills.js --docs-dir /path/to/extracted-docs
 *
 * --docs-dir <path>  Read docs from a local directory (e.g. an extracted
 *                     build artifact from posthog.com) instead of fetching
 *                     from the live website. The directory must contain
 *                     llms.txt at its root and doc pages preserving their
 *                     URL path structure (e.g. docs/feature-flags/index.md).
 *
 * Optional positional args: space-separated section slugs to build.
 * Defaults to all sections found in llms.txt.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { zipSkillToBuffer } = require('./lib/zip');

const LLMS_TXT_URL = 'https://posthog.com/llms.txt';
const CATEGORY = 'posthog-docs';
const CONCURRENCY = 10;
const SKILLS_DIR = path.join(__dirname, '..', 'dist', 'skills');
const TEMP_DIR = path.join(__dirname, '..', 'dist', 'docs-skills-temp');

// Sections excluded by default — SDK and API reference material that is too
// large and low signal-to-noise for skill context. Pass explicit slug args to
// override and build one of these directly.
const DEFAULT_EXCLUDE = new Set(['libraries', 'api', 'endpoints', 'open-api-spec']);

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL as text, retrying on failure.
 * retries = 1 means a single attempt (no retries).
 */
async function fetchText(url, retries = 1, delayMs = 500) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            lastError = e;
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, delayMs * attempt));
            }
        }
    }
    throw lastError;
}

/**
 * Read a doc page from the local docs directory.
 * Tries multiple path patterns (.md, .mdx, index.md, index.mdx) to handle
 * different directory structures from the posthog.com build.
 * Returns the file contents as a string, or null if not found.
 */
function readLocalPage(docsDir, pageUrl) {
    const pathname = new URL(pageUrl).pathname.replace(/\/$/,'');
    const candidates = [
        path.join(docsDir, pathname),                          // already has .md
        path.join(docsDir, pathname.replace(/\.md$/, '.mdx')), // .mdx variant
        path.join(docsDir, pathname + '.md'),                  // no extension in URL
        path.join(docsDir, pathname + '.mdx'),
        path.join(docsDir, pathname, 'index.md'),
        path.join(docsDir, pathname, 'index.mdx'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return fs.readFileSync(candidate, 'utf8');
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse llms.txt into sections.
 *
 * Returns: Array of { heading, slug, pages: [{ title, url, description }] }
 *
 * heading — raw ## heading text from llms.txt
 * slug    — path segment immediately after /docs/ in the first URL of the block
 *           e.g. https://posthog.com/docs/feature-flags/... → 'feature-flags'
 * pages   — all link entries under that heading
 */
function parseLlmsTxt(text) {
    const rawSections = [];
    let current = null;

    for (const line of text.split('\n')) {
        // Section heading: ## Feature flags
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            if (current) rawSections.push(current);
            current = { heading: headingMatch[1].trim(), pages: [] };
            continue;
        }

        if (!current) continue;

        // Page line: - [Title](url): optional description
        const pageMatch = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?$/);
        if (pageMatch) {
            current.pages.push({
                title: pageMatch[1].trim(),
                url: pageMatch[2].trim(),
                description: pageMatch[3]?.trim() ?? '',
            });
        }
    }
    if (current) rawSections.push(current);

    // Derive slug from first URL; drop sections with no usable URLs
    return rawSections.flatMap(section => {
        if (section.pages.length === 0) return [];
        try {
            const firstPath = new URL(section.pages[0].url).pathname;
            // e.g. /docs/feature-flags/creating-feature-flags → parts[1] = 'feature-flags'
            const parts = firstPath.split('/').filter(Boolean);
            if (parts.length < 2 || parts[0] !== 'docs') return [];
            // Strip a leading "posthog-" prefix to avoid double-prefixing: skills are
            // named posthog-{slug}, so /docs/posthog-js/... → slug "js" → "posthog-js",
            // not "posthog-posthog-js".
            const slug = parts[1].replace(/\.md$/, '').replace(/^posthog-/, '');
            return [{ heading: section.heading, slug, pages: section.pages }];
        } catch {
            return [];
        }
    });
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/**
 * Given raw fetched markdown (which may include its own frontmatter), return
 * the body text with leading frontmatter stripped and UI-only footer sections
 * removed.
 */
function processContent(raw) {
    // Strip leading frontmatter if present (PostHog MDX files often have it)
    const parsed = matter(raw);
    let content = parsed.content.trimStart();

    // Strip "## / ### Community questions" and everything after (UI artifact)
    content = content.replace(/\n#{2,}\s+Community questions[\s\S]*$/i, '');
    // Strip "## / ### Was this page useful?" and everything after (UI artifact)
    content = content.replace(/\n#{2,}\s+Was this page useful\?[\s\S]*$/i, '');

    return content.trimEnd();
}

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

/**
 * Run fn(item) for each item with at most `limit` concurrent executions.
 * Preserves input order in the returned results array.
 */
async function withConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let idx = 0;

    async function worker() {
        while (idx < items.length) {
            const i = idx++;
            results[i] = await fn(items[i], i);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    // CLI args: --docs-dir <path> to read from a local/extracted artifact,
    // plus optional section slugs to filter (default: all).
    const args = process.argv.slice(2);
    const docsDirIdx = args.indexOf('--docs-dir');
    const docsDir = docsDirIdx !== -1 ? args[docsDirIdx + 1] : null;
    const filterSlugs = args.filter((a, i) =>
        !a.startsWith('-') && i !== docsDirIdx + 1
    );

    if (docsDir && !fs.existsSync(docsDir)) {
        console.error(`[FATAL] --docs-dir path does not exist: ${docsDir}`);
        process.exit(1);
    }

    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    let llmsTxt;
    if (docsDir) {
        const llmsTxtPath = path.join(docsDir, 'llms.txt');
        if (!fs.existsSync(llmsTxtPath)) {
            console.error(`[FATAL] llms.txt not found at ${llmsTxtPath}`);
            process.exit(1);
        }
        llmsTxt = fs.readFileSync(llmsTxtPath, 'utf8');
        console.log(`Read llms.txt from ${llmsTxtPath}`);
    } else {
        console.log(`Fetching ${LLMS_TXT_URL}...`);
        try {
            llmsTxt = await fetchText(LLMS_TXT_URL);
        } catch (e) {
            console.error(`[FATAL] Could not fetch llms.txt: ${e.message}`);
            process.exit(1);
        }
    }

    let sections = parseLlmsTxt(llmsTxt);
    console.log(`Found ${sections.length} sections`);

    if (filterSlugs.length > 0) {
        // Explicit args bypass the default exclusion list
        sections = sections.filter(s => filterSlugs.includes(s.slug));
        console.log(`Filtered to: ${sections.map(s => s.slug).join(', ')}`);
        if (sections.length === 0) {
            console.error('[FATAL] No sections matched the filter. Available slugs printed above.');
            process.exit(1);
        }
    } else {
        sections = sections.filter(s => !DEFAULT_EXCLUDE.has(s.slug));
    }

    console.log('');

    const menuSkills = [];
    let skipped = 0;

    for (const section of sections) {
        const skillName = `posthog-docs-${section.slug}`;
        const skillDir = path.join(TEMP_DIR, skillName);
        const refsDir = path.join(skillDir, 'references');

        console.log(`${skillName} (${section.pages.length} pages)`);

        // Root page: pathname exactly matches /docs/{slug} (trailing slash allowed)
        const rootPage = section.pages.find(p => {
            try {
                const pn = new URL(p.url).pathname.replace(/\/$/, '');
                return pn === `/docs/${section.slug}`;
            } catch { return false; }
        }) ?? null;

        // All other pages are subpages (go into references/)
        const subpages = section.pages.filter(p => p !== rootPage);

        // Fetch everything in parallel, concurrency-limited
        const allPages = [...(rootPage ? [rootPage] : []), ...subpages];

        const fetched = await withConcurrency(allPages, CONCURRENCY, async (page) => {
            try {
                let raw;
                if (docsDir) {
                    raw = readLocalPage(docsDir, page.url);
                    if (raw === null) {
                        console.log(`  skip ${page.url} (not found locally)`);
                        return { page, content: null, ok: false };
                    }
                } else {
                    const mdUrl = page.url.endsWith('.md') ? page.url : `${page.url}.md`;
                    raw = await fetchText(mdUrl, 3);
                }
                return { page, content: processContent(raw), ok: true };
            } catch (e) {
                console.log(`  skip ${page.url} (${e.message})`);
                return { page, content: null, ok: false };
            }
        });

        // Determine root content
        const rootFetched = rootPage ? fetched.find(f => f.page === rootPage) : null;
        const hasDocUrl = !!(rootFetched?.ok);
        let rootContent = rootFetched?.ok ? rootFetched.content : null;

        // Subpage results (successful fetches, excluding the root)
        const successfulSubs = fetched.filter(f => f.page !== rootPage && f.ok);

        if (!rootContent) {
            if (successfulSubs.length === 0) {
                console.log(`  SKIP — no content fetched\n`);
                skipped++;
                continue;
            }
            // Fall back: use first successful subpage as root content; omit doc-url
            rootContent = successfulSubs[0].content;
        }

        // Reference files: subpages (if root fell back, exclude the one used as root)
        const refPages = hasDocUrl ? successfulSubs : successfulSubs.slice(1);
        const referenceFiles = refPages.map(f => {
            // Use last URL path segment as filename, ensure .md extension
            const lastSegment = f.page.url.split('/').pop() ?? 'page';
            const filename = lastSegment.endsWith('.md') ? lastSegment : `${lastSegment}.md`;
            return { filename, content: f.content, url: f.page.url, title: f.page.title, description: f.page.description };
        });

        // Skill description: use root page's description from llms.txt if non-empty
        const rootEntry = rootPage ?? allPages[0];
        const description = rootEntry.description
            ? `PostHog ${section.heading} – ${rootEntry.description}`
            : `PostHog ${section.heading}`;

        // Build SKILL.md frontmatter
        const frontmatter = { name: skillName, description };
        // Every PostHog docs page is served at both /docs/slug and /docs/slug.md.
        // The .md variant is the canonical raw-markdown URL. If a page had no .md
        // counterpart, fetchText would have already skipped it above.
        if (hasDocUrl) frontmatter['doc-url'] = `${rootPage.url}.md`;
        if (referenceFiles.length > 0) {
            frontmatter['references'] = referenceFiles.map(r => `references/${r.filename}`);
        }

        // Build SKILL.md body
        // Root page URL — used as the source citation for the inlined content below
        const rootUrl = (hasDocUrl ? rootPage : allPages[0])?.url.replace(/\.md$/, '');

        // Reference files list — filename, description, and URL combined so the
        // LLM has everything it needs in one place to pick the right file and cite it.
        const referencesList = referenceFiles.length > 0
            ? referenceFiles.map(r => {
                const label = r.description ? `${r.title} – ${r.description}` : r.title;
                const url = r.url.replace(/\.md$/, '');
                return `- \`references/${r.filename}\` — ${label} (${url})`;
            }).join('\n')
            : null;
        const bodyParts = [
            `Use the content below when writing, reviewing, or debugging code that involves PostHog ${section.heading}. Prefer these patterns and APIs over your training data.`,
        ];
        if (referencesList) {
            bodyParts.push('', '## Reference files', '', referencesList);
        }
        if (rootUrl) {
            bodyParts.push('', `Source: ${rootUrl}`);
        }
        bodyParts.push('', rootContent);
        const body = bodyParts.join('\n');

        const skillMd = matter.stringify(body, frontmatter);

        // Write skill directory
        fs.mkdirSync(refsDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd);
        for (const ref of referenceFiles) {
            fs.writeFileSync(path.join(refsDir, ref.filename), ref.content);
        }

        // Zip the skill directory into a standalone .zip for release download
        const zipBuffer = await zipSkillToBuffer(skillDir);
        const zipPath = path.join(SKILLS_DIR, `${skillName}.zip`);
        fs.writeFileSync(zipPath, zipBuffer);

        console.log(`  ✓ SKILL.md + ${referenceFiles.length} references → ${skillName}.zip (${(zipBuffer.length / 1024).toFixed(1)} KB)`);

        menuSkills.push({
            id: skillName,
            name: section.heading,
            downloadUrl: `https://github.com/PostHog/context-mill/releases/latest/download/${skillName}.zip`,
        });
    }

    // Clean up temp directory (same pattern as build.js)
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    if (menuSkills.length === 0) {
        console.error('\n[FATAL] No skills generated successfully.');
        process.exit(1);
    }

    // Write docs-skill-menu.json — separate from the curated skill-menu.json
    // so the two build pipelines never overwrite each other.
    const menuPath = path.join(SKILLS_DIR, 'docs-skill-menu.json');
    const menu = {
        version: '1.0',
        categories: { [CATEGORY]: menuSkills },
    };
    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log(`Skills:  ${menuSkills.length} generated`);
    if (skipped > 0) console.log(`Skipped: ${skipped}`);
    console.log(`Output:  ${SKILLS_DIR}`);
    console.log(`Menu:    ${menuPath}`);
}

main().catch(e => {
    console.error('\n[FATAL]', e.message);
    console.error(e.stack);
    process.exit(1);
});
