#!/usr/bin/env node

/**
 * Development server for MCP resources
 *
 * Runs one full build at startup, then watches context/skills/
 * and example-apps/ for changes. A file edit triggers an incremental rebuild of
 * only the skills that own the path; manifest.json and skill-menu.json are
 * regenerated from the in-memory skill list. The bundled
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
import chokidar from 'chokidar';

import { loadAndExpandSkills } from './lib/skill-generator.js';
import { buildAgents } from './lib/agent-generator.js';
import {
    partialRebuild,
    loadDocContentsFromManifest,
    reconcileOrphans,
} from './lib/build-phases.js';
import {
    buildIndexes,
    routeChange,
    diffSkillIds,
} from './lib/change-router.js';

const PORT = process.env.PORT || 8765;
const FORCE_FULL_REBUILD = process.env.FORCE_FULL_REBUILD === '1';
const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';

const repoRoot = path.join(import.meta.dirname, '..');
const configDir = path.join(repoRoot, 'context');
const distDir = path.join(repoRoot, 'dist');
const skillsDir = path.join(distDir, 'skills');
const skillsSourceDir = path.join(configDir, 'skills');
const agentsSourceDir = path.join(configDir, 'agents');
const agentsDir = path.join(distDir, 'agents');
const exampleAppsDir = path.join(repoRoot, 'example-apps');

const localSkillsUrl = `http://localhost:${PORT}/skills`;
// Agent prompts are flat release assets, so they hang off the root here too —
// the same level as agent-menu.json — mirroring the published layout.
const localAgentsUrl = `http://localhost:${PORT}`;

// `generateManifest` reads SKILLS_BASE_URL from process.env, and the agent build
// reads AGENTS_BASE_URL. Partial rebuilds run in this process, so set both here —
// the build subprocess inherits them.
process.env.SKILLS_BASE_URL = localSkillsUrl;
process.env.AGENTS_BASE_URL = localAgentsUrl;

// --- state ---

let indexes = { groupRoots: [], examplePathIndex: new Map() };
let knownSkills = [];
let docContents = {};

const pendingIds = new Set();
let needsIndexRebuild = false;
let isBuilding = false;

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

function refreshIndexesAndState() {
    const { skills } = loadAndExpandSkills({ configDir });
    indexes = buildIndexes({ skills, configDir });
    return skills;
}

async function runPartialRebuild(ids) {
    const start = Date.now();
    const { allSkills } = await partialRebuild({
        ids,
        repoRoot,
        configDir,
        distDir,
        version: BUILD_VERSION,
        docContents,
        log: console.log,
    });
    knownSkills = allSkills.map(s => ({ id: s.id }));
    const ms = Date.now() - start;
    console.log(`✅ Rebuilt ${ids.length} skill(s): ${ids.join(', ')} (${ms}ms)\n`);
}

async function drainQueue() {
    if (isBuilding) return;
    if (pendingIds.size === 0 && !needsIndexRebuild) return;

    isBuilding = true;
    try {
        while (pendingIds.size > 0 || needsIndexRebuild) {
            const indexRebuildRequested = needsIndexRebuild;
            const idsThisRun = new Set(pendingIds);
            pendingIds.clear();
            needsIndexRebuild = false;

            if (FORCE_FULL_REBUILD) {
                try {
                    await runFullBuildSubprocess();
                } catch (err) {
                    console.error(`❌ Full rebuild failed: ${err.message}\n`);
                    continue;
                }
                const skills = refreshIndexesAndState();
                knownSkills = skills.map(s => ({
                    id: s.id,
                    _group: s._group,
                    _examplePaths: s._examplePaths,
                }));
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
                knownSkills = newSkills.map(s => ({
                    id: s.id,
                    _group: s._group,
                    _examplePaths: s._examplePaths,
                }));

                // Pure removal — still rewrite manifest + reconcile orphans.
                if (idsThisRun.size === 0 && removed.length > 0) {
                    try {
                        await runPartialRebuild([]);
                    } catch (err) {
                        console.error(`❌ Rebuild failed: ${err.message}\n`);
                    }
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

// --- watcher ---

function handleEvent(event, absPath) {
    // Agent prompts are decoupled from the skill incremental machinery. A change
    // under context/agents/ just re-copies them wholesale — cheap.
    if (absPath.startsWith(agentsSourceDir)) {
        try {
            const { count } = buildAgents({
                configDir,
                distDir,
                baseUrl: localAgentsUrl,
                version: BUILD_VERSION,
            });
            console.log(
                `📝 ${event}: ${path.relative(repoRoot, absPath)} → rebuilt ${count} agent prompt(s)`,
            );
        } catch (err) {
            console.error(`❌ Agent rebuild failed: ${err.message}`);
        }
        return;
    }

    const decision = routeChange({
        event,
        absPath,
        indexes,
        paths: { repoRoot, skillsDir: skillsSourceDir, exampleAppsDir },
    });

    const relPath = path.relative(repoRoot, absPath);

    if (!decision) {
        console.log(`↪ no skill group owns ${relPath}, skipping`);
        return;
    }

    for (const id of decision.ids) pendingIds.add(id);
    if (decision.needsIndexRebuild) needsIndexRebuild = true;

    const suffix = decision.needsIndexRebuild ? ' (index rebuild)' : '';
    console.log(`📝 ${event}: ${relPath} → queued ${decision.ids.length} skill(s)${suffix}`);

    drainQueue().catch(err => console.error(`❌ Drain failed: ${err.message}`));
}

function setupWatcher() {
    const sep = path.sep;
    const watcher = chokidar.watch([skillsSourceDir, agentsSourceDir, exampleAppsDir], {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        awaitWriteFinish: { stabilityThreshold: 75, pollInterval: 25 },
        ignored: (p) => p.includes(`${sep}node_modules${sep}`) || p.includes(`${sep}.git${sep}`),
    });
    watcher.on('all', handleEvent);
    watcher.on('error', err => console.error(`Watcher error: ${err.message}`));

    console.log('\n👀 Watching:');
    console.log(`   📁 ${path.relative(repoRoot, skillsSourceDir)}`);
    console.log(`   📁 ${path.relative(repoRoot, agentsSourceDir)}`);
    console.log(`   📁 ${path.relative(repoRoot, exampleAppsDir)}`);

    return watcher;
}

// --- HTTP server ---

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

function serveFile(res, filePath, contentType, attachmentName = null) {
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...NO_CACHE_HEADERS });
        res.end(`Not found: ${path.basename(filePath)}. Run build first.`);
        return;
    }

    const stat = fs.statSync(filePath);
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
        const skillMatch = req.url?.match(/^\/skills\/(.+\.zip)$/);
        if (skillMatch) {
            const skillFile = skillMatch[1];
            serveFile(res, path.join(skillsDir, skillFile), 'application/zip', skillFile);
            return;
        }

        if (req.url === '/skill-menu.json') {
            serveFile(res, path.join(skillsDir, 'skill-menu.json'), 'application/json');
            return;
        }

        if (req.url === '/agent-menu.json') {
            serveFile(res, path.join(agentsDir, 'agent-menu.json'), 'application/json');
            return;
        }

        const agentMatch = req.url?.match(/^\/(agent-[\w-]+\.md)$/);
        if (agentMatch) {
            serveFile(res, path.join(agentsDir, agentMatch[1]), 'text/markdown; charset=utf-8');
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
        res.end('Not found. Available endpoints:\n  /skill-menu.json\n  /skills-mcp-resources.zip\n  /skills/{id}.zip\n  /agent-menu.json\n  /agent-{flow}-{type}.md');
    });

    server.listen(PORT, () => {
        console.log('\n🚀 Development server started!');
        console.log(`\n📍 Skills bundle:   http://localhost:${PORT}/skills-mcp-resources.zip`);
        console.log(`📍 Individual skill: http://localhost:${PORT}/skills/{id}.zip`);
        console.log(`📋 Skills menu:      http://localhost:${PORT}/skill-menu.json`);
        console.log(`🤖 Agent prompt:     http://localhost:${PORT}/agent-{flow}-{type}.md`);
        console.log(`📋 Agents menu:      http://localhost:${PORT}/agent-menu.json`);
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

    const skills = refreshIndexesAndState();
    knownSkills = skills.map(s => ({
        id: s.id,
        _group: s._group,
        _examplePaths: s._examplePaths,
    }));
    docContents = loadDocContentsFromManifest(path.join(skillsDir, 'manifest.json'));

    const removed = reconcileOrphans({
        allSkills: knownSkills,
        distDir,
        log: console.log,
    });
    if (removed.length > 0) {
        console.log(`🗑  Reconciled ${removed.length} orphan ZIP(s) from prior runs`);
    }

    const server = createServer();
    const watcher = setupWatcher();

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
