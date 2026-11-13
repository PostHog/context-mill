import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'context', 'skills');

function auditReferenceFiles() {
    const files = [];
    for (const skill of fs.readdirSync(SKILLS_DIR)) {
        if (!skill.startsWith('audit')) continue;
        const refs = path.join(SKILLS_DIR, skill, 'references');
        if (!fs.existsSync(refs)) continue;
        for (const f of fs.readdirSync(refs)) {
            if (f.endsWith('.md')) files.push(path.join(refs, f));
        }
    }
    return files;
}

// Grep patterns the references hand to subagents, e.g. `posthog\??\.capture(\?\.)?\(`
function extractPatterns(method) {
    const found = new Set();
    const re = /`([^`]+)`/g;
    for (const file of auditReferenceFiles()) {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            for (const m of line.matchAll(re)) {
                for (const alt of m[1].split('|')) {
                    if (alt.startsWith('posthog\\') && alt.includes('.' + method)) found.add(alt);
                }
            }
        }
    }
    return [...found];
}

const CAPTURE_FORMS = [
    "posthog.capture('a')",
    "posthog?.capture('b')",
    "this.posthog?.capture('c')",
    "posthog.capture?.('d')",
    "posthog?.capture?.('e')",
];
const IDENTIFY_FORMS = CAPTURE_FORMS.map(s => s.replace('capture', 'identify'));

describe('audit skill grep patterns', () => {
    for (const [method, forms] of [['capture', CAPTURE_FORMS], ['identify', IDENTIFY_FORMS]]) {
        it(`match optional-chained ${method} call forms`, () => {
            const patterns = extractPatterns(method);
            expect(patterns.length).toBeGreaterThan(0);
            for (const pattern of patterns) {
                const re = new RegExp(pattern);
                for (const form of forms) {
                    expect(re.test(form), `${pattern} should match ${form}`).toBe(true);
                }
            }
        });

        it(`no reference uses a direct-call-only ${method} pattern`, () => {
            const direct = new RegExp('posthog\\\\\\.' + method + '\\\\\\(');
            for (const file of auditReferenceFiles()) {
                const text = fs.readFileSync(file, 'utf8');
                expect(direct.test(text), path.relative(REPO_ROOT, file)).toBe(false);
            }
        });
    }
});
