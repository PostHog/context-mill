import { describe, it, expect } from 'vitest';
import { collectCommandments } from '../skill-generator.js';

const config = {
    tag_parents: {
        javascript_web: ['javascript'],
        javascript_node: ['javascript'],
        nextjs: ['javascript_web', 'javascript_node'],
        react: ['javascript_web'],
    },
    commandments: {
        javascript: ['root rule'],
        nextjs: ['nextjs rule'],
        javascript_web: ['web rule: no PII in capture properties'],
        javascript_node: ['node rule: captureException in error handlers'],
        'react-native': ['mobile rule'],
    },
};

describe('collectCommandments tag taxonomy', () => {
    it('inherits parent category rules transitively (framework → runtime → root)', () => {
        const rules = collectCommandments(['react'], config);
        expect(rules).toContain('web rule: no PII in capture properties');
        expect(rules).toContain('root rule'); // react → javascript_web → javascript
    });

    it('is exclusively additive — every own-tag rule survives expansion', () => {
        const rules = collectCommandments(['nextjs'], config);
        expect(rules).toContain('nextjs rule');
        expect(rules).toContain('web rule: no PII in capture properties');
        expect(rules).toContain('node rule: captureException in error handlers');
        expect(rules).toContain('root rule');
    });

    it('does not pull category rules for tags outside the taxonomy', () => {
        const rules = collectCommandments(['react-native'], config);
        expect(rules).toEqual(['mobile rule']);
    });

    it('dedupes rules reached via overlapping paths and survives cycles', () => {
        const cyclic = {
            tag_parents: { a: ['b'], b: ['a', 'javascript_web'] },
            commandments: config.commandments,
        };
        const rules = collectCommandments(['a', 'javascript_web'], cyclic);
        expect(
            rules.filter((r) => r === 'web rule: no PII in capture properties'),
        ).toHaveLength(1);
    });
});
