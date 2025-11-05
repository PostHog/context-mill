import { describe, it, expect } from 'vitest';
import ignoreFilePlugin from '../ignore-file.js';

describe('ignore-file plugin', () => {
    it('returns empty string when // @ignoreFile is in first line', () => {
        const input = `// @ignoreFile
line 1
line 2`;
        expect(ignoreFilePlugin.transform(input)).toBe('');
    });

    it('returns empty string when # @ignoreFile is in first few lines', () => {
        const input = `# Some header
# @ignoreFile
line 1
line 2`;
        expect(ignoreFilePlugin.transform(input)).toBe('');
    });

    it('returns empty string when /* @ignoreFile */ is present', () => {
        const input = `/* @ignoreFile */
line 1
line 2`;
        expect(ignoreFilePlugin.transform(input)).toBe('');
    });

    it('returns empty string when <!-- @ignoreFile --> is present', () => {
        const input = `<!-- @ignoreFile -->
line 1
line 2`;
        expect(ignoreFilePlugin.transform(input)).toBe('');
    });

    it('does not ignore file when @ignoreFile is not in first 10 lines', () => {
        const input = `line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10
line 11
// @ignoreFile
line 12`;
        expect(ignoreFilePlugin.transform(input)).toBe(input);
    });

    it('does not modify content without @ignoreFile', () => {
        const input = `line 1
line 2
line 3`;
        expect(ignoreFilePlugin.transform(input)).toBe(input);
    });

    it('does NOT ignore when @ignoreFile is not at start of comment', () => {
        const input = `// some text @ignoreFile
line 1
line 2`;
        expect(ignoreFilePlugin.transform(input)).toBe(input);
    });
});
