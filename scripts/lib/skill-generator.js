/**
 * Skill Generator
 *
 * Generates Agent Skills packages by combining:
 * - Example code (processed into markdown)
 * - Documentation (fetched from URLs)
 * - Commandments (based on tags)
 */

/**
 * Optional `cli:` block in a skill's `config.yaml` — declares whether and how
 * the skill appears in the wizard CLI. Parsed by `parseCliBlock`, propagated by
 * `expandSkillGroups`, emitted into `dist/skills/cli-manifest.json` (the wizard
 * snapshots that manifest to derive its skill-backed command surface).
 *
 * Full schema, the YAML→command mapping, the flat-vs-family convention, and the
 * naming rules live in CONTRIBUTING.md § "How skills get into the wizard CLI".
 *
 * @typedef {Object} CliRoleBlock
 * @property {'command' | 'skill' | 'internal'} role
 *   How the skill appears: a typed `command`, a `skill` reachable via
 *   `wizard skill <id>`, or `internal` (hidden). Skills with no `cli:` block
 *   default to `skill` and are not emitted into `cli-manifest.json`.
 * @property {string} [command]
 *   The user-typed word that registers this skill (e.g. `'feature-flags'` in
 *   `wizard audit feature-flags`). Required when `role` is `'command'`;
 *   defaults to the variant id when omitted, except the magic `id: all`
 *   variant, which requires an explicit `command`. Use the full PostHog
 *   product name, not a shorthand.
 * @property {string} [parentCommand]
 *   The command this skill nests under (e.g. `'audit'`). Omit for flat commands.
 * @property {boolean} [default]
 *   When true, this leaf is pre-highlighted in the family's interactive picker
 *   (`wizard <family>` → Enter runs it). The picker still opens (discovery +
 *   consent); this just makes the obvious choice one keystroke. At most one
 *   leaf per family should be marked.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import { processExample, loadSkipPatterns, mergeSkipPatterns, defaultPlugins } from './example-processor.js';
import { CLI_ROLES, validateCommandName } from './cli-block-validation.js';

/**
 * Load YAML config file
 */
function loadYaml(configPath) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content);
}

// A line that is exactly `{{> name}}` is replaced at build time with the body
// of `<configDir>/shared/name.md` (frontmatter stripped), so shared prose like
// the MCP tool-calling grammar lives in one canonical file and every skill that
// includes it stays in sync.
const PARTIAL_DIRECTIVE = /^[ \t]*\{\{>\s*([a-z0-9-]+)\s*\}\}[ \t]*$/gm;

function expandPartials(body, configDir) {
    return body.replace(PARTIAL_DIRECTIVE, (_match, name) => {
        const partialPath = path.join(configDir, 'shared', `${name}.md`);
        if (!fs.existsSync(partialPath)) {
            throw new Error(`Partial include {{> ${name}}} references missing file ${partialPath}`);
        }
        return matter(fs.readFileSync(partialPath, 'utf8')).content.trim();
    });
}

/**
 * Validate and normalize a raw `cli:` block from a skill `config.yaml`.
 * Returns `null` when the block is absent, throws on malformed input.
 *
 * Naming-convention checks (kebab-case, length 2–20, no reserved words,
 * no internal-flag collisions) run on every `command` and `parentCommand`
 * value before the resolved block is returned.
 *
 * `context` is a human-readable label used in error messages (e.g.
 * `'Skill group "audit-events"'` or
 * `'Skill group "migrate", variant "statsig"'`).
 *
 * @param {unknown} raw
 * @param {string} context
 * @returns {{ role: 'command' | 'skill' | 'internal', command?: string, parentCommand?: string, default?: boolean } | null}
 */
function parseCliBlock(raw, context) {
    if (raw == null) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`${context}: cli block must be an object`);
    }
    const { role, command, parentCommand, default: isDefault, ...rest } = raw;
    const unknownKeys = Object.keys(rest);
    if (unknownKeys.length > 0) {
        throw new Error(`${context}: cli block has unknown keys: ${unknownKeys.join(', ')}`);
    }
    if (!role) {
        throw new Error(`${context}: cli.role is required`);
    }
    if (!CLI_ROLES.includes(role)) {
        throw new Error(`${context}: cli.role must be one of ${CLI_ROLES.join(', ')} (got "${role}")`);
    }
    const result = { role };
    if (command != null) {
        if (typeof command !== 'string' || command.length === 0) {
            throw new Error(`${context}: cli.command must be a non-empty string when set`);
        }
        validateCommandName(command, 'command', context);
        result.command = command;
    }
    if (parentCommand != null) {
        if (typeof parentCommand !== 'string' || parentCommand.length === 0) {
            throw new Error(`${context}: cli.parentCommand must be a non-empty string when set`);
        }
        validateCommandName(parentCommand, 'parentCommand', context);
        result.parentCommand = parentCommand;
    }
    if (isDefault != null) {
        if (typeof isDefault !== 'boolean') {
            throw new Error(`${context}: cli.default must be a boolean when set`);
        }
        if (isDefault) result.default = true;
    }
    return result;
}

