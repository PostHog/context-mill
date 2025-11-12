#!/usr/bin/env node

/**
 * Build script to transform example projects into markdown documentation
 * This generates a ZIP file containing one markdown file per framework example
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const matter = require('gray-matter');
const { composePlugins, ignoreLinePlugin, ignoreFilePlugin, ignoreBlockPlugin } = require('./plugins/index');

/**
 * Manifest configuration constants
 */
const MANIFEST_VERSION = '1.0';
const URI_SCHEME = 'posthog://';

/**
 * Documentation URLs configuration
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
        }
    }
};

/**
 * Build configuration
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
        ],
        regex: [
            /^.env(?!\.example$)/
        ],
    },
};

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
 * Now supports plugins for content transformation
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
            console.warn(`Skipping ${file.relativePath}: ${e.message}`);
        }
    }

    return markdown;
}

/**
 * Discover prompts from mcp-commands directory
 */
function discoverPrompts(promptsPath) {
    const prompts = [];

    if (!fs.existsSync(promptsPath)) {
        return prompts;
    }

    const files = fs.readdirSync(promptsPath).filter(f => f.endsWith('.json'));

    for (const filename of files) {
        const filePath = path.join(promptsPath, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const promptData = JSON.parse(content);

        prompts.push({
            id: promptData.name,
            name: promptData.name,
            title: promptData.title,
            description: promptData.description,
            file: `mcp-commands/${filename}`,
            fullPath: filePath,
            messages: promptData.messages,
        });
    }

    return prompts;
}

/**
 * Generate manifest JSON from discovered workflows, examples, and prompts
 * This generates ALL URIs so MCP just reflects them
 */
function generateManifest(discoveredWorkflows, exampleIds, discoveredPrompts) {
    const workflows = discoveredWorkflows.map(workflow => ({
        id: workflow.id,
        name: workflow.title,
        description: workflow.description,
        file: workflow.file,
        order: workflow.order,
        // Use category/name structure: workflows/basic-integration/event-setup-begin
        uri: `${URI_SCHEME}workflows/${workflow.category}/${workflow.name}`,
        nextStepId: workflow.nextStepId,
        nextStepUri: workflow.nextStepId
            ? `${URI_SCHEME}workflows/${workflow.category}/${discoveredWorkflows.find(w => w.id === workflow.nextStepId)?.name}`
            : undefined,
    }));

    const examples = exampleIds.map(framework => ({
        id: framework,
        name: `PostHog ${framework} example project`,
        description: `Example project code for ${framework}`,
        file: `${framework}.md`,
        uri: `${URI_SCHEME}examples/${framework}`,
    }));

    // Build docs array from configuration
    const docs = [
        {
            id: DOCS_CONFIG.identify.id,
            name: DOCS_CONFIG.identify.name,
            description: DOCS_CONFIG.identify.description,
            uri: `${URI_SCHEME}docs/${DOCS_CONFIG.identify.id}`,
            url: DOCS_CONFIG.identify.url,
        },
        ...Object.values(DOCS_CONFIG.frameworks).map(framework => ({
            id: framework.id,
            name: framework.name,
            description: framework.description,
            uri: `${URI_SCHEME}docs/frameworks/${framework.id}`,
            url: framework.url,
        }))
    ];

    // Build URI lookup map for template substitution
    const uriMap = {
        'workflows.basic-integration.begin': workflows.find(w => w.id === 'basic-integration-event-setup-begin')?.uri,
        'workflows.basic-integration.edit': workflows.find(w => w.id === 'basic-integration-event-setup-edit')?.uri,
        'workflows.basic-integration.revise': workflows.find(w => w.id === 'basic-integration-event-setup-revise')?.uri,
        'docs.frameworks': 'posthog://docs/frameworks/{framework}',
        'examples': 'posthog://examples/{framework}',
    };

    // Helper to replace template variables
    const replaceTemplateVars = (text) => {
        let result = text;
        for (const [key, value] of Object.entries(uriMap)) {
            if (value) {
                result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
        }
        return result;
    };

    // Build prompts array with template variables replaced
    const prompts = discoveredPrompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        messages: prompt.messages.map(msg => ({
            ...msg,
            content: {
                ...msg.content,
                text: replaceTemplateVars(msg.content.text),
            },
        })),
    }));

    return {
        version: MANIFEST_VERSION,
        resources: {
            workflows,
            examples,
            docs,
            prompts,
        },
    };
}

