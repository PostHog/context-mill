import { describe, expect, it } from 'vitest';
import { createDetachedPin } from '../models/pin.mjs';
import { inspectPrompt, renderPrompt } from '../prompts/loader.mjs';
import { indexSourceFile } from '../tools/ast-pins.mjs';
import { traceBlastRadius } from '../tools/blast-radius.mjs';
import { createToolCatalog } from '../tools/catalog.mjs';
import { createMcpDispatcher } from '../tools/mcp-server.mjs';
import { insertFactsIntoDb, openFactsDb, queryFactsForPieces } from '../tools/facts-sqlite.mjs';
import { reconcileHumanMdxDrift, splitMdxFile } from '../tools/mdx-splitter.mjs';
import { checkPortContracts, wireDeterministicPorts } from '../tools/port-linker.mjs';
import { compileUseCaseSkill, verifySkillAnchors } from '../tools/skill-compiler.mjs';

describe('prompts/loader (shared includes & strict vars)', () => {
  it('inlines shared fragments and throws on unresolved placeholders', () => {
    const info = inspectPrompt('extract-facts.md');
    expect(info.includes).toContain('shared/verbatim-quote-law.md');
    expect(info.includes).toContain('shared/port-taxonomy.md');
    expect(info.variables).toContain('definitionsBlock');

    expect(() => renderPrompt('extract-facts.md', { product: 'mcp-analytics' })).toThrow(/unresolved placeholders/);

    const rendered = renderPrompt('extract-facts.md', {
      product: 'mcp-analytics',
      boundToolsList: '- `read_pinned_slice`',
      definitionsBlock: '### DEF: posthog:a.py#foo',
    });
    expect(rendered).toContain('Verbatim quote law');
    expect(rendered).toContain('Source quarantine');
    expect(rendered).toContain('mcp-analytics');
  });
});