/**
 * Merge a group-level cli block with a variant-level override and fill in
 * the implicit command name for the `command` role. Returns `null` when
 * neither level declared a block.
 *
 * For `role: 'command'`, the command name falls back to the variant's
 * short id (e.g. parentCommand `migrate` + variant `statsig` →
 * `wizard migrate statsig`). The `id: 'all'` variant is special — its
 * skill id collapses to the group key, so the command name has to be
 * set explicitly at the group level.
 *
 * @param {ReturnType<typeof parseCliBlock>} groupCli
 * @param {ReturnType<typeof parseCliBlock>} variantCli
 * @param {{ id: string }} variant
 * @param {string} groupKey
 */
function resolveVariantCli(groupCli, variantCli, variant, groupKey) {
    if (!groupCli && !variantCli) return null;
    const merged = { ...(groupCli ?? {}), ...(variantCli ?? {}) };
    if (merged.role === 'command' && !merged.command) {
        if (variant.id === 'all') {
            throw new Error(
                `Skill group "${groupKey}", variant "all": cli.command is required at the group level when role is command and the variant id is "all"`,
            );
        }
        merged.command = variant.id;
        // The fallback value bypassed parseCliBlock's checks, so validate it
        // here too — a variant id like "help" or "CamelCase" must not slip
        // through into the manifest just because it wasn't typed as a command.
        validateCommandName(
            merged.command,
            'command',
            `Skill group "${groupKey}", variant "${variant.id}"`,
        );
    }
    return merged;
}

/**
 * Load skills configuration by recursively scanning the skills/ directory.
 * A directory containing config.yaml with a `variants` array is a skill group.
 * The composite key is the relative path from skills/ to that directory.
 * Each config is self-contained — no inheritance between parent and child.
 */
function loadSkillsConfig(configDir) {
    const skillsDir = path.join(configDir, 'skills');
    const config = {};

    function scan(dir, keyParts) {
        const configFile = path.join(dir, 'config.yaml');
        if (fs.existsSync(configFile)) {
            const localConfig = loadYaml(configFile);
            if (localConfig?.variants || localConfig?.variants_from) {
                config[keyParts.join('/')] = localConfig;
            }
        }

        // Always descend into subdirectories
        const children = fs.readdirSync(dir, { withFileTypes: true })
            .filter(e => e.isDirectory());
        for (const child of children) {
            scan(path.join(dir, child.name), [...keyParts, child.name]);
        }
    }

    const topLevel = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory());
    for (const entry of topLevel) {
        scan(path.join(skillsDir, entry.name), [entry.name]);
    }

    return config;
}

/**
 * Load commandments configuration
 */
function loadCommandments(configDir) {
    return loadYaml(path.join(configDir, 'commandments.yaml'));
}

/**
 * Load a skill description template from the directory identified by composite key.
 */
