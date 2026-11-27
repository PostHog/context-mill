// Workflow 1: Build Derived Knowledge IA (RFC "Build pipeline").
//
// Top-level execution order:
//   1. [script] inventory-symbols    -> AST/YAML symbol extraction + detached `{commit, code_hash}` pins
//   2. [agent]  extract-facts        -> Hydrogen batched fact + port extraction with verbatim quote gates
//   3. [script] wire-ports           -> 0-LLM exact + HTTP wildcard + implied model_hook port wiring
//   4. [agent]  connect-seams        -> Neon classification of cross-team boundaries onto pinned platform seams
//   5. [agent]  assemble-procedures  -> Neon 1-surface procedure assembly citing verified facts
//   6. [script] assign-codes         -> Dewey v3 permanent append-only register with commit-free stable keys
import { isConnectCandidate, stableFactKey, validateFact } from '../models/fact.mjs';
import { assignDeweyCodesV3 } from '../models/register.mjs';
import { agentStep, defineWorkflow, scriptStep } from '../models/workflow.mjs';
import { classifyFileExclusion, indexSourceFile, planSymbolBatches } from '../tools/ast-pins.mjs';
import { wireDeterministicPorts } from '../tools/port-linker.mjs';

async function runInventorySymbols(ctx) {
  // If defs were preloaded in state (e.g., replay or test fixture), index them cleanly.
  if (Array.isArray(ctx.state.defs) && ctx.state.defs.length > 0 && !ctx.state.sourceFiles) {
    ctx.state.defsById = new Map(ctx.state.defs.map(d => [d.id, d]));
    ctx.state.anchors = Object.fromEntries(ctx.state.defs.map(d => [d.id, d]));
    return { defs: ctx.state.defs.length, excludedFiles: 0 };
  }

  const defs = [];
  const excludedFiles = [];
  const sourceFiles = ctx.state.sourceFiles || [];

  for (const file of sourceFiles) {
    const excl = classifyFileExclusion(file.repo, file.path, ctx.product);
    if (excl.excluded) {
      excludedFiles.push({ ...file, ...excl });
      continue;
    }
    const text = file.text ?? ctx.git?.readFileAtCommit(file.repo, file.commit, file.path) ?? null;
    const fileDefs = await indexSourceFile({
      repo: file.repo,
      commit: file.commit,
      path: file.path,
      text,
      productConfig: ctx.product,
      parseAst: ctx.parseAst,
    });
    defs.push(...fileDefs);
  }

  ctx.state.defs = defs;
  ctx.state.defsById = new Map(defs.map(d => [d.id, d]));
  ctx.state.anchors = Object.fromEntries(defs.map(d => [d.id, d]));
  ctx.state.excludedFiles = excludedFiles;
  return { defs: defs.length, excludedFiles: excludedFiles.length };
}

function buildExtractBatches(ctx) {
  const batches = planSymbolBatches(ctx.state.defs || []);
  return batches.map((b, idx) => ({
    id: `extract-${idx + 1}:${b.fileKey}`,
    defs: b.defs,
    vars: {
      definitionsBlock: b.defs
        .map(d => `### DEF: ${d.id} (surface=${d.surface}, lines=${d.start}-${d.end})\n\`\`\`\n${d.sliceText}\n\`\`\``)
        .join('\n\n'),
    },
  }));
}

function applyExtractedFacts(ctx, outputs) {
  const accepted = [];
  const rejected = [];
  const noBehavior = [];
  let seq = 1;

  for (const { batch, result } of outputs) {
    const defById = new Map(batch.defs.map(d => [d.id, d]));
    for (const nb of result.data?.no_behavior || []) {
      if (defById.has(nb.def)) noBehavior.push(nb);
    }
    for (const raw of result.data?.facts || []) {
      const def = defById.get(raw.def) || (batch.defs.length === 1 ? batch.defs[0] : null);
      if (!def) {
        rejected.push({ fact: raw, error: `Unknown def: ${raw.def}` });
        continue;
      }
      const err = validateFact({ ...raw, path: def.path }, def.sliceText);
      if (err) {
        rejected.push({ fact: raw, error: err });
        continue;
      }
      const id = `F-${seq++}`;
      accepted.push({
        id,
        def: def.id,
        repo: def.repo,
        path: def.path,
        surface: def.surface,
        pin: def.pin,
        type: raw.type,
        claim: raw.claim,
        quote: raw.quote,
        ...(raw.port ? { port: raw.port } : {}),
        ...(raw.ports ? { ports: raw.ports } : {}),
      });
    }
  }

  ctx.state.facts = accepted;
  ctx.state.rejectedFacts = rejected;
  ctx.state.noBehavior = noBehavior;
  return { accepted: accepted.length, rejected: rejected.length, noBehavior: noBehavior.length };
}