/**
 * Recursively get all files in a directory (used for LLM prompts)
 */
function getAllFilesInDirectory(dirPath, arrayOfFiles = [], baseDir = dirPath) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const relativePath = path.relative(baseDir, filePath);

        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFilesInDirectory(filePath, arrayOfFiles, baseDir);
        } else if (file.endsWith('.md') && file !== 'README.md') {
            arrayOfFiles.push({
                fullPath: filePath,
                relativePath: relativePath,
            });
        }
    });

    return arrayOfFiles;
}

/**
 * Parse workflow metadata from filename
 * Format: [order].[step]-[name].md
 * Example: 1.0-event-setup-begin.md -> { order: 1.0, step: 0, name: 'event-setup-begin' }
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
}

/**
 * Discover workflows from llm-prompts directory structure
 * Convention: llm-prompts/[category]/[order].[step]-[name].md
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

/**
 * Main build function
 */
async function build() {
    console.log('Building markdown documentation from example projects...\n');

    const outputDir = path.join(__dirname, '..', 'dist');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process each framework example
    const markdownFiles = [];

    for (const example of defaultConfig.examples) {
        const absolutePath = path.join(__dirname, '..', example.path);

        if (!fs.existsSync(absolutePath)) {
            console.warn(`Warning: Project directory not found: ${absolutePath}`);
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
    }

    // Discover and process LLM prompts (workflows)
    console.log('\nDiscovering workflows...');
    const promptsPath = path.join(__dirname, '..', 'llm-prompts');
    let discoveredWorkflows = [];

    if (fs.existsSync(promptsPath)) {
        discoveredWorkflows = discoverWorkflows(promptsPath);
        console.log(`  ✓ Discovered ${discoveredWorkflows.length} workflow steps`);

        // Process each workflow file with next-step appending
        for (const workflow of discoveredWorkflows) {
            // Read the file content
            let content = fs.readFileSync(workflow.fullPath, 'utf8');

            if (workflow.nextStepId) {
                // Generate next step URI
                const nextStepUri = `${URI_SCHEME}workflows/${workflow.nextStepId}`;

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

            markdownFiles.push({
                filename: workflow.file,
                path: tempFilePath
            });
        }
    } else {
        console.warn('  Warning: LLM prompts directory not found');
    }

    // Discover prompts
    console.log('\nDiscovering prompts...');
    const promptsDir = path.join(__dirname, '..', 'mcp-commands');
    const discoveredPrompts = discoverPrompts(promptsDir);
    if (discoveredPrompts.length > 0) {
        console.log(`  ✓ Discovered ${discoveredPrompts.length} prompts`);
    } else {
        console.log('  No prompts found');
    }

    // Collect example IDs
    const exampleIds = defaultConfig.examples.map(ex => ex.id);

    // Generate and write manifest
    console.log('\nGenerating manifest...');
    const manifest = generateManifest(discoveredWorkflows, exampleIds, discoveredPrompts);
    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`  ✓ Generated manifest.json`);

    // Add manifest to files to be archived
    markdownFiles.push({
        filename: 'manifest.json',
        path: manifestPath
    });

    // Create ZIP archive
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
        throw err;
    });

    archive.pipe(output);

    // Add markdown files to archive
    for (const file of markdownFiles) {
        archive.file(file.path, { name: file.filename });
    }

    await archive.finalize();
}

// Run the build
build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
