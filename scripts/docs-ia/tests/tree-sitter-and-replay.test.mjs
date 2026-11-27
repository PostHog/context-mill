import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { MCP_ANALYTICS_REPLAY_EVENTS } from '../data/mcp-analytics-replay-events.mjs';
import { inspectPrompt } from '../prompts/loader.mjs';
import { runWorkflow } from '../runtime/runner.mjs';
import { classifyFileExclusion, indexSourceFile } from '../tools/ast-pins.mjs';
import { queryAuditTrail } from '../tools/blast-radius.mjs';
import {
  createTreeSitterAstParser,
  foldMembers,
  foldRawDeclarationsToDefs,
  patchGrammarGaps,
  supportedTreeSitterExt,
} from '../tools/tree-sitter-parser.mjs';
import { replayPrsWorkflow } from '../workflows/replay-prs.workflow.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

describe('tree-sitter-parser adapter & watched release manifests', () => {
  it('folds short nested members into standalone definitions while keeping >=6-line methods standalone', () => {
    expect(supportedTreeSitterExt('.tsx')).toBe(true);
    expect(supportedTreeSitterExt('.rs')).toBe(true);
    expect(supportedTreeSitterExt('.md')).toBe(false);

    // JSX bare `&` patch preserves exact string length so byte/row positions never shift
    const jsx = '<Card title="Tools & Models">R&D &amp; Ops</Card>';
    const patched = patchGrammarGaps(jsx, 'tsx');
    expect(patched).toHaveLength(jsx.length);
    expect(patched).toContain('Tools _ Models');
    expect(patched).toContain('&amp;');

    const nodes = new Map([
      [
        'posthog-js:client.ts#PostHogMCP',
        { id: 'posthog-js:client.ts#PostHogMCP', repo: 'posthog-js', path: 'client.ts', symbol: 'PostHogMCP', kind: 'type', inScope: true, lines: [1, 20], ownLines: [1, 20] },
      ],
      [
        'posthog-js:client.ts#PostHogMCP.apiKey',
        { id: 'posthog-js:client.ts#PostHogMCP.apiKey', repo: 'posthog-js', path: 'client.ts', symbol: 'PostHogMCP.apiKey', kind: 'member', inScope: true, lines: [2, 2], ownLines: [2] },
      ],
      [
        'posthog-js:client.ts#PostHogMCP.captureUnknownTool',
        { id: 'posthog-js:client.ts#PostHogMCP.captureUnknownTool', repo: 'posthog-js', path: 'client.ts', symbol: 'PostHogMCP.captureUnknownTool', kind: 'function', inScope: true, lines: [4, 11], ownLines: [4, 5, 6, 7, 8, 9, 10] },
      ],
    ]);

    const { holderOf, defs } = foldMembers(nodes);
    expect(holderOf.get('posthog-js:client.ts#PostHogMCP.apiKey')).toBe('posthog-js:client.ts#PostHogMCP');
    expect(holderOf.get('posthog-js:client.ts#PostHogMCP.captureUnknownTool')).toBe('posthog-js:client.ts#PostHogMCP.captureUnknownTool');
    expect(defs.get('posthog-js:client.ts#PostHogMCP').ownLines).toEqual([1, 2, 20]);
    expect(defs.get('posthog-js:client.ts#PostHogMCP.captureUnknownTool').lines).toBe(7);

    const rawLines = ['import { x } from "y";', 'export function run() {', '  return x();', '}'];
    const folded = foldRawDeclarationsToDefs({
      repo: 'posthog-js',
      path: 'run.ts',
      lines: rawLines,
      declarations: [{
        symbol: 'run',
        kind: 'function',
        first: { startIndex: 23, startPosition: { row: 1, column: 0 } },
        last: { endIndex: 55, endPosition: { row: 3, column: 1 } },
      }],
    });
    expect(folded).toEqual([{ symbol: 'run', kind: 'function', ownLines: [2, 3, 4] }]);
  });

  it('gracefully falls back when web-tree-sitter is absent and indexes watched SDK release manifests', async () => {
    const parserRes = await createTreeSitterAstParser({ moduleSearchPaths: ['/nonexistent/node_modules'] });
    expect(typeof parserRes.available).toBe('boolean');

    const mcpaConfig = yaml.load(readFileSync(join(REPO_ROOT, 'facts', 'products', 'mcp-analytics.yml'), 'utf8'));
    const changesetPath = '.sampo/changesets/mcp-python-stable.md';
    const changesetBody = '---\npypi/posthog: minor\n---\n`posthog.mcp` is now stable.\n';

    expect(classifyFileExclusion('posthog-python', changesetPath, mcpaConfig, changesetBody).excluded).toBe(false);
    expect(classifyFileExclusion('posthog-python', 'README.md', mcpaConfig, 'general readme').excluded).toBe(true);

    const defs = await indexSourceFile({
      repo: 'posthog-python',
      commit: '5f2ee56bb0f2',
      path: changesetPath,
      text: changesetBody,
      productConfig: mcpaConfig,
    });
    expect(defs).toHaveLength(1);
    expect(defs[0].kind).toBe('release_manifest');
    expect(defs[0].surface).toBe('PY');
  });
});

