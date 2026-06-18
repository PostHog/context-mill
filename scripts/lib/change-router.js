/**
 * Change router — pure path → skill IDs mapping for the dev server.
 *
 * Given a chokidar event and an absolute path, decide which skill IDs need
 * rebuilding (and whether the in-memory skill index needs a full refresh
 * because a config.yaml changed or a directory was added/removed).
 */

import path from 'path';

/**
 * True if `absPath` is `parent` itself or lives underneath it.
 */
function isUnder(absPath, parent) {
    return absPath === parent || absPath.startsWith(parent + path.sep);
}

/**
 * Build the two indexes the router consults:
 *
 *   - groupRoots: one entry per unique `skill._group`, with the absolute path
 *     to the group's source directory and the variant IDs that live under it.
 *     Sorted by `absPath.length` DESC so the deepest matching group wins.
 *   - examplePathIndex: reverse index { examplePath → skillId[] } keyed by the
 *     POSIX paths that appear in `skill._examplePaths` (e.g. "example-apps/django").
 */
function buildIndexes({ skills, configDir }) {
    const groupsByKey = new Map();
    const examplePathIndex = new Map();

    for (const skill of skills) {
        const compositeKey = skill._group;
        if (!groupsByKey.has(compositeKey)) {
            const absPath = path.join(configDir, 'skills', ...compositeKey.split('/'));
            groupsByKey.set(compositeKey, {
                absPath,
                compositeKey,
                variantIds: [],
            });
        }
        groupsByKey.get(compositeKey).variantIds.push(skill.id);

        for (const examplePath of (skill._examplePaths || [])) {
            if (!examplePathIndex.has(examplePath)) {
                examplePathIndex.set(examplePath, []);
            }
            const arr = examplePathIndex.get(examplePath);
            if (!arr.includes(skill.id)) arr.push(skill.id);
        }
    }

    const groupRoots = [...groupsByKey.values()].sort(
        (a, b) => b.absPath.length - a.absPath.length,
    );

    return { groupRoots, examplePathIndex };
}

/**
 * First group whose absPath contains `absPath`. Because groupRoots is sorted
 * longest-first, this resolves to the deepest matching (nested) group.
 */
function findNearestGroup(absPath, groupRoots) {
    for (const root of groupRoots) {
        if (isUnder(absPath, root.absPath)) return root;
    }
    return null;
}

/**
 * Skill IDs whose `_examplePaths` cover `relPathPosix` — either an exact
 * match or a directory prefix match (`relPathPosix.startsWith(key + '/')`).
 */
function findExamplesMatching(relPathPosix, examplePathIndex) {
    const ids = new Set();
    for (const [key, skillIds] of examplePathIndex) {
        if (relPathPosix === key || relPathPosix.startsWith(key + '/')) {
            for (const id of skillIds) ids.add(id);
        }
    }
    return [...ids];
}

/**
 * Route a chokidar event to skill IDs.
 *
 * Returns either:
 *   - null              — path is out of scope
 *   - { ids: string[], needsIndexRebuild?: boolean }
 *
 * The router never does I/O. Callers handle the actual rebuild and index
 * refresh.
 */
function routeChange({ event, absPath, indexes, paths }) {
    const { groupRoots, examplePathIndex } = indexes;
    const { repoRoot, skillsDir, exampleAppsDir } = paths;

    if (isUnder(absPath, skillsDir)) {
        const isDirEvent = event === 'addDir' || event === 'unlinkDir';
        const isConfigEvent = path.basename(absPath) === 'config.yaml';

        if (isConfigEvent || isDirEvent) {
            const group = findNearestGroup(absPath, groupRoots);
            return {
                ids: group?.variantIds ?? [],
                needsIndexRebuild: true,
            };
        }

        const group = findNearestGroup(absPath, groupRoots);
        if (group) return { ids: group.variantIds };
        return null;
    }

    if (isUnder(absPath, exampleAppsDir)) {
        const relPosix = path.relative(repoRoot, absPath).split(path.sep).join('/');
        const ids = findExamplesMatching(relPosix, examplePathIndex);
        if (ids.length === 0) return null;
        return { ids };
    }

    return null;
}

/**
 * Compare two skill lists by ID. Returns { added, removed, kept } string arrays.
 */
function diffSkillIds(oldSkills, newSkills) {
    const oldIds = new Set(oldSkills.map(s => s.id));
    const newIds = new Set(newSkills.map(s => s.id));
    const added = [];
    const removed = [];
    const kept = [];
    for (const id of newIds) {
        if (oldIds.has(id)) kept.push(id);
        else added.push(id);
    }
    for (const id of oldIds) {
        if (!newIds.has(id)) removed.push(id);
    }
    return { added, removed, kept };
}

export {
    buildIndexes,
    routeChange,
    findNearestGroup,
    findExamplesMatching,
    diffSkillIds,
};