function runWirePorts(ctx) {
  const links = wireDeterministicPorts(ctx.state.facts || []);
  ctx.state.portLinks = links;
  return { exactLinks: links.length };
}

function buildConnectBatches(ctx) {
  const candidates = (ctx.state.facts || []).filter(isConnectCandidate);
  const menu = ctx.state.platformMenu || [];
  if (!candidates.length || !menu.length) return [];

  const menuBlock = menu.map(m => `- ${m.id} (${m.area}): ${m.carrier}`).join('\n');
  const batches = [];
  for (let i = 0; i < candidates.length; i += 18) {
    const slice = candidates.slice(i, i + 18);
    batches.push({
      id: `connect-${batches.length + 1}`,
      facts: slice,
      vars: {
        platformMenuBlock: menuBlock,
        candidateFactsBlock: slice
          .map(f => `- ${f.id} [${f.surface}/${f.type}] (${f.def}): ${f.claim} | quote: ${JSON.stringify(f.quote)}`)
          .join('\n'),
      },
    });
  }
  return batches;
}

function applyConnectedSeams(ctx, outputs) {
  const accepted = [];
  for (const { result } of outputs) {
    for (const link of result.data?.links || []) {
      accepted.push(link);
    }
  }
  ctx.state.platformLinks = accepted;
  return { seamLinks: accepted.length };
}

function buildProcedureBatches(ctx) {
  const bySurface = new Map();
  for (const f of ctx.state.facts || []) {
    if (!bySurface.has(f.surface)) bySurface.set(f.surface, []);
    bySurface.get(f.surface).push(f);
  }
  return [...bySurface.entries()].map(([surface, surfaceFacts]) => ({
    id: `procedures-${surface}`,
    surface,
    vars: {
      surface,
      surfaceFactsBlock: surfaceFacts
        .map(f => `- ${f.id} [${f.type}] (${f.def}): ${f.claim}`)
        .join('\n'),
    },
  }));
}

function applyProcedures(ctx, outputs) {
  const validFactIds = new Set((ctx.state.facts || []).map(f => f.id));
  const procedures = [];
  const droppedRefs = [];

  for (const { batch, result } of outputs) {
    for (const pr of result.data?.procedures || []) {
      const steps = (pr.steps || []).map(st => {
        const verifiedFacts = (st.facts || []).filter(fid => {
          if (validFactIds.has(fid)) return true;
          droppedRefs.push({ procedure: pr.id, fact: fid });
          return false;
        });
        return { ...st, facts: verifiedFacts };
      });
      procedures.push({ ...pr, surface: batch.surface, steps });
    }
  }

  ctx.state.procedures = procedures;
  ctx.state.droppedProcedureFactRefs = droppedRefs;
  return { procedures: procedures.length, droppedRefs: droppedRefs.length };
}

