#!/usr/bin/env node

/**
 * ============================================================================
 * PostHog MCP Resources Build Script (LEGACY)
 * ============================================================================
 *
 * This script transforms example projects into MCP resources by:
 * 1. Converting example projects to markdown documentation
 * 2. Discovering and processing workflow guides from llm-prompts/
 * 3. Discovering MCP command prompts from mcp-commands/
 * 4. Generating a manifest with all URIs and metadata
 * 5. Creating a ZIP archive for the MCP server to consume
 *
 * The examples repository is the single source of truth for all URIs.
 * The MCP server purely reflects what's in the manifest - no logic, no URIs.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const matter = require('gray-matter');
const { composePlugins, ignoreLinePlugin, ignoreFilePlugin, ignoreBlockPlugin } = require('./plugins/index');

//#region Configuration

/**
 * Manifest configuration constants
 *
 * - MANIFEST_VERSION: Schema version for manifest structure
 * - BUILD_VERSION: Git release version (set by CI, defaults to 'dev' locally)
 * - URI_SCHEME: Base scheme for all resource URIs
 */
const MANIFEST_VERSION = '1.0';
const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';
const URI_SCHEME = 'posthog://';

/**
 * URI pattern constants - SINGLE SOURCE OF TRUTH for all URI formats
 */
const URI_PATTERNS = {
    workflow: (category, name) => `${URI_SCHEME}workflows/${category}/${name}`,
    doc: (id) => `${URI_SCHEME}docs/${id}`,
    frameworkDocs: `${URI_SCHEME}docs/frameworks/{framework}`,
    examples: `${URI_SCHEME}examples/{framework}`,
};

/**
 * Generate a workflow URI from a workflow object
 * @param {Object} workflow - Workflow object with category and name properties
 * @returns {string} The full URI for the workflow
 */
function getWorkflowUri(workflow) {
    return URI_PATTERNS.workflow(workflow.category, workflow.name);
}

/**
 * Documentation URLs configuration
 * These docs are fetched at runtime by the MCP server
 */
const DOCS_CONFIG = {
    identify: {
        id: 'identify',
        name: 'Identify Users docs',
        description: 'PostHog documentation on identifying users',
        url: 'https://posthog.com/docs/getting-started/identify-users.md'
    },
    frameworks: {
        'nextjs-app-router': {
            id: 'nextjs-app-router',
            name: 'PostHog Next.js App Router integration documentation',
            description: 'PostHog integration documentation for Next.js App Router',
            url: 'https://posthog.com/docs/libraries/next-js.md'
        },
        'nextjs-pages-router': {
            id: 'nextjs-pages-router',
            name: 'PostHog Next.js Pages Router integration documentation',
            description: 'PostHog integration documentation for Next.js Pages Router',
            url: 'https://posthog.com/docs/libraries/next-js.md'
        },
        'react-react-router-6': {
            id: 'react-react-router-6',
            name: 'PostHog React Router v6 integration documentation',
            description: 'PostHog integration documentation for React Router v6',
            url: 'https://posthog.com/docs/libraries/react-router/react-router-v6'
        },
        'react-react-router-7-framework': {
            id: 'react-react-router-7-framework',
            name: 'PostHog React Router v7 Framework mode integration documentation',
            description: 'PostHog integration documentation for React Router v7 Framework mode',
            url: 'https://posthog.com/docs/libraries/react-router/react-router-v7-framework-mode'
        },
        'react-react-router-7-data': {
            id: 'react-react-router-7-data',
            name: 'PostHog React Router v7 Data mode integration documentation',
            description: 'PostHog integration documentation for React Router v7 Data mode',
            url: 'https://posthog.com/docs/libraries/react-router/react-router-v7-data-mode'
        },
        'react-react-router-7-declarative': {
            id: 'react-react-router-7-declarative',
            name: 'PostHog React Router v7 Declarative mode integration documentation',
            description: 'PostHog integration documentation for React Router v7 Declarative mode',
            url: 'https://posthog.com/docs/libraries/react-router/react-router-v7-declarative-mode'
        },
        'django': {
            id: 'django',
            name: 'PostHog Django integration documentation',
            description: 'PostHog integration documentation for Django',
            url: 'https://posthog.com/docs/libraries/django'
        },
        'laravel': {
            id: 'laravel',
            name: 'PostHog Laravel integration documentation',
            description: 'PostHog integration documentation for Laravel',
            url: 'https://posthog.com/docs/libraries/laravel'
        }
    }
};

