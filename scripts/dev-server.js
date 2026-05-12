#!/usr/bin/env node

/**
 * Development server for MCP resources
 *
 * Serves the generated ZIP file over HTTP and watches the skill source dirs.
 * On a file change, only the affected skill group is rebuilt — not the entire
 * skill catalog. See hot-reload.md for the routing logic.
 *
 * Usage: npm run dev
 *
 * Env vars:
 *   PORT=3000              — server port (default 8765)
 *   FORCE_FULL_REBUILD=1   — shell out to `npm run build` on every change
 *                            (fallback to today's behavior for one session)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const { loadAndExpandSkills } = require('./lib/skill-generator');
const { partialRebuild, loadDocContentsFromManifest, reconcileOrphans } = require('./lib/build-phases');
const { buildIndexes, routeChange, diffSkillIds } = require('./lib/change-router');

const PORT = process.env.PORT || 8765;
const FORCE_FULL_REBUILD = process.env.FORCE_FULL_REBUILD === '1';
const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

const repoRoot = path.join(__dirname, '..');
const configDir = path.join(repoRoot, 'transformation-config');
const distDir = path.join(repoRoot, 'dist');
const skillsDir = path.join(distDir, 'skills');
const skillsSourceDir = path.join(configDir, 'skills');
const basicsDir = path.join(repoRoot, 'basics');
const promptsDir = path.join(repoRoot, 'llm-prompts');
const SKILLS_ZIP_PATH = path.join(distDir, 'skills-mcp-resources.zip');

const localSkillsUrl = `http://localhost:${PORT}/skills`;
const buildEnv = { ...process.env, SKILLS_BASE_URL: localSkillsUrl, BUILD_VERSION };

// ─── State ──────────────────────────────────────────────────────────────────

let indexes = { groupRoots: [], examplePathIndex: new Map() };
let knownSkills = [];
let docContents = {};

const pendingIds = new Set();
let needsIndexRebuild = false;
let isBuilding = false;

// ─── Build orchestration ────────────────────────────────────────────────────

function runFullBuildSubprocess() {
    return new Promise((resolve, reject) => {
        const buildProcess = spawn('npm', ['run', 'build'], {
            stdio: 'inherit',
            cwd: repoRoot,
            env: buildEnv,
            shell: true,
        });
        buildProcess.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`build exited with code ${code}`));
        });
    });
}

function refreshIndexesAndState() {
    const { skills } = loadAndExpandSkills({ configDir });
    indexes = buildIndexes({ skills, configDir });
    return skills;
}

async function runPartialRebuild(ids) {
    const t0 = Date.now();
    const { allSkills } = await partialRebuild({
        ids,
        repoRoot,
        configDir,
        distDir,
        promptsDir,
        version: BUILD_VERSION,
        docContents,
        log: msg => console.log(msg),
    });
    knownSkills = allSkills;
    const ms = Date.now() - t0;
    console.log(`✅ Rebuilt ${ids.length} skill(s): ${ids.join(', ')} (${ms}ms)\n`);
}

async function drainQueue() {
    if (isBuilding) return;
    if (pendingIds.size === 0 && !needsIndexRebuild) return;

    isBuilding = true;
    try {
        while (pendingIds.size > 0 || needsIndexRebuild) {
            // Snapshot and clear before doing work; new events accumulate concurrently.
            const indexRebuildRequested = needsIndexRebuild;
            const idsThisRun = new Set(pendingIds);
            pendingIds.clear();
            needsIndexRebuild = false;

            if (FORCE_FULL_REBUILD) {
                console.log('🔨 Full rebuild (FORCE_FULL_REBUILD=1)...');
                await runFullBuildSubprocess();
                const skills = refreshIndexesAndState();
                knownSkills = skills.map(s => ({ id: s.id }));
                docContents = loadDocContentsFromManifest(path.join(skillsDir, 'manifest.json'));
                continue;
            }

            if (indexRebuildRequested) {
                const newSkills = refreshIndexesAndState();
                const { added, removed } = diffSkillIds(knownSkills, newSkills);

                if (removed.length > 0) {
                    console.log(`↪ removed variants: ${removed.join(', ')}`);
                }
                for (const id of added) idsThisRun.add(id);
                // Existing variants whose group config changed still need a rebuild
                // — the original routeChange call added them to pendingIds.

                // Update knownSkills now so subsequent events route correctly
                knownSkills = newSkills.map(s => ({ id: s.id, _group: s._group, _examplePaths: s._examplePaths }));

                // If only a removal happened with no other changes, the reconcile step
                // below still needs to fire — feed it through partialRebuild with empty ids
                // which will skip generation but still reconcile and rewrite the manifest.
                if (idsThisRun.size === 0 && removed.length > 0) {
                    await runPartialRebuild([]);
                    continue;
                }
            }

            if (idsThisRun.size === 0) continue;

            const ids = [...idsThisRun];
            console.log(`🔨 Rebuilding ${ids.length} skill(s): ${ids.join(', ')}...`);
            try {
                await runPartialRebuild(ids);
            } catch (err) {
                console.error(`❌ Rebuild failed: ${err.message}\n`);
            }
        }
    } finally {
        isBuilding = false;
    }
}

// ─── Watcher ────────────────────────────────────────────────────────────────

function relativeToRepo(absPath) {
    return path.relative(repoRoot, absPath) || absPath;
}

function handleEvent(event, absPath) {
    const decision = routeChange({
        event,
        absPath,
        indexes,
        paths: { repoRoot, skillsDir: skillsSourceDir, basicsDir },
    });

    if (!decision) {
        console.log(`↪ no skill group owns ${relativeToRepo(absPath)}, skipping`);
        return;
    }

    if (decision.needsIndexRebuild) needsIndexRebuild = true;
    for (const id of decision.ids) pendingIds.add(id);

    console.log(`📝 ${event}: ${relativeToRepo(absPath)} → queued ${decision.ids.length} skill(s)${decision.needsIndexRebuild ? ' (index rebuild)' : ''}`);
    drainQueue();
}

function setupWatcher() {
    console.log('\n👀 Watching for changes:');
    console.log(`   📁 ${path.relative(repoRoot, skillsSourceDir)}`);
    console.log(`   📁 ${path.relative(repoRoot, basicsDir)}`);

    const watcher = chokidar.watch([skillsSourceDir, basicsDir], {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        awaitWriteFinish: { stabilityThreshold: 75, pollInterval: 25 },
        ignored: (p) => p.includes(`${path.sep}node_modules${path.sep}`) || p.includes(`${path.sep}.git${path.sep}`),
    });

    watcher.on('all', handleEvent);
    watcher.on('error', err => console.error(`Watcher error: ${err.message}`));
}

// ─── HTTP server ────────────────────────────────────────────────────────────

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
        'Expires': '0',
    });

    fileStream.pipe(res);
    console.log(`📦 Served ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
}

function createServer() {
    const server = http.createServer((req, res) => {
        const skillMatch = req.url?.match(/^\/skills\/(.+\.zip)$/);
        if (skillMatch) {
            const skillFile = skillMatch[1];
            serveZip(res, path.join(skillsDir, skillFile), skillFile);
            return;
        }

        if (req.url === '/skill-menu.json') {
            const menuPath = path.join(skillsDir, 'skill-menu.json');
            if (!fs.existsSync(menuPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('skill-menu.json not found. Run build first.');
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            });
            res.end(fs.readFileSync(menuPath, 'utf8'));
            console.log('📋 Served skill-menu.json');
            return;
        }

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
        console.log(`📍 Skills menu:     http://localhost:${PORT}/skill-menu.json`);
    });
}

// ─── Entry ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('🎯 PostHog MCP Skills Development Server');
    console.log('=========================================');
    if (FORCE_FULL_REBUILD) {
        console.log('⚠️  FORCE_FULL_REBUILD=1 — every change triggers `npm run build`');
    }

    console.log('\n🔄 Initial full build with local URLs...');
    await runFullBuildSubprocess();

    const skills = refreshIndexesAndState();
    knownSkills = skills.map(s => ({ id: s.id, _group: s._group, _examplePaths: s._examplePaths }));
    docContents = loadDocContentsFromManifest(path.join(skillsDir, 'manifest.json'));

    // Catch up on any orphan ZIPs left from prior runs.
    const removed = reconcileOrphans({ allSkills: knownSkills, distDir, log: msg => console.log(msg) });
    if (removed.length > 0) {
        console.log(`🗑  Reconciled ${removed.length} orphan ZIP(s) from prior runs\n`);
    }

    createServer();
    setupWatcher();

    console.log('\n✨ Ready for development!');
    console.log('   Press Ctrl+C to stop\n');
}

process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down dev server...');
    process.exit(0);
});

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
