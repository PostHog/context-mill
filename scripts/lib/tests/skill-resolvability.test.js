import { describe, it, expect } from 'vitest';
import { absentMessage, checkSkillResolvability, missingMessage, resolveSkill } from '../skill-resolvability.js';

/** A menu entry with the tags the menu writer gives it. */
const entry = (id, tags = [], extra = {}) => ({ id, name: id, tags, ...extra });

/** A pack entry: `id` under `integration`, tagged with its match keys. */
const pack = (id, match, ...tags) =>
    entry(`integration-${id}`, [...Object.entries(match).map(([key, value]) => `${key}:${value}`), 'integration', ...tags]);

/** A step skill completed from the framework's pack. */
const step = id => entry(`integration-${id}`, ['integration-steps'], { frameworkReferences: 'integration' });

const menu = categories => ({ categories });

const check = (categories, wizard = {}) =>
    checkSkillResolvability(menu(categories), {
        frameworks: ['nextjs', 'django'],
        taskSkills: ['integration-install'],
        packFamily: 'integration',
        ...wizard,
    });

const ids = unreachable => unreachable.map(found => found.id);

describe('resolveSkill', () => {
    const entries = [
        { ...pack('next-app', { framework: 'nextjs', variant: 'app' }, 'default'), family: 'integration' },
        { ...pack('next-pages', { framework: 'nextjs', variant: 'pages' }), family: 'integration' },
        { ...pack('django', { framework: 'django' }), family: 'integration' },
    ];

    it('takes a menu id over a family, whatever the run', () => {
        expect(resolveSkill(entries, 'integration-next-pages', {}).id).toBe('integration-next-pages');
    });

    it('resolves no family for a run with no framework', () => {
        expect(resolveSkill(entries, 'integration', { variant: ['pages'] })).toBeUndefined();
    });

    it('breaks a tie with the default tag when the run has no value for a key', () => {
        expect(resolveSkill(entries, 'integration', { framework: ['nextjs'] }).id).toBe('integration-next-app');
    });

    it('drops an entry whose key disagrees with the run', () => {
        expect(resolveSkill(entries, 'integration', { framework: ['nextjs'], variant: ['pages'] }).id).toBe('integration-next-pages');
        expect(resolveSkill(entries, 'integration', { framework: ['nextjs'], variant: ['other'] })).toBeUndefined();
    });
});