function loadSkillTemplate(configDir, compositeKey, templateFile) {
    const filePath = path.join(configDir, 'skills', ...compositeKey.split('/'), templateFile);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Template "${templateFile}" not found for key "${compositeKey}"`);
    }
    return fs.readFileSync(filePath, 'utf8');
}

/**
 * Normalize example_paths to an array.
 * Accepts undefined, a string, or an array of strings.
 */
function normalizeExamplePaths(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Resolve `variants_from` references: a group may borrow another group's
 * variant matrix instead of duplicating it. Only the framework identity comes
 * across — id, display_name, tags, docs_urls, framework, default — never
 * example paths, templates, cli blocks, or shared docs, which stay the
 * borrowing group's own concern. One level only; a source group must declare
 * its variants literally. Pure — returns a new config, never mutates the input.
 */
function resolveVariantsFrom(config) {
    const resolved = {};
    for (const [key, group] of Object.entries(config)) {
        if (!group.variants_from) {
            resolved[key] = group;
            continue;
        }
        if (group.variants) {
            throw new Error(`Skill group "${key}": declare either variants or variants_from, not both`);
        }
        const source = config[group.variants_from];
        if (!source) {
            throw new Error(`Skill group "${key}": variants_from "${group.variants_from}" does not name a skill group`);
        }
        if (source.variants_from) {
            throw new Error(`Skill group "${key}": variants_from cannot chain ("${group.variants_from}" also uses variants_from)`);
        }
        const variants = source.variants.map(v => {
            const variant = { id: v.id, display_name: v.display_name };
            if (v.tags) variant.tags = [...v.tags];
            if (v.docs_urls) variant.docs_urls = [...v.docs_urls];
            if (v.framework) variant.framework = v.framework;
            if (v.default) variant.default = v.default;
            return variant;
        });
        // Drop the reference key — the resolved copy declares variants literally.
        const { variants_from: _from, ...rest } = group;
        resolved[key] = { ...rest, variants };
    }
    return resolved;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A match key is a trait name as the wizard spells it, such as `framework` or `frameworkVariant`. */
const TRAIT_NAME = /^[a-z][A-Za-z0-9]*$/;

/** The file at a pack's root that lists what a variant table row built: its match keys, its rules and each product's pages. */
const VARIANT_FILE = 'variant.json';

/**
 * What a skill with `framework_references` leaves for its consumer to fill from a framework's pack:
 * the framework's name inline, and one line each where the pack's pages and its rules file are listed.
 */
const FRAMEWORK_NAME = '{framework_name}';
const FRAMEWORK_DOCS = '{framework_docs}';
const FRAMEWORK_RULES = '{framework_rules}';

/** The product whose pages are a variant's own `docs_urls`. A variant table cannot declare it again. */
const INTEGRATION_PRODUCT = 'integration';

/** A page is a URL, or `{ url, title }` to override the title the build reads from the page. */
const isDocEntry = entry =>
    typeof entry === 'string' || (entry && typeof entry === 'object' && typeof entry.url === 'string');

/**
 * Validate a variant table: a group that declares `products`. Each variant lists
 * every product's pages under `docs`, or names the product under `gaps`.
 * `match` is checked on every group, since any variant may declare it.
 */
function validateVariantTable(key, group) {
    const products = group.products;
    if (products !== undefined) {
        const valid = Array.isArray(products) && products.every(p => typeof p === 'string' && KEBAB.test(p));
        if (!valid) {
            throw new Error(`Skill group "${key}": products must be a list of kebab-case names`);
        }
        if (products.includes(INTEGRATION_PRODUCT)) {
            throw new Error(`Skill group "${key}": "${INTEGRATION_PRODUCT}" is every variant's docs_urls, not a product to list`);
        }
        if (new Set(products).size !== products.length) {
            throw new Error(`Skill group "${key}": products lists a name twice`);
        }
    }
    for (const variant of group.variants || []) {
        const where = `Skill group "${key}", variant "${variant.id}"`;
        if (variant.match !== undefined) {
            const entries = variant.match && typeof variant.match === 'object' && !Array.isArray(variant.match)
                ? Object.entries(variant.match)
                : null;
            if (!entries || entries.some(([k, v]) => !TRAIT_NAME.test(k) || typeof v !== 'string' || v.length === 0 || v.includes(':'))) {
                throw new Error(`${where}: match must map trait names, such as frameworkVariant, to non-empty strings`);
            }
            if (variant.match.framework !== undefined && variant.match.framework !== variant.framework) {
                throw new Error(`${where}: match.framework "${variant.match.framework}" differs from framework "${variant.framework}"`);
            }
        }
        if (products === undefined) {
            if (variant.docs !== undefined || variant.gaps !== undefined) {
                throw new Error(`${where}: docs and gaps need the group to declare products`);
            }
            continue;
        }
        const docs = variant.docs ?? {};
        const gaps = variant.gaps ?? [];
        if (typeof docs !== 'object' || Array.isArray(docs) || !Array.isArray(gaps)) {
            throw new Error(`${where}: docs must map products to pages, and gaps must be a list`);
        }
        const unknown = [...Object.keys(docs), ...gaps].filter(p => !products.includes(p));
        if (unknown.length > 0) {
            throw new Error(`${where}: ${unknown.join(', ')} is not in the group's products`);
        }
        for (const product of products) {
            const pages = docs[product];
            const listed = Array.isArray(pages) && pages.length > 0 && pages.every(isDocEntry);
            if (pages !== undefined && !listed) {
                throw new Error(`${where}: docs.${product} must be a non-empty list of pages`);
            }
            if (listed === gaps.includes(product)) {
                throw new Error(
                    listed
                        ? `${where}: ${product} has pages and is also named under gaps`
                        : `${where}: no ${product} pages. List them under docs, or name ${product} under gaps`,
                );
            }
        }
    }
}

/**
 * Validate `replaces` and `framework_references`. A group with either is one skill, written once for
 * every framework: `replaces` names the group or skill it stands in for, and `framework_references`
 * names the product whose pages a consumer adds from the framework's pack.
 */
