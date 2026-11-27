// Workflow 3: Two-Gate Hash Refresh, Human Soft-Drift Reconciliation & Lifecycle Audit Trail
// (RFC "Drift, lifecycle, and audit trails").
//
// Top-level execution order:
//   1. [script] hash-refresh         -> Detached commit outer gate -> MD5 inner check (0 LLM) + PortContracts
//   2. [script] reconcile-docs-drift -> 3-tier human MDX soft-drift reconciler (0 LLM)
//   3. [script] trace-blast-radius   -> Deterministic symbol -> F -> PR -> UC -> C -> page backwalk (0 LLM)
//   4. [agent]  judge-stale-claims   -> Neon high-effort judge waking ONLY on changed/new/deleted symbols
//   5. [script] retire-and-commit    -> Apply Dewey v3 renames/tombstones/forward pointers and update claim states
import { nextClaimState } from '../models/claim.mjs';
import { stableFactKey } from '../models/fact.mjs';
import { refreshDetachedPin } from '../models/pin.mjs';
import { assignDeweyCodesV3 } from '../models/register.mjs';
import { agentStep, defineWorkflow, scriptStep } from '../models/workflow.mjs';
import { traceBlastRadius } from '../tools/blast-radius.mjs';
import { reconcileHumanMdxDrift } from '../tools/mdx-splitter.mjs';
import { checkPortContracts } from '../tools/port-linker.mjs';

function runHashRefresh(ctx) {
  const headCommits = ctx.state.headCommits || {};
  const readSlice = ctx.state.readSlice || ((repo, commit, path) => ctx.git?.readFileAtCommit(repo, commit, path) ?? null);
  const worklist = [];
  let freshCount = 0;
  let bumpedCount = 0;
  let skippedSameCommit = 0;

  for (const [defId, anchor] of Object.entries(ctx.state.anchors || {})) {
    const headCommit = headCommits[anchor.repo] || anchor.pin?.commit;
    const res = refreshDetachedPin({
      pin: anchor.pin,
      headCommit,
      getSliceText: () => readSlice(anchor.repo, headCommit, anchor.path, anchor.ownLines),
    });

    if (res.state === 'fresh') {
      freshCount++;
      if (!res.hashChecked) skippedSameCommit++;
      if (res.bumped) {
        bumpedCount++;
        anchor.pin = res.pin;
      }
    } else {
      worklist.push({
        defId,
        repo: anchor.repo,
        path: anchor.path,
        surface: anchor.surface,
        refreshState: res.state,
        prevPin: res.pin,
        candidatePin: res.candidatePin,
      });
    }
  }

  // Also check versioned platform PortContracts (Capture, Ingestion, HyperCache, etc.)
  const contractCheck = checkPortContracts({
    contracts: ctx.state.portContracts || [],
    headCommits,
    readSlice,
  });

  ctx.state.staleWorklist = worklist;
  ctx.state.driftedContracts = contractCheck.driftedContracts;
  return {
    fresh: freshCount,
    skippedSameCommit,
    bumpedZeroLlm: bumpedCount,
    driftedSymbols: worklist.length,
    driftedContracts: contractCheck.driftedContracts.length,
  };
}

function runReconcileDocsDrift(ctx) {
  if (!Array.isArray(ctx.state.nextDocPieces) || !ctx.state.nextDocPieces.length) {
    return { skipped: true, reason: 'no_next_doc_pieces' };
  }
  const res = reconcileHumanMdxDrift({
    prevClaims: ctx.state.claims || [],
    nextPieces: ctx.state.nextDocPieces,
    docsCommit: ctx.state.headCommits?.['posthog-com'] || null,
  });
  ctx.state.claims = res.reconciledClaims;
  ctx.state.retiredClaimCodes = res.retiredClaimCodes;
  ctx.state.unmappedNewDocPieces = res.unmappedNewPieces;
  return res.stats;
}

function runTraceBlastRadius(ctx) {
  const changedDefIds = (ctx.state.staleWorklist || []).map(w => w.defId);
  const blast = traceBlastRadius({
    changedDefIds,
    driftedContracts: ctx.state.driftedContracts || [],
    facts: ctx.state.facts || [],
    portLinks: ctx.state.portLinks || [],
    procedures: ctx.state.procedures || [],
    useCases: ctx.state.useCases || [],
    claims: ctx.state.claims || [],
  });
  ctx.state.blastRadius = blast;
  return {
    changedSymbols: blast.changedDefIds.length,
    directFacts: blast.directFactCodes.length,
    oneHopFacts: blast.oneHopFactCodes.length,
    affectedClaims: blast.affectedClaimCodes.length,
    affectedPages: blast.affectedDocsPages.length,
  };
}

function buildDriftJudgeBatches(ctx) {
  const worklist = ctx.state.staleWorklist || [];
  const driftedContracts = ctx.state.driftedContracts || [];
  if (!worklist.length && !driftedContracts.length) return [];

  const blast = ctx.state.blastRadius || {};
  const lines = [
    '### Changed / deleted pinned symbols:',
    ...worklist.map(w => `- ${w.defId} [${w.refreshState}] (${w.repo}:${w.path})`),
    ...(driftedContracts.length
      ? ['\n### Drifted platform PortContracts:', ...driftedContracts.map(c => `- ${c.id} (${c.area}): consumers=${JSON.stringify(c.consumers)}`)]
      : []),
    `\n### Deterministic blast radius:\n${JSON.stringify(blast, null, 2)}`,
  ];

  return [{
    id: 'judge-drift-main',
    vars: { worklistBlock: lines.join('\n') },
  }];
}

