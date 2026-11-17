#!/usr/bin/env node

/**
 * Development server for MCP resources
 *
 * Runs one full build at startup, then watches context/skills/, context/shared/
 * and example-apps/ for changes. A file edit triggers an incremental rebuild of
 * only the skills that own the path, or of every skill for an edit under
 * context/shared/, since any skill may include a partial. manifest.json and
 * skill-menu.json are regenerated from the in-memory skill list. The bundled
 * skills-mcp-resources.zip and marketplace tree stay at initial-build state
 * until the next manual `npm run build`.
 *
 * Doc URLs (`docs_urls`, `shared_docs`, `docs.yaml`) are fetched once during
 * the initial build. Subsequent partial rebuilds reuse the inlined doc text
 * recovered from the prior manifest, so no network calls happen mid-session.
 *
 * Set FORCE_FULL_REBUILD=1 to fall back to a full `npm run build` on every
 * change.
 *
 * Usage:
 *   npm run dev
 *   PORT=3000 npm run dev
 *   FORCE_FULL_REBUILD=1 npm run dev
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import { watchSkillSources } from './lib/dev-watcher.js';

const PORT = process.env.PORT || 8765;
const FORCE_FULL_REBUILD = process.env.FORCE_FULL_REBUILD === '1';
const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

const repoRoot = path.join(import.meta.dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const skillsDir = path.join(distDir, 'skills');

const localSkillsUrl = `http://localhost:${PORT}/skills`;

// `generateManifest` reads SKILLS_BASE_URL from process.env. Partial rebuilds run
// in this process, so set it here — the build subprocess inherits it.
process.env.SKILLS_BASE_URL = localSkillsUrl;

// --- build orchestration ---

function runFullBuildSubprocess() {
    return new Promise((resolve, reject) => {
        const buildEnv = {
            ...process.env,
            SKILLS_BASE_URL: localSkillsUrl,
            BUILD_VERSION,
        };
        const buildProcess = spawn('npm', ['run', 'build'], {
            stdio: 'inherit',
            cwd: repoRoot,
            env: buildEnv,
            shell: true,
        });
        buildProcess.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`npm run build exited with code ${code}`));
        });
        buildProcess.on('error', reject);
    });
}

// --- HTTP server ---

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

function serveFile(res, filePath, contentType, attachmentName = null) {
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    if (!stat?.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...NO_CACHE_HEADERS });
        res.end(`Not found: ${path.basename(filePath)}. Run build first.`);
        return;
    }

    const headers = {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        ...NO_CACHE_HEADERS,
    };
    if (attachmentName) {
        headers['Content-Disposition'] = `attachment; filename="${attachmentName}"`;
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
}

function createServer() {
    const server = http.createServer((req, res) => {
        console.log(`→ ${req.method} ${req.url}`);
        // A skill is asked for by its file name alone, so no request reaches outside the skills folder.
        const skillMatch = req.url?.match(/^\/skills\/([A-Za-z0-9][A-Za-z0-9._-]*\.zip)$/);
        if (skillMatch) {
            const skillFile = skillMatch[1];
            serveFile(res, path.join(skillsDir, skillFile), 'application/zip', skillFile);
            return;
        }

        if (req.url === '/skill-menu.json') {
            serveFile(res, path.join(skillsDir, 'skill-menu.json'), 'application/json');
            return;
        }

        if (req.url === '/skills-mcp-resources.zip' || req.url === '/') {
            serveFile(
                res,
                path.join(distDir, 'skills-mcp-resources.zip'),
                'application/zip',
                'skills-mcp-resources.zip',
            );
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain', ...NO_CACHE_HEADERS });
        res.end('Not found. Available endpoints:\n  /skill-menu.json\n  /skills-mcp-resources.zip\n  /skills/{id}.zip');
    });

    server.listen(PORT, () => {
        console.log('\n🚀 Development server started!');
        console.log(`\n📍 Skills bundle:   http://localhost:${PORT}/skills-mcp-resources.zip`);
        console.log(`📍 Individual skill: http://localhost:${PORT}/skills/{id}.zip`);
        console.log(`📋 Skills menu:      http://localhost:${PORT}/skill-menu.json`);
    });

    return server;
}

// --- entry ---

async function main() {
    console.log('🎯 PostHog MCP Skills Development Server');
    console.log('=========================================');

    if (FORCE_FULL_REBUILD) {
        console.log('\n⚠️  FORCE_FULL_REBUILD=1 — every change triggers `npm run build`');
    }

    console.log('\n🔨 Running initial full build...');
    await runFullBuildSubprocess();

    const server = createServer();
    const watcher = watchSkillSources({
        repoRoot,
        distDir,
        version: BUILD_VERSION,
        fullBuild: FORCE_FULL_REBUILD ? runFullBuildSubprocess : null,
    });

    console.log('\n👀 Watching:');
    for (const dir of watcher.dirs) console.log(`   📁 ${path.relative(repoRoot, dir)}`);

    console.log('\n✨ Ready for development!');
    console.log('   Press Ctrl+C to stop\n');

    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down dev server...');
        server.close();
        // chokidar.close() can stall while awaitWriteFinish timers drain on a
        // large tree. Give it a short window, then exit — the OS reclaims any
        // remaining watch handles when the process dies.
        await Promise.race([
            watcher.close(),
            new Promise(resolve => setTimeout(resolve, 500)),
        ]);
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
