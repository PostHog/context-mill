// Unit tests for StatefulIaStore & principled +/- feature-flag delta detection.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  inspectFeatureFlagDelta,
  pageLevelSurface,
  StatefulIaStore,
} from '../runtime/stateful-ia-engine.mjs';

describe('stateful-ia-engine', () => {
it('handles feature-flag deltas, batch mutations, blast radius, and human-PR reconciliation', () => {
// 1. Principled +/- feature flag detection
{
  const addFlagDiff = `
+++ b/frontend/src/lib/constants.tsx
+    MCP_ANALYTICS_LEADERBOARD_HOME: 'mcp-analytics-leaderboard-home',
+++ b/products/mcp_analytics/frontend/MCPAnalyticsDashboard.tsx
+    return featureFlags[FEATURE_FLAGS.MCP_ANALYTICS_LEADERBOARD_HOME] ? (
`;
  const r1 = inspectFeatureFlagDelta('feat(mcp-analytics): trial leaderboard layout on home tab (#114168)', addFlagDiff, addFlagDiff);
  assert.equal(r1.isDeferredNewFlag, true, 'Adding a new feature flag gate must defer');
  assert.deepEqual(r1.addedFlags, ['MCP_ANALYTICS_LEADERBOARD_HOME']);
  assert.deepEqual(r1.removedFlags, []);

  const removeFlagDiff = `
--- a/products/mcp_analytics/frontend/MCPAnalyticsDashboard.tsx
-    return featureFlags[FEATURE_FLAGS.MCP_ANALYTICS_LEADERBOARD_HOME] ? (
+    return <MCPAnalyticsLeaderboardHome />
`;
  const r2 = inspectFeatureFlagDelta('feat(mcp-analytics): ship the leaderboard as the only home layout (#135656)', removeFlagDiff, removeFlagDiff);
  assert.equal(r2.isDeferredNewFlag, false, 'Removing a feature flag must NOT defer');
  assert.deepEqual(r2.removedFlags, ['MCP_ANALYTICS_LEADERBOARD_HOME']);

  // Context line mentioning an existing flag must NOT defer!
  const contextOnlyDiff = `
  const flag = FEATURE_FLAGS.MCP_ANALYTICS_INTENT_ROUTING
- const limit = 64
+ const limit = 128
`;
  const r3 = inspectFeatureFlagDelta('fix(mcp-analytics): allow 128-char session ids', contextOnlyDiff, contextOnlyDiff);
  assert.equal(r3.isDeferredNewFlag, false, 'Context-line flag reference must NOT defer');
}

// 2. StatefulIaStore registerFact -> updateFact -> retireFact -> reconcileDocsMap
{
  const store = new StatefulIaStore({
    anchors: [],
    facts: [],
    claims: [
      {
        claimCode: 'MCPA-ALL-C-000001',
        leafKey: 'c3:all:events.mdx:abc:10',
        pieceId: 'contents/docs/mcp-analytics/events.mdx#L5-L5',
        pagePath: 'contents/docs/mcp-analytics/events.mdx',
        pageUrl: 'https://posthog.com/docs/mcp-analytics/events',
        startLine: 5,
        endLine: 5,
        text: 'PostHog emits `$mcp_tool_call` on every MCP tool call.',
        plainText: 'PostHog emits $mcp_tool_call on every MCP tool call.',
        surface: 'ALL',
        state: 'fresh',
        factCodes: [],
        sectionCodes: ['MCPA-1.1'],
      },
    ],
    outline: {
      chapters: [
        {
          code: 'MCPA-1',
          key: 'ch-events',
          title: 'Events',
          sections: [{ code: 'MCPA-1.1', key: 'sec-events', title: 'Core events', summary: 'Core MCP events', live_doc_pages: ['contents/docs/mcp-analytics/events.mdx'], factCodes: [] }],
        },
      ],
    },
    register: { version: 3, tool: 'MCPA', surfaces: ['TS', 'RS'], leaves: { 'MCPA-ALL-C-000001': 'c3:all:events.mdx:abc:10' }, retiredLeaves: [] },
    productConfig: { code: 'MCPA', surfaces: ['UI', 'API', 'MCP', 'TS', 'WEB', 'PY', 'RS'], doc_surface_hints: [] },
  });

  // Map a brand-new Rust SDK fact
  const reg = store.registerFact({
    def: 'posthog-rs:src/mcp/options.rs#McpOptions',
    repo: 'posthog-rs',
    path: 'src/mcp/options.rs',
    symbol: 'McpOptions',
    surface: 'RS',
    type: 'option',
    claim: 'Rust SDK exposes McpOptions for instrumenting rmcp servers.',
    quote: 'pub struct McpOptions',
    pin: { commit: '8408705', code_hash: 'deadbeef' },
    today: '2026-10-26',
  });
  assert.equal(reg.factCode, 'MCPA-RS-F-000001');
  assert.equal(store.factsByCode.size, 1);

  // Bind claim to the new fact, then update fact -> update returns impactedClaims without polluting unrelated future PRs
  store.claimsByCode.get('MCPA-ALL-C-000001').factCodes.push(reg.factCode);
  const upd = store.updateFact({ factCode: reg.factCode, claim: 'Updated Rust McpOptions claim for $mcp_initialize.' });
  assert.equal(upd.ok, true);
  assert.equal(upd.impactedClaims.length, 1);

  // Auto-port extraction on newly mapped facts mentioning an event ($mcp_initialize) or REST route (/api/...)
  const autoPortFact = store.registerFact({
    def: 'posthog-python:posthog/mcp/types.py#MCPAnalyticsOptions',
    repo: 'posthog-python',
    path: 'posthog/mcp/types.py',
    symbol: 'MCPAnalyticsOptions',
    surface: 'PY',
    type: 'option',
    claim: 'send_initialize_event controls whether $mcp_initialize is emitted.',
    quote: 'send_initialize_event: bool = True',
    pin: { commit: 'd8a1b97', code_hash: '11223344' },
    today: '2026-10-28',
  });
  assert.deepEqual(autoPortFact.fact.port, { kind: 'event', dir: 'ref', key: '$mcp_initialize' });

  // Retire fact -> tombstone written, never recycled, claim flips to `contradicted`
  const ret = store.retireFact({ factCode: reg.factCode, reason: 'Removed option', today: '2026-11-06' });
  assert.equal(ret.ok, true);
  assert.equal(store.claimsByCode.get('MCPA-ALL-C-000001').state, 'contradicted');
  assert.equal(store.register.retiredLeaves.length, 1);

  const reg2 = store.registerFact({
    def: 'posthog-rs:src/mcp/options.rs#McpOptionsV2',
    repo: 'posthog-rs',
    path: 'src/mcp/options.rs',
    symbol: 'McpOptionsV2',
    surface: 'RS',
    type: 'option',
    claim: 'Second Rust fact.',
    quote: 'pub struct McpOptionsV2',
    pin: { commit: '98d2bf1', code_hash: 'cafebabe' },
    today: '2026-11-06',
  });
  assert.equal(reg2.factCode, 'MCPA-RS-F-000002', 'Retired code must NEVER be recycled');

  // Reconcile docs map after line shift + page move updates pageUrl and surface!
  const docsMap = new Map([
    ['contents/docs/mcp-analytics/installation/rust.mdx', '# Rust\n\nIntro line.\n\nExtra line.\n\nPostHog emits `$mcp_tool_call` on every MCP tool call.\n'],
  ]);
  const rec = store.reconcileDocsMap(docsMap, { docsCommit: 'abc', today: '2026-11-12' });
  assert.equal(rec.stats.movedCrossPage, 1);
  const moved = store.claimsByCode.get('MCPA-ALL-C-000001');
  assert.equal(moved.pagePath, 'contents/docs/mcp-analytics/installation/rust.mdx');
  assert.equal(moved.pageUrl, 'https://posthog.com/docs/mcp-analytics/installation/rust');
  assert.equal(moved.surface, 'RS', 'Surface refined from ALL -> RS when moved to rust.mdx');
  assert.equal(moved.startLine, 7);

  // Shared cross-surface pages MUST stay 'ALL' even when text contains TS-only tokens like sendInitializeEvent
  assert.equal(pageLevelSurface('contents/docs/mcp-analytics/events.mdx'), 'ALL');
  assert.equal(pageLevelSurface('contents/docs/mcp-analytics/installation/index.mdx'), 'ALL');
  assert.equal(pageLevelSurface('contents/docs/mcp-analytics/installation/typescript.mdx'), 'TS');
  assert.equal(pageLevelSurface('contents/docs/mcp-analytics/surfaces/api.mdx'), 'API');
}

});
});
