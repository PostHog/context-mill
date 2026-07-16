import { describe, it, expect } from 'vitest';

import {
    assetNameFromUrl,
    expectedAssetsForMenu,
    findMissingAssets,
} from '../release-assets.js';

describe('assetNameFromUrl', () => {
    it('returns the last path segment of a release download URL', () => {
        expect(
            assetNameFromUrl(
                'https://github.com/PostHog/context-mill/releases/latest/download/agent-integration-v2-install.md',
            ),
        ).toBe('agent-integration-v2-install.md');
    });
});

describe('expectedAssetsForMenu', () => {
    it('includes the menu file plus every entry downloadUrl basename', () => {
        const entries = [
            { downloadUrl: 'http://x/agent-flow-a.md' },
            { downloadUrl: 'http://x/agent-flow-b.md' },
        ];
        expect(expectedAssetsForMenu('agent-menu.json', entries)).toEqual(
            new Set(['agent-menu.json', 'agent-flow-a.md', 'agent-flow-b.md']),
        );
    });

    it('ignores entries without a downloadUrl', () => {
        expect(expectedAssetsForMenu('skill-menu.json', [{ id: 'x' }])).toEqual(
            new Set(['skill-menu.json']),
        );
    });
});

describe('findMissingAssets', () => {
    it('reports expected assets absent from the release, sorted', () => {
        const expected = new Set(['agent-menu.json', 'agent-b.md', 'agent-a.md']);
        const actual = ['agent-menu.json', 'skill-menu.json'];
        expect(findMissingAssets(expected, actual)).toEqual(['agent-a.md', 'agent-b.md']);
    });

    it('returns nothing when the release carries every expected asset', () => {
        const expected = new Set(['agent-menu.json', 'agent-a.md']);
        const actual = ['agent-a.md', 'agent-menu.json', 'extra.zip'];
        expect(findMissingAssets(expected, actual)).toEqual([]);
    });
});
