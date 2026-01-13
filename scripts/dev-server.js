#!/usr/bin/env node

/**
 * Development server for MCP resources
 *
 * Serves the generated ZIP file over HTTP and watches markdown files
 * for changes, automatically rebuilding when needed.
 *
 * Usage: npm run dev
 *
 * To use a different port:
 *   PORT=3000 npm run dev
 *
 * Then update the MCP server command to match:
 *   pnpm run dev:local-resources (and update wrangler --var flag)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8765;
const ZIP_PATH = path.join(__dirname, '..', 'dist', 'skills-mcp-resources.zip');
const SKILLS_DIR = path.join(__dirname, '..', 'dist', 'skills');

// Directories to watch for changes
const WATCH_DIRS = [
    path.join(__dirname, '..', 'llm-prompts'),
    path.join(__dirname, '..', 'transformation-config'),
];

let isRebuilding = false;
let rebuildQueued = false;

/**
 * Run the build script with local URLs
 */
function rebuild() {
    if (isRebuilding) {
        rebuildQueued = true;
        return;
    }

    console.log('\n🔨 Rebuilding skills with local URLs...');
    isRebuilding = true;

    // Use local URL for skill downloads during development
    const localSkillsUrl = `http://localhost:${PORT}/skills`;

    const buildProcess = spawn('node', [path.join(__dirname, 'build-skills.js')], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, SKILLS_BASE_URL: localSkillsUrl }
    });

    buildProcess.on('close', (code) => {
        isRebuilding = false;

        if (code === 0) {
            console.log('✅ Rebuild complete!\n');
        } else {
            console.error(`❌ Build failed with code ${code}\n`);
        }

        // If another rebuild was queued, run it now
        if (rebuildQueued) {
            rebuildQueued = false;
            rebuild();
        }
    });
}

/**
 * Watch directories for file changes
 */
function setupWatchers() {
    console.log('\n👀 Watching for changes in:');

    WATCH_DIRS.forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.log(`   ⚠️  ${path.relative(path.join(__dirname, '..'), dir)} (not found, skipping)`);
            return;
        }

        console.log(`   📁 ${path.relative(path.join(__dirname, '..'), dir)}`);

        // Watch recursively
        fs.watch(dir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;

            // Trigger on markdown, JSON, or YAML files
            if (filename.endsWith('.md') || filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml')) {
                console.log(`\n📝 Changed: ${filename}`);
                rebuild();
            }
        });
    });
}

/**
 * Create HTTP server to serve the ZIP files
 */
function createServer() {
    const server = http.createServer((req, res) => {
        // Serve individual skill ZIPs at /skills/{id}.zip
        const skillMatch = req.url?.match(/^\/skills\/(.+\.zip)$/);
        if (skillMatch) {
            const skillFile = skillMatch[1];
            const skillPath = path.join(SKILLS_DIR, skillFile);

            if (!fs.existsSync(skillPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`Skill ZIP not found: ${skillFile}`);
                return;
            }

            const stat = fs.statSync(skillPath);
            const fileSize = stat.size;
            const fileStream = fs.createReadStream(skillPath);

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Length': fileSize,
                'Content-Disposition': `attachment; filename="${skillFile}"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            });

            fileStream.pipe(res);
            console.log(`📦 Served skill: ${skillFile} (${(fileSize / 1024).toFixed(1)} KB)`);
            return;
        }

        // Serve bundled skills ZIP at the examples URL (skills replaces examples)
        if (req.url === '/examples-mcp-resources.zip' || req.url === '/') {
            if (!fs.existsSync(ZIP_PATH)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('ZIP file not found. Run build first.');
                return;
            }

            const stat = fs.statSync(ZIP_PATH);
            const fileSize = stat.size;
            const fileStream = fs.createReadStream(ZIP_PATH);

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Length': fileSize,
                'Content-Disposition': 'attachment; filename="skills-mcp-resources.zip"',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });

            fileStream.pipe(res);

            console.log(`📦 Served bundle (${(fileSize / 1024).toFixed(1)} KB)`);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found. Use /examples-mcp-resources.zip or /skills/{id}.zip');
        }
    });

    server.listen(PORT, () => {
        console.log('\n🚀 Development server started!');
        console.log(`\n📍 Bundle: http://localhost:${PORT}/examples-mcp-resources.zip`);
        console.log(`📍 Skills: http://localhost:${PORT}/skills/{id}.zip`);
        console.log('\n💡 To use with MCP server, set environment variable:');
        console.log(`   POSTHOG_MCP_LOCAL_EXAMPLES_URL=http://localhost:${PORT}/examples-mcp-resources.zip`);
    });
}

/**
 * Main entry point
 */
async function main() {
    console.log('🎯 PostHog MCP Skills Development Server');
    console.log('=========================================');

    // Initial build with local URLs
    const localSkillsUrl = `http://localhost:${PORT}/skills`;

    if (!fs.existsSync(ZIP_PATH)) {
        console.log('\n⚠️  ZIP file not found. Running initial build...');
    } else {
        console.log('\n🔄 Rebuilding with local URLs...');
    }

    await new Promise((resolve) => {
        const buildProcess = spawn('node', [path.join(__dirname, 'build-skills.js')], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, SKILLS_BASE_URL: localSkillsUrl }
        });
        buildProcess.on('close', resolve);
    });

    // Start server
    createServer();

    // Setup file watchers
    setupWatchers();

    console.log('\n✨ Ready for development!');
    console.log('   Press Ctrl+C to stop\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down dev server...');
    process.exit(0);
});

// Run
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
