// Workflow 2: Live Docs Mapping & Contradiction Verification (RFC "Docs mapping").
//
// Top-level execution order:
//   1. [script] segment-mdx          -> Source-first MDX splitter (`structural` / `unverified` / `mappable`)
//   2. [script] retrieve-candidates  -> Deterministic token-overlap candidate fact retriever (0 LLM)
//   3. [agent]  bind-claims          -> Neon first-pass claim binder against candidate facts & decisions
//   4. [agent]  judge-contradictions -> Neon high-effort second-pass judge reading full AST symbol slices
//   5. [script] compute-coverage     -> Canonical claim state tally + 1-hop port reach coverage scorecard
import { agentStep, defineWorkflow, scriptStep } from '../models/workflow.mjs';
import { splitMdxFile } from '../tools/mdx-splitter.mjs';

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .match(/[a-z0-9$_-]{3,}/g) || []
  );
}

function runSegmentMdx(ctx) {
  const pieces = [];
  for (const page of ctx.state.docsPages || []) {
    const text = page.text ?? ctx.git?.readFileAtCommit('posthog-com', page.commit, page.pagePath) ?? '';
    pieces.push(...splitMdxFile(page.pagePath, text, { surfaceHints: ctx.product.doc_surface_hints || [] }));
  }
  ctx.state.pieces = pieces;
  const mappable = pieces.filter(p => p.mappable).length;
  return { totalPieces: pieces.length, mappable, structuralOrMedia: pieces.length - mappable };
}

function runRetrieveCandidates(ctx) {
  const facts = ctx.state.facts || [];
  const indexedFacts = facts.map(f => ({
    fact: f,
    tokens: tokenize(`${f.claim} ${f.quote} ${f.def} ${f.surface}`),
  }));

  const candidatesByPiece = new Map();
  for (const piece of ctx.state.pieces || []) {
    if (!piece.mappable) continue;
    const pTokens = tokenize(`${piece.headingPath} ${piece.plainText}`);
    const scored = [];
    for (const { fact, tokens } of indexedFacts) {
      let score = 0;
      for (const tok of pTokens) if (tokens.has(tok)) score++;
      if (piece.surfaceHint !== 'ALL' && fact.surface === piece.surfaceHint) score += 2;
      if (score > 0) scored.push({ fact, score });
    }
    scored.sort((a, b) => b.score - a.score);
    candidatesByPiece.set(piece.pieceId, scored.slice(0, 12).map(s => s.fact));
  }

  ctx.state.candidatesByPiece = candidatesByPiece;
  return { mappablePiecesIndexed: candidatesByPiece.size };
}

function buildBindBatches(ctx) {
  const mappable = (ctx.state.pieces || []).filter(p => p.mappable);
  const batches = [];
  for (let i = 0; i < mappable.length; i += 10) {
    const slice = mappable.slice(i, i + 10);
    batches.push({
      id: `bind-${batches.length + 1}`,
      pieces: slice,
      vars: {
        piecesBlock: slice
          .map(p => {
            const cands = ctx.state.candidatesByPiece?.get(p.pieceId) || [];
            const candLines = cands
              .map(f => `  - ${f.code || f.id} [${f.surface}/${f.type}]: ${f.claim}`)
              .join('\n');
            return `### PIECE: ${p.pieceId} (${p.headingPath || 'top'}, surface=${p.surfaceHint})\n${p.plainText}\nCandidates:\n${candLines || '  - (none)'}`;
          })
          .join('\n\n'),
      },
    });
  }
  return batches;
}

function applyClaimBindings(ctx, outputs) {
  const pieceById = new Map((ctx.state.pieces || []).map(p => [p.pieceId, p]));
  const claims = [];

  // Preserve non-mappable structural / media pieces directly without LLM calls.
  for (const p of ctx.state.pieces || []) {
    if (!p.mappable) {
      claims.push({
        pieceId: p.pieceId,
        pagePath: p.pagePath,
        headingPath: p.headingPath,
        startLine: p.startLine,
        endLine: p.endLine,
        text: p.text,
        plainText: p.plainText,
        state: p.preState || 'structural',
        factCodes: [],
        reason: 'Deterministic structural or media segmentation',
      });
    }
  }

  for (const { result } of outputs) {
    for (const b of result.data?.bindings || []) {
      const p = pieceById.get(b.piece_id);
      if (!p) continue;
      claims.push({
        pieceId: p.pieceId,
        pagePath: p.pagePath,
        headingPath: p.headingPath,
        startLine: p.startLine,
        endLine: p.endLine,
        text: p.text,
        plainText: p.plainText,
        state: b.state,
        factCodes: b.fact_codes || [],
        decisionCode: b.decision_code || null,
        reason: b.reason,
      });
    }
  }

  ctx.state.claims = claims;
  const escalated = claims.filter(c => c.state === 'contradicted' || c.state === 'unbound');
  ctx.state.escalatedClaims = escalated;
  return { totalClaims: claims.length, escalatedForJudge: escalated.length };
}

