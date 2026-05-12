/**
 * Change router — given a watcher event, return the set of skill IDs to rebuild
 * (and whether the index needs rebuilding first).
 *
 * Used by scripts/dev-server.js to translate filesystem events into incremental
 * build work. The dev server holds the two indexes this module builds and feeds
 * them back into routeChange() on every event.
 */

const path = require('path');

function isUnder(absPath, parentAbsPath) {
    return absPath === parentAbsPath || absPath.startsWith(parentAbsPath + path.sep);
}

/**
 * Build the two lookup indexes from an expanded skill list.
 *
 *  - groupRoots: [{ absPath, compositeKey, variantIds }], sorted longest-first
 *    so walk-up finds the deepest matching group (e.g. audit/subagents/dispatch
 *    wins over audit when a file under the dispatch dir changes).
 *
 *  - examplePathIndex: Map<examplePath, skillId[]>. examplePath values are
 *    forward-slash relative paths from repoRoot (e.g. "basics/django"), matching
 *    the values configs put under variant.example_paths.
 */
function buildIndexes({ skills, configDir }) {
    const byGroup = new Map();
    for (const skill of skills) {
        const key = skill._group;
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key).push(skill.id);
    }

    const groupRoots = [];
    for (const [compositeKey, variantIds] of byGroup) {
        const absPath = path.join(configDir, 'skills', ...compositeKey.split('/'));
        groupRoots.push({ absPath, compositeKey, variantIds });
    }
    groupRoots.sort((a, b) => b.absPath.length - a.absPath.length);

    const examplePathIndex = new Map();
    for (const skill of skills) {
        for (const examplePath of skill._examplePaths || []) {
            if (!examplePathIndex.has(examplePath)) {
                examplePathIndex.set(examplePath, []);
            }
            examplePathIndex.get(examplePath).push(skill.id);
        }
    }

    return { groupRoots, examplePathIndex };
}

function findNearestGroup(absPath, groupRoots) {
    for (const root of groupRoots) {
        if (isUnder(absPath, root.absPath)) return root;
    }
    return null;
}

function findExamplesMatching(relPathPosix, examplePathIndex) {
    const ids = new Set();
    for (const [examplePath, skillIds] of examplePathIndex) {
        if (relPathPosix === examplePath || relPathPosix.startsWith(examplePath + '/')) {
            for (const id of skillIds) ids.add(id);
        }
    }
    return [...ids];
}

/**
 * Route a watcher event to a rebuild decision.
 *
 * @param {object} args
 * @param {string} args.event - chokidar event: add/change/unlink/addDir/unlinkDir
 * @param {string} args.absPath - absolute path that fired the event
 * @param {object} args.indexes - { groupRoots, examplePathIndex } from buildIndexes
 * @param {object} args.paths - { repoRoot, skillsDir, basicsDir }
 *
 * @returns {object|null}
 *   - { ids: string[], needsIndexRebuild?: boolean }
 *   - null when no rebuild is warranted (cross-cutting yaml, llm-prompts, etc.)
 */
function routeChange({ event, absPath, indexes, paths }) {
    const { repoRoot, skillsDir, basicsDir } = paths;

    if (isUnder(absPath, skillsDir)) {
        const isConfigYaml = path.basename(absPath) === 'config.yaml';
        const isDirEvent = event === 'addDir' || event === 'unlinkDir';

        if (isConfigYaml || isDirEvent) {
            const group = findNearestGroup(absPath, indexes.groupRoots);
            return {
                ids: group ? group.variantIds : [],
                needsIndexRebuild: true,
            };
        }

        const group = findNearestGroup(absPath, indexes.groupRoots);
        return group ? { ids: group.variantIds } : null;
    }

    if (isUnder(absPath, basicsDir)) {
        const relPosix = path.relative(repoRoot, absPath).split(path.sep).join('/');
        const ids = findExamplesMatching(relPosix, indexes.examplePathIndex);
        return ids.length > 0 ? { ids } : null;
    }

    return null;
}

/**
 * Diff two expanded skill lists by ID.
 * Returns { added, removed, kept } sets of skill IDs.
 */
function diffSkillIds(oldSkills, newSkills) {
    const oldIds = new Set(oldSkills.map(s => s.id));
    const newIds = new Set(newSkills.map(s => s.id));
    const added = [...newIds].filter(id => !oldIds.has(id));
    const removed = [...oldIds].filter(id => !newIds.has(id));
    const kept = [...newIds].filter(id => oldIds.has(id));
    return { added, removed, kept };
}

module.exports = {
    buildIndexes,
    routeChange,
    findNearestGroup,
    findExamplesMatching,
    diffSkillIds,
};