function validateReplacements(config) {
    const dashed = key => key.replace(/\//g, '-');
    const names = new Set();
    const products = new Set([INTEGRATION_PRODUCT]);
    for (const [key, group] of Object.entries(config)) {
        names.add(dashed(key));
        for (const variant of group.variants || []) {
            names.add(variant.id === 'all' ? dashed(key) : `${dashed(key)}-${variant.id}`);
        }
        for (const product of Array.isArray(group.products) ? group.products : []) products.add(product);
    }
    for (const [key, group] of Object.entries(config)) {
        if (group.replaces === undefined && group.framework_references === undefined) continue;
        const where = `Skill group "${key}"`;
        const single = group.variants?.length === 1 && group.variants[0].id === 'all';
        if (!single) {
            throw new Error(`${where}: replaces and framework_references need exactly one variant, with id "all"`);
        }
        if (group.replaces !== undefined && !names.has(group.replaces)) {
            throw new Error(`${where}: replaces "${group.replaces}" names no skill group or skill`);
        }
        if (group.replaces === dashed(key)) {
            throw new Error(`${where}: a skill cannot replace itself`);
        }
        if (group.framework_references === undefined) continue;
        if (!products.has(group.framework_references)) {
            throw new Error(`${where}: framework_references "${group.framework_references}" is no product of a variant table`);
        }
        if (group.packaging === 'bundle' || (group.variants[0].docs_urls || []).length > 0) {
            throw new Error(`${where}: a skill with framework_references ships its own pages as shared_docs, and is not bundled`);
        }
    }
}

/**
 * Expand grouped skill config into a flat array of skill objects.
 * Each top-level key (except shared_docs) is a skill group with
 * base properties and a variants array (literal or via variants_from).
 */
function expandSkillGroups(config, configDir) {
    const skills = [];
    const resolvedConfig = resolveVariantsFrom(config);
    validateReplacements(resolvedConfig);

    for (const [key, group] of Object.entries(resolvedConfig)) {
        if (key === 'shared_docs') continue;
        if (!group.variants) continue;
        validateVariantTable(key, group);

        const baseTemplate = group.template ? loadSkillTemplate(configDir, key, group.template) : null;
        const baseTags = group.tags || [];
        const baseDescription = group.description || null;
        const baseSharedDocs = group.shared_docs || [];
        const baseExamplePaths = normalizeExamplePaths(group.example_paths);
        const baseCli = parseCliBlock(group.cli, `Skill group "${key}"`);
        // `packaging: bundle` ships the group as one JSON whose variants live inside.
        const bundled = group.packaging === 'bundle';

        // Category is the first segment of the composite key, or an explicit override
        const category = group.category || key.split('/')[0];

        // Topic is the sub-path after the first segment (null for flat keys)
        const parts = key.split('/');
        const topic = parts.length > 1 ? parts.slice(1).join('/') : null;

        // Composite key with slashes replaced by dashes, for use in IDs and filenames
        const compositeKeyDashed = key.replace(/\//g, '-');

        for (const variation of group.variants) {
            // Deduped: a variant that repeats a group-level tag would otherwise
            // collect that tag's commandments twice.
            const mergedTags = [...new Set([...baseTags, ...(variation.tags || [])])];
            let description = variation.description;
            if (!description && baseDescription) {
                // A skill written once for every framework names the framework its consumer fills in.
                description = baseDescription.replace(
                    /{display_name}/g,
                    group.framework_references ? FRAMEWORK_NAME : variation.display_name,
                );
            }

            // Support per-variation template override
            const template = variation.template
                ? loadSkillTemplate(configDir, key, variation.template)
                : baseTemplate;

            // Support per-variation shared_docs (merged with base)
            const sharedDocs = [...baseSharedDocs, ...(variation.shared_docs || [])];

            // Skill ID: {compositeKey-dashed}-{shortId}, dropping the "-all" suffix
            const skillId = variation.id === 'all'
                ? compositeKeyDashed
                : `${compositeKeyDashed}-${variation.id}`;

            const variantCli = parseCliBlock(
                variation.cli,
                `Skill group "${key}", variant "${variation.id}"`,
            );
            const cli = resolveVariantCli(baseCli, variantCli, variation, key);

            skills.push({
                ...variation,
                id: skillId,
                _shortId: variation.id,
                _category: category,
                _topic: topic,
                tags: mergedTags,
                description,
                _template: template,
                _sharedDocs: sharedDocs,
                _examplePaths: [...baseExamplePaths, ...normalizeExamplePaths(variation.example_paths)],
                _references: group.references || null,
                _products: group.products || null,
                _replaces: group.replaces || null,
                _frameworkReferences: group.framework_references || null,
                _templatePath: path.join(configDir, 'skills', ...key.split('/'), variation.template || group.template || ''),
                _group: key,
                _bundle: bundled,
                _groupTags: baseTags,
                _cli: cli,
            });
        }
    }

    skills.forEach(validateDocFilenames);
    return skills;
}

/**
 * Derive a filename from the last `parts` parts of a URL's path
 * e.g., https://posthog.com/docs/libraries/next-js.md → next-js.md, or libraries-next-js.md from two parts
 */
function urlToFilename(url, parts = 1) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        let filename = pathParts.slice(-parts).join('-') || 'doc';

        // Ensure .md extension
        if (!filename.endsWith('.md')) {
            filename += '.md';
        }

        return filename;
    } catch (e) {
        return 'doc.md';
    }
}

const docUrl = docEntry => (typeof docEntry === 'string' ? docEntry : docEntry.url);

/**
 * The file name of each page written to one folder, in the pages' order.
 * A page takes the last part of its URL. When two pages share it, each takes
 * its parent part too: `installation/python.md` and `libraries/python.md` become
 * `installation-python.md` and `libraries-python.md`. Throws when two pages
 * still share a name, since the second would replace the first.
 */
function docFilenames(docEntries, where) {
    const urls = docEntries.map(docUrl);
    const short = urls.map(url => urlToFilename(url));
    const names = urls.map((url, i) =>
        short.filter(name => name === short[i]).length > 1 ? urlToFilename(url, 2) : short[i]);
    const written = new Map();
    names.forEach((name, i) => {
        if (written.has(name)) {
            throw new Error(`${where}: ${written.get(name)} and ${urls[i]} would both be written as ${name}`);
        }
        written.set(name, urls[i]);
    });
    return names;
}

