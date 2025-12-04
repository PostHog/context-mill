#!/usr/bin/env node

/**
 * Development server for MCP resources
 *
 * Serves the generated ZIP file over HTTP and watches markdown files
 * for changes, automatically rebuilding when needed.
 *
 * Usage: npm run dev
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8765;
const ZIP_PATH = path.join(__dirname, '..', 'dist', 'examples-mcp-resources.zip');

// Directories to watch for changes
const WATCH_DIRS = [
    path.join(__dirname, '..', 'llm-prompts'),
    path.join(__dirname, '..', 'mcp-commands'),
    path.join(__dirname, '..', 'basics'),
];

let isRebuilding = false;
let rebuildQueued = false;

/**
 * Run the build script
 */
function rebuild() {
    if (isRebuilding) {
        rebuildQueued = true;
        return;
    }

    console.log('\n🔨 Rebuilding resources...');
    isRebuilding = true;

    const buildProcess = spawn('node', [path.join(__dirname, 'build-examples-mcp-resources.js')], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
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
 * Watch directories for markdown file changes
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

            // Only trigger on markdown or JSON files
            if (filename.endsWith('.md') || filename.endsWith('.json')) {
                console.log(`\n📝 Changed: ${filename}`);
                rebuild();
            }
        });
    });
}

/**
 * Create HTTP server to serve the ZIP file
 */
function createServer() {
    const server = http.createServer((req, res) => {
        // Only serve the ZIP file
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
                'Content-Disposition': 'attachment; filename="examples-mcp-resources.zip"',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });

            fileStream.pipe(res);

            console.log(`📦 Served ZIP file (${(fileSize / 1024).toFixed(1)} KB)`);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found. Use /examples-mcp-resources.zip');
        }
    });

    server.listen(PORT, () => {
        console.log('\n🚀 Development server started!');
        console.log(`\n📍 ZIP available at: http://localhost:${PORT}/examples-mcp-resources.zip`);
        console.log('\n💡 To use with MCP server, set environment variable:');
        console.log(`   POSTHOG_MCP_LOCAL_EXAMPLES_URL=http://localhost:${PORT}/examples-mcp-resources.zip`);
    });
}

/**
 * Main entry point
 */
async function main() {
    console.log('🎯 PostHog MCP Resources Development Server');
    console.log('==========================================');

    // Initial build if ZIP doesn't exist
    if (!fs.existsSync(ZIP_PATH)) {
        console.log('\n⚠️  ZIP file not found. Running initial build...');
        await new Promise((resolve) => {
            const buildProcess = spawn('node', [path.join(__dirname, 'build-examples-mcp-resources.js')], {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')
            });
            buildProcess.on('close', resolve);
        });
    }

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