describe('tools (AST pins, port linker, MDX soft-drift, blast radius, skill compiler)', () => {
  it('indexes YAML MCP tools and source functions with detached pins', async () => {
    const yamlText = [
      'tools:',
      '  mcp-analytics-summary:',
      '    operation: list_summary',
      '    scopes: [mcp:read]',
      '  mcp-analytics-tools:',
      '    operation: list_tools',
      '    scopes: [mcp:read]',
    ].join('\n');

    const defs = await indexSourceFile({
      repo: 'posthog',
      commit: 'abc123',
      path: 'products/mcp_analytics/mcp/tools.yaml',
      text: yamlText,
    });
    expect(defs.map(d => d.symbol)).toEqual(['mcp-analytics-summary', 'mcp-analytics-tools']);
    expect(defs[0].surface).toBe('MCP');
    expect(defs[0].pin.commit).toBe('abc123');
    expect(defs[0].pin.code_hash).toHaveLength(32);

    // 4-space indented tools.yaml (e.g. products/replay_vision/mcp/tools.yaml) must index every tool
    const fourSpaceYaml = [
      'category: Replay vision',
      'tools:',
      '    vision-alerts-create:',
      '        operation: vision_alerts_create',
      '        enabled: true',
      '    vision-scanners-draft:',
      '        operation: vision_scanners_draft',
      '        enabled: true',
    ].join('\n');
    const rvDefs = await indexSourceFile({
      repo: 'posthog',
      commit: 'abc123',
      path: 'products/replay_vision/mcp/tools.yaml',
      text: fourSpaceYaml,
    });
    expect(rvDefs.map(d => d.symbol)).toEqual(['vision-alerts-create', 'vision-scanners-draft']);
  });

  it('retrieves exact identifiers and cross-product seams via local SQLite FTS5 BM25', () => {
    const db = openFactsDb(':memory:');
    try {
      insertFactsIntoDb(db, 'replay-vision', [
        { _idx: 0, factCode: 'RV-MCP-F-000001', leafKey: 'k0', def: 'posthog:tools.yaml#vision-scanners-draft', repo: 'posthog', path: 'products/replay_vision/mcp/tools.yaml', symbol: 'vision-scanners-draft', surface: 'MCP', claim: 'Drafts a scanner with budget and experiment_id options.', quote: 'vision-scanners-draft:' },
        { _idx: 1, factCode: 'RV-UI-F-000001', leafKey: 'k1', def: 'posthog:Scanner.tsx#Scanner', repo: 'posthog', path: 'products/replay_vision/frontend/Scanner.tsx', symbol: 'Scanner', surface: 'UI', claim: 'Displays scanner list table.', quote: 'export function Scanner()' },
      ]);
      insertFactsIntoDb(db, 'ai-observability', [
        { _idx: 0, factCode: 'AIO-PY-F-000001', leafKey: 'aio0', def: 'posthog-python:posthog/ai/otel/spans.py#set_trace', repo: 'posthog-python', path: 'posthog/ai/otel/spans.py', symbol: 'set_trace', surface: 'PY', claim: 'Sets $ai_trace_id on LLM spans for AI Observability correlation.', quote: '$ai_trace_id' },
      ]);
      const res = queryFactsForPieces(
        db,
        [{ headingPath: 'MCP Tools', text: 'Call `vision-scanners-draft` and correlate `$ai_trace_id`.', surfaceHint: 'MCP' }],
        { product: 'replay-vision', limit: 10, crossProduct: true, crossLimit: 5 }
      );
      expect(res.inProductIndices[0]).toBe(0);
      expect(res.crossHits).toHaveLength(1);
      expect(res.crossHits[0].product).toBe('ai-observability');
    } finally {
      db.close();
    }
  });

  it('wires exact ports, wildcard HTTP routes, implied model hooks, and PortContracts at 0 LLM calls', () => {
    const facts = [
      {
        id: 'F-1',
        def: 'posthog:api.py#create_survey',
        claim: 'Creates a Survey record via API.',
        quote: 'Survey.objects.create(**data)',
        port: { kind: 'store', dir: 'write', key: 'model:Survey' },
      },
      {
        id: 'F-2',
        def: 'posthog:models.py#survey_changed',
        claim: 'Invalidates cache after Survey save.',
        quote: '@receiver(post_save, sender=Survey)',
        port: { kind: 'model_hook', dir: 'handle', key: 'Survey:post_save' },
      },
      {
        id: 'F-3',
        def: 'posthog-js:client.ts#send',
        claim: 'Posts survey sent event to capture.',
        quote: 'fetch("/i/v0/e/")',
        port: { kind: 'http', dir: 'emit', key: 'POST /i/v0/e/' },
      },
      {
        id: 'F-4',
        def: 'posthog:capture.rs#ingest',
        claim: 'Capture handles all /i/v0 routes.',
        quote: 'route("/i/v0/*")',
        port: { kind: 'http', dir: 'handle', key: '* /i/v0/*' },
      },
    ];
    const links = wireDeterministicPorts(facts);
    expect(links.some(l => l.from === 'F-1' && l.to === 'F-2' && l.by === 'implied-model-hook')).toBe(true);
    expect(links.some(l => l.from === 'F-3' && l.to === 'F-4' && l.by === 'exact-http-wildcard')).toBe(true);

    const oldPin = createDetachedPin({ commit: 'c1', text: 'max_batch = 1024' });
    const check = checkPortContracts({
      contracts: [{
        id: 'PORT-CAPTURE-V0',
        area: 'platform-capture',
        carrier: 'http:handle POST /i/v0/e',
        sources: [{ repo: 'posthog', path: 'rust/capture/v0.rs', pin: oldPin }],
        consumers: { sections: ['MCPA-1.1'], useCases: ['UC-1'], docsPages: ['contents/docs/mcp-analytics/index.mdx'] },
      }],
      headCommits: { posthog: 'c2' },
      readSlice: () => 'max_batch = 2048',
    });
    expect(check.driftedContracts).toHaveLength(1);
    expect(check.driftedContracts[0].consumers.docsPages).toContain('contents/docs/mcp-analytics/index.mdx');
  });

  it('splits MDX into structural/media/checkable pieces and reconciles human soft-drift cleanly', () => {
    const mdxV1 = [
      '---',
      'title: MCP Analytics',
      '---',
      '',
      '## Setup',
      '',
      'Pass your project API key when initializing the PostHog MCP wrapper.',
      '',
      '![Dashboard](images/dash.png)',
    ].join('\n');
    const piecesV1 = splitMdxFile('contents/docs/mcp-analytics/index.mdx', mdxV1);
    expect(piecesV1.find(p => p.kind === 'frontmatter').preState).toBe('structural');
    expect(piecesV1.find(p => p.kind === 'paragraph').mappable).toBe(true);
    expect(piecesV1.find(p => p.text.startsWith('![')).preState).toBe('unverified');

    const prevClaims = [{
      claimCode: 'MCPA-ALL-C-000001',
      pieceId: piecesV1.find(p => p.kind === 'paragraph').pieceId,
      pagePath: 'contents/docs/mcp-analytics/index.mdx',
      plainText: 'Pass your project API key when initializing the PostHog MCP wrapper.',
      state: 'fresh',
      factCodes: ['MCPA-TS-F-000001'],
    }];

    // Human tightens wording on the same page without updating IA files
    const mdxV2 = mdxV1.replace(
      'Pass your project API key when initializing the PostHog MCP wrapper.',
      'Pass your project API key when initializing the PostHog MCP server wrapper.'
    );
    const piecesV2 = splitMdxFile('contents/docs/mcp-analytics/index.mdx', mdxV2);
    const rec = reconcileHumanMdxDrift({ prevClaims, nextPieces: piecesV2, docsCommit: 'doc2' });
    expect(rec.stats.humanEdited).toBe(1);
    expect(rec.reconciledClaims[0].claimCode).toBe('MCPA-ALL-C-000001');
    expect(rec.reconciledClaims[0].state).toBe('unverified_human');
    expect(rec.reconciledClaims[0].factCodes).toEqual(['MCPA-TS-F-000001']);
  });

  it('never inverts fenced code blocks inside <Steps>, <Step>, <MultiLanguage>, or <CalloutBox> wrappers', () => {
    const longBody = Array.from({ length: 38 }, (_, idx) => `const stepLine${idx + 1} = ${idx + 1};`).join('\n');
    const mdx = [
      '---',
      'title: Install Tracing',
      '---',
      '',
      '<Steps>',
      '<Step title="Configure exporter" badge="required">',
      '',
      'Configure OpenTelemetry to send spans to `/i/v1/traces`.',
      '',
      '```ts',
      longBody,
      '```',
      '',
      'Alternatively, set `OTEL_EXPORTER_OTLP_ENDPOINT` in your environment.',
      '',
      '</Step>',
      '</Steps>',
      '',
      '<MultiLanguage>',
      '',
      '```python file=Python',
      'posthog.capture("event")',
      '```',
      '',
      '```ruby file=Ruby',
      'posthog.capture(event: "event")',
      '```',
      '',
      '</MultiLanguage>',
      '',
      '<ProductScreenshot',
      '  imageLight="https://example.com/light.png"',
      '  alt="Tracing waterfall"',
      '/>',
      '',
      '<CalloutBox icon="IconInfo" title="Note">',
      'Retention defaults to 14 days for trace spans.',
      '</CalloutBox>',
    ].join('\n');

    const pieces = splitMdxFile('contents/docs/distributed-tracing/installation/node.mdx', mdx);
    const codePieces = pieces.filter(p => p.kind === 'code');
    expect(codePieces).toHaveLength(3);
    expect(codePieces[0].text.startsWith('```ts\n')).toBe(true);
    expect(codePieces[0].text).toContain('const stepLine38 = 38;');
    expect(codePieces[1].text.startsWith('```python file=Python\n')).toBe(true);
    expect(codePieces[2].text.startsWith('```ruby file=Ruby\n')).toBe(true);
    // Zero inverted fences starting on a bare closing fence
    expect(codePieces.filter(p => /^```(\s|$)/.test(p.text.trim()))).toEqual([]);
    // Prose after long code block stays a mappable paragraph, never swallowed into an inverted fence
    const afterProse = pieces.find(p => p.kind === 'paragraph' && p.text.includes('OTEL_EXPORTER_OTLP_ENDPOINT'));
    expect(afterProse?.mappable).toBe(true);
    // Multi-line screenshot stays unverified media; short CalloutBox stays one mappable jsx piece
    expect(pieces.find(p => p.text.includes('ProductScreenshot'))?.preState).toBe('unverified');
    expect(pieces.find(p => p.text.includes('Retention defaults to 14 days'))?.mappable).toBe(true);
    // Closing tags are structural, never glued onto paragraphs
    expect(pieces.filter(p => p.kind === 'paragraph' && /<\/(Step|Steps|MultiLanguage)>/.test(p.text))).toEqual([]);
  });

  it('traces blast radius and compiles surface-sliced UC skills with 0 broken anchors', () => {
    const facts = [
      { code: 'MCPA-TS-F-000001', def: 'posthog-js:mcp.ts#wrap', surface: 'TS', type: 'fact', claim: 'Wraps MCP tool calls and emits mcp_tool_call.', quote: 'capture("mcp_tool_call")', pin: { commit: '11112222', code_hash: 'aaaabbbb' } },
      { code: 'MCPA-API-F-000001', def: 'posthog:api.py#query', surface: 'API', type: 'fact', claim: 'Queries mcp_tool_call events in ClickHouse.', quote: 'WHERE event = "mcp_tool_call"', pin: { commit: '11112222', code_hash: 'ccccdddd' } },
    ];
    const procedures = [
      { code: 'MCPA-TS-PR-001', surface: 'TS', goal: 'Instrument TS MCP server', steps: [{ text: 'Wrap handler', facts: ['MCPA-TS-F-000001'] }] },
      { code: 'MCPA-API-PR-001', surface: 'API', goal: 'Query analytics API', steps: [{ text: 'Call endpoint', facts: ['MCPA-API-F-000001'] }] },
    ];
    const useCases = [{ code: 'UC-1', title: 'Track MCP calls', procedures: ['MCPA-TS-PR-001', 'MCPA-API-PR-001'] }];
    const claims = [{ claimCode: 'MCPA-ALL-C-000001', pagePath: 'contents/docs/mcp-analytics/typescript.mdx', factCodes: ['MCPA-TS-F-000001'] }];

    const blast = traceBlastRadius({
      changedDefIds: ['posthog-js:mcp.ts#wrap'],
      facts,
      portLinks: [{ from: 'MCPA-TS-F-000001', to: 'MCPA-API-F-000001' }],
      procedures,
      useCases,
      claims,
    });
    expect(blast.directFactCodes).toEqual(['MCPA-TS-F-000001']);
    expect(blast.oneHopFactCodes).toEqual(['MCPA-API-F-000001']);
    expect(blast.affectedDocsPages).toEqual(['contents/docs/mcp-analytics/typescript.mdx']);

    const skill = compileUseCaseSkill({ useCase: useCases[0], procedures, facts, surfaces: ['TS'] });
    expect(skill.stats.procedures).toBe(1);
    expect(skill.markdown).toContain('MCPA-TS-F-000001');
    expect(skill.markdown).not.toContain('MCPA-API-F-000001');
    expect(verifySkillAnchors(skill.markdown)).toEqual({
      totalLinks: 1,
      declaredAnchors: 1,
      brokenLinks: [],
      ok: true,
    });
  });

  it('enforces step-scoped tool allowlists in the MCP JSON-RPC dispatcher', async () => {
    const state = {
      defsById: new Map([['posthog:a.py#foo', { repo: 'posthog', path: 'a.py', symbol: 'foo', sliceText: 'return limit_100()' }]]),
      facts: [],
    };
    const catalog = createToolCatalog(() => state);
    const dispatch = createMcpDispatcher({ catalog, allowedTools: ['read_pinned_slice', 'verify_verbatim_quote'] });

    const listResp = await dispatch({ id: 1, method: 'tools/list' });
    expect(listResp.result.tools.map(t => t.name)).toEqual(['read_pinned_slice', 'verify_verbatim_quote']);

    const okCall = await dispatch({
      id: 2,
      method: 'tools/call',
      params: { name: 'verify_verbatim_quote', arguments: { def_id: 'posthog:a.py#foo', quote: 'return limit_100()' } },
    });
    expect(okCall.result.isError).toBeUndefined();
    expect(JSON.parse(okCall.result.content[0].text).ok).toBe(true);

    // Calling a tool NOT bound to this step must fail closed!
    const deniedCall = await dispatch({
      id: 3,
      method: 'tools/call',
      params: { name: 'assign_dewey_codes', arguments: { product_code: 'SV', surfaces: ['API'] } },
    });
    expect(deniedCall.result.isError).toBe(true);
    expect(deniedCall.result.content[0].text).toMatch(/not bound to this workflow step/);
  });
});
