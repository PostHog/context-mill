import fs from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import { describe, expect, it } from 'vitest';
import {
    EMBEDDED_BROWSER_SNIPPETS,
    generateBrowserSnippet,
    renderEmbeddedBrowserSnippet,
} from '../../generate-browser-snippets.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');

function runSnippetWithReadOnlyArrayToString(target = EMBEDDED_BROWSER_SNIPPETS[0]) {
    const insertedScripts = [];
    const context = {
        document: {
            createElement: () => ({}),
            getElementsByTagName: () => [{
                parentNode: {
                    insertBefore: script => insertedScripts.push(script),
                },
            }],
        },
        window: {},
    };

    runInNewContext(
        `'use strict';Object.defineProperty(Array.prototype,'toString',{writable:false});${generateBrowserSnippet(target)}`,
        context,
    );
    context.window.posthog.init('phc_test', { api_host: 'https://us.i.posthog.com' });

    return { insertedScripts, posthog: context.window.posthog };
}

describe('embedded PostHog browser snippet', () => {
    it('keeps every embedded copy in sync with the generator', () => {
        for (const target of EMBEDDED_BROWSER_SNIPPETS) {
            const content = fs.readFileSync(path.join(REPO_ROOT, target.file), 'utf8');
            expect(renderEmbeddedBrowserSnippet(content, target), target.file).toBe(content);
        }
    });

    it.each(EMBEDDED_BROWSER_SNIPPETS)(
        'initializes $file when Array.prototype.toString is read-only',
        target => {
            const { insertedScripts, posthog } = runSnippetWithReadOnlyArrayToString(target);

            expect(insertedScripts).toHaveLength(1);
            expect(posthog._i).toEqual([
                ['phc_test', { api_host: 'https://us.i.posthog.com' }, 'posthog'],
            ]);
            expect(posthog.toString()).toBe('posthog (stub)');
            expect(posthog.people.toString()).toBe('posthog.people (stub)');
        },
    );

    it('preserves the toString property behavior', () => {
        const { posthog } = runSnippetWithReadOnlyArrayToString();

        for (const stub of [posthog, posthog.people]) {
            expect(Object.getOwnPropertyDescriptor(stub, 'toString')).toMatchObject({
                configurable: true,
                enumerable: true,
                writable: true,
            });
        }
    });
});