function runAssignCodes(ctx) {
  const productCode = ctx.product.code || 'IA';
  const surfaces = ctx.product.surfaces || [...new Set((ctx.state.facts || []).map(f => f.surface))];
  const leaves = [
    ...(ctx.state.facts || []).map(f => ({
      kind: 'F',
      surface: f.surface,
      key: stableFactKey({ surface: f.surface, defId: f.def, factType: f.type, quote: f.quote }),
      title: f.claim.slice(0, 96),
      quote: f.quote,
      refId: f.id,
    })),
    ...(ctx.state.procedures || []).map(pr => ({
      kind: 'PR',
      surface: pr.surface,
      key: `pr:${pr.surface.toLowerCase()}:${pr.id}`,
      title: pr.goal || pr.id,
      refId: pr.id,
    })),
  ];

  const assigned = assignDeweyCodesV3({
    productCode,
    surfaces,
    outline: ctx.state.outline || [],
    useCases: ctx.state.useCases || [],
    leaves,
    register: ctx.state.register || null,
    ucRegister: ctx.state.ucRegister || null,
  });

  const codeByRef = new Map(assigned.leaves.map(l => [l.refId, l.code]));
  ctx.state.facts = (ctx.state.facts || []).map(f => ({ ...f, code: codeByRef.get(f.id) || f.id }));
  ctx.state.portLinks = (ctx.state.portLinks || []).map(l => ({
    ...l,
    from: codeByRef.get(l.from) || l.from,
    to: codeByRef.get(l.to) || l.to,
  }));
  ctx.state.procedures = (ctx.state.procedures || []).map(pr => ({
    ...pr,
    code: codeByRef.get(pr.id) || pr.id,
    steps: (pr.steps || []).map(st => ({
      ...st,
      facts: (st.facts || []).map(fid => codeByRef.get(fid) || fid),
    })),
  }));
  ctx.state.register = assigned.register;
  ctx.state.ucRegister = assigned.ucRegister;
  return assigned.stats;
}

export const buildIaWorkflow = defineWorkflow({
  id: 'build-ia',
  title: 'Build Derived Knowledge IA',
  description: 'Extract pinned AST facts, wire deterministic ports, connect platform seams, assemble procedures, and mint permanent Dewey v3 codes.',
  rfcSection: 'Build pipeline',
  steps: [
    scriptStep({
      id: 'inventory-symbols',
      description: 'Index in-scope AST/YAML symbols with detached { commit, code_hash, own_runs } pins (0 LLM)',
      run: runInventorySymbols,
    }),
    agentStep({
      id: 'extract-facts',
      description: 'Extract outside-in typed facts and cross-boundary ports from bounded symbol slices',
      model: 'gemini-4-hydrogen',
      effort: 'medium',
      prompt: 'extract-facts.md',
      schema: 'extract-facts.schema.json',
      tools: ['read_pinned_slice', 'verify_verbatim_quote', 'validate_fact_batch'],
      mcpServers: ['docs-ia-tools'],
      concurrency: 6,
      buildBatches: buildExtractBatches,
      applyOutputs: applyExtractedFacts,
    }),
    scriptStep({
      id: 'wire-ports',
      description: 'Wire internal emitters to handlers across http, event, store, and implied model_hook seams (0 LLM)',
      run: runWirePorts,
    }),
    agentStep({
      id: 'connect-seams',
      description: 'Classify cross-team boundaries onto pinned platform-* seams without crawling unrelated repos',
      model: 'gemini-4-neon',
      effort: 'medium',
      prompt: 'connect-seams.md',
      schema: 'connect-seams.schema.json',
      tools: ['read_pinned_slice', 'lookup_facts_by_symbol'],
      mcpServers: ['docs-ia-tools'],
      concurrency: 4,
      buildBatches: buildConnectBatches,
      applyOutputs: applyConnectedSeams,
    }),
    agentStep({
      id: 'assemble-procedures',
      description: 'Chain prerequisites and verified facts into 1-surface procedures',
      model: 'gemini-4-neon',
      effort: 'medium',
      prompt: 'assemble-procedures.md',
      schema: 'assemble-procedures.schema.json',
      tools: ['lookup_facts_by_symbol', 'query_fact'],
      mcpServers: ['docs-ia-tools'],
      concurrency: 4,
      buildBatches: buildProcedureBatches,
      applyOutputs: applyProcedures,
    }),
    scriptStep({
      id: 'assign-codes',
      description: 'Mint or relocate permanent Dewey v3 codes with commit-free stable keys (0 LLM)',
      run: runAssignCodes,
    }),
  ],
});
