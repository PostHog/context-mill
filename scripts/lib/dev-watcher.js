/**
 * Dev watcher — keeps dist/skills current while skill sources change.
 *
 * Watches context/skills/, context/shared/ and example-apps/. A change rebuilds
 * only the skills that own the path, or every skill for a change under
 * context/shared/, since any skill may include a partial. manifest.json and
 * skill-menu.json are rewritten from the in-memory skill list. With `fullBuild`,
 * every change runs it instead of a partial rebuild.
 */

import path from 'path';
import chokidar from 'chokidar';

import { loadAndExpandSkills } from './skill-generator.js';
import {
    partialRebuild,
    loadDocContentsFromManifest,
    reconcileOrphans,
} from './build-phases.js';
import {
    buildIndexes,
    routeChange,
    diffSkillIds,
} from './change-router.js';

function toKnownSkill(skill) {
    return { id: skill.id, _group: skill._group, _examplePaths: skill._examplePaths };
}

async function watchSkillSources({
    repoRoot,
    distDir,
    version,
    fullBuild = null,
    log = console.log,
    logError = console.error,
}) {
    const configDir = path.join(repoRoot, 'context');
    const manifestPath = path.join(distDir, 'skills', 'manifest.json');
    const paths = {
        repoRoot,
        skillsDir: path.join(configDir, 'skills'),
        sharedDir: path.join(configDir, 'shared'),
        exampleAppsDir: path.join(repoRoot, 'example-apps'),
    };
    const dirs = [paths.skillsDir, paths.sharedDir, paths.exampleAppsDir];

    let indexes = { groupRoots: [], examplePathIndex: new Map() };
    let knownSkills = [];
    let docContents = {};
    const pendingIds = new Set();
    let needsIndexRebuild = false;
    let isBuilding = false;

    function refreshIndexes() {
        const { skills } = loadAndExpandSkills({ configDir });
        indexes = buildIndexes({ skills, configDir });
        return skills;
    }

    function loadState() {
        knownSkills = refreshIndexes().map(toKnownSkill);
        docContents = loadDocContentsFromManifest(manifestPath);
    }

    async function runPartialRebuild(ids) {
        const start = Date.now();
        const { allSkills } = await partialRebuild({
            ids,
            repoRoot,
            configDir,
            distDir,
            version,
            docContents,
            log,
        });
        knownSkills = allSkills.map(s => ({ id: s.id }));
        const ms = Date.now() - start;
        log(`✅ Rebuilt ${ids.length} skill(s): ${ids.join(', ')} (${ms}ms)\n`);
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

                if (fullBuild) {
                    try {
                        await fullBuild();
                    } catch (err) {
                        logError(`❌ Full rebuild failed: ${err.message}\n`);
                        continue;
                    }
                    loadState();
                    continue;
                }

                if (indexRebuildRequested) {
                    const newSkills = refreshIndexes();
                    const { added, removed } = diffSkillIds(knownSkills, newSkills);
                    if (removed.length > 0) {
                        log(`↪ removed variants: ${removed.join(', ')}`);
                    }
                    for (const id of added) idsThisRun.add(id);
                    knownSkills = newSkills.map(toKnownSkill);

                    // Pure removal — still rewrite manifest + reconcile orphans.
                    if (idsThisRun.size === 0 && removed.length > 0) {
                        try {
                            await runPartialRebuild([]);
                        } catch (err) {
                            logError(`❌ Rebuild failed: ${err.message}\n`);
                        }
                        continue;
                    }
                }

                if (idsThisRun.size === 0) continue;

                const ids = [...idsThisRun];
                log(`🔨 Rebuilding ${ids.length} skill(s): ${ids.join(', ')}...`);
                try {
                    await runPartialRebuild(ids);
                } catch (err) {
                    logError(`❌ Rebuild failed: ${err.message}\n`);
                }
            }
        } finally {
            isBuilding = false;
        }
    }

    function handleEvent(event, absPath) {
        const decision = routeChange({ event, absPath, indexes, paths });
        const relPath = path.relative(repoRoot, absPath);

        if (!decision) {
            log(`↪ no skill group owns ${relPath}, skipping`);
            return;
        }

        for (const id of decision.ids) pendingIds.add(id);
        if (decision.needsIndexRebuild) needsIndexRebuild = true;

        const suffix = decision.needsIndexRebuild ? ' (index rebuild)' : '';
        log(`📝 ${event}: ${relPath} → queued ${decision.ids.length} skill(s)${suffix}`);

        drainQueue().catch(err => logError(`❌ Drain failed: ${err.message}`));
    }

    loadState();

    const removed = reconcileOrphans({ allSkills: knownSkills, distDir, log });
    if (removed.length > 0) {
        log(`🗑  Reconciled ${removed.length} orphan ZIP(s) from prior runs`);
    }

    const sep = path.sep;
    const watcher = chokidar.watch(dirs, {
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        awaitWriteFinish: { stabilityThreshold: 75, pollInterval: 25 },
        ignored: (p) => p.includes(`${sep}node_modules${sep}`) || p.includes(`${sep}.git${sep}`),
    });
    watcher.on('all', handleEvent);
    watcher.on('error', err => logError(`Watcher error: ${err.message}`));
    await new Promise(resolve => watcher.once('ready', resolve));

    return {
        dirs,
        close: () => watcher.close(),
    };
}

export { watchSkillSources };