describe('checkSkillResolvability', () => {
    it('passes when every framework resolves in the pack family', () => {
        const result = check({
            integration: [pack('nextjs', { framework: 'nextjs' }), pack('django', { framework: 'django' })],
            'integration/install': [step('install')],
        });

        expect(result).toEqual({ families: ['integration'], absent: [], missing: [], unreachable: [] });
    });

    it('names every family and framework that resolves nothing', () => {
        const result = check(
            {
                integration: [pack('nextjs', { framework: 'nextjs' })],
                'integration/install': [step('install')],
                logs: [entry('logs-django', ['framework:django'])],
            },
            { frameworks: ['nextjs', 'django', 'go'], taskSkills: ['integration-install', 'logs'] },
        );

        expect(result.missing).toEqual([
            { family: 'logs', framework: 'nextjs' },
            { family: 'logs', framework: 'go' },
            { family: 'integration', framework: 'django' },
            { family: 'integration', framework: 'go' },
        ]);
        const message = missingMessage(result.missing);
        expect(message).toContain('logs: nextjs, go');
        expect(message).toContain('integration: django, go');
    });

    it('asks no framework of a task skill that is a menu id', () => {
        const result = check(
            {
                integration: [pack('nextjs', { framework: 'nextjs' }), pack('django', { framework: 'django' })],
                'spend-audit/queries': [entry('spend-audit-queries')],
            },
            { taskSkills: ['spend-audit-queries'] },
        );

        expect(result).toEqual({ families: ['integration'], absent: [], missing: [], unreachable: [] });
    });

    it('checks the pack family when no task skill is completed from the pack', () => {
        const result = check({
            integration: [pack('nextjs', { framework: 'nextjs' })],
            'integration/install': [entry('integration-install')],
        });

        expect(result.families).toEqual(['integration']);
        expect(result.missing).toEqual([{ family: 'integration', framework: 'django' }]);
    });

    it('lists a task skill that is no menu id and no family, apart from the frameworks', () => {
        const result = check(
            {
                integration: [pack('nextjs', { framework: 'nextjs' }), pack('django', { framework: 'django' })],
                'integration/install': [step('install')],
            },
            { taskSkills: ['integration-install', 'spend-audit-queries'] },
        );

        expect(result).toEqual({ families: ['integration'], absent: ['spend-audit-queries'], missing: [], unreachable: [] });
        const message = absentMessage(result.absent);
        expect(message).toContain('  spend-audit-queries');
        expect(message).toContain('WIZARD_TASK_SKILLS');
    });

    it('resolves a framework by the category a family is published under', () => {
        const result = check(
            {
                integration: [pack('nextjs', { framework: 'nextjs' }), pack('django', { framework: 'django' })],
                'integration/install': [entry('install-next', ['framework:nextjs']), entry('install-django', ['framework:django'])],
            },
            { taskSkills: ['integration-install'] },
        );

        expect(result).toEqual({ families: ['integration-install', 'integration'], absent: [], missing: [], unreachable: [] });
    });

    it('counts a framework missing when its family has only an untagged entry', () => {
        const result = check({
            integration: [entry('integration-php', ['php', 'integration'])],
            'integration/install': [step('install')],
        });

        expect(result.missing).toEqual([
            { family: 'integration', framework: 'nextjs' },
            { family: 'integration', framework: 'django' },
        ]);
    });

    it('lists an entry with no framework tag, and one for a framework the wizard does not detect', () => {
        const result = check({
            integration: [
                pack('nextjs', { framework: 'nextjs' }),
                pack('django', { framework: 'django' }),
                entry('integration-php', ['php', 'integration']),
                pack('wordpress', { framework: 'wordpress' }),
            ],
            'integration/install': [step('install')],
        });

        expect(result.missing).toEqual([]);
        expect(result.unreachable).toEqual([
            { family: 'integration', id: 'integration-php', reason: 'it has no framework: tag' },
            { family: 'integration', id: 'integration-wordpress', reason: 'the wizard detects no framework:wordpress' },
        ]);
    });

    it('lists an entry that ties with an earlier one, and one the default outranks', () => {
        const result = check({
            integration: [
                pack('nextjs', { framework: 'nextjs' }),
                pack('nextjs-again', { framework: 'nextjs' }),
                pack('django-old', { framework: 'django' }),
                pack('django', { framework: 'django' }, 'default'),
            ],
            'integration/install': [step('install')],
        });

        expect(result.missing).toEqual([]);
        expect(result.unreachable).toEqual([
            { family: 'integration', id: 'integration-nextjs-again', reason: 'another entry outranks it on every run' },
            { family: 'integration', id: 'integration-django-old', reason: 'another entry outranks it on every run' },
        ]);
    });

    it('reaches an entry through any other match key the wizard sends, such as variant', () => {
        const result = check(
            {
                integration: [
                    pack('next-app', { framework: 'nextjs', variant: 'app' }, 'default'),
                    pack('next-pages', { framework: 'nextjs', variant: 'pages' }),
                    pack('django', { framework: 'django' }, 'default'),
                    pack('django-async', { framework: 'django', server: 'asgi' }),
                ],
                'integration/install': [step('install')],
            },
            { matchKeys: { variant: { nextjs: ['app', 'pages'] }, server: { django: ['asgi'] } } },
        );

        expect(result).toEqual({ families: ['integration'], absent: [], missing: [], unreachable: [] });
    });

    it('lists an entry another outranks on every value of the other match keys', () => {
        const result = check(
            {
                integration: [
                    pack('next-pages', { framework: 'nextjs', variant: 'pages' }),
                    pack('next-pages-again', { framework: 'nextjs', variant: 'pages' }),
                    pack('next-fallback', { framework: 'nextjs' }),
                    pack('django', { framework: 'django' }),
                ],
                'integration/install': [step('install')],
            },
            { matchKeys: { variant: { nextjs: ['app', 'pages'] } } },
        );

        expect(result.missing).toEqual([]);
        expect(ids(result.unreachable)).toEqual(['integration-next-pages-again']);
    });

    it('names a framework and variant that resolves nothing, and the entry whose variant the wizard does not send', () => {
        const result = check(
            {
                integration: [
                    pack('next-app', { framework: 'nextjs', variant: 'app' }, 'default'),
                    pack('next-pages', { framework: 'nextjs', variant: 'page' }),
                    pack('django', { framework: 'django' }),
                ],
                'integration/install': [step('install')],
            },
            { matchKeys: { variant: { nextjs: ['app', 'pages'] } } },
        );

        expect(result.missing).toEqual([{ family: 'integration', framework: 'nextjs', variant: 'pages' }]);
        expect(missingMessage(result.missing)).toContain('integration: nextjs with variant:pages');
        expect(result.unreachable).toEqual([
            { family: 'integration', id: 'integration-next-pages', reason: 'the wizard sends no variant:page with framework:nextjs' },
        ]);
    });

    it('lists a framework that resolves nothing alone once, whatever variants it has', () => {
        const result = check(
            {
                integration: [pack('django', { framework: 'django' })],
                'integration/install': [step('install')],
            },
            { matchKeys: { variant: { nextjs: ['app', 'pages'] } } },
        );

        expect(result.missing).toEqual([{ family: 'integration', framework: 'nextjs' }]);
    });

    it('counts a framework resolved by an entry that names another key, which a run with no value for it never disagrees with', () => {
        const result = check({
            integration: [pack('next-pages', { framework: 'nextjs', variant: 'pages' }), pack('django', { framework: 'django' })],
            'integration/install': [step('install')],
        });

        expect(result.missing).toEqual([]);
    });
});
