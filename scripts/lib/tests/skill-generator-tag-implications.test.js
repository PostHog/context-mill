import { describe, it, expect } from 'vitest';
import { collectCommandments } from '../skill-generator.js';

const config = {
    tag_implications: {
        nextjs: ['javascript_web', 'javascript_node'],
        react: ['javascript_web'],
    },
    commandments: {
        nextjs: ['nextjs rule'],
        javascript_web: ['web rule: no PII in capture properties'],
        javascript_node: ['node rule: captureException in error handlers'],
        'react-native': ['mobile rule'],
    },
};

describe('collectCommandments tag implications', () => {
    it('collects implied runtime rules for a framework tag', () => {
        const rules = collectCommandments(['nextjs', 'javascript'], config);
        expect(rules).toContain('nextjs rule');
        expect(rules).toContain('web rule: no PII in capture properties');
        expect(rules).toContain('node rule: captureException in error handlers');
    });

    it('does not imply web rules for tags without implications', () => {
        const rules = collectCommandments(['react-native'], config);
        expect(rules).toEqual(['mobile rule']);
    });

    it('dedupes rules collected via overlapping tags', () => {
        const rules = collectCommandments(
            ['nextjs', 'react', 'javascript_web'],
            config,
        );
        expect(
            rules.filter((r) => r === 'web rule: no PII in capture properties'),
        ).toHaveLength(1);
    });
});