/** Throws when two pages of a skill would be written under one name, before any page is fetched. */
function validateDocFilenames(skill) {
    docFilenames([...(skill.docs_urls || []), ...(skill._sharedDocs || [])], `Skill "${skill.id}"`);
    for (const product of skill._products || []) {
        docFilenames(skill.docs?.[product] ?? [], `Skill "${skill.id}", ${product} pages`);
    }
}

/**
 * Convert a string to sentence case, preserving proper nouns
 */
function toSentenceCase(str) {
    if (!str) return str;

    // Proper nouns to preserve
    const properNouns = [
        'PostHog', 'Next.js', 'React', 'JavaScript', 'TypeScript',
        'Node.js', 'API', 'SDK', 'SSR', 'SPA', 'URL', 'HTML', 'CSS',
    ];

    // Lowercase everything first
    let result = str.toLowerCase();

    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // Restore proper nouns
    for (const noun of properNouns) {
        const regex = new RegExp(noun, 'gi');
        result = result.replace(regex, noun);
    }

    return result;
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? toSentenceCase(match[1].trim()) : null;
}

/**
 * Infer a description from URL path
 * e.g., /docs/libraries/next-js → "PostHog integration documentation for Next.js"
 */
function inferDescription(url) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);

        // Remove .md extension from last part
        const lastPart = pathParts[pathParts.length - 1]?.replace('.md', '') || '';

        // Convert kebab-case to readable
        const readable = lastPart.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (pathParts.includes('libraries') || pathParts.includes('docs')) {
            return `PostHog documentation for ${readable}`;
        }

        return `PostHog documentation: ${readable}`;
    } catch (e) {
        return 'PostHog documentation';
    }
}

// On-disk doc cache. posthog.com serves the .md docs slowly and drops
// connections under the build's ~50-fetch burst, which used to kill the
// whole build (and the dev server with it) on a single transient failure.
// Entries live for DOCS_CACHE_TTL_MS (default 24h, 0 disables); an expired
// entry is still kept as a stale fallback when every retry fails.
const DOC_CACHE_DIR = path.join(import.meta.dirname, '..', '..', '.docs-cache');
const DOC_CACHE_TTL_MS = process.env.DOCS_CACHE_TTL_MS !== undefined
    ? Number(process.env.DOCS_CACHE_TTL_MS)
    : 24 * 60 * 60 * 1000;
const FETCH_RETRIES = 3;
const FETCH_BACKOFF_MS = [1_000, 4_000];

function docCachePath(url) {
    const key = crypto.createHash('sha256').update(url).digest('hex');
    return path.join(DOC_CACHE_DIR, `${key}.json`);
}

function readDocCache(url) {
    if (DOC_CACHE_TTL_MS <= 0) return null;
    try {
        const entry = JSON.parse(fs.readFileSync(docCachePath(url), 'utf8'));
        if (entry?.url !== url || typeof entry?.content !== 'string') return null;
        return { ...entry, fresh: Date.now() - entry.fetchedAt < DOC_CACHE_TTL_MS };
    } catch {
        return null;
    }
}

function writeDocCache(url, { content, title }) {
    if (DOC_CACHE_TTL_MS <= 0) return;
    try {
        fs.mkdirSync(DOC_CACHE_DIR, { recursive: true });
        fs.writeFileSync(docCachePath(url), JSON.stringify({ url, title, content, fetchedAt: Date.now() }));
    } catch {
        // Cache writes are best-effort; the fetch result is still returned.
    }
}

async function fetchDocOnce(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
        // Deterministic client errors (404 etc.) won't change on retry.
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
    }
    const content = await response.text();
    const title = extractTitle(content) || inferDescription(url);
    return { content, title };
}

/**
 * Fetch markdown content from a URL, with an on-disk cache and retries.
 * Returns both content and inferred metadata. Logs `Fetching doc:` only
 * on a real network fetch — cache hits are silent.
 */
