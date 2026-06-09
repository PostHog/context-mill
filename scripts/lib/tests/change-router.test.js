import { describe, it, expect } from 'vitest';
import path from 'path';

import {
    buildIndexes,
    routeChange,
    findNearestGroup,
    findExamplesMatching,
    diffSkillIds,
} from '../change-router.js';

const REPO_ROOT = path.join(path.sep, 'repo');
const CONFIG_DIR = path.join(REPO_ROOT, 'transformation-config');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const BASICS_DIR = path.join(REPO_ROOT, 'basics');
const PATHS = { repoRoot: REPO_ROOT, skillsDir: SKILLS_DIR, basicsDir: BASICS_DIR };

function skill({ id, group, examplePaths = [] }) {
    return { id, _group: group, _examplePaths: examplePaths };
}

describe('buildIndexes', () => {
    it('produces groupRoots sorted longest-first so nested groups win', () => {
        const skills = [
            skill({ id: 'audit', group: 'audit' }),
            skill({ id: 'audit-subagents-dispatch', group: 'audit/subagents/dispatch' }),
            skill({ id: 'error-tracking-web', group: 'error-tracking' }),
        ];
        const { groupRoots } = buildIndexes({ skills, configDir: CONFIG_DIR });

        const lens = groupRoots.map(g => g.absPath.length);
        for (let i = 1; i < lens.length; i++) {
            expect(lens[i]).toBeLessThanOrEqual(lens[i - 1]);
        }
        expect(groupRoots[0].compositeKey).toBe('audit/subagents/dispatch');
    });

    it('collects every variant ID per group', () => {
        const skills = [
            skill({ id: 'error-tracking-web', group: 'error-tracking' }),
            skill({ id: 'error-tracking-django', group: 'error-tracking' }),
            skill({ id: 'audit', group: 'audit' }),
        ];
        const { groupRoots } = buildIndexes({ skills, configDir: CONFIG_DIR });

        const et = groupRoots.find(g => g.compositeKey === 'error-tracking');
        expect(et.variantIds.sort()).toEqual(['error-tracking-django', 'error-tracking-web']);
    });

    it('reverse-indexes shared basics dirs to multiple skills', () => {
        const skills = [
            skill({ id: 'instrument-product-analytics-next-app', group: 'omnibus/instrument-product-analytics', examplePaths: ['basics/next-app-router'] }),
            skill({ id: 'feature-flags-next-app', group: 'feature-flags', examplePaths: ['basics/next-app-router'] }),
        ];
        const { examplePathIndex } = buildIndexes({ skills, configDir: CONFIG_DIR });

        expect(examplePathIndex.get('basics/next-app-router').sort()).toEqual([
            'feature-flags-next-app',
            'instrument-product-analytics-next-app',
        ]);
    });
});

describe('routeChange — skills dir', () => {
    const skills = [
        skill({ id: 'audit', group: 'audit' }),
        skill({ id: 'audit-subagents-dispatch', group: 'audit/subagents/dispatch' }),
        skill({ id: 'error-tracking-web', group: 'error-tracking', examplePaths: ['basics/web'] }),
    ];
    const indexes = buildIndexes({ skills, configDir: CONFIG_DIR });

    it('routes a reference edit to the owning group', () => {
        const abs = path.join(SKILLS_DIR, 'audit', 'references', 'overview.md');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toEqual({ ids: ['audit'] });
    });

    it('disambiguates subagent vs. parent group (longest-first wins)', () => {
        const abs = path.join(SKILLS_DIR, 'audit', 'subagents', 'dispatch', 'description.md');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toEqual({ ids: ['audit-subagents-dispatch'] });
    });

    it('config.yaml change flags an index rebuild', () => {
        const abs = path.join(SKILLS_DIR, 'audit', 'config.yaml');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toEqual({ ids: ['audit'], needsIndexRebuild: true });
    });

    it('config.yaml add (new group) returns empty ids + index rebuild', () => {
        const abs = path.join(SKILLS_DIR, 'brand-new', 'config.yaml');
        const decision = routeChange({ event: 'add', absPath: abs, indexes, paths: PATHS });
        expect(decision).toEqual({ ids: [], needsIndexRebuild: true });
    });

    it('unlinkDir flags an index rebuild', () => {
        const abs = path.join(SKILLS_DIR, 'audit');
        const decision = routeChange({ event: 'unlinkDir', absPath: abs, indexes, paths: PATHS });
        expect(decision?.needsIndexRebuild).toBe(true);
    });

    it('returns null for unknown non-config paths inside skills/', () => {
        const abs = path.join(SKILLS_DIR, 'never-existed', 'description.md');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toBeNull();
    });
});

