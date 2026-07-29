import { describe, it, expect } from 'vitest';
import { extractProseUrls, pool } from '../../check-links.js';

describe('extractProseUrls', () => {
    it('finds bare and markdown-linked URLs', () => {
        const md = [
            'See https://posthog.com/docs/libraries/next-js for setup.',
            'Or read [the guide](https://posthog.com/docs/product-analytics/autocapture).',
        ].join('\n');

        expect(extractProseUrls(md)).toEqual([
            'https://posthog.com/docs/libraries/next-js',
            'https://posthog.com/docs/product-analytics/autocapture',
        ]);
    });

    it('strips trailing sentence punctuation but keeps anchors', () => {
        const md = 'Read https://posthog.com/docs/libraries/react-native#autocapture, then stop.';
        expect(extractProseUrls(md)).toEqual([
            'https://posthog.com/docs/libraries/react-native#autocapture',
        ]);
    });

    it('ignores URLs inside fenced code blocks', () => {
        // A URL in a snippet is something the agent writes into the user's
        // code, not a link we are asserting is live.
        const md = [
            'Real link: https://posthog.com/docs/a',
            '```bash',
            'curl https://posthog.com/docs/not-a-real-link',
            '```',
            'Another: https://posthog.com/docs/b',
        ].join('\n');

        expect(extractProseUrls(md)).toEqual([
            'https://posthog.com/docs/a',
            'https://posthog.com/docs/b',
        ]);
    });

    it('handles tilde fences and unclosed fences', () => {
        const md = [
            '~~~js',
            'const u = "https://posthog.com/docs/inside"',
            '~~~',
            'https://posthog.com/docs/outside',
        ].join('\n');

        expect(extractProseUrls(md)).toEqual(['https://posthog.com/docs/outside']);
    });

    it('ignores non-posthog docs URLs', () => {
        const md = 'See https://nextjs.org/docs/app and https://posthog.com/docs/a';
        expect(extractProseUrls(md)).toEqual(['https://posthog.com/docs/a']);
    });

    it('returns nothing for markdown with no docs links', () => {
        expect(extractProseUrls('# Title\n\nJust prose.')).toEqual([]);
    });
});

describe('pool', () => {
    it('preserves input order regardless of completion order', async () => {
        const delays = [30, 0, 15, 5];
        const results = await pool(delays, 2, async (ms) => {
            await new Promise((r) => setTimeout(r, ms));
            return ms;
        });
        expect(results).toEqual(delays);
    });

    it('never exceeds the concurrency limit', async () => {
        let inFlight = 0;
        let peak = 0;
        await pool([...Array(20).keys()], 3, async (n) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 1));
            inFlight--;
            return n;
        });
        expect(peak).toBeLessThanOrEqual(3);
    });

    it('handles an empty input list', async () => {
        expect(await pool([], 4, async (x) => x)).toEqual([]);
    });
});
