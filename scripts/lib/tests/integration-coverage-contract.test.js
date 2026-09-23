import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const context = join(process.cwd(), 'context');
const agent = (name) => readFileSync(join(context, 'agents', 'integration-v2', `${name}.md`), 'utf8');
const aiReference = (name) =>
    readFileSync(join(context, 'skills', 'ai-observability', 'references', `${name}.md`), 'utf8');
const plain = (value) => value.replaceAll('**', '').replace(/\s+/g, ' ');

describe('integration coverage contract', () => {
    it('requires an inference coverage ledger before manual capture is complete', () => {
        const task = agent('ai-observability');
        const begin = aiReference('1-begin');
        const instrument = aiReference('3-instrument');

        expect(task).toMatch(/inference coverage ledger/i);
        expect(task).toMatch(/ambiguous paths as unresolved/i);
        expect(begin).toMatch(/inference coverage ledger/i);
        expect(instrument).toMatch(/JSON,\s+SSE, NDJSON, and WebSocket/i);
        expect(instrument).toMatch(/HTTP error and cancellation/i);
        expect(instrument).toMatch(/every tool dispatch/i);
    });

    it('makes review reconcile coverage and fix false success captures', () => {
        const review = agent('review');

        expect(review).toMatch(/inference coverage ledger/i);
        expect(review).toMatch(/unmodified call sites/i);
        expect(review).toMatch(/false success/i);
    });

    it('checks user resolution across auth methods and captures after confirmed success', () => {
        expect(agent('identify')).toMatch(/auth method inventory/i);
        expect(agent('capture')).toMatch(/authoritative\s+success/i);
        expect(plain(agent('review'))).toMatch(/auth method inventory/i);
    });
});
