import { describe, it, expect } from 'vitest';
import ignoreLinePlugin from '../ignore-line.js';

describe('ignore-line plugin', () => {
    it('removes line with // @ignoreLine comment', () => {
        const input = `line 1
// @ignoreLine
line 2
line 3`;
        const expected = `line 1
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });

    it('removes line with # @ignoreLine comment', () => {
        const input = `line 1
# @ignoreLine
line 2
line 3`;
        const expected = `line 1
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });

    it('removes line with /* @ignoreLine */ comment', () => {
        const input = `line 1
/* @ignoreLine */
line 2
line 3`;
        const expected = `line 1
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });

    it('removes line with <!-- @ignoreLine --> comment', () => {
        const input = `line 1
<!-- @ignoreLine -->
line 2
line 3`;
        const expected = `line 1
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });

    it('removes line when @ignoreLine is at end of code line', () => {
        const input = `line 1
const foo = 'bar'; // @ignoreLine
line 2
line 3`;
        const expected = `line 1
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });

    it('does NOT remove when @ignoreLine is not at start of comment', () => {
        const input = `line 1
// this is fun @ignoreLine
line 2
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(input);
    });

    it('does not modify content without @ignoreLine', () => {
        const input = `line 1
line 2
line 3`;
        expect(ignoreLinePlugin.transform(input)).toBe(input);
    });

    it('handles multiple @ignoreLine markers', () => {
        const input = `line 1
// @ignoreLine
line 2
line 3
# @ignoreLine
line 4
line 5`;
        const expected = `line 1
line 3
line 5`;
        expect(ignoreLinePlugin.transform(input)).toBe(expected);
    });
});
