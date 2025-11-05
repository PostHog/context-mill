import { describe, it, expect } from 'vitest';
import ignoreBlockPlugin from '../ignore-block.js';

describe('ignore-block plugin', () => {
    it('removes block with // comments', () => {
        const input = `line 1
// @ignoreBlockStart
line 2
line 3
// @ignoreBlockEnd
line 4`;
        const expected = `line 1
line 4`;
        expect(ignoreBlockPlugin.transform(input)).toBe(expected);
    });

    it('removes block with # comments', () => {
        const input = `line 1
# @ignoreBlockStart
line 2
line 3
# @ignoreBlockEnd
line 4`;
        const expected = `line 1
line 4`;
        expect(ignoreBlockPlugin.transform(input)).toBe(expected);
    });

    it('removes block with /* */ comments', () => {
        const input = `line 1
/* @ignoreBlockStart */
line 2
line 3
/* @ignoreBlockEnd */
line 4`;
        const expected = `line 1
line 4`;
        expect(ignoreBlockPlugin.transform(input)).toBe(expected);
    });

    it('removes block with HTML comments', () => {
        const input = `line 1
<!-- @ignoreBlockStart -->
line 2
line 3
<!-- @ignoreBlockEnd -->
line 4`;
        const expected = `line 1
line 4`;
        expect(ignoreBlockPlugin.transform(input)).toBe(expected);
    });

    it('handles multiple ignore blocks', () => {
        const input = `line 1
// @ignoreBlockStart
line 2
// @ignoreBlockEnd
line 3
# @ignoreBlockStart
line 4
# @ignoreBlockEnd
line 5`;
        const expected = `line 1
line 3
line 5`;
        expect(ignoreBlockPlugin.transform(input)).toBe(expected);
    });

    it('does not modify content without ignore blocks', () => {
        const input = `line 1
line 2
line 3`;
        expect(ignoreBlockPlugin.transform(input)).toBe(input);
    });

    it('does NOT remove when markers are not at start of comment', () => {
        const input = `line 1
// some text @ignoreBlockStart
line 2
// some text @ignoreBlockEnd
line 3`;
        expect(ignoreBlockPlugin.transform(input)).toBe(input);
    });
});
