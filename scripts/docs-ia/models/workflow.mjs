// Declarative workflow & step specification models.
//
// Core invariant:
//   Every top-level workflow file makes the deterministic-script -> agent -> deterministic-script
//   sequence readable in one screen, and every `agentStep` binds its `model`, `effort`, `prompt`,
//   `schema`, `tools`, and `mcpServers` right next to each other in the same config object.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const STEP_KINDS = Object.freeze(['script', 'agent']);

export function scriptStep({ id, description, run, when = null }) {
  if (!id || typeof id !== 'string') throw new Error('scriptStep requires a string id');
  if (typeof run !== 'function') throw new Error(`scriptStep "${id}" requires a run(ctx) function`);
  return Object.freeze({
    kind: 'script',
    id,
    description: description || '',
    run,
    when,
  });
}

export function agentStep({
  id,
  description,
  model,
  effort = 'medium',
  prompt,
  schema,
  tools = [],
  mcpServers = [],
  concurrency = 4,
  when = null,
  buildBatches,
  applyOutputs,
}) {
  if (!id || typeof id !== 'string') throw new Error('agentStep requires a string id');
  if (!model) throw new Error(`agentStep "${id}" requires a model`);
  if (!prompt) throw new Error(`agentStep "${id}" requires a prompt filename`);
  if (!schema) throw new Error(`agentStep "${id}" requires a JSON schema filename`);
  if (typeof buildBatches !== 'function') throw new Error(`agentStep "${id}" requires buildBatches(ctx)`);
  if (typeof applyOutputs !== 'function') throw new Error(`agentStep "${id}" requires applyOutputs(ctx, results)`);

  return Object.freeze({
    kind: 'agent',
    id,
    description: description || '',
    model,
    effort,
    prompt,
    schema,
    tools: Object.freeze([...tools]),
    mcpServers: Object.freeze([...mcpServers]),
    concurrency,
    when,
    buildBatches,
    applyOutputs,
  });
}

export function defineWorkflow({ id, title, description, rfcSection = null, steps }) {
  if (!id || typeof id !== 'string') throw new Error('defineWorkflow requires a string id');
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`workflow "${id}" requires at least one step`);
  }
  const seenIds = new Set();
  for (const step of steps) {
    if (!STEP_KINDS.includes(step.kind)) throw new Error(`Unknown step kind in "${id}": ${step.kind}`);
    if (seenIds.has(step.id)) throw new Error(`Duplicate step id "${step.id}" in workflow "${id}"`);
    seenIds.add(step.id);
  }
  return Object.freeze({
    id,
    title: title || id,
    description: description || '',
    rfcSection,
    steps: Object.freeze([...steps]),
  });
}

/**
 * Validate that every agent step's prompt file, JSON schema file, and bound deterministic tools
 * exist before running step 1. Fails fast on misconfigured bindings.
 */
export function validateWorkflow(workflow, { toolCatalog, promptsDir, schemasDir }) {
  const errors = [];
  for (const step of workflow.steps) {
    if (step.kind !== 'agent') continue;
    const promptPath = join(promptsDir, step.prompt);
    if (!existsSync(promptPath)) {
      errors.push(`[${workflow.id}/${step.id}] missing prompt file: ${step.prompt}`);
    }
    const schemaPath = join(schemasDir, step.schema);
    if (!existsSync(schemaPath)) {
      errors.push(`[${workflow.id}/${step.id}] missing schema file: ${step.schema}`);
    }
    for (const toolName of step.tools) {
      if (!toolCatalog.has(toolName)) {
        errors.push(`[${workflow.id}/${step.id}] unknown tool binding: "${toolName}"`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`Invalid workflow "${workflow.id}":\n  - ${errors.join('\n  - ')}`);
  }
  return true;
}

/** Serialize a workflow's declarative structure for `cli.mjs inspect` and documentation. */
export function describeWorkflow(workflow) {
  return {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description,
    rfcSection: workflow.rfcSection,
    steps: workflow.steps.map((s, idx) => (
      s.kind === 'script'
        ? { index: idx + 1, kind: 'script', id: s.id, description: s.description }
        : {
            index: idx + 1,
            kind: 'agent',
            id: s.id,
            description: s.description,
            model: s.model,
            effort: s.effort,
            prompt: s.prompt,
            schema: s.schema,
            tools: [...s.tools],
            mcpServers: [...s.mcpServers],
            concurrency: s.concurrency,
          }
    )),
  };
}
