import { describe, it, expect } from 'vitest';
import { serializeSkill } from '../skill-generator.js';

describe('serializeSkill: capture mode', () => {
    const base = { id: 'integration-python', _shortId: 'python', _category: 'integration', display_name: 'Python', description: 'd', _group: 'integration' };

    it('emits captureMode for a tagged variant and nothing for an untagged one', () => {
        expect(serializeSkill({ ...base, capture_mode: 'v1' }).captureMode).toBe('v1');
        expect(serializeSkill(base)).not.toHaveProperty('captureMode');
    });
});
