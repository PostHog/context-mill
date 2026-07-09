import { describe, it, expect } from 'vitest';
import { mergeSkipPatterns, shouldSkip } from '../example-processor.js';

const globalPatterns = {
    includes: ['.yml', '.gitignore', 'node_modules'],
    regex: [new RegExp('^.env(?!\\.example$)')],
    allow: [],
};

describe('shouldSkip', () => {
    it('skips files matching a substring pattern', () => {
        const patterns = mergeSkipPatterns(globalPatterns);
        expect(shouldSkip('project.yml', patterns)).toBe(true);
        expect(shouldSkip('node_modules/foo.js', patterns)).toBe(true);
    });

    it('skips files matching a regex pattern', () => {
        const patterns = mergeSkipPatterns(globalPatterns);
        expect(shouldSkip('.env', patterns)).toBe(true);
        expect(shouldSkip('.env.example', patterns)).toBe(false);
    });

    it('keeps files matching no pattern', () => {
        const patterns = mergeSkipPatterns(globalPatterns);
        expect(shouldSkip('Sources/App.swift', patterns)).toBe(false);
    });

    it('allow patterns rescue files from substring skips', () => {
        const patterns = mergeSkipPatterns(globalPatterns, { allow: ['project.yml'] });
        expect(shouldSkip('project.yml', patterns)).toBe(false);
        // Other .yml files stay skipped
        expect(shouldSkip('ci.yml', patterns)).toBe(true);
    });

    it('allow patterns rescue files from regex skips', () => {
        const patterns = mergeSkipPatterns(globalPatterns, { allow: ['.env'] });
        expect(shouldSkip('.env', patterns)).toBe(false);
    });

    it('tolerates merged patterns with no allow key', () => {
        expect(shouldSkip('project.yml', { includes: ['.yml'], regex: [] })).toBe(true);
    });
});

describe('mergeSkipPatterns', () => {
    it('concatenates example includes and allow onto global patterns', () => {
        const merged = mergeSkipPatterns(globalPatterns, {
            includes: ['dist/'],
            allow: ['project.yml'],
        });
        expect(merged.includes).toContain('.yml');
        expect(merged.includes).toContain('dist/');
        expect(merged.allow).toEqual(['project.yml']);
    });

    it('defaults to empty arrays when example overrides are absent', () => {
        const merged = mergeSkipPatterns(globalPatterns);
        expect(merged.allow).toEqual([]);
        expect(merged.regex).toHaveLength(1);
    });
});