function applyDriftJudgments(ctx, outputs) {
  const verdicts = [];
  const leafChanges = [];
  const updatedFacts = [...(ctx.state.facts || [])];
  const claimByCode = new Map((ctx.state.claims || []).map(c => [c.claimCode || c.code || c.pieceId, c]));

  for (const { result } of outputs) {
    const d = result.data;
    if (!d) continue;
    verdicts.push({ verdict: d.verdict, summary: d.summary });

    // Behavior-preserving refactors simply advance candidate pins with 0 docs changes.
    if (d.verdict === 'no_behavior_change') {
      for (const w of ctx.state.staleWorklist || []) {
        if (w.candidatePin && ctx.state.anchors?.[w.defId]) {
          ctx.state.anchors[w.defId].pin = w.candidatePin;
        }
      }
      continue;
    }

    // Real behavior change: append new/updated facts, record retirements, flip affected claims to contradicted.
    for (const nf of d.new_or_updated_facts || []) {
      const anchor = ctx.state.anchors?.[nf.def];
      updatedFacts.push({
        id: `F-drift-${updatedFacts.length + 1}`,
        def: nf.def,
        surface: nf.surface,
        type: nf.type,
        claim: nf.claim,
        quote: nf.quote,
        pin: anchor?.pin || null,
      });
    }
    for (const ret of d.retired_fact_codes || []) {
      leafChanges.push({
        retire: [ret.code],
        op: ret.op,
        to: ret.to || [],
        reason: ret.reason,
      });
    }
    for (const clCode of d.affected_claim_codes || []) {
      const cl = claimByCode.get(clCode);
      if (cl && cl.state !== 'contradicted') {
        cl.state = nextClaimState(cl.state, cl.state === 'stale' ? 'judge_contradicted' : 'contradict');
      }
    }
  }

  ctx.state.facts = updatedFacts;
  ctx.state.pendingLeafChanges = leafChanges;
  ctx.state.driftVerdicts = verdicts;
  return { verdicts: verdicts.length, retirementsQueued: leafChanges.length };
}

function runRetireAndCommit(ctx) {
  if (!ctx.state.register) return { skipped: true, reason: 'no_register_loaded' };
  const productCode = ctx.product.code || ctx.state.register.tool || 'IA';
  const surfaces = ctx.product.surfaces || ctx.state.register.surfaces || ['API'];
  const leaves = (ctx.state.facts || []).map(f => ({
    kind: 'F',
    surface: f.surface,
    key: stableFactKey({ surface: f.surface, defId: f.def, factType: f.type, quote: f.quote }),
    title: f.claim.slice(0, 96),
    quote: f.quote,
  }));

  const res = assignDeweyCodesV3({
    productCode,
    surfaces,
    outline: ctx.state.outline || [],
    leaves,
    register: ctx.state.register,
    ucRegister: ctx.state.ucRegister || null,
    leafChanges: ctx.state.pendingLeafChanges || [],
    autoRetireMissingLeaves: false,
  });

  ctx.state.register = res.register;
  ctx.state.ucRegister = res.ucRegister;
  return res.stats;
}

export const refreshDriftWorkflow = defineWorkflow({
  id: 'refresh-drift',
  title: 'Two-Gate Hash Refresh & Drift Maintenance',
  description: 'Bump untouched pins at 0 LLM calls, reconcile human MDX edits, trace blast radius, judge only changed symbols, and preserve retired audit trails.',
  rfcSection: 'Drift, lifecycle, and audit trails',
  steps: [
    scriptStep({
      id: 'hash-refresh',
      description: 'Outer commit gate + inner function body MD5 check + PortContract hash refresh (0 LLM)',
      run: runHashRefresh,
    }),
    scriptStep({
      id: 'reconcile-docs-drift',
      description: '3-tier deterministic human MDX soft-drift reconciler (0 LLM)',
      run: runReconcileDocsDrift,
    }),
    scriptStep({
      id: 'trace-blast-radius',
      description: 'Walk changed symbols & contracts through F -> PR -> UC -> C -> live docs pages (0 LLM)',
      run: runTraceBlastRadius,
    }),
    agentStep({
      id: 'judge-stale-claims',
      description: 'Wake agent judge ONLY when pinned MD5 hashes or platform contracts actually changed',
      model: 'gemini-4-neon',
      effort: 'high',
      prompt: 'judge-drift.md',
      schema: 'judge-drift.schema.json',
      tools: [
        'read_pinned_slice',
        'lookup_facts_by_symbol',
        'trace_blast_radius',
        'verify_verbatim_quote',
        'lookup_audit_trail',
      ],
      mcpServers: ['docs-ia-tools'],
      concurrency: 1,
      when: ctx => (ctx.state.staleWorklist || []).length > 0 || (ctx.state.driftedContracts || []).length > 0,
      buildBatches: buildDriftJudgeBatches,
      applyOutputs: applyDriftJudgments,
    }),
    scriptStep({
      id: 'retire-and-commit',
      description: 'Write Dewey v3 forward pointers and tombstones into the append-only register (0 LLM)',
      run: runRetireAndCommit,
    }),
  ],
});
