#!/usr/bin/env node

/**
 * Build script to transform example projects into markdown documentation
 * This generates a ZIP file containing one markdown file per framework example
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Build configuration
 */
const defaultConfig = {
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
 */
function fileToMarkdown(relativePath, content, extension) {
    let markdown = `## ${relativePath}\n\n`;
    if (extension === 'md') {
        markdown += content;
    } else {
        markdown += `\`\`\`${extension}\n`;
        markdown += content;
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
function convertProjectToMarkdown(absolutePath, frameworkInfo, relativePath, skipPatterns) {
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
            markdown += fileToMarkdown(file.relativePath, content, extension);
        } catch (e) {
            // Skip files that can't be read as text
            console.warn(`Skipping ${file.relativePath}: ${e.message}`);
        }
    }

    return markdown;
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

        console.log(`Processing ${example.displayName}...`);
        const markdown = convertProjectToMarkdown(
            absolutePath,
            example,
            example.path,
            skipPatterns
        );

        const outputFilename = `${example.id}.md`;
        const outputPath = path.join(outputDir, outputFilename);

        fs.writeFileSync(outputPath, markdown, 'utf8');
        markdownFiles.push({ filename: outputFilename, path: outputPath });

        console.log(`  ✓ Generated ${outputFilename} (${(markdown.length / 1024).toFixed(1)} KB)`);
    }

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
