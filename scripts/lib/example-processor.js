/**
 * Example Processor
 *
 * Converts an example project directory into a markdown file.
 * Reads configuration from transformation-config/skip-patterns.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { composePlugins, ignoreLinePlugin, ignoreFilePlugin, ignoreBlockPlugin } = require('../plugins/index');
const { REPO_URL } = require('./constants');

/**
 * Load skip patterns from YAML config
 */
function loadSkipPatterns(configPath) {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);

    return {
        global: {
            includes: config.global?.includes || [],
            regex: (config.global?.regex || []).map(pattern => new RegExp(pattern)),
        },
        examples: config.examples || {},
    };
}

/**
 * Check if a file should be skipped based on patterns
 */
function shouldSkip(filePath, skipPatterns) {
    // Check includes patterns (substring matching)
    if (skipPatterns.includes.some(pattern => filePath.includes(pattern))) {
        return true;
    }

    // Check regex patterns
    if (skipPatterns.regex.some(regex => regex.test(filePath))) {
        return true;
    }

    return false;
}

/**
 * Merge global and example-specific skip patterns
 */
function mergeSkipPatterns(globalPatterns, examplePatterns = {}) {
    return {
        includes: [
            ...globalPatterns.includes,
            ...(examplePatterns.includes || []),
        ],
        regex: [
            ...globalPatterns.regex,
            ...(examplePatterns.regex || []).map(p => new RegExp(p)),
        ],
    };
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dirPath, baseDir, skipPatterns) {
    const files = [];
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const relativePath = path.relative(baseDir, fullPath);

        if (shouldSkip(relativePath, skipPatterns)) {
            continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files.push(...collectFiles(fullPath, baseDir, skipPatterns));
        } else {
            files.push({ fullPath, relativePath });
        }
    }

    return files;
}

/**
 * Convert file content to markdown code block
 */
function fileToMarkdown(relativePath, content, extension, plugins = []) {
    const context = { relativePath, extension };

    // Apply plugins
    const transformedContent = plugins.length > 0
        ? composePlugins(plugins)(content, context)
        : content;

    // Skip if empty after transformation
    if (!transformedContent || transformedContent.trim() === '') {
        return null;
    }

    let markdown = `## ${relativePath}\n\n`;

    if (extension === 'md') {
        markdown += transformedContent;
    } else {
        markdown += `\`\`\`${extension}\n`;
        markdown += transformedContent;
        markdown += '\n```\n';
    }

    markdown += '\n---\n\n';
    return markdown;
}

/**
 * Build markdown header for example
 */
function buildHeader(displayName, repoUrl, examplePath) {
    let header = `# PostHog ${displayName} Example Project\n\n`;
    header += `Repository: ${repoUrl}\n`;
    header += `Path: ${examplePath}\n`;
    header += '\n---\n\n';
    return header;
}

/**
 * Process an example project into markdown
 *
 * @param {Object} options
 * @param {string} options.examplePath - Path to example directory (relative to repo root)
 * @param {string} options.displayName - Human-readable name
 * @param {string} options.id - Example identifier
 * @param {string} options.repoRoot - Path to repository root
 * @param {Object} options.skipPatterns - Merged skip patterns
 * @param {Array} options.plugins - Content transformation plugins
 * @returns {string} Generated markdown content
 */
function processExample({ examplePath, displayName, id, repoRoot, skipPatterns, plugins = [] }) {
    const absolutePath = path.join(repoRoot, examplePath);
    const repoUrl = REPO_URL;

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Example directory not found: ${absolutePath}`);
    }

    // Collect files
    const files = collectFiles(absolutePath, absolutePath, skipPatterns);

    // Sort: README.md first, then alphabetical
    files.sort((a, b) => {
        if (a.relativePath === 'README.md') return -1;
        if (b.relativePath === 'README.md') return 1;
        return a.relativePath.localeCompare(b.relativePath);
    });

    // Build markdown
    let markdown = buildHeader(displayName, repoUrl, examplePath);

    for (const file of files) {
        try {
            const content = fs.readFileSync(file.fullPath, 'utf8');
            const extension = path.extname(file.fullPath).slice(1) || '';
            const fileMarkdown = fileToMarkdown(file.relativePath, content, extension, plugins);

            if (fileMarkdown !== null) {
                markdown += fileMarkdown;
            }
        } catch (e) {
            console.error(`[ERROR] Failed to process ${file.relativePath}:`, e.message);
        }
    }

    return markdown;
}

/**
 * Default plugins applied to all examples
 */
const defaultPlugins = [ignoreFilePlugin, ignoreBlockPlugin, ignoreLinePlugin];

module.exports = {
    loadSkipPatterns,
    mergeSkipPatterns,
    processExample,
    defaultPlugins,
};