describe('routeChange — basics dir', () => {
    const skills = [
        skill({ id: 'instrument-product-analytics-next-app', group: 'omnibus/instrument-product-analytics', examplePaths: ['basics/next-app-router'] }),
        skill({ id: 'feature-flags-next-app', group: 'feature-flags', examplePaths: ['basics/next-app-router'] }),
        skill({ id: 'error-tracking-django', group: 'error-tracking', examplePaths: ['basics/django'] }),
    ];
    const indexes = buildIndexes({ skills, configDir: CONFIG_DIR });

    it('fans out to every skill sharing a basics dir', () => {
        const abs = path.join(BASICS_DIR, 'next-app-router', 'app', 'page.tsx');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision.ids.sort()).toEqual([
            'feature-flags-next-app',
            'instrument-product-analytics-next-app',
        ]);
    });

    it('matches nested paths under basics/<x>/...', () => {
        const abs = path.join(BASICS_DIR, 'django', 'project', 'views.py');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toEqual({ ids: ['error-tracking-django'] });
    });

    it('returns null for orphan basics dirs (no consumers)', () => {
        const abs = path.join(BASICS_DIR, 'unused-fixture', 'main.go');
        const decision = routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS });
        expect(decision).toBeNull();
    });
});

describe('routeChange — out-of-scope paths', () => {
    const skills = [skill({ id: 'audit', group: 'audit' })];
    const indexes = buildIndexes({ skills, configDir: CONFIG_DIR });

    it('returns null for top-level transformation-config yaml edits', () => {
        const abs = path.join(CONFIG_DIR, 'commandments.yaml');
        expect(routeChange({ event: 'change', absPath: abs, indexes, paths: PATHS })).toBeNull();
    });
});

describe('findNearestGroup', () => {
    it('returns null when no group contains the path', () => {
        const { groupRoots } = buildIndexes({
            skills: [skill({ id: 'audit', group: 'audit' })],
            configDir: CONFIG_DIR,
        });
        expect(findNearestGroup(path.join(REPO_ROOT, 'somewhere-else'), groupRoots)).toBeNull();
    });
});

describe('findExamplesMatching', () => {
    it('matches exact path and directory prefix', () => {
        const index = new Map([
            ['basics/django', ['a', 'b']],
            ['basics/django-rest', ['c']],
        ]);
        expect(findExamplesMatching('basics/django', index).sort()).toEqual(['a', 'b']);
        expect(findExamplesMatching('basics/django/views.py', index).sort()).toEqual(['a', 'b']);
        expect(findExamplesMatching('basics/django-rest/api.py', index)).toEqual(['c']);
        expect(findExamplesMatching('basics/django-other', index)).toEqual([]);
    });
});

describe('diffSkillIds', () => {
    it('returns added / removed / kept arrays', () => {
        const before = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const after = [{ id: 'b' }, { id: 'c' }, { id: 'd' }];
        const { added, removed, kept } = diffSkillIds(before, after);
        expect(added).toEqual(['d']);
        expect(removed).toEqual(['a']);
        expect(kept.sort()).toEqual(['b', 'c']);
    });
});
