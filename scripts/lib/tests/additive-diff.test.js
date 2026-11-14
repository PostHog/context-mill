import { describe, it, expect } from 'vitest';

import { contains, recordKey } from '../additive-diff.js';

/** What `contains` reports for a baseline and a candidate: what changed or went, and what was added. */
function compare(baseline, candidate) {
    const changed = [];
    const added = [];
    contains(baseline, candidate, 'menu', changed, added);
    return { changed, added };
}

describe('recordKey', () => {
    it.each([
        ['records with an id', [{ id: 'a' }, { id: 'b' }], 'id'],
        ['records with a skillId', [{ skillId: 'a' }], 'skillId'],
        ['an empty list', [], undefined],
        ['a list of strings', ['a', 'b'], undefined],
        ['records where one has no id', [{ id: 'a' }, { name: 'b' }], undefined],
    ])('names the field of %s', (_, list, key) => {
        expect(recordKey(list)).toBe(key);
    });
});

describe('contains', () => {
    it('allows a new field, a new record and a new entry of a record, and counts each', () => {
        const result = compare(
            { skills: [{ id: 'a', name: 'A' }] },
            { skills: [{ id: 'a', name: 'A', tags: ['x'] }, { id: 'b', name: 'B' }], version: 2 },
        );

        expect(result).toEqual({ changed: [], added: ['menu.skills[a].tags', 'menu.skills[b]', 'menu.version'] });
    });

    it('compares records by their id, in any order', () => {
        const result = compare({ skills: [{ id: 'a' }, { id: 'b' }] }, { skills: [{ id: 'b' }, { id: 'a' }] });

        expect(result).toEqual({ changed: [], added: [] });
    });

    it.each([
        ['a changed value', { name: 'A' }, { name: 'B' }, ['menu.name']],
        ['a removed field', { name: 'A', tags: [] }, { name: 'A' }, ['menu.tags (removed)']],
        ['a removed record', { skills: [{ id: 'a' }, { id: 'b' }] }, { skills: [{ id: 'a' }] }, ['menu.skills[b] (removed)']],
        ['a changed list of plain values', { tags: ['a'] }, { tags: ['a', 'b'] }, ['menu.tags']],
    ])('reports %s', (_, baseline, candidate, changed) => {
        expect(compare(baseline, candidate).changed).toEqual(changed);
    });

    // A list that is empty today has nothing a release could change or remove.
    it.each([
        ['records', [{ id: 'a' }, { id: 'b' }], ['menu.skills[a]', 'menu.skills[b]']],
        ['plain values', ['a'], ['menu.skills[0]']],
    ])('counts the first %s of an empty list as additions', (_, list, added) => {
        expect(compare({ skills: [] }, { skills: list })).toEqual({ changed: [], added });
    });
});
