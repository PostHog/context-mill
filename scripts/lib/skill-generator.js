/**
 * Skill Generator
 *
 * Generates Agent Skills packages by combining:
 * - Example code (processed into markdown)
 * - Documentation (fetched from URLs)
 * - LLM prompts/workflows
 * - Commandments (based on tags)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');
const { processExample, loadSkipPatterns, mergeSkipPatterns, defaultPlugins } = require('./example-processor');

/**
 * Load YAML config file
 */
function loadYaml(configPath) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content);
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
        const baseType = group.type || 'example';
        const baseDescription = group.description || null;
        const baseSharedDocs = group.shared_docs || [];

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

            // Skill ID: {compositeKey-dashed}-{shortId}
            const skillId = `${compositeKeyDashed}-${variation.id}`;

            skills.push({
                ...variation,
                id: skillId,
                _shortId: variation.id,
                _category: category,
                _topic: topic,
                type: variation.type || baseType,
                tags: mergedTags,
                description,
                _template: template,
                _sharedDocs: sharedDocs,
                _group: key,
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

/**
 * Fetch markdown content from a URL
 * Returns both content and inferred metadata
 */
async function fetchDoc(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
    }
    const content = await response.text();
    const title = extractTitle(content) || inferDescription(url);

    return { content, title };
}

/**
 * Collect commandments for a set of tags
 */
function collectCommandments(tags, commandmentsConfig) {
    const rules = [];
    const commandments = commandmentsConfig.commandments || {};

    for (const tag of tags) {
        if (commandments[tag]) {
            rules.push(...commandments[tag]);
        }
    }

    return rules;
}

/**
 * Format commandments as markdown bullet list
 */
function formatCommandments(rules) {
    if (rules.length === 0) {
        return '_No specific framework guidelines._';
    }
    return rules.map(rule => `- ${rule}`).join('\n');
}

/**
 * Format workflow files as numbered steps for SKILL.md
 */
function formatWorkflowSteps(workflows) {
    if (workflows.length === 0) {
        return '_No workflow defined._';
    }

    // Group by category and sort
    const byCategory = {};
    for (const wf of workflows) {
        if (!byCategory[wf.category]) {
            byCategory[wf.category] = [];
        }
        byCategory[wf.category].push(wf);
    }

    const lines = [];
    for (const category of Object.keys(byCategory).sort()) {
        const categoryWorkflows = byCategory[category].sort((a, b) => a.order - b.order);

        for (let i = 0; i < categoryWorkflows.length; i++) {
            const wf = categoryWorkflows[i];
            const filename = `${wf.category}-${wf.filename}`;
            const stepNum = i + 1;
            const isFirst = i === 0;

            let line = `${stepNum}. \`${filename}\``;
            if (wf.title) {
                line += ` - ${wf.title}`;
            }
            if (isFirst) {
                line += ' ← **Start here**';
            }
            lines.push(line);
        }
    }

    return lines.join('\n');
}

/**
 * Parse workflow filename to extract order
 * Format: [major].[minor]-[name].md
 */
function parseWorkflowOrder(filename) {
    const match = filename.match(/^(\d+)\.(\d+)-(.+)\.md$/);
    if (!match) return null;
    return {
        order: parseFloat(`${match[1]}.${match[2]}`),
        name: match[3],
    };
}

/**
 * Discover workflows from llm-prompts directory
 * Links workflows to their next step within each category
 */
function discoverWorkflows(promptsDir) {
    const workflows = [];

    if (!fs.existsSync(promptsDir)) {
        return workflows;
    }

    const categories = fs.readdirSync(promptsDir).filter(name => {
        const fullPath = path.join(promptsDir, name);
        return fs.statSync(fullPath).isDirectory() && name !== 'node_modules';
    });

    for (const category of categories) {
        const categoryPath = path.join(promptsDir, category);
        const files = fs.readdirSync(categoryPath)
            .filter(f => f.endsWith('.md') && f !== 'README.md')
            .sort();

        for (const filename of files) {
            const filePath = path.join(categoryPath, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = matter(content);
            const orderInfo = parseWorkflowOrder(filename);

            workflows.push({
                category,
                filename,
                order: orderInfo?.order ?? 0,
                title: parsed.data.title || filename,
                description: parsed.data.description || '',
                content: parsed.content,
                fullPath: filePath,
            });
        }
    }

    // Sort by category then order
    workflows.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.order - b.order;
    });

    // Link to next step within each category
    for (let i = 0; i < workflows.length; i++) {
        const current = workflows[i];
        const next = workflows[i + 1];

        if (next && next.category === current.category) {
            current.nextFilename = `${next.category}-${next.filename}`;
        }
    }

    return workflows;
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
 * @param {Array} options.workflows - Discovered workflows
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
    workflows,
}) {
    const skillDir = path.join(outputDir, skill.id);
    const referencesDir = path.join(skillDir, 'references');

    // Create directories
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(referencesDir, { recursive: true });

    // Track reference files for the SKILL.md listing
    const references = [];

    // Process example code if this is an example-based skill
    if (skill.type === 'example' && skill.example_path) {
        console.log(`  Processing example: ${skill.example_path}`);

        const exampleMarkdown = processExample({
            examplePath: skill.example_path,
            displayName: skill.display_name,
            id: skill.id,
            repoRoot,
            skipPatterns: mergeSkipPatterns(skipPatterns.global, skipPatterns.examples[skill.id]),
            plugins: defaultPlugins,
        });

        fs.writeFileSync(
            path.join(referencesDir, 'EXAMPLE.md'),
            exampleMarkdown,
            'utf8'
        );

        references.push({
            filename: 'EXAMPLE.md',
            description: `${skill.display_name} example project code`,
        });
    }

    // Helper to process a doc entry (string URL or {url, title} object)
    async function processDoc(docEntry, logPrefix = '') {
        const url = typeof docEntry === 'string' ? docEntry : docEntry.url;
        const titleOverride = typeof docEntry === 'object' ? docEntry.title : null;

        console.log(`  ${logPrefix}Fetching doc: ${url}`);

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

    // Fetch and write skill-specific docs
    if (skill.docs_urls && skill.docs_urls.length > 0) {
        for (const docEntry of skill.docs_urls) {
            await processDoc(docEntry);
        }
    }

    // Fetch and write shared docs
    for (const docEntry of sharedDocs) {
        await processDoc(docEntry, 'shared ');
    }

    // Include relevant workflows (flattened with category prefix, linked to next step)
    // Skip workflows for docs-only skills
    if (skill.type !== 'docs-only') {
        for (const workflow of workflows) {
            let content = fs.readFileSync(workflow.fullPath, 'utf8');

            // Append continuation message if there's a next step
            if (workflow.nextFilename) {
                content += `\n\n---\n\n**Upon completion, continue with:** [${workflow.nextFilename}](${workflow.nextFilename})`;
            }

            const filename = `${workflow.category}-${workflow.filename}`;
            fs.writeFileSync(
                path.join(referencesDir, filename),
                content,
                'utf8'
            );

            references.push({
                filename,
                description: toSentenceCase(workflow.title),
            });
        }
    }

    // Build references list for SKILL.md
    const referencesText = references
        .map(ref => `- \`${ref.filename}\` - ${ref.description}`)
        .join('\n');

    // Collect commandments for this skill's tags
    const rules = collectCommandments(skill.tags || [], commandmentsConfig);
    const commandmentsText = formatCommandments(rules);

    // Format workflow steps
    const workflowText = formatWorkflowSteps(workflows);

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
 * Generate all skills from configuration
 *
 * @param {Object} options
 * @param {string} options.repoRoot - Repository root path
 * @param {string} options.configDir - Config directory path (transformation-config)
 * @param {string} options.outputDir - Output directory for generated skills
 * @param {string} options.promptsDir - LLM prompts directory
 * @param {string} options.version - Build version
 */
async function generateAllSkills({
    repoRoot,
    configDir,
    outputDir,
    promptsDir,
    version,
}) {
    console.log('Loading configuration...');

    // Load all configs
    const skillsConfig = loadSkillsConfig(configDir);
    const commandmentsConfig = loadCommandments(configDir);
    const skipPatterns = loadSkipPatterns(path.join(configDir, 'skip-patterns.yaml'));

    // Expand grouped skills into flat array
    const skills = expandSkillGroups(skillsConfig, configDir);

    // Discover workflows
    console.log('Discovering workflows...');
    const workflows = discoverWorkflows(promptsDir);
    console.log(`  Found ${workflows.length} workflow files`);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`\nGenerating ${skills.length} skills...`);

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
            workflows,
        });

        console.log(`  ✓ ${skill.id}`);
    }

    console.log(`\n✓ Generated ${skills.length} skills to ${outputDir}`);

    // Return full skill metadata for manifest generation
    return skills.map(s => ({
        id: s.id,
        shortId: s._shortId,
        category: s._category,
        displayName: s.display_name,
        type: s.type || 'example',
        group: s._group,
        name: s.description,
        description: s.description,
        tags: s.tags || [],
    }));
}

module.exports = {
    loadSkillsConfig,
    loadCommandments,
    loadSkillTemplate,
    expandSkillGroups,
    collectCommandments,
    discoverWorkflows,
    generateSkill,
    generateAllSkills,
    fetchDoc,
};
