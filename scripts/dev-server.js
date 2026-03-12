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
const DIST_DIR = path.join(__dirname, '..', 'dist');
const SKILLS_ZIP_PATH = path.join(DIST_DIR, 'skills-mcp-resources.zip');
const SKILLS_DIR = path.join(DIST_DIR, 'skills');

// Directories to watch for changes
const WATCH_DIRS = [
    path.join(__dirname, '..', 'llm-prompts'),
    path.join(__dirname, '..', 'transformation-config'),
    path.join(__dirname, '..', 'mcp-commands'),
    path.join(__dirname, '..', 'basics'),
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

    const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, SKILLS_BASE_URL: localSkillsUrl },
        shell: true
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
 * Helper to serve a ZIP file
 */
function serveZip(res, zipPath, filename) {
    if (!fs.existsSync(zipPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`ZIP file not found: ${filename}. Run build first.`);
        return;
    }

    const stat = fs.statSync(zipPath);
    const fileSize = stat.size;
    const fileStream = fs.createReadStream(zipPath);

    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': fileSize,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    fileStream.pipe(res);
    console.log(`📦 Served ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
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
            serveZip(res, skillPath, skillFile);
            return;
        }

        // Serve skill menu
        if (req.url === '/skill-menu.json') {
            const menuPath = path.join(SKILLS_DIR, 'skill-menu.json');
            if (!fs.existsSync(menuPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('skill-menu.json not found. Run build first.');
                return;
            }
            const content = fs.readFileSync(menuPath, 'utf8');
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(content);
            console.log(`📋 Served skill-menu.json`);
            return;
        }

        // Serve skills bundle
        if (req.url === '/skills-mcp-resources.zip' || req.url === '/') {
            serveZip(res, SKILLS_ZIP_PATH, 'skills-mcp-resources.zip');
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found. Available endpoints:\n  /skill-menu.json\n  /skills-mcp-resources.zip\n  /skills/{id}.zip');
    });

    server.listen(PORT, () => {
        console.log('\n🚀 Development server started!');
        console.log(`\n📍 Skills bundle:   http://localhost:${PORT}/skills-mcp-resources.zip`);
        console.log(`📍 Individual skill: http://localhost:${PORT}/skills/{id}.zip`);
        console.log('\n💡 To use with MCP server, set environment variable:');
        console.log(`   POSTHOG_MCP_LOCAL_SKILLS_URL=http://localhost:${PORT}/skills-mcp-resources.zip`);
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

    if (!fs.existsSync(SKILLS_ZIP_PATH)) {
        console.log('\n⚠️  ZIP file not found. Running initial build...');
    } else {
        console.log('\n🔄 Rebuilding with local URLs...');
    }

    await new Promise((resolve) => {
        const buildProcess = spawn('npm', ['run', 'build'], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, SKILLS_BASE_URL: localSkillsUrl },
            shell: true
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
