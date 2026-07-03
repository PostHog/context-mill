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
            if (localConfig?.variants) {
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
 * Expand grouped skill config into a flat array of skill objects.
 * Each top-level key (except shared_docs) is a skill group with
 * base properties and a variants array.
 */
function expandSkillGroups(config, configDir) {
    const skills = [];

    for (const [key, group] of Object.entries(config)) {
        if (key === 'shared_docs') continue;
        if (!group.variants) continue;

        const baseTemplate = group.template ? loadSkillTemplate(configDir, key, group.template) : null;
        const baseTags = group.tags || [];
        const baseDescription = group.description || null;
        const baseSharedDocs = group.shared_docs || [];
        const baseExamplePaths = normalizeExamplePaths(group.example_paths);
        const baseCli = parseCliBlock(group.cli, `Skill group "${key}"`);

        // Category is the first segment of the composite key, or an explicit override
        const category = group.category || key.split('/')[0];

        // Topic is the sub-path after the first segment (null for flat keys)
        const parts = key.split('/');
        const topic = parts.length > 1 ? parts.slice(1).join('/') : null;

        // Composite key with slashes replaced by dashes, for use in IDs and filenames
        const compositeKeyDashed = key.replace(/\//g, '-');

        for (const variation of group.variants) {
            const mergedTags = [...baseTags, ...(variation.tags || [])];
            let description = variation.description;
            if (!description && baseDescription) {
                description = baseDescription.replace(/{display_name}/g, variation.display_name);
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
                _group: key,
                _cli: cli,
            });
        }
    }

    return skills;
}

/**
 * Derive a filename from a URL
 * e.g., https://posthog.com/docs/libraries/next-js.md → next-js.md
 */
function urlToFilename(url) {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        let filename = pathParts[pathParts.length - 1] || 'doc';

        // Ensure .md extension
        if (!filename.endsWith('.md')) {
            filename += '.md';
        }

        return filename;
    } catch (e) {
        return 'doc.md';
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
    const rules = [];
    const commandments = commandmentsConfig.commandments || {};

    // Walk the tag taxonomy (see tag_parents in commandments.yaml): child
    // tags additively inherit their parent categories' rules, transitively
    // (react -> javascript_web -> javascript). Expansion never removes tags.
    const parents = commandmentsConfig.tag_parents || {};
    const expanded = [];
    const queue = [...tags];
    while (queue.length > 0) {
        const tag = queue.shift();
        if (expanded.includes(tag)) continue;
        expanded.push(tag);
        queue.push(...(parents[tag] || []));
    }

    for (const tag of expanded) {
        if (commandments[tag]) {
            rules.push(...commandments[tag]);
        }
    }

    // Overlapping tag sets can repeat a rule — keep the first occurrence.
    const seen = new Set();
    return rules.filter((rule) => {
        const key = JSON.stringify(rule);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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
        const localReferences = fs.readdirSync(sourceReferencesDir, { withFileTypes: true })
            .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
            .sort((a, b) => a.name.localeCompare(b.name));

        const refsConfig = skill._references || {};

        for (const reference of localReferences) {
            const sourcePath = path.join(sourceReferencesDir, reference.name);
            const parsed = matter(fs.readFileSync(sourcePath, 'utf8'));
            const nextFile = parsed.data.next_step;
            const isWorkflowStep = 'next_step' in parsed.data;
            let body = parsed.content.replace(/^\n+/, '').replace(/\s+$/, '');
            const headingMatch = body.match(/^#\s+(.+)$/m);
            const displayTitle = parsed.data.title || headingMatch?.[1] || reference.name;
            const displayDescription = parsed.data.description || headingMatch?.[1] || reference.name;

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

            fs.writeFileSync(
                path.join(referencesDir, reference.name),
                fileContent,
                'utf8'
            );

            references.push({
                filename: reference.name,
                description: displayDescription,
            });

            if (isWorkflowStep) {
                workflowSteps.push({
                    filename: reference.name,
                    title: displayTitle,
                });
            }
        }
    }

    // Helper to process a doc entry (string URL or {url, title} object).
    // fetchDoc logs `Fetching doc:` only on a real network fetch — cache hits
    // are silent.
    async function processDoc(docEntry) {
        const url = typeof docEntry === 'string' ? docEntry : docEntry.url;
        const titleOverride = typeof docEntry === 'object' ? docEntry.title : null;

        const result = await fetchDoc(url);
        if (result) {
            const filename = urlToFilename(url);
            fs.writeFileSync(
                path.join(referencesDir, filename),
                result.content,
                'utf8'
            );

            references.push({
                filename,
                description: titleOverride || result.title,
            });
        }
    }

    if (skill.docs_urls && skill.docs_urls.length > 0) {
        for (const docEntry of skill.docs_urls) {
            await processDoc(docEntry);
        }
    }

    for (const docEntry of sharedDocs) {
        await processDoc(docEntry);
    }

    // Build references list for SKILL.md
    const referencesText = references
        .map(ref => `- \`references/${ref.filename}\` - ${ref.description}`)
        .join('\n');

    // Collect commandments for this skill's tags
    const rules = collectCommandments(skill.tags || [], commandmentsConfig);
    const commandmentsText = formatCommandments(rules);

    // Format workflow steps for skills that use the {workflow} placeholder
    const workflowText = formatWorkflowSteps(workflowSteps);

    // Build SKILL.md content
    let skillContent = generateFrontmatter(skill, version);

    // Apply template substitutions
    let body = skillTemplate
        .replace(/{display_name}/g, skill.display_name)
        .replace(/{references}/g, referencesText)
        .replace(/{commandments}/g, commandmentsText)
        .replace(/{workflow}/g, workflowText);

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
};
