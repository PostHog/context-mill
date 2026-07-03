import { describe, it, expect } from 'vitest';
import { collectCommandments } from '../skill-generator.js';

// Runtime membership is declared directly in each skill's config tags, so
// collectCommandments is a plain per-tag lookup — no taxonomy expansion.
const config = {
    commandments: {
        javascript: ['root rule'],
        nextjs: ['nextjs rule'],
        javascript_web: ['web rule: no PII in capture properties'],
        javascript_node: ['node rule: captureException in error handlers'],
        'react-native': ['mobile rule'],
    },
};

describe('collectCommandments', () => {
    it('collects the commandments for every tag the skill declares', () => {
        // A full-stack JS skill declares both runtime categories in its config.
        const rules = collectCommandments(
            ['nextjs', 'javascript', 'javascript_web', 'javascript_node'],
            config,
        );
        expect(rules).toContain('nextjs rule');
        expect(rules).toContain('root rule');
        expect(rules).toContain('web rule: no PII in capture properties');
        expect(rules).toContain('node rule: captureException in error handlers');
    });

    it('does not pull category rules a skill did not declare', () => {
        // A web-only skill (no javascript_node tag) gets no server rules.
        const rules = collectCommandments(['javascript', 'javascript_web'], config);
        expect(rules).toContain('web rule: no PII in capture properties');
        expect(rules).not.toContain('node rule: captureException in error handlers');
    });

    it('ignores tags with no commandments', () => {
        const rules = collectCommandments(['react-native', 'typescript'], config);
        expect(rules).toEqual(['mobile rule']);
    });
});
