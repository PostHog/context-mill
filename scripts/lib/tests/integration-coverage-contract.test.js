import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const context = join(process.cwd(), 'context');
const agent = (name) => readFileSync(join(context, 'agents', 'integration-v2', `${name}.md`), 'utf8');
const aiReference = (name) =>
    readFileSync(join(context, 'skills', 'ai-observability', 'references', `${name}.md`), 'utf8');
const plain = (value) => value.replaceAll('**', '').replace(/\s+/g, ' ');
const routeGuide = /manual-capture#tracing-proxied-inference-paths/;

describe('integration coverage contract', () => {
    it('links route discovery and keeps a ledger through verification', () => {
        const task = agent('ai-observability');
        const begin = aiReference('1-begin');
        const instrument = aiReference('3-instrument');
        const verify = aiReference('4-verify');

        expect(task).toMatch(/inference coverage ledger/i);
        expect(task).toMatch(/ambiguous paths as unresolved/i);
        expect(task).toMatch(routeGuide);
        expect(plain(begin)).toMatch(/list every inference entry point, its transport, and capture status/i);
        expect(begin).toMatch(routeGuide);
        expect(instrument).toMatch(routeGuide);
        expect(instrument).toMatch(/provider request once after its outcome is known/i);
        expect(verify).toMatch(/reconcile the inference coverage ledger/i);
    });

    it('makes review reconcile coverage and fix false success captures', () => {
        const review = agent('review');

        expect(plain(review)).toMatch(/inference coverage ledger/i);
        expect(review).toMatch(/including unmodified ones/i);
        expect(review).toMatch(/false success/i);
    });

    it('checks user resolution across auth methods and captures after confirmed success', () => {
        expect(agent('identify')).toMatch(/auth method inventory/i);
        expect(agent('capture')).toMatch(/provider result confirms success/i);
        expect(plain(agent('review'))).toMatch(/auth method inventory/i);
    });
});
