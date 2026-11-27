import { describe, expect, it } from 'vitest';
import { describeWorkflow, validateWorkflow } from '../models/workflow.mjs';
import { PROMPTS_DIR } from '../prompts/loader.mjs';
import { buildScopedMcpSettings } from '../runtime/agent-adapter.mjs';
import { runWorkflow, SCHEMAS_DIR } from '../runtime/runner.mjs';
import { createToolCatalog } from '../tools/catalog.mjs';
import { buildIaWorkflow } from '../workflows/build-ia.workflow.mjs';
import { compileSkillsWorkflow } from '../workflows/compile-skills.workflow.mjs';
import { WORKFLOWS } from '../workflows/index.mjs';
import { mapDocsWorkflow } from '../workflows/map-docs.workflow.mjs';
import { refreshDriftWorkflow } from '../workflows/refresh-drift.workflow.mjs';

describe('top-level workflows & co-located tool/MCP config bindings', () => {
  it('validates every registered workflow prompt, schema, and deterministic tool binding', () => {
    const catalog = createToolCatalog(() => ({}));
    for (const wf of WORKFLOWS) {
      expect(validateWorkflow(wf, { toolCatalog: catalog, promptsDir: PROMPTS_DIR, schemasDir: SCHEMAS_DIR })).toBe(true);
      const desc = describeWorkflow(wf);
      expect(desc.steps.length).toBeGreaterThan(0);
      for (const step of wf.steps) {
        if (step.kind === 'agent') {
          const settings = buildScopedMcpSettings({ step, stateSnapshotPath: '/tmp/state.json' });
          expect(settings.mcpServers['docs-ia-tools'].args).toContain(step.tools.join(','));
        }
      }
    }
  });

  it('executes build-ia -> map-docs -> refresh-drift (0-LLM bump + changed-MD5 judge) -> compile-skills end to end', async () => {
    const product = { slug: 'mcp-analytics', name: 'MCP Analytics', code: 'MCPA', surfaces: ['TS', 'API', 'MCP'] };
    const tsCodeV1 = 'export function wrapMcpServer(apiKey) {\n  return capture("$mcp_tool_call", { apiKey, limit: 100 });\n}';
    const pyCodeV1 = 'def query_mcp_events(team_id):\n    return execute_hogql_query("SELECT * FROM events WHERE event = \'$mcp_tool_call\'")';
    const docV1 = '# MCP Analytics\n\nThe TypeScript wrapper captures `$mcp_tool_call` events with a limit of 100 properties.\n';

    const invokedSteps = [];
    const mockAgent = async ({ step, batch, allowedTools }) => {
      invokedSteps.push({ stepId: step.id, model: step.model, tools: allowedTools });
      if (step.id === 'extract-facts') {
        const allMockFacts = [
          {
            def: 'posthog-js:packages/ai/src/mcp/wrap.ts#wrapMcpServer',
            type: 'fact',
            claim: 'Wrapping an MCP server captures $mcp_tool_call events with a 100 property limit.',
            quote: 'return capture("$mcp_tool_call", { apiKey, limit: 100 });',
            port: { kind: 'event', dir: 'emit', key: '$mcp_tool_call' },
          },
          {
            def: 'posthog:products/mcp_analytics/backend/api.py#query_mcp_events',
            type: 'fact',
            claim: 'Backend analytics queries $mcp_tool_call events via HogQL.',
            quote: 'return execute_hogql_query("SELECT * FROM events WHERE event = \'$mcp_tool_call\'")',
            port: { kind: 'event', dir: 'handle', key: '$mcp_tool_call' },
          },
        ];
        const batchDefIds = new Set(batch.defs.map(d => d.id));
        return { data: { facts: allMockFacts.filter(f => batchDefIds.has(f.def)) } };
      }
      if (step.id === 'assemble-procedures') {
        if (batch.surface !== 'TS') return { data: { procedures: [] } };
        return {
          data: {
            procedures: [{
              id: 'proc-wrap-mcp',
              goal: 'Instrument MCP server',
              actor: 'developer',
              entry: 'wrapMcpServer',
              steps: [{ text: 'Call wrapMcpServer with project key', facts: ['F-1'] }],
            }],
          },
        };
      }
      if (step.id === 'bind-claims') {
        return {
          data: {
            bindings: [{
              piece_id: 'contents/docs/mcp-analytics/typescript.mdx#L3-L3',
              state: 'fresh',
              fact_codes: ['MCPA-TS-F-000001'],
              reason: 'Matches pinned wrapMcpServer fact',
            }],
          },
        };
      }
      if (step.id === 'judge-stale-claims') {
        return {
          data: {
            verdict: 'behavior_changed',
            summary: 'Property limit increased from 100 to 250.',
            new_or_updated_facts: [{
              def: 'posthog-js:packages/ai/src/mcp/wrap.ts#wrapMcpServer',
              surface: 'TS',
              type: 'limit',
              claim: 'Wrapping an MCP server captures $mcp_tool_call events with a 250 property limit.',
              quote: 'return capture("$mcp_tool_call", { apiKey, limit: 250 });',
            }],
            retired_fact_codes: [{
              code: 'MCPA-TS-F-000001',
              op: 'rename',
              to: ['MCPA-TS-F-000002'],
              reason: 'Limit raised from 100 to 250',
            }],
            affected_claim_codes: ['contents/docs/mcp-analytics/typescript.mdx#L3-L3'],
            affected_docs_pages: ['contents/docs/mcp-analytics/typescript.mdx'],
          },
        };
      }
      return { data: {} };
    };

    // 1. Build IA
    const built = await runWorkflow(buildIaWorkflow, {
      product,
      initialState: {
        sourceFiles: [
          { repo: 'posthog-js', commit: 'js1', path: 'packages/ai/src/mcp/wrap.ts', text: tsCodeV1 },
          { repo: 'posthog', commit: 'ph1', path: 'products/mcp_analytics/backend/api.py', text: pyCodeV1 },
        ],
        useCases: [{ key: 'uc-instrument-ts', title: 'Instrument TS MCP server', procedures: ['MCPA-TS-PR-001'] }],
      },
      agentExecutor: mockAgent,
    });
    expect(built.state.facts).toHaveLength(2);
    expect(built.state.portLinks).toHaveLength(1);
    expect(built.state.portLinks[0].key).toBe('$mcp_tool_call');
    expect(built.state.facts[0].code).toBe('MCPA-TS-F-000001');

    // 2. Map live docs
    const mapped = await runWorkflow(mapDocsWorkflow, {
      product,
      initialState: {
        ...built.state,
        docsPages: [{ pagePath: 'contents/docs/mcp-analytics/typescript.mdx', text: docV1 }],
      },
      agentExecutor: mockAgent,
    });
    expect(mapped.state.coverage.scorecard.claimStates.fresh).toBe(1);
    expect(mapped.state.coverage.scorecard.coveredFactsOneHop).toBe(2);

    // 3a. Refresh drift when commit moves but code MD5 is IDENTICAL -> 0 LLM calls!
    const callsBeforeZeroDrift = invokedSteps.length;
    const noDrift = await runWorkflow(refreshDriftWorkflow, {
      product,
      initialState: {
        ...mapped.state,
        headCommits: { 'posthog-js': 'js2', posthog: 'ph2' },
        readSlice: (repo) => (repo === 'posthog-js' ? tsCodeV1 : pyCodeV1),
      },
      agentExecutor: mockAgent,
    });
    expect(invokedSteps.length).toBe(callsBeforeZeroDrift);
    expect(noDrift.trace.find(t => t.stepId === 'hash-refresh').summary.bumpedZeroLlm).toBe(2);
    expect(noDrift.trace.find(t => t.stepId === 'judge-stale-claims').status).toBe('skipped');

    // 3b. Refresh drift when wrapMcpServer body changes -> wakes judge-stale-claims, flips claim to contradicted, retires old code!
    const tsCodeV2 = tsCodeV1.replace('limit: 100', 'limit: 250');
    const withDrift = await runWorkflow(refreshDriftWorkflow, {
      product,
      initialState: {
        ...noDrift.state,
        headCommits: { 'posthog-js': 'js3', posthog: 'ph2' },
        readSlice: (repo) => (repo === 'posthog-js' ? tsCodeV2 : pyCodeV1),
      },
      agentExecutor: mockAgent,
    });
    expect(withDrift.trace.find(t => t.stepId === 'judge-stale-claims').status).toBe('done');
    expect(withDrift.state.claims.find(c => c.pieceId.endsWith('#L3-L3')).state).toBe('contradicted');
    expect(withDrift.state.register.retiredLeaves.some(r => r.code === 'MCPA-TS-F-000001')).toBe(true);

    // 4. Compile downstream skills & verify 0 broken anchors
    const compiled = await runWorkflow(compileSkillsWorkflow, {
      product,
      initialState: {
        ...built.state,
        useCases: [{ code: 'UC-1', title: 'Instrument TS MCP server', procedures: ['MCPA-TS-PR-001'] }],
      },
    });
    expect(compiled.state.anchorVerification.ok).toBe(true);
    expect(compiled.state.compiledSkills[0].markdown).toContain('MCPA-TS-F-000001');
  });

  it('supports dry-run mode without invoking any live agent', async () => {
    const res = await runWorkflow(buildIaWorkflow, {
      product: { slug: 'mcp-analytics', code: 'MCPA', surfaces: ['TS'] },
      initialState: {
        sourceFiles: [
          { repo: 'posthog-js', commit: 'js1', path: 'packages/ai/src/mcp/wrap.ts', text: 'export function a() { return 1; }\n' },
        ],
      },
      dryRun: true,
    });
    const extractTrace = res.trace.find(t => t.stepId === 'extract-facts');
    expect(extractTrace.status).toBe('dry_run');
    expect(extractTrace.tools).toContain('verify_verbatim_quote');
    expect(extractTrace.mcpServers).toEqual(['docs-ia-tools']);
  });
});