async function fetchDoc(url) {
    const cached = readDocCache(url);
    if (cached?.fresh) {
        return { content: cached.content, title: cached.title };
    }

    console.log(`  Fetching doc: ${url}`);
    let lastError;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
        try {
            const result = await fetchDocOnce(url);
            writeDocCache(url, result);
            return result;
        } catch (error) {
            lastError = error;
            // Network-level failures (undici "fetch failed") have no
            // `retryable` flag — treat them as retryable.
            if (error.retryable === false || attempt === FETCH_RETRIES) break;
            const delay = FETCH_BACKOFF_MS[attempt - 1] ?? FETCH_BACKOFF_MS.at(-1);
            console.log(`    retrying in ${delay / 1000}s (${error.message ?? error})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    if (cached) {
        const ageMinutes = Math.round((Date.now() - cached.fetchedAt) / 60_000);
        console.warn(`    WARN: using stale cached copy (${ageMinutes}m old) after fetch failure: ${url}`);
        return { content: cached.content, title: cached.title };
    }
    throw lastError;
}

/**
 * Collect commandments for a set of tags
 */
function collectCommandments(tags, commandmentsConfig) {
    const commandments = commandmentsConfig.commandments || {};
    // `all` is language-agnostic and ships with every skill, whatever its tags.
    const rules = [...(commandments.all || [])];

    // Deduped: variants inherit group-level tags and may re-declare them, which
    // would otherwise collect that tag's rules twice.
    for (const tag of new Set(tags)) {
        if (tag !== 'all' && commandments[tag]) {
            rules.push(...commandments[tag]);
        }
    }

    return rules;
}

/**
 * Coerce a commandment rule to a string.
 * YAML parses unquoted "key: value" lines as objects — rejoin them.
 */
function ruleToString(rule) {
    if (typeof rule === 'string') return rule;
    if (typeof rule === 'object' && rule !== null) {
        return Object.entries(rule).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return String(rule);
}

/**
 * Format commandments as markdown bullet list
 */
function formatCommandments(rules) {
    if (rules.length === 0) {
        return '_No specific framework guidelines._';
    }
    return rules.map(rule => `- ${ruleToString(rule)}`).join('\n');
}

/**
 * Format workflow steps as a numbered list for the {workflow} template placeholder.
 * Workflow steps are local references with `next_step:` frontmatter present (set or null),
 * ordered by filename. The first step gets a "← Start here" marker.
 */
function formatWorkflowSteps(steps) {
    if (steps.length === 0) {
        return '_No workflow defined._';
    }
    return steps.map((step, i) => {
        let line = `${i + 1}. \`references/${step.filename}\``;
        if (step.title) {
            line += ` - ${step.title}`;
        }
        if (i === 0) {
            line += ' ← **Start here**';
        }
        return line;
    }).join('\n');
}

/**
 * Generate SKILL.md frontmatter
 */
function generateFrontmatter(skill, version) {
    const frontmatter = {
        name: skill.id,
        description: skill.description,
        metadata: {
            author: 'PostHog',
            version: version,
        },
    };

    return '---\n' + yaml.dump(frontmatter) + '---\n\n';
}

function markdownReferenceNames(dir, prefix) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
        .map(entry => path.posix.join(prefix, entry.name))
        .sort((a, b) => a.localeCompare(b));
}

/**
 * Generate a complete skill package
 *
 * @param {Object} options
 * @param {Object} options.skill - Skill configuration from skills.yaml
 * @param {string} options.version - Build version
 * @param {string} options.repoRoot - Repository root path
 * @param {string} options.configDir - Config directory path
 * @param {string} options.outputDir - Output directory for skills
 * @param {Object} options.skipPatterns - Skip patterns config
 * @param {Object} options.commandmentsConfig - Commandments config
 * @param {string} options.skillTemplate - Skill description template
 * @param {Array} options.sharedDocs - Shared docs URLs
 */