function buildJudgeBatches(ctx) {
  const escalated = ctx.state.escalatedClaims || [];
  if (!escalated.length) return [];
  const batches = [];
  for (let i = 0; i < escalated.length; i += 6) {
    const slice = escalated.slice(i, i + 6);
    batches.push({
      id: `judge-contradictions-${batches.length + 1}`,
      claims: slice,
      vars: {
        escalatedClaimsBlock: slice
          .map(c => `- ${c.pieceId} [initial=${c.state}] (${c.headingPath}): "${c.plainText}" | facts=${JSON.stringify(c.factCodes)} | note=${c.reason}`)
          .join('\n'),
      },
    });
  }
  return batches;
}

function applyContradictionVerdicts(ctx, outputs) {
  const claimByPiece = new Map((ctx.state.claims || []).map(c => [c.pieceId, c]));
  let confirmed = 0;
  let downgraded = 0;

  for (const { result } of outputs) {
    for (const v of result.data?.verdicts || []) {
      const cl = claimByPiece.get(v.piece_id);
      if (!cl) continue;
      if (v.verdict === 'confirmed_contradiction') {
        cl.state = 'contradicted';
        cl.proofQuote = v.proof_quote || null;
        cl.reason = v.reason;
        if (v.fact_codes?.length) cl.factCodes = v.fact_codes;
        confirmed++;
      } else {
        cl.state = v.verdict === 'unbound' ? 'unbound' : 'fresh';
        cl.reason = v.reason;
        if (v.fact_codes?.length) cl.factCodes = v.fact_codes;
        downgraded++;
      }
    }
  }
  return { confirmedContradictions: confirmed, downgradedOrResolved: downgraded };
}

function runComputeCoverage(ctx) {
  const counts = {};
  const coveredFactCodes = new Set();
  for (const cl of ctx.state.claims || []) {
    counts[cl.state] = (counts[cl.state] || 0) + 1;
    if (cl.state === 'fresh' || cl.state === 'prose-backed') {
      for (const fc of cl.factCodes || []) coveredFactCodes.add(fc);
    }
  }
  // 1-hop port reach credit
  for (const link of ctx.state.portLinks || []) {
    if (coveredFactCodes.has(link.from)) coveredFactCodes.add(link.to);
    if (coveredFactCodes.has(link.to)) coveredFactCodes.add(link.from);
  }
  const totalFacts = (ctx.state.facts || []).length;
  const scorecard = {
    claimStates: counts,
    totalFacts,
    coveredFactsOneHop: coveredFactCodes.size,
    factCoveragePct: totalFacts ? Number(((100 * coveredFactCodes.size) / totalFacts).toFixed(1)) : 0,
  };
  ctx.state.coverage = { claims: ctx.state.claims || [], scorecard };
  return scorecard;
}

export const mapDocsWorkflow = defineWorkflow({
  id: 'map-docs',
  title: 'Map Live Docs to Derived Facts',
  description: 'Segment live MDX pages, retrieve candidate code facts, bind claims, run second-pass contradiction verification, and score coverage.',
  rfcSection: 'Docs mapping',
  steps: [
    scriptStep({
      id: 'segment-mdx',
      description: 'Source-first MDX segmentation into structural, media, and checkable claim pieces (0 LLM)',
      run: runSegmentMdx,
    }),
    scriptStep({
      id: 'retrieve-candidates',
      description: 'Retrieve top candidate code-pinned facts per checkable MDX piece (0 LLM)',
      run: runRetrieveCandidates,
    }),
    agentStep({
      id: 'bind-claims',
      description: 'Bind each checkable docs piece to pinned facts and editorial decisions',
      model: 'gemini-4-neon',
      effort: 'medium',
      prompt: 'bind-claims.md',
      schema: 'bind-claims.schema.json',
      tools: ['query_fact', 'lookup_facts_by_symbol', 'read_pinned_slice'],
      mcpServers: ['docs-ia-tools'],
      concurrency: 6,
      buildBatches: buildBindBatches,
      applyOutputs: applyClaimBindings,
    }),
    agentStep({
      id: 'judge-contradictions',
      description: 'Second-pass judge reading full pinned AST slices before confirming any contradiction',
      model: 'gemini-4-neon',
      effort: 'high',
      prompt: 'judge-contradictions.md',
      schema: 'judge-contradictions.schema.json',
      tools: ['read_pinned_slice', 'lookup_facts_by_symbol', 'verify_verbatim_quote'],
      mcpServers: ['docs-ia-tools'],
      concurrency: 4,
      when: ctx => (ctx.state.escalatedClaims || []).length > 0,
      buildBatches: buildJudgeBatches,
      applyOutputs: applyContradictionVerdicts,
    }),
    scriptStep({
      id: 'compute-coverage',
      description: 'Compute claim state scorecard and 1-hop port-weighted coverage metrics (0 LLM)',
      run: runComputeCoverage,
    }),
  ],
});
