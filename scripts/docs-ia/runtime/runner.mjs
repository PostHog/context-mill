// Declarative workflow runner.
//
// Validates every step's prompt, JSON schema, and bound deterministic tools BEFORE step 1 runs,
// executes script steps directly, and executes agent steps through `agentExecutor` with the
// exact prompt partials, schema path, and scoped MCP tool allowlist bound to that step.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflow } from '../models/workflow.mjs';
import { PROMPTS_DIR, renderPrompt } from '../prompts/loader.mjs';
import { createToolCatalog } from '../tools/catalog.mjs';
import { executeAgyAgent, runPool } from './agent-adapter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMAS_DIR = resolve(HERE, '..', 'models', 'schemas');

function formatBoundToolsList(step, toolCatalog) {
  if (!step.tools.length) return '- None (pure structured extraction from provided batch input).';
  return step.tools
    .map(name => {
      const def = toolCatalog.get(name);
      return `- \`${name}\`: ${def?.description || 'Deterministic tool'}`;
    })
    .join('\n');
}

function serializeStateSnapshot(state) {
  return {
    defs: state.defs || [],
    anchors: state.anchors || {},
    facts: state.facts || [],
    portLinks: state.portLinks || [],
    procedures: state.procedures || [],
    useCases: state.useCases || [],
    claims: state.claims || [],
    driftedContracts: state.driftedContracts || [],
    register: state.register || null,
    ucRegister: state.ucRegister || null,
  };
}

export async function runWorkflow(
  workflow,
  {
    product = {},
    initialState = {},
    git = null,
    parseAst = null,
    agentExecutor = executeAgyAgent,
    dryRun = false,
    fromStep = null,
    toStep = null,
    promptsDir = PROMPTS_DIR,
    schemasDir = SCHEMAS_DIR,
    log = () => {},
  } = {}
) {
  const state = { ...initialState };
  if (!state.defsById && Array.isArray(state.defs)) {
    state.defsById = new Map(state.defs.map(d => [d.id, d]));
  }

  const toolCatalog = createToolCatalog(() => state);
  validateWorkflow(workflow, { toolCatalog, promptsDir, schemasDir });

  const ctx = {
    workflowId: workflow.id,
    product,
    state,
    git,
    parseAst,
    tools: toolCatalog,
    dryRun,
    log,
  };

  const trace = [];
  let started = !fromStep;

  for (const step of workflow.steps) {
    if (!started) {
      if (step.id === fromStep) started = true;
      else continue;
    }

    if (typeof step.when === 'function' && !step.when(ctx)) {
      trace.push({ stepId: step.id, kind: step.kind, status: 'skipped', reason: 'condition_false' });
      log(`[${workflow.id}] skip ${step.id} (condition false)`);
      if (step.id === toStep) break;
      continue;
    }

    const t0 = Date.now();

    if (step.kind === 'script') {
      log(`[${workflow.id}] script ${step.id}: ${step.description}`);
      const summary = await step.run(ctx);
      trace.push({
        stepId: step.id,
        kind: 'script',
        status: 'done',
        wallMs: Date.now() - t0,
        summary: summary ?? null,
      });
    } else if (step.kind === 'agent') {
      const batches = await step.buildBatches(ctx);
      const schemaPath = join(schemasDir, step.schema);
      const boundToolsList = formatBoundToolsList(step, toolCatalog);

      if (!batches.length) {
        trace.push({
          stepId: step.id,
          kind: 'agent',
          status: 'skipped',
          reason: 'zero_batches',
          model: step.model,
          effort: step.effort,
          tools: [...step.tools],
        });
        log(`[${workflow.id}] skip ${step.id} (0 batches)`);
      } else if (dryRun) {
        const renderedPreviews = batches.map(b => ({
          batchId: b.id,
          promptChars: renderPrompt(
            step.prompt,
            {
              product: product.slug || product.name || 'unknown',
              productCode: product.code || 'IA',
              boundToolsList,
              ...b.vars,
            },
            { promptsDir }
          ).length,
        }));
        trace.push({
          stepId: step.id,
          kind: 'agent',
          status: 'dry_run',
          wallMs: Date.now() - t0,
          model: step.model,
          effort: step.effort,
          prompt: step.prompt,
          schema: step.schema,
          tools: [...step.tools],
          mcpServers: [...step.mcpServers],
          batchCount: batches.length,
          batches: renderedPreviews,
        });
        log(`[${workflow.id}] dry-run agent ${step.id} (${batches.length} batches, model=${step.model}, tools=[${step.tools.join(', ')}])`);
      } else {
        log(`[${workflow.id}] agent ${step.id} (${batches.length} batches, model=${step.model}/${step.effort}, tools=[${step.tools.join(', ')}])`);
        const snapshot = step.tools.length > 0 ? serializeStateSnapshot(state) : null;
        const outputs = await runPool(batches, step.concurrency, async batch => {
          const promptText = renderPrompt(
            step.prompt,
            {
              product: product.slug || product.name || 'unknown',
              productCode: product.code || 'IA',
              boundToolsList,
              ...batch.vars,
            },
            { promptsDir }
          );
          const result = await agentExecutor({
            step,
            batch,
            promptText,
            schemaPath,
            stateSnapshot: snapshot,
            tools: toolCatalog,
            allowedTools: [...step.tools],
          });
          return { batch, result };
        });
        const summary = await step.applyOutputs(ctx, outputs);
        trace.push({
          stepId: step.id,
          kind: 'agent',
          status: 'done',
          wallMs: Date.now() - t0,
          model: step.model,
          effort: step.effort,
          prompt: step.prompt,
          schema: step.schema,
          tools: [...step.tools],
          mcpServers: [...step.mcpServers],
          batchCount: batches.length,
          summary: summary ?? null,
        });
      }
    }

    if (step.id === toStep) break;
  }

  return { workflowId: workflow.id, state, trace };
}