async function generateSkill({
    skill,
    version,
    repoRoot,
    configDir,
    outputDir,
    skipPatterns,
    commandmentsConfig,
    skillTemplate,
    sharedDocs,
    fetchDocFn = fetchDoc,
}) {
    const skillDir = path.join(outputDir, skill.id);
    const referencesDir = path.join(skillDir, 'references');

    // Create directories
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(referencesDir, { recursive: true });

    // Track reference files for the SKILL.md listing
    const references = [];

    // Track workflow step files (local references with `next_step:` frontmatter)
    // for the {workflow} template placeholder. Ordered by filename.
    const workflowSteps = [];

    // Process example projects
    if (skill._examplePaths && skill._examplePaths.length > 0) {
        const isSingle = skill._examplePaths.length === 1;
        for (const examplePath of skill._examplePaths) {
            const dirName = path.basename(examplePath);
            console.log(`  Processing example: ${examplePath}`);

            const exampleMarkdown = processExample({
                examplePath,
                displayName: isSingle ? skill.display_name : dirName,
                id: skill.id,
                repoRoot,
                skipPatterns: mergeSkipPatterns(skipPatterns.global, skipPatterns.examples[isSingle ? skill.id : dirName]),
                plugins: defaultPlugins,
            });

            const filename = isSingle ? 'EXAMPLE.md' : `EXAMPLE-${dirName}.md`;
            fs.writeFileSync(
                path.join(referencesDir, filename),
                exampleMarkdown,
                'utf8'
            );

            references.push({
                filename,
                description: `${isSingle ? skill.display_name : dirName} example project code`,
            });
        }
    }

    // Copy local markdown references from a source references/ directory, if present.
    // Group config injects a shared `preamble`; per-file `next_step` frontmatter drives continuation links.
    const sourceReferencesDir = path.join(configDir, 'skills', ...skill._group.split('/'), 'references');
    if (fs.existsSync(sourceReferencesDir)) {
        const localReferences = [
            ...markdownReferenceNames(sourceReferencesDir, ''),
            ...markdownReferenceNames(path.join(sourceReferencesDir, skill._shortId), skill._shortId),
        ];

        const refsConfig = skill._references || {};

        for (const reference of localReferences) {
            const sourcePath = path.join(sourceReferencesDir, reference);
            const parsed = matter(fs.readFileSync(sourcePath, 'utf8'));
            const nextFile = parsed.data.next_step;
            const isWorkflowStep = 'next_step' in parsed.data;
            let body = expandPartials(parsed.content, configDir).replace(/^\n+/, '').replace(/\s+$/, '');
            const headingMatch = body.match(/^#\s+(.+)$/m);
            const displayTitle = parsed.data.title || headingMatch?.[1] || reference;
            const displayDescription = parsed.data.description || headingMatch?.[1] || reference;

            if (nextFile) {
                if (refsConfig.preamble && headingMatch) {
                    const headingEnd = body.indexOf(headingMatch[0]) + headingMatch[0].length;
                    body = body.slice(0, headingEnd) + '\n\n' + refsConfig.preamble + body.slice(headingEnd);
                }
                body += `\n\n---\n\n**Upon completion, continue with:** [${nextFile}](${nextFile})`;
            }

            // Re-emit frontmatter without our internal `next_step` key so the
            // emitted file matches the original llm-prompts shape (title + description only).
            const emittedFrontmatter = { ...parsed.data };
            delete emittedFrontmatter.next_step;
            const fileContent = Object.keys(emittedFrontmatter).length
                ? `---\n${yaml.dump(emittedFrontmatter, { lineWidth: -1 })}---\n\n${body}`
                : body;

            const targetPath = path.join(referencesDir, reference);
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, fileContent, 'utf8');

            references.push({
                filename: reference,
                description: displayDescription,
            });

            if (isWorkflowStep) {
                workflowSteps.push({
                    filename: reference,
                    title: displayTitle,
                });
            }
        }
    }

    // Writes the pages of one folder: `references/`, or `subfolder` under it. Each doc entry is a URL
    // or `{ url, title }`. fetchDoc logs `Fetching doc:` only on a real network fetch — cache hits are silent.
    async function writeDocs(docEntries, where, subfolder = '') {
        const names = docFilenames(docEntries, where);
        const written = [];
        for (const [i, docEntry] of docEntries.entries()) {
            const result = await fetchDocFn(docUrl(docEntry));
            const dir = path.join(referencesDir, subfolder);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, names[i]), result.content, 'utf8');
            written.push({
                filename: path.posix.join(subfolder, names[i]),
                description: (typeof docEntry === 'object' && docEntry.title) || result.title,
            });
        }
        return written;
    }

    // A skill written once for every framework lists the framework's pages where a variant's own would go.
    if (skill._frameworkReferences) {
        references.push({ placeholder: FRAMEWORK_DOCS });
    }

    // The variant's own pages come first and are kept for the variant table's `integration` product.
    const variantDocUrls = skill.docs_urls || [];
    const pages = await writeDocs([...variantDocUrls, ...sharedDocs], `Skill "${skill.id}"`);
    references.push(...pages);
    const variantDocs = pages.slice(0, variantDocUrls.length);

    // Collect commandments for this skill's tags.
    const rules = collectCommandments(skill.tags || [], commandmentsConfig);
    const commandmentsText = formatCommandments(rules);

    // Also emit them as a reference file. The orchestrator installs this skill
    // as the framework reference and points its task agents at individual
    // files, so the rules must exist outside the SKILL.md body.
    // A skill written once for every framework takes its rules from the framework's pack.
    if (skill._frameworkReferences) {
        references.push({ placeholder: FRAMEWORK_RULES });
    } else if (rules.length > 0) {
        fs.writeFileSync(
            path.join(referencesDir, 'COMMANDMENTS.md'),
            `# Framework rules\n\nFollow these when integrating PostHog into this framework.\n\n${commandmentsText}\n`,
            'utf8',
        );
        references.push({
            filename: 'COMMANDMENTS.md',
            description: 'Framework-specific rules the integration must follow',
        });
    }

    // A variant table row also ships each product's pages and a `variant.json` that lists them.
    // Neither joins `references`, so SKILL.md reads as it did before the row had products.
    if (skill._products) {
        const products = {
            [INTEGRATION_PRODUCT]: variantDocs.map(ref => ({
                file: `references/${ref.filename}`,
                description: ref.description,
            })),
        };
        for (const product of skill._products) {
            const written = await writeDocs(skill.docs?.[product] ?? [], `Skill "${skill.id}", ${product} pages`, product);
            products[product] = written.map(ref => ({ file: `references/${ref.filename}`, description: ref.description }));
        }
        const variant = {
            id: skill._shortId,
            displayName: skill.display_name,
            match: { ...(skill.framework ? { framework: skill.framework } : {}), ...(skill.match || {}) },
            rules: rules.length > 0
                ? { file: 'references/COMMANDMENTS.md', description: 'Framework-specific rules the integration must follow' }
                : null,
            products,
        };
        fs.writeFileSync(path.join(skillDir, VARIANT_FILE), JSON.stringify(variant, null, 2) + '\n', 'utf8');
    }

    // Build references list for SKILL.md
    const referencesText = references
        .map(ref => ref.placeholder ?? `- \`references/${ref.filename}\` - ${ref.description}`)
        .join('\n');

    // Format workflow steps for skills that use the {workflow} placeholder
    const workflowText = formatWorkflowSteps(workflowSteps);

    // Build SKILL.md content
    let skillContent = generateFrontmatter(skill, version);

    // Apply template substitutions
    let body = skillTemplate
        .replace(/{display_name}/g, skill._frameworkReferences ? FRAMEWORK_NAME : skill.display_name)
        .replace(/{references}/g, referencesText)
        .replace(/{commandments}/g, commandmentsText)
        .replace(/{workflow}/g, workflowText);
    body = expandPartials(body, configDir);

    skillContent += body;

    // Write SKILL.md
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');

    return skillDir;
}