/**
 * Build configuration
 * Defines which example projects to process and how to filter their files
 */
const defaultConfig = {
    // Global plugins applied to all examples
    plugins: [ignoreFilePlugin, ignoreBlockPlugin, ignoreLinePlugin],
    examples: [
        {
            path: 'basics/next-app-router',
            id: 'nextjs-app-router',
            displayName: 'Next.js App Router',
            tags: ['nextjs', 'react', 'ssr', 'app-router'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            // Example-specific plugins (optional)
            plugins: [],
        },
        {
            path: 'basics/next-pages-router',
            id: 'nextjs-pages-router',
            displayName: 'Next.js Pages Router',
            tags: ['nextjs', 'react', 'ssr', 'pages-router'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            // Example-specific plugins (optional)
            plugins: [],
        },
        {
            path: 'basics/react-react-router-6',
            id: 'react-react-router-6',
            displayName: 'React Router v6',
            tags: ['react', 'react-router', 'v6', 'spa'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/react-react-router-7-framework',
            id: 'react-react-router-7-framework',
            displayName: 'React Router v7 - Framework mode',
            tags: ['react', 'react-router', 'v7', 'framework', 'ssr'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/react-react-router-7-data',
            id: 'react-react-router-7-data',
            displayName: 'React Router v7 - Data mode',
            tags: ['react', 'react-router', 'v7', 'data', 'spa'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/react-react-router-7-declarative',
            id: 'react-react-router-7-declarative',
            displayName: 'React Router v7 - Declarative mode',
            tags: ['react', 'react-router', 'v7', 'declarative', 'spa'],
            skipPatterns: {
                includes: [],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/django',
            id: 'django',
            displayName: 'Django',
            tags: ['django', 'python', 'server-side'],
            skipPatterns: {
                includes: [
                    '__pycache__',
                    '.pyc',
                    'db.sqlite3',
                    '.venv',
                    'venv',
                    'env',
                ],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/flask',
            id: 'flask',
            displayName: 'Flask',
            tags: ['flask', 'python', 'server-side'],
            skipPatterns: {
                includes: [
                    '__pycache__',
                    '.pyc',
                    '.pyo',
                    '.pyd',
                    '.env',
                    '.db',
                    '.venv',
                    'venv',
                    'instance',
                ],
                regex: [],
            },
            plugins: [],
        },
        {
            path: 'basics/laravel',
            id: 'laravel',
            displayName: 'Laravel',
            tags: ['laravel', 'php', 'server-side'],
            skipPatterns: {
                includes: [
                    'storage/framework',
                    'storage/logs',
                    'bootstrap/cache',
                    'public/hot',
                    'public/storage',
                    'public/build',
                    '.env.backup',
                ],
                regex: [],
            },
            plugins: [],
        },
    ],
    globalSkipPatterns: {
        includes: [
            '.json',
            '.yaml',
            '.yml',
            '.tsbuildinfo',
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.ico',
            '.svg',
            '.woff',
            '.woff2',
            '.ttf',
            '.eot',
            '.pdf',
            '.zip',
            '.tar',
            '.gz',
            '.exe',
            '.dll',
            '.so',
            '.dylib',
            '.css',
            '.scss',
            '.sass',
            '.less',
            '.styl',
            '.stylus',
            '.pcss',
            '.postcss',
            '.tailwindcss',
            // Database
            '.sqlite',
            '.sqlite-journal',
            // Build artifacts
            'node_modules',
            '.git',
            '.next',
            'playwright-report',
            'test-results',
            'coverage',
            '.DS_Store',
            '.gitignore',
            'eslint',
            'repomix-output.xml',
            // Python
            'venv',
            '.venv',
            '__pycache__',
            '.pyc',
            '.egg-info',
            '.eggs',
            '.pytest_cache',
            '.mypy_cache',
            '.ruff_cache',
            '.tox',
            '.nox',
            'htmlcov',
            '.coverage',
            'pip-log.txt',
            '.Python',
            // PHP
            'vendor',
            '.phpunit.result.cache',
            '.php-cs-fixer.cache',
            '.phpstan.cache',
            '.php_cs.cache',
            'phpstan.neon',
            'psalm.xml',
            '.psalm',
        ],
        regex: [
            /^.env(?!\.example$)/
        ],
    },
};

//#endregion

//#region Example Project Processing

/**
 * Build markdown header for an example project
 */
function buildMarkdownHeader(frameworkName, repoUrl, relativePath) {
    let markdown = `# PostHog ${frameworkName} Example Project\n\n`;
    markdown += `Repository: ${repoUrl}\n`;
    if (relativePath) {
        markdown += `Path: ${relativePath}\n`;
    }
    markdown += '\n---\n\n';
    return markdown;
}

/**
 * Convert a file to a markdown code block
 * Supports plugins for content transformation (e.g., removing ignore comments)
 *
 * @param {string} relativePath - The relative path of the file
 * @param {string} content - The file content
 * @param {string} extension - The file extension
 * @param {Array} plugins - Optional array of plugins to transform content
 * @returns {string|null} - The markdown representation of the file, or null if content is empty after transformation
 */
function fileToMarkdown(relativePath, content, extension, plugins = []) {
    // Create context object for plugins
    const context = {
        relativePath,
        extension,
    };

    // Apply plugins to content if provided
    const transformedContent = plugins.length > 0
        ? composePlugins(plugins)(content, context)
        : content;

    // If content is empty after transformation, return null to skip the file
    if (!transformedContent || transformedContent.trim() === '') {
        return null;
    }

    // Build markdown output
    let markdown = `## ${relativePath}\n\n`;
    if (extension === 'md') {
        markdown += transformedContent;
    } else {
        markdown += `\`\`\`${extension}\n`;
        markdown += transformedContent;
        markdown += '\n```\n\n';
    }
    markdown += '\n---\n\n';
    return markdown;
}

/**
 * Merge global and example-specific skip patterns
 */
function mergeSkipPatterns(globalPatterns, examplePatterns) {
    return {
        includes: [...globalPatterns.includes, ...examplePatterns.includes],
        regex: [...globalPatterns.regex, ...examplePatterns.regex],
    };
}

/**
 * Check if a file should be skipped based on patterns
 */
function shouldSkip(filePath, skipPatterns) {
    // Check includes patterns (substring matching)
    const hasIncludeMatch = skipPatterns.includes.some(pattern =>
        filePath.includes(pattern)
    );
    if (hasIncludeMatch) return true;

    // Check regex patterns
    const hasRegexMatch = skipPatterns.regex.some(pattern => {
        try {
            const regex = new RegExp(pattern);
            return regex.test(filePath);
        } catch (e) {
            console.warn(`Invalid regex pattern: ${pattern}`);
            return false;
        }
    });
    if (hasRegexMatch) return true;

    return false;
}

/**
 * Recursively get all files in a directory, filtering as we go
 */
function getAllFiles(dirPath, arrayOfFiles = [], baseDir = dirPath, skipPatterns = null) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const relativePath = path.relative(baseDir, filePath);

        // Skip early if patterns are provided
        if (skipPatterns && shouldSkip(relativePath, skipPatterns)) {
            return;
        }

        if (fs.statSync(filePath).isDirectory()) {
            // Skip early for directories to avoid traversing unnecessary folders
            arrayOfFiles = getAllFiles(filePath, arrayOfFiles, baseDir, skipPatterns);
        } else {
            arrayOfFiles.push({
                fullPath: filePath,
                relativePath: relativePath,
            });
        }
    });

    return arrayOfFiles;
}

/**
 * Convert an example project directory to markdown
 * Main function that orchestrates the conversion process
 */
function convertProjectToMarkdown(absolutePath, frameworkInfo, relativePath, skipPatterns, plugins = []) {
    const repoUrl = 'https://github.com/PostHog/examples';
    let markdown = buildMarkdownHeader(frameworkInfo.displayName, repoUrl, relativePath);

    // Get all files, filtering during traversal for efficiency
    const files = getAllFiles(absolutePath, [], absolutePath, skipPatterns);

    // Sort files for consistent output, with README.md at root always first
    files.sort((a, b) => {
        // README.md at root should always be first
        if (a.relativePath === 'README.md') return -1;
        if (b.relativePath === 'README.md') return 1;

        // Otherwise sort alphabetically
        return a.relativePath.localeCompare(b.relativePath);
    });

    // Convert each file to markdown
    for (const file of files) {
        try {
            const content = fs.readFileSync(file.fullPath, 'utf8');
            const extension = path.extname(file.fullPath).slice(1) || '';
            const fileMarkdown = fileToMarkdown(file.relativePath, content, extension, plugins);

            // Skip file if plugins returned empty content
            if (fileMarkdown !== null) {
                markdown += fileMarkdown;
            }
        } catch (e) {
            // Skip files that can't be read as text
            console.error(`[ERROR] Failed to process ${file.relativePath}:`, e);
        }
    }

    return markdown;
}

//#endregion

//#region Workflow Discovery and Processing

/**
 * Parse workflow metadata from filename
 * Format: [order].[step]-[name].md
 * Example: 1.0-begin.md -> { order: 1.0, step: 0, name: 'begin' }
 */
function parseWorkflowFilename(filename) {
    const match = filename.match(/^(\d+)\.(\d+)-(.+)\.md$/);
    if (!match) return null;

    const [, major, minor, name] = match;
    return {
        order: parseFloat(`${major}.${minor}`),
        step: parseInt(minor),
        name: name,
    };
}

/**
 * Extract title and description from markdown frontmatter
 * Throws error if frontmatter is missing required fields
 */
function extractMetadataFromMarkdown(content, filename) {
    try {
        const parsed = matter(content);

        if (!parsed.data.title) {
            throw new Error(`Missing 'title' in frontmatter for ${filename}`);
        }

        if (!parsed.data.description) {
            throw new Error(`Missing 'description' in frontmatter for ${filename}`);
        }

        return {
            title: parsed.data.title,
            description: parsed.data.description,
        };
    } catch (e) {
        console.error(`[ERROR] Failed to extract metadata from ${filename}:`, e);
        throw e;
    }
}

/**
 * Discover workflows from llm-prompts directory structure
 * Convention: llm-prompts/[category]/[order].[step]-[name].md
 * Automatically links workflow steps within each category
 */
function discoverWorkflows(promptsPath) {
    const workflows = [];
    const categories = fs.readdirSync(promptsPath).filter(name => {
        const fullPath = path.join(promptsPath, name);
        return fs.statSync(fullPath).isDirectory() && name !== 'node_modules';
    });

    for (const category of categories) {
        const categoryPath = path.join(promptsPath, category);
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && f !== 'README.md');

        for (const filename of files) {
            const parsed = parseWorkflowFilename(filename);
            if (!parsed) {
                console.warn(`  Warning: Skipping ${category}/${filename} - doesn't match workflow naming convention`);
                continue;
            }

            try {
                const filePath = path.join(categoryPath, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const metadata = extractMetadataFromMarkdown(content, `${category}/${filename}`);

                workflows.push({
                    category,
                    filename,
                    order: parsed.order,
                    step: parsed.step,
                    name: parsed.name,
                    id: `${category}-${parsed.name}`,
                    title: metadata.title || parsed.name.replace(/-/g, ' '),
                    description: metadata.description || `Workflow step for ${parsed.name}`,
                    file: `prompts/${category}/${filename}`,
                    fullPath: filePath,
                });
            } catch (e) {
                console.error(`[ERROR] Failed to process workflow ${category}/${filename}:`, e);
                throw e;
            }
        }
    }

    // Sort by category and order
    workflows.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.order - b.order;
    });

    // Link next steps within each category
    const categorized = {};
    workflows.forEach(w => {
        if (!categorized[w.category]) categorized[w.category] = [];
        categorized[w.category].push(w);
    });

    Object.values(categorized).forEach(categoryWorkflows => {
        categoryWorkflows.forEach((workflow, i) => {
            if (i < categoryWorkflows.length - 1) {
                workflow.nextStepId = categoryWorkflows[i + 1].id;
            }
        });
    });

    return workflows;
}

//#endregion

//#region MCP Commands (Prompts) Discovery

/**
 * Discover prompts from mcp-commands directory
 * Each .json file represents a prompt with template variables for URIs
 */
function discoverPrompts(promptsPath) {
    const prompts = [];

    if (!fs.existsSync(promptsPath)) {
        return prompts;
    }

    const files = fs.readdirSync(promptsPath).filter(f => f.endsWith('.json'));

    for (const filename of files) {
        try {
            const filePath = path.join(promptsPath, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const promptData = JSON.parse(content);

            if (!promptData.name) {
                throw new Error(`Missing 'name' field in prompt JSON`);
            }
            if (!promptData.title) {
                throw new Error(`Missing 'title' field in prompt JSON`);
            }
            if (!promptData.description) {
                throw new Error(`Missing 'description' field in prompt JSON`);
            }
            if (!promptData.messages) {
                throw new Error(`Missing 'messages' field in prompt JSON`);
            }

            prompts.push({
                id: promptData.name,
                name: promptData.name,
                title: promptData.title,
                description: promptData.description,
                file: `mcp-commands/${filename}`,
                fullPath: filePath,
                messages: promptData.messages,
            });
        } catch (e) {
            console.error(`[ERROR] Failed to process prompt ${filename}:`, e);
            throw e;
        }
    }

    return prompts;
}

//#endregion

//#region Manifest Generation and URI Management

/**
 * Generate manifest JSON from discovered workflows, examples, and prompts
 * This generates ALL URIs - the MCP server purely reflects what's here
 */
function generateManifest(discoveredWorkflows, exampleIds, discoveredPrompts) {
    // Helper to get next step URI by looking up the workflow
    const getNextStepUri = (nextStepId) => {
        if (!nextStepId) return undefined;
        const nextWorkflow = discoveredWorkflows.find(w => w.id === nextStepId);
        return nextWorkflow ? getWorkflowUri(nextWorkflow) : undefined;
    };

    // Generate workflow resources with hierarchical URIs
    const workflows = discoveredWorkflows.map(workflow => ({
        id: workflow.id,
        name: workflow.title,
        description: workflow.description,
        file: workflow.file,
        order: workflow.order,
        uri: getWorkflowUri(workflow),
        nextStepId: workflow.nextStepId,
        nextStepUri: getNextStepUri(workflow.nextStepId),
    }));

    // TEMPORARY: Backward compatibility alias for legacy URI
    // TODO: Remove once external tools are updated to use new URI structure
    const beginWorkflow = discoveredWorkflows.find(w => w.id === 'basic-integration-begin');
    if (beginWorkflow) {
        workflows.push({
            id: 'legacy-setup-begin',
            name: 'Event Setup - Begin (Legacy URI)',
            description: 'Start the event tracking setup process (legacy URI for backward compatibility)',
            file: beginWorkflow.file,
            order: beginWorkflow.order,
            uri: 'posthog://integration/workflow/setup/begin', // Old hardcoded URI
            nextStepId: beginWorkflow.nextStepId,
            nextStepUri: getNextStepUri(beginWorkflow.nextStepId),
        });
    }

    // Generate non-templated documentation resources (fetched at runtime from URLs)
    // Only include docs that aren't covered by templates
    const docs = [
        {
            id: DOCS_CONFIG.identify.id,
            name: DOCS_CONFIG.identify.name,
            description: DOCS_CONFIG.identify.description,
            uri: URI_PATTERNS.doc(DOCS_CONFIG.identify.id),
            url: DOCS_CONFIG.identify.url,
        },
    ];

    // Build URI lookup map for template variable substitution in prompts
    // This dynamically generates mappings from discovered workflows
    const uriMap = {};

    // Add workflow template mappings with pattern: workflows.{category}.{last-part-of-id}
    for (const workflow of workflows) {
        // Skip legacy aliases
        if (workflow.id.startsWith('legacy-')) continue;

        // Extract the last part of the ID for the template key
        // e.g., "begin" from "basic-integration-begin"
        const idParts = workflow.id.split('-');
        const shortName = idParts[idParts.length - 1];

        // Find the original workflow to get category
        const originalWorkflow = discoveredWorkflows.find(w => w.id === workflow.id);
        if (!originalWorkflow) continue;

        const templateKey = `workflows.${originalWorkflow.category}.${shortName}`;
        uriMap[templateKey] = workflow.uri;
        console.log(`[DEBUG] Template mapping: {{${templateKey}}} -> ${workflow.uri}`);
    }

    // Add static template mappings for docs and examples
    uriMap['docs.frameworks'] = URI_PATTERNS.frameworkDocs;
    uriMap['examples'] = URI_PATTERNS.examples;

    /**
     * Helper to replace template variables in prompt text
     * Replaces {{template.key}} with actual URIs
     */
    const replaceTemplateVars = (text) => {
        let result = text;
        for (const [key, value] of Object.entries(uriMap)) {
            if (value) {
                const before = result;
                result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                if (before !== result) {
                    console.log(`[DEBUG] Replaced {{${key}}} with ${value}`);
                }
            }
        }
        return result;
    };

    // Build resource templates
    // Examples and framework docs should be templated for easy parameterized access
    const templates = [
        {
            name: 'PostHog example projects',
            uriPattern: URI_PATTERNS.examples,
            description: 'Example project code showing PostHog integration for various frameworks',
            parameterName: 'framework',
            items: exampleIds.map(id => ({
                id: id,
                file: `${id}.md`,
            })),
        },
        {
            name: 'PostHog framework integration documentation',
            uriPattern: URI_PATTERNS.frameworkDocs,
            description: 'PostHog integration documentation for various frameworks',
            parameterName: 'framework',
            items: Object.values(DOCS_CONFIG.frameworks).map(framework => {
                // If this framework has an example, use the markdown file
                if (exampleIds.includes(framework.id)) {
                    return {
                        id: framework.id,
                        file: `${framework.id}.md`,
                    };
                }
                // Otherwise fall back to URL for frameworks without examples
                return {
                    id: framework.id,
                    url: framework.url,
                };
            }),
        },
    ];

    // Build prompts array with template variables replaced
    // Add available frameworks to description so the agent knows what's available
    const prompts = discoveredPrompts.map(prompt => {
        const availableFrameworks = templates[0].items.map(item => item.id);
        const frameworksList = availableFrameworks.join(', ');

        return {
            id: prompt.id,
            name: prompt.name,
            title: prompt.title,
            description: `${prompt.description}. Available frameworks: ${frameworksList}`,
            messages: prompt.messages.map(msg => ({
                ...msg,
                content: {
                    ...msg.content,
                    text: replaceTemplateVars(msg.content.text),
                },
            })),
        };
    });

    return {
        version: MANIFEST_VERSION,
        buildVersion: BUILD_VERSION,
        buildTimestamp: new Date().toISOString(),
        resources: {
            workflows,
            docs,
            prompts,
        },
        templates,
    };
}

//#endregion

//#region Build Orchestration

/**
 * Process workflow files by appending next-step continuations
 * Workflows need next-step URIs appended to guide users through multi-step processes
 */
function processWorkflowFiles(discoveredWorkflows, outputDir) {
    const processedFiles = [];

    for (const workflow of discoveredWorkflows) {
        // Read the file content
        let content = fs.readFileSync(workflow.fullPath, 'utf8');

        if (workflow.nextStepId) {
            // Find the next workflow to generate its URI
            const nextWorkflow = discoveredWorkflows.find(w => w.id === workflow.nextStepId);
            if (!nextWorkflow) {
                console.warn(`[WARNING] Next step workflow not found: ${workflow.nextStepId}`);
                continue;
            }

            // Generate next step URI using the single source of truth
            const nextStepUri = getWorkflowUri(nextWorkflow);

            // Append next step message
            content += `\n\n---\n\n**Upon completion, access the following resource to continue:** ${nextStepUri}`;
        }

        // Write the modified content to a temp file in dist
        const tempFilePath = path.join(outputDir, `temp-${workflow.filename}`);
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        fs.writeFileSync(tempFilePath, content, 'utf8');

        processedFiles.push({
            filename: workflow.file,
            path: tempFilePath
        });
    }

    return processedFiles;
}

/**
 * Main build function
 * Orchestrates the entire build process:
 * 1. Convert example projects to markdown
 * 2. Discover and process workflows
 * 3. Discover MCP command prompts
 * 4. Generate manifest with all URIs
 * 5. Create ZIP archive
 */
async function build() {
    console.log('Building markdown documentation from example projects...');
    console.log(`Build Version: ${BUILD_VERSION}`);
    console.log('');

    const outputDir = path.join(__dirname, '..', 'dist');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // ========================================================================
    // Step 1: Process Example Projects
    // ========================================================================
    const markdownFiles = [];

    for (const example of defaultConfig.examples) {
        try {
            const absolutePath = path.join(__dirname, '..', example.path);

            if (!fs.existsSync(absolutePath)) {
                console.warn(`[WARNING] Project directory not found: ${absolutePath}`);
                continue;
            }

            // Merge global and example-specific skip patterns
            const skipPatterns = mergeSkipPatterns(
                defaultConfig.globalSkipPatterns,
                example.skipPatterns
            );

            // Merge global and example-specific plugins
            const plugins = [
                ...(defaultConfig.plugins || []),
                ...(example.plugins || [])
            ];

            console.log(`Processing ${example.displayName}...`);
            const markdown = convertProjectToMarkdown(
                absolutePath,
                example,
                example.path,
                skipPatterns,
                plugins
            );

            const outputFilename = `${example.id}.md`;
            const outputPath = path.join(outputDir, outputFilename);

            fs.writeFileSync(outputPath, markdown, 'utf8');
            markdownFiles.push({ filename: outputFilename, path: outputPath });

            console.log(`  ✓ Generated ${outputFilename} (${(markdown.length / 1024).toFixed(1)} KB)`);
        } catch (e) {
            console.error(`[ERROR] Failed to process example ${example.displayName}:`, e);
            throw e;
        }
    }

    // ========================================================================
    // Step 2: Discover and Process Workflows
    // ========================================================================
    console.log('\nDiscovering workflows...');
    const promptsPath = path.join(__dirname, '..', 'llm-prompts');
    let discoveredWorkflows = [];

    try {
        if (fs.existsSync(promptsPath)) {
            discoveredWorkflows = discoverWorkflows(promptsPath);
            console.log(`  ✓ Discovered ${discoveredWorkflows.length} workflow steps`);

            // Process workflow files with next-step appending
            const workflowFiles = processWorkflowFiles(discoveredWorkflows, outputDir);
            markdownFiles.push(...workflowFiles);
        } else {
            console.warn('[WARNING] LLM prompts directory not found');
        }
    } catch (e) {
        console.error('[ERROR] Failed to discover/process workflows:', e);
        throw e;
    }

    // ========================================================================
    // Step 3: Discover MCP Command Prompts
    // ========================================================================
    console.log('\nDiscovering prompts...');
    const promptsDir = path.join(__dirname, '..', 'mcp-commands');
    let discoveredPrompts = [];

    try {
        discoveredPrompts = discoverPrompts(promptsDir);
        if (discoveredPrompts.length > 0) {
            console.log(`  ✓ Discovered ${discoveredPrompts.length} prompts`);
        } else {
            console.log('  No prompts found');
        }
    } catch (e) {
        console.error('[ERROR] Failed to discover prompts:', e);
        throw e;
    }

    // ========================================================================
    // Step 4: Generate Manifest
    // ========================================================================
    console.log('\nGenerating manifest...');
    const exampleIds = defaultConfig.examples.map(ex => ex.id);

    try {
        const manifest = generateManifest(discoveredWorkflows, exampleIds, discoveredPrompts);
        const manifestPath = path.join(outputDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        console.log(`  ✓ Generated manifest.json`);

        // Add manifest to files to be archived
        markdownFiles.push({
            filename: 'manifest.json',
            path: manifestPath
        });
    } catch (e) {
        console.error('[ERROR] Failed to generate manifest:', e);
        throw e;
    }

    // ========================================================================
    // Step 5: Create ZIP Archive
    // ========================================================================
    console.log('\nCreating ZIP archive...');
    const zipPath = path.join(outputDir, 'examples-mcp-resources.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`\n✓ Build complete!`);
        console.log(`  Archive: ${zipPath}`);
        console.log(`  Size: ${(archive.pointer() / 1024).toFixed(1)} KB`);
        console.log(`  Files: ${markdownFiles.length}`);
    });

    archive.on('error', (err) => {
        console.error('[ERROR] Archive creation failed:', err);
        throw err;
    });

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            console.warn('[WARNING] Archive warning:', err);
        } else {
            console.error('[ERROR] Archive error:', err);
            throw err;
        }
    });

    archive.pipe(output);

    // Add markdown files to archive
    try {
        for (const file of markdownFiles) {
            if (!fs.existsSync(file.path)) {
                throw new Error(`File not found: ${file.path}`);
            }
            console.log(`  Adding to archive: ${file.filename}`);
            archive.file(file.path, { name: file.filename });
        }

        await archive.finalize();
    } catch (e) {
        console.error('[ERROR] Failed to add files to archive:', e);
        throw e;
    }
}

//#endregion

//#region Entry Point

// Run the build
build().catch(err => {
    console.error('\n[FATAL ERROR] Build failed:', err);
    console.error('\nStack trace:');
    console.error(err.stack);
    process.exit(1);
});

//#endregion
