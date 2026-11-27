// Central registry of every top-level Docs IA workflow.
import { buildIaWorkflow } from './build-ia.workflow.mjs';
import { compileSkillsWorkflow } from './compile-skills.workflow.mjs';
import { mapDocsWorkflow } from './map-docs.workflow.mjs';
import { refreshDriftWorkflow } from './refresh-drift.workflow.mjs';

export const WORKFLOWS = Object.freeze([
  buildIaWorkflow,
  mapDocsWorkflow,
  refreshDriftWorkflow,
  compileSkillsWorkflow,
]);

export const WORKFLOW_BY_ID = new Map(WORKFLOWS.map(w => [w.id, w]));

export function getWorkflow(id) {
  const wf = WORKFLOW_BY_ID.get(id);
  if (!wf) {
    throw new Error(`Unknown workflow "${id}". Available: ${WORKFLOWS.map(w => w.id).join(', ')}`);
  }
  return wf;
}