/**
 * Convert an expanded skill into the manifest-builder shape.
 */
function serializeSkill(s) {
    const result = {
        id: s.id,
        shortId: s._shortId,
        category: s._category,
        displayName: s.display_name,
        type: s.type || 'skill',
        group: s._group,
        name: s.description,
        description: s.description,
        tags: s.tags || [],
    };
    if (s.framework) {
        result.framework = s.framework;
    }
    if (s.default) {
        result.default = true;
    }
    if (s.match) {
        result.match = s.match;
    }
    if (s._replaces) {
        result.replaces = s._replaces;
    }
    if (s._frameworkReferences) {
        result.frameworkReferences = s._frameworkReferences;
    }
    if (s._bundle) {
        result.bundle = true;
        result.groupTags = s._groupTags || [];
    }
    if (s._cli) {
        result.cli = s._cli;
    }
    return result;
}

/**
 * Load and expand skills config. Cheap; no I/O beyond reading YAML.
 */
function loadAndExpandSkills({ configDir }) {
    const skillsConfig = loadSkillsConfig(configDir);
    const commandmentsConfig = loadCommandments(configDir);
    const skipPatterns = loadSkipPatterns(path.join(configDir, 'skip-patterns.yaml'));
    const skills = expandSkillGroups(skillsConfig, configDir);
    return { skills, commandmentsConfig, skipPatterns };
}

/**
 * Run the inner generation loop for an arbitrary set of expanded skills.
 */
async function runGenerate({
    skills,
    version,
    repoRoot,
    configDir,
    outputDir,
    skipPatterns,
    commandmentsConfig,
}) {
    fs.mkdirSync(outputDir, { recursive: true });

    for (const skill of skills) {
        console.log(`\nGenerating skill: ${skill.id}`);

        await generateSkill({
            skill,
            version,
            repoRoot,
            configDir,
            outputDir,
            skipPatterns,
            commandmentsConfig,
            skillTemplate: skill._template,
            sharedDocs: skill._sharedDocs || [],
        });

        console.log(`  ✓ ${skill.id}`);
    }
}

/**
 * Partial generation entry point: only regenerate skills whose IDs are in `ids`.
 * Still returns the full expanded skill list (`allSkills`) so callers can rebuild
 * a current manifest even if no skills are rebuilt this pass.
 */
async function generateSkillsByIds({
    ids,
    repoRoot,
    configDir,
    outputDir,
    version,
}) {
    const { skills, commandmentsConfig, skipPatterns } = loadAndExpandSkills({ configDir });
    const idSet = new Set(ids);
    const filtered = skills.filter(s => idSet.has(s.id));

    if (filtered.length === 0) {
        return { allSkills: skills.map(serializeSkill), rebuiltSkills: [] };
    }

    await runGenerate({
        skills: filtered,
        version,
        repoRoot,
        configDir,
        outputDir,
        skipPatterns,
        commandmentsConfig,
    });

    return {
        allSkills: skills.map(serializeSkill),
        rebuiltSkills: filtered.map(serializeSkill),
    };
}

/**
 * Generate all skills from configuration
 *
 * @param {Object} options
 * @param {string} options.repoRoot - Repository root path
 * @param {string} options.configDir - Config directory path (context)
 * @param {string} options.outputDir - Output directory for generated skills
 * @param {string} options.version - Build version
 */
async function generateAllSkills({
    repoRoot,
    configDir,
    outputDir,
    version,
}) {
    console.log('Loading configuration...');

    const { skills, commandmentsConfig, skipPatterns } = loadAndExpandSkills({ configDir });

    console.log(`\nGenerating ${skills.length} skills...`);

    await runGenerate({
        skills,
        version,
        repoRoot,
        configDir,
        outputDir,
        skipPatterns,
        commandmentsConfig,
    });

    console.log(`\n✓ Generated ${skills.length} skills to ${outputDir}`);

    return skills.map(serializeSkill);
}

export {
    VARIANT_FILE,
    FRAMEWORK_NAME,
    FRAMEWORK_DOCS,
    FRAMEWORK_RULES,
    loadSkillsConfig,
    loadCommandments,
    loadSkillTemplate,
    expandSkillGroups,
    collectCommandments,
    generateSkill,
    generateAllSkills,
    loadAndExpandSkills,
    runGenerate,
    generateSkillsByIds,
    serializeSkill,
    fetchDoc,
    parseCliBlock,
    resolveVariantCli,
    expandPartials,
};