describe('replay-prs workflow & verified MCPA register artifacts', () => {
  it('replays code PRs (0-LLM unchanged bump, flag deferral, multi-page fan-out) and human MDX soft-drift end to end', async () => {
    const promptMeta = inspectPrompt('replay-pr.md');
    expect(promptMeta.includes).toContain('shared/verbatim-quote-law.md');
    expect(promptMeta.variables).toContain('candidatePageExcerptsBlock');

    const mcpaConfig = yaml.load(readFileSync(join(REPO_ROOT, 'facts', 'products', 'mcp-analytics.yml'), 'utf8'));
    const t0Ts = 'export function instrument(server) {\n  return capture("$mcp_tool_call", { distinct_id: "anonymous" });\n}\n';
    const e2Ts = 'export function instrument(server) {\n  return capture("$mcp_unknown_tool", { distinct_id: generateSessionId() });\n}\n';
    const docT0 = [
      '---',
      'title: Events',
      '---',
      '',
      '## Events',
      '',
      '`$mcp_unknown_tool` is emitted on Go and Rust SDKs only.',
    ].join('\n');
    const docHuman = docT0.replace(
      '`$mcp_unknown_tool` is emitted on Go and Rust SDKs only.',
      '`$mcp_unknown_tool` fires on unregistered tools in Go and Rust SDKs.'
    );

    const [t0Def] = await indexSourceFile({
      repo: 'posthog-js',
      commit: 'c0',
      path: 'packages/mcp/src/index.ts',
      text: t0Ts,
      productConfig: mcpaConfig,
    });

    let judgeCalls = 0;
    const res = await runWorkflow(replayPrsWorkflow, {
      product: mcpaConfig,
      initialState: {
        t0Commits: { 'posthog-js': 'c0', 'posthog-com': 'd0' },
        anchorsList: [{ ...t0Def, sliceText: undefined }],
        outline: [{
          code: 'MCPA-1',
          key: 'ch-events',
          title: 'Events',
          sections: [{ code: 'MCPA-1.1', key: 'sec-unknown', title: 'Unknown tools', live_doc_pages: ['contents/docs/mcp-analytics/events.mdx'] }],
        }],
        decisions: [],
        facts: [{
          def: t0Def.id,
          repo: 'posthog-js',
          path: t0Def.path,
          symbol: t0Def.symbol,
          surface: 'TS',
          type: 'fact',
          claim: 'TypeScript MCP wrapper captures $mcp_tool_call with anonymous fallback.',
          quote: 'return capture("$mcp_tool_call", { distinct_id: "anonymous" });',
          factCode: 'MCPA-TS-F-000001',
          code: 'MCPA-TS-F-000001',
          pin: t0Def.pin,
        }],
        claims: [{
          claimCode: 'MCPA-ALL-C-000001',
          pieceId: 'contents/docs/mcp-analytics/events.mdx#L7-L7',
          pagePath: 'contents/docs/mcp-analytics/events.mdx',
          startLine: 7,
          endLine: 7,
          text: '`$mcp_unknown_tool` is emitted on Go and Rust SDKs only.',
          plainText: '$mcp_unknown_tool is emitted on Go and Rust SDKs only.',
          surface: 'ALL',
          state: 'fresh',
          factCodes: ['MCPA-TS-F-000001'],
        }],
        docsSnapshots: {
          d0: [{ pagePath: 'contents/docs/mcp-analytics/events.mdx', text: docT0 }],
          d1: [{ pagePath: 'contents/docs/mcp-analytics/events.mdx', text: docHuman }],
        },
        replayEvents: [
          {
            id: 'R1',
            date: '2026-11-02',
            kind: 'code_pr',
            repo: 'posthog-js',
            prNumber: 1,
            commit: 'c1',
            title: 'chore(mcp): comment-only bump',
            truthNeedsDocs: false,
            truthPages: [],
            prData: {
              files: [{ status: 'M', path: 'packages/mcp/src/index.ts', text: `// header comment\n${t0Ts}` }],
              diffByPath: { 'packages/mcp/src/index.ts': '+// header comment\n' },
            },
          },
          {
            id: 'R2',
            date: '2026-11-03',
            kind: 'code_pr',
            repo: 'posthog',
            prNumber: 2,
            commit: 'p1',
            title: 'feat(mcp-analytics): add setup mode behind a flag',
            isFlaggedUnreleased: true,
            truthNeedsDocs: false,
            truthPages: [],
            prData: {
              files: [{ status: 'A', path: 'products/mcp_analytics/frontend/setup.tsx', text: 'export function Setup() { return useFeatureFlag("MCP_SETUP"); }\n' }],
              diffByPath: { 'products/mcp_analytics/frontend/setup.tsx': '+useFeatureFlag("MCP_SETUP")\n' },
            },
          },
          {
            id: 'R3',
            date: '2026-11-04',
            kind: 'human_docs_pr',
            repo: 'posthog-com',
            prNumber: 3,
            commit: 'd1',
            title: 'docs(mcp-analytics): tighten event wording',
            truthNeedsDocs: false,
            truthPages: [],
          },
          {
            id: 'R4',
            date: '2026-11-05',
            kind: 'code_pr',
            repo: 'posthog-js',
            prNumber: 4,
            commit: 'c2',
            title: 'feat(mcp): emit $mcp_unknown_tool in @posthog/mcp',
            johnEvalRow: 32,
            truthNeedsDocs: true,
            truthPages: ['contents/docs/mcp-analytics/events.mdx'],
            prData: {
              files: [{ status: 'M', path: 'packages/mcp/src/index.ts', text: e2Ts }],
              diffByPath: { 'packages/mcp/src/index.ts': '-  return capture("$mcp_tool_call", { distinct_id: "anonymous" });\n+  return capture("$mcp_unknown_tool", { distinct_id: generateSessionId() });\n' },
            },
          },
        ],
      },
      agentExecutor: async () => {
        judgeCalls++;
        return {
          data: {
            needs_docs: true,
            change_kind: 'update',
            affected_pages: ['contents/docs/mcp-analytics/events.mdx'],
            contradicted_claim_codes: ['MCPA-ALL-C-000001'],
            new_facts: [{
              def: t0Def.id,
              type: 'fact',
              sectionCode: 'MCPA-1.1',
              claim: 'TypeScript MCP wrapper emits $mcp_unknown_tool with generated session IDs.',
              quote: 'return capture("$mcp_unknown_tool", { distinct_id: generateSessionId() });',
            }],
            reason: 'Contradicts Go/Rust-only claim on events.mdx.',
          },
        };
      },
    });

    // R1 (unchanged ownLines MD5), R2 (flagged), and R3 (human MDX) all ran in 0 LLM calls; only R4 called the judge!
    expect(judgeCalls).toBe(1);
    expect(res.state.replayScorecard.metrics.needsDocsF1).toBe(1);
    expect(res.state.replayScorecard.metrics.pageRecall).toBe(1);
    expect(res.state.replayScorecard.metrics.johnEvalAgreement).toBe('1/1 (100.0%)');
    expect(res.state.claims[0].state).toBe('unverified_human');
  });

  it('ships the 24-event MCPA dataset and verified register/scorecard under facts/registers/mcp-analytics', () => {
    expect(MCP_ANALYTICS_REPLAY_EVENTS).toHaveLength(24);
    expect(MCP_ANALYTICS_REPLAY_EVENTS.filter(e => e.johnEvalRow !== undefined)).toHaveLength(8);

    const regDir = join(REPO_ROOT, 'facts', 'registers', 'mcp-analytics');
    if (existsSync(join(regDir, 'replay-scorecard.json'))) {
      const sc = JSON.parse(readFileSync(join(regDir, 'replay-scorecard.json'), 'utf8'));
      const cont = sc.arms.kw_plus_ia_continuous.metrics;
      expect(cont.johnEvalAgreement).toBe('8/8 (100.0%)');
      expect(cont.needsDocsF1).toBe(1);
      expect(cont.pageRecall).toBe(1);

      const reg = JSON.parse(readFileSync(join(regDir, 'mcpa.codes.json'), 'utf8'));
      expect(reg.tool).toBe('MCPA');
      expect(reg.retiredLeaves.length).toBeGreaterThan(50);
      const sampleRetired = reg.retiredLeaves[0].code;
      expect(queryAuditTrail(reg, sampleRetired).status).toBe('tombstoned');
    }
  });
});
