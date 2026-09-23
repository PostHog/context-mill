import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const flowDir = join(process.cwd(), 'context', 'agents', 'error-tracking');
const sentences = (file) =>
    readFileSync(join(flowDir, file), 'utf8')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.:;])\s+(?=[A-Z-])/);

// `.env` is gitignored, so it is usually missing where the app runs, and
// `node --env-file=.env` exits 9 before any app code when it is.
describe('error-tracking env loading', () => {
    it('never tells the agent to put a hard --env-file on the start script', () => {
        for (const file of ['init.md', 'configure.md']) {
            const hard = sentences(file).filter(
                (s) => s.includes('`--env-file=.env`') && /`start`|run script/.test(s),
            );
            for (const sentence of hard) expect(sentence).toMatch(/\bnever\b/i);
        }
    });

    it('names a loader that tolerates a missing .env for the run script', () => {
        for (const file of ['init.md', 'configure.md']) {
            expect(sentences(file).join(' ')).toContain('--env-file-if-exists=.env');
        }
    });

    it('promises uploads on every build only once credentials and CI are in place', () => {
        const promise = sentences('report.md').filter((s) => /every production build/.test(s));
        expect(promise.length).toBeGreaterThan(0);
        for (const sentence of promise) expect(sentence).toMatch(/wire-ci/);
    });
});
