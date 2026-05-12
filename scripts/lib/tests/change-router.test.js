import { describe, it, expect } from 'vitest';
import { join, sep } from 'path';

const { buildIndexes, routeChange, diffSkillIds } = require('../change-router.js');

const REPO_ROOT = sep === '/' ? '/repo' : 'C:\\repo';
const CONFIG_DIR = join(REPO_ROOT, 'transformation-config');
const SKILLS_DIR = join(CONFIG_DIR, 'skills');
const BASICS_DIR = join(REPO_ROOT, 'basics');

const PATHS = { repoRoot: REPO_ROOT, skillsDir: SKILLS_DIR, basicsDir: BASICS_DIR };

function makeSkill({ id, group, examplePaths = [] }) {
    return { id, _group: group, _examplePaths: examplePaths };
}

describe('buildIndexes', () => {
    it('sorts groupRoots longest-first so subagent paths beat parent paths', () => {
        const skills = [
            makeSkill({ id: 'audit', group: 'audit' }),
            makeSkill({ id: 'audit-subagents-dispatch', group: 'audit/subagents/dispatch' }),
        ];
        const { groupRoots } = buildIndexes({ skills, configDir: CONFIG_DIR });
        expect(groupRoots[0].compositeKey).toBe('audit/subagents/dispatch');
        expect(groupRoots[1].compositeKey).toBe('audit');
    });

    it('collects all variants for a group', () => {
        const skills = [
            makeSkill({ id: 'integration-django', group: 'integration' }),
            makeSkill({ id: 'integration-flask', group: 'integration' }),
        ];
        const { groupRoots } = buildIndexes({ skills, configDir: CONFIG_DIR });
        expect(groupRoots).toHaveLength(1);
        expect(groupRoots[0].variantIds.sort()).toEqual(['integration-django', 'integration-flask']);
    });

    it('builds a reverse index from example path to skill IDs', () => {
        const skills = [
            makeSkill({ id: 'integration-django', group: 'integration', examplePaths: ['basics/django'] }),
            makeSkill({ id: 'integration-flask', group: 'integration', examplePaths: ['basics/flask'] }),
            makeSkill({ id: 'omnibus-django', group: 'omnibus', examplePaths: ['basics/django'] }),
        ];
        const { examplePathIndex } = buildIndexes({ skills, configDir: CONFIG_DIR });
        expect(examplePathIndex.get('basics/django').sort()).toEqual(['integration-django', 'omnibus-django']);
        expect(examplePathIndex.get('basics/flask')).toEqual(['integration-flask']);
    });
});

describe('routeChange — skills directory', () => {
    const skills = [
        makeSkill({ id: 'audit', group: 'audit' }),
        makeSkill({ id: 'audit-subagents-dispatch', group: 'audit/subagents/dispatch' }),
        makeSkill({ id: 'audit-subagents-event-capture', group: 'audit/subagents/event-capture' }),
        makeSkill({ id: 'integration-django', group: 'integration', examplePaths: ['basics/django'] }),
    ];
    const indexes = buildIndexes({ skills, configDir: CONFIG_DIR });

    it('routes a reference edit to the containing group', () => {
        const absPath = join(SKILLS_DIR, 'audit', 'references', '3-identification.md');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toEqual({ ids: ['audit'] });
    });

    it('routes a subagent edit to the subagent group, not the parent', () => {
        const absPath = join(SKILLS_DIR, 'audit', 'subagents', 'dispatch', 'description.md');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toEqual({ ids: ['audit-subagents-dispatch'] });
    });

    it('flags index rebuild on config.yaml change', () => {
        const absPath = join(SKILLS_DIR, 'audit', 'config.yaml');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toEqual({ ids: ['audit'], needsIndexRebuild: true });
    });

    it('flags index rebuild for an added config.yaml of an unknown new group', () => {
        const absPath = join(SKILLS_DIR, 'brand-new-group', 'config.yaml');
        const result = routeChange({ event: 'add', absPath, indexes, paths: PATHS });
        expect(result).toEqual({ ids: [], needsIndexRebuild: true });
    });

    it('flags index rebuild on unlinkDir of a group', () => {
        const absPath = join(SKILLS_DIR, 'audit', 'subagents', 'dispatch');
        const result = routeChange({ event: 'unlinkDir', absPath, indexes, paths: PATHS });
        expect(result).toEqual({ ids: ['audit-subagents-dispatch'], needsIndexRebuild: true });
    });

    it('returns null for a non-config file outside any known group', () => {
        const absPath = join(SKILLS_DIR, 'totally-unknown', 'description.md');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toBeNull();
    });
});

describe('routeChange — basics directory', () => {
    const skills = [
        makeSkill({ id: 'integration-django', group: 'integration', examplePaths: ['basics/django'] }),
        makeSkill({ id: 'omnibus-django', group: 'omnibus', examplePaths: ['basics/django'] }),
        makeSkill({ id: 'integration-flask', group: 'integration', examplePaths: ['basics/flask'] }),
    ];
    const indexes = buildIndexes({ skills, configDir: CONFIG_DIR });

    it('routes a basics edit to every variant referencing that dir', () => {
        const absPath = join(BASICS_DIR, 'django', 'views.py');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result.ids.sort()).toEqual(['integration-django', 'omnibus-django']);
        expect(result.needsIndexRebuild).toBeUndefined();
    });

    it('routes a nested basics edit correctly', () => {
        const absPath = join(BASICS_DIR, 'flask', 'app', 'routes', 'home.py');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result.ids).toEqual(['integration-flask']);
    });

    it('returns null for a basics dir not referenced by any skill', () => {
        const absPath = join(BASICS_DIR, 'orphan-example', 'main.py');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toBeNull();
    });
});

describe('routeChange — out-of-scope paths', () => {
    const indexes = buildIndexes({ skills: [], configDir: CONFIG_DIR });

    it('returns null for llm-prompts', () => {
        const absPath = join(REPO_ROOT, 'llm-prompts', 'audit', '3.0-foo.md');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toBeNull();
    });

    it('returns null for top-level transformation-config yaml', () => {
        const absPath = join(CONFIG_DIR, 'commandments.yaml');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toBeNull();
    });

    it('returns null for mcp-commands', () => {
        const absPath = join(REPO_ROOT, 'mcp-commands', 'foo.json');
        const result = routeChange({ event: 'change', absPath, indexes, paths: PATHS });
        expect(result).toBeNull();
    });
});

describe('diffSkillIds', () => {
    it('detects additions, removals, and kept variants', () => {
        const oldSkills = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const newSkills = [{ id: 'b' }, { id: 'c' }, { id: 'd' }];
        const { added, removed, kept } = diffSkillIds(oldSkills, newSkills);
        expect(added).toEqual(['d']);
        expect(removed).toEqual(['a']);
        expect(kept.sort()).toEqual(['b', 'c']);
    });
});
