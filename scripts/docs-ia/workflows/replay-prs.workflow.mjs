// Workflow 5: Historical PR Replay & Drift Benchmark (RFC "Drift, lifecycle, and audit trails").
//
// Top-level execution order:
//   1. [script] diff-and-reconcile-events -> Chronological 2-gate pin diff, flag deferral & 3-tier MDX soft-drift (0 LLM)
//   2. [agent]  judge-replay-events       -> Neon judge with section-windowed MDX excerpts & scoped MCP tools
//   3. [script] apply-and-score-replay    -> Mint Dewey v3 codes, retire deleted leaves/claims, and score PR & page accuracy
import { stableFactKey } from '../models/fact.mjs';
import { refreshDetachedPin } from '../models/pin.mjs';
import { assignDeweyCodesV3 } from '../models/register.mjs';
import { agentStep, defineWorkflow, scriptStep } from '../models/workflow.mjs';
import { classifyFileExclusion, indexSourceFile, isWatchedManifest, surfaceForPath } from '../tools/ast-pins.mjs';
import { reconcileHumanMdxDrift, splitMdxFile } from '../tools/mdx-splitter.mjs';

function isInProductScope(repo, relPath, diffChunk, product) {
  if (isWatchedManifest(repo, relPath, product, diffChunk)) return true;
  const prefixes = product.repo_prefixes?.[repo] || [];
  const seams = product.seam_paths?.[repo] || [];
  for (const p of [...prefixes, ...seams]) {
    if (relPath === p || relPath.startsWith(p)) {
      if (relPath.endsWith('.md') && !isWatchedManifest(repo, relPath, product, diffChunk)) return false;
      return true;
    }
  }
  return false;
}

const GENERIC_STOPWORDS = new Set([
  'return', 'const', 'export', 'import', 'function', 'class', 'async', 'await', 'default',
  'interface', 'string', 'number', 'boolean', 'object', 'undefined', 'false', 'true', 'null',
  'public', 'private', 'static', 'readonly', 'typeof', 'instanceof', 'switch', 'break', 'continue',
  'catch', 'throw', 'finally', 'yield', 'super', 'extends', 'implements', 'package', 'module',
  'require', 'props', 'state', 'value', 'values', 'index', 'length', 'items', 'result', 'results',
  'error', 'errors', 'response', 'request', 'params', 'config', 'options', 'query', 'event', 'events',
  'client', 'server', 'source', 'target', 'status', 'count', 'total', 'label', 'title', 'content',
]);

// Product-agnostic surface-scoped IA claim ranker (zero hardcoded product cues or page paths):
//   0. Filter claims by IA surface (`ALL` or any surface touched by this PR)
//   1. Direct code-pinned facts touched by changed/deleted symbols (+15)
//   2. 1-hop port neighbors (+8)
//   3. Shared Dewey capability sections (`sectionCodes`, +4)
//   4. Generic distinctive identifiers extracted automatically from changed diff lines (+3/+5)
function selectDiversifiedBoundClaims({
  claims,
  directFactCodes,
  portFactCodes,
  touchedSectionCodes = new Set(),
  touchedSurfaces = new Set(),
  diffText,
}) {
  const changedLinesOnly = diffText
    .split('\n')
    .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .join('\n');

  const rawTokens = changedLinesOnly.match(/(\$[a-z][a-z0-9_]{3,}|[a-z]+_[a-z0-9_]{3,}|[a-z]{2,}[A-Z][A-Za-z0-9]{2,})/g) || [];
  const tokenFreq = new Map();
  for (const tok of rawTokens) {
    const low = tok.toLowerCase();
    if (GENERIC_STOPWORDS.has(low) || low.length < 5) continue;
    tokenFreq.set(low, (tokenFreq.get(low) || 0) + 1);
  }
  const diffTokens = [...tokenFreq.entries()]
    .sort((a, b) => (b[0].startsWith('$') ? 10 : 0) - (a[0].startsWith('$') ? 10 : 0) || b[1] - a[1])
    .slice(0, 25)
    .map(([t]) => t);

  const hasSurfaceFilter = touchedSurfaces.size > 0;
  const scored = [];
  for (const c of claims) {
    const claimSurf = String(c.surface || 'ALL').toUpperCase();
    if (hasSurfaceFilter && claimSurf !== 'ALL' && !touchedSurfaces.has(claimSurf)) continue;

    let score = 0;
    let graphHit = false;
    for (const fc of c.factCodes || []) {
      if (directFactCodes.has(fc)) { score += 15; graphHit = true; }
      else if (portFactCodes.has(fc)) { score += 8; graphHit = true; }
    }
    for (const sc of c.sectionCodes || []) {
      if (touchedSectionCodes.has(sc)) { score += 4; graphHit = true; }
    }
    const lowerClaim = `${c.text || ''} ${c.plainText || ''}`.toLowerCase();
    let identHits = 0;
    for (const tok of diffTokens) {
      if (lowerClaim.includes(tok)) {
        score += tok.startsWith('$') ? 5 : 3;
        identHits++;
      }
    }
    if (score > 0 && (graphHit || identHits >= 1)) {
      scored.push({ claim: c, score, graphHit });
    }
  }

  const byPage = new Map();
  for (const item of scored) {
    const p = item.claim.pagePath;
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(item);
  }
  const rankedPages = [...byPage.entries()]
    .map(([pagePath, items]) => {
      items.sort((a, b) => b.score - a.score);
      const hasDirectGraph = items.some(x => x.graphHit);
      const pageScore = items.slice(0, 3).reduce((s, x) => s + x.score, 0) + (hasDirectGraph ? 6 : 0);
      return { pagePath, pageScore, topClaims: items.slice(0, 4).map(x => x.claim) };
    })
    .sort((a, b) => b.pageScore - a.pageScore);

  return {
    selectedClaims: rankedPages.slice(0, 12).flatMap(rp => rp.topClaims),
    topCandidatePages: rankedPages.slice(0, 6).map(rp => rp.pagePath),
  };
}

function buildSectionWindowedExcerpts(pages, topCandidatePages, boundClaims) {
  return topCandidatePages
    .slice(0, 6)
    .map(pp => {
      const pg = (pages || []).find(x => x.pagePath === pp);
      if (!pg) return '';
      if (pg.text.length <= 6500) return `<page path="${pp}">\n${pg.text}\n</page>`;
      const pLines = pg.text.split('\n');
      const keep = new Set();
      for (let i = 1; i <= Math.min(35, pLines.length); i++) keep.add(i);
      for (const mc of boundClaims.filter(c => c.pagePath === pp)) {
        for (let ln = Math.max(1, mc.startLine - 14); ln <= Math.min(pLines.length, mc.endLine + 16); ln++) {
          keep.add(ln);
        }
      }
      const sortedLn = [...keep].sort((a, b) => a - b);
      const windowed = [];
      let prev = 0;
      for (const ln of sortedLn) {
        if (prev && ln > prev + 1) windowed.push('...');
        windowed.push(`L${ln}: ${pLines[ln - 1]}`);
        prev = ln;
      }
      return `<page path="${pp}">\n${windowed.join('\n').slice(0, 7500)}\n</page>`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function extractDiffFocusedSlice(def, fileDiff) {
  if ((def.sliceText || '').length <= 520) return def.sliceText || '';
  const addedLines = String(fileDiff || '')
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1).trim())
    .filter(l => l.length >= 8);
  const defLines = def.sliceText.split('\n');
  const matched = defLines.filter(dl => addedLines.some(al => dl.includes(al)));
  return matched.length > 0 ? matched.slice(0, 12).join('\n') : def.sliceText.slice(0, 520);
}

function loadDocsSnapshot(ctx, docsCommit) {
  if (typeof ctx.state.loadDocsAtCommit === 'function') {
    return ctx.state.loadDocsAtCommit(docsCommit);
  }
  if (Array.isArray(ctx.state.docsSnapshots?.[docsCommit])) {
    const pages = ctx.state.docsSnapshots[docsCommit];
    const allPieces = pages.flatMap(p => splitMdxFile(p.pagePath, p.text, { surfaceHints: ctx.product.doc_surface_hints }));
    return { files: pages.map(p => p.pagePath), pages, allPieces };
  }
  if (ctx.git && docsCommit) {
    const prefix = ctx.product.docs_prefix || 'contents/docs/mcp-analytics';
    const files = ctx.git.listTreeAtCommit('posthog-com', docsCommit, [prefix])
      .filter(f => /\.(md|mdx)$/i.test(f))
      .sort();
    const pages = files
      .map(pagePath => ({ pagePath, text: ctx.git.readFileAtCommit('posthog-com', docsCommit, pagePath) }))
      .filter(p => p.text !== null);
    const allPieces = pages.flatMap(p => splitMdxFile(p.pagePath, p.text, { surfaceHints: ctx.product.doc_surface_hints }));
    return { files, pages, allPieces };
  }
  const pages = ctx.state.docsPages || [];
  const allPieces = pages.flatMap(p => splitMdxFile(p.pagePath, p.text, { surfaceHints: ctx.product.doc_surface_hints }));
  return { files: pages.map(p => p.pagePath), pages, allPieces };
}

async function runDiffAndReconcileEvents(ctx) {
  const events = ctx.state.replayEvents || [];
  const initialAnchors = Array.isArray(ctx.state.anchorsList)
    ? ctx.state.anchorsList
    : Object.values(ctx.state.anchors || {});
  const anchorsById = new Map(initialAnchors.map(a => [a.id, structuredClone(a)]));
  const baseFacts = ctx.state.facts || [];
  let claims = structuredClone(ctx.state.claims || []);
  let docsCommit = ctx.state.t0Commits?.['posthog-com'] || ctx.product.t0_commits?.['posthog-com'] || null;
  let liveDocs = loadDocsSnapshot(ctx, docsCommit);

  const preparedEvents = new Map();
  let zeroLlmSkips = 0;
  let humanReconciles = 0;

  for (const ev of events) {
    if (ev.kind === 'human_docs_pr') {
      docsCommit = ev.commit;
      liveDocs = loadDocsSnapshot(ctx, docsCommit);
      const rec = reconcileHumanMdxDrift({
        prevClaims: claims,
        nextPieces: liveDocs.allPieces,
        docsCommit,
      });
      claims = rec.reconciledClaims;
      humanReconciles++;
      preparedEvents.set(ev.id, { kind: 'human_docs_pr', stats: rec.stats, reconciledClaims: structuredClone(claims) });
      continue;
    }

    const prData = ev.prData || ctx.state.getPrCommitData?.(ev.repo, ev.commit);
    if (!prData) throw new Error(`Missing PR commit diff data for replay event ${ev.id} (${ev.repo}@${ev.commit})`);

    const editablePagePaths = liveDocs.files;
    const inScopeFiles = (prData.files || []).filter(f =>
      isInProductScope(ev.repo, f.path, prData.diffByPath?.[f.path] || '', ctx.product)
    );
    const nonExcludedFiles = inScopeFiles.filter(
      f => !classifyFileExclusion(ev.repo, f.path, ctx.product, prData.diffByPath?.[f.path] || '').excluded
    );

    if (!nonExcludedFiles.length) {
      zeroLlmSkips++;
      preparedEvents.set(ev.id, { skipReason: 'zero_llm_excl_or_out_of_scope_gate' });
      continue;
    }

    const changedSymbols = [];
    const newSymbols = [];
    const deletedSymbols = [];
    let bumpedSameHashCount = 0;

    for (const f of nonExcludedFiles) {
      const oldPath = f.oldPath || f.path;
      const prevFileAnchors = [...anchorsById.values()].filter(a => a.repo === ev.repo && a.path === oldPath);
      if (f.status === 'D') {
        for (const a of prevFileAnchors) {
          deletedSymbols.push(a);
          anchorsById.delete(a.id);
        }
        continue;
      }
      const fileText = f.text ?? ctx.state.readFileAtCommit?.(ev.repo, ev.commit, f.path) ?? ctx.git?.readFileAtCommit(ev.repo, ev.commit, f.path) ?? null;
      const nextDefs = await indexSourceFile({
        repo: ev.repo,
        commit: ev.commit,
        path: f.path,
        text: fileText,
        productConfig: ctx.product,
        parseAst: ctx.parseAst,
      });
      const nextById = new Map(nextDefs.map(d => [d.id, d]));

      for (const oldA of prevFileAnchors) {
        const nextD = nextById.get(oldA.id);
        const ref = refreshDetachedPin({
          pin: oldA.pin,
          headCommit: ev.commit,
          getSliceText: () => (nextD ? nextD.sliceText : null),
        });
        if (ref.state === 'fresh') {
          if (ref.bumped) bumpedSameHashCount++;
          anchorsById.set(oldA.id, { ...nextD, sliceText: undefined, pin: ref.pin });
        } else if (ref.state === 'gone') {
          deletedSymbols.push(oldA);
          anchorsById.delete(oldA.id);
        } else {
          changedSymbols.push({ prev: oldA, next: nextD });
          anchorsById.set(oldA.id, { ...nextD, sliceText: undefined, pin: ref.candidatePin });
        }
      }
      for (const nextD of nextDefs) {
        if (!prevFileAnchors.some(a => a.id === nextD.id)) {
          newSymbols.push(nextD);
          anchorsById.set(nextD.id, { ...nextD, sliceText: undefined });
        }
      }
    }

    if (!changedSymbols.length && !newSymbols.length && !deletedSymbols.length) {
      zeroLlmSkips++;
      preparedEvents.set(ev.id, { skipReason: 'zero_llm_detached_md5_unchanged', bumpedSameHashCount });
      continue;
    }

    const diffText = nonExcludedFiles.map(f => prData.diffByPath?.[f.path] || '').join('\n').slice(0, 85_000);
    const hasNewFeatureFlagGate = /\b(behind a flag|FEATURE_FLAGS\.[A-Z0-9_]+|useFeatureFlag\(|feature_flag:\s*['"][a-z0-9_-]+['"])/i.test(
      `${ev.title}\n${diffText}`
    ) && !/\b(remove.*flag|ship.*only.*layout|drop.*flag)\b/i.test(ev.title);

    if (hasNewFeatureFlagGate) {
      zeroLlmSkips++;
      preparedEvents.set(ev.id, { skipReason: 'deferred_behind_feature_flag_gate', deferredCount: newSymbols.length });
      continue;
    }

    const changedDefIds = new Set([...changedSymbols.map(s => s.prev.id), ...deletedSymbols.map(s => s.id)]);
    const directlyAffectedFacts = baseFacts.filter(f => changedDefIds.has(f.def));
    const directFactCodes = new Set(directlyAffectedFacts.map(f => f.factCode || f.code));
    const touchedSectionCodes = new Set(directlyAffectedFacts.map(f => f.sectionCode).filter(Boolean));
    const touchedSurfaces = new Set([
      ...changedSymbols.map(s => String(s.prev.surface || '').toUpperCase()),
      ...newSymbols.map(s => String(s.surface || '').toUpperCase()),
      ...deletedSymbols.map(s => String(s.surface || '').toUpperCase()),
      ...nonExcludedFiles.map(f => surfaceForPath(ev.repo, f.path, ctx.product)),
    ].filter(Boolean));
    const changedPorts = new Set(
      directlyAffectedFacts.map(f => (f.port ? `${f.port.kind}:${f.port.key.toLowerCase()}` : null)).filter(Boolean)
    );
    const portFactCodes = new Set();
    for (const f of baseFacts) {
      if (f.port && changedPorts.has(`${f.port.kind}:${f.port.key.toLowerCase()}`)) {
        portFactCodes.add(f.factCode || f.code);
      }
    }

    const { selectedClaims: boundClaims, topCandidatePages } = selectDiversifiedBoundClaims({
      claims,
      directFactCodes,
      portFactCodes,
      touchedSectionCodes,
      touchedSurfaces,
      diffText,
    });

    const outlineChapters = Array.isArray(ctx.state.outline)
      ? ctx.state.outline
      : ctx.state.outline?.chapters || [];
    const decisions = ctx.state.decisions || ctx.state.outline?.decisions || [];

    const sectionsAndDecisionsBlock = [
      '### IA Sections:',
      ...outlineChapters.flatMap(ch =>
        (ch.sections || []).map(s => `- ${s.code} (${s.key}): ${s.title} -> pages: ${(s.live_doc_pages || []).join(', ')}`)
      ),
      '\n### IA Decisions:',
      ...decisions.map(d => `- [${d.code}] (${d.surface}) ${d.title}: ${d.why}`),
    ].join('\n');

    const boundClaimsBlock = boundClaims
      .map(c => `- [${c.claimCode || c.code}] (${c.pagePath}:L${c.startLine}, state=${c.state}) ${String(c.plainText || c.text).slice(0, 240)}`)
      .join('\n') || '(none)';

    const candidatePageExcerptsBlock = buildSectionWindowedExcerpts(liveDocs.pages, topCandidatePages, boundClaims) || '(none)';

    const astDeltaBlock = [
      ...deletedSymbols.slice(0, 18).map(d => {
        const retiredBehaviors = baseFacts.filter(f => f.def === d.id).slice(0, 3).map(f => f.claim).join(' // ');
        return `DELETED DEF ${d.id} (${d.surface})${retiredBehaviors ? ` — retired behaviors: ${retiredBehaviors}` : ''}`;
      }),
      ...newSymbols.slice(0, 18).map(d => `NEW DEF ${d.id} (${d.surface}):\n${extractDiffFocusedSlice(d, prData.diffByPath?.[d.path])}`),
      ...changedSymbols.slice(0, 18).map(s => `MODIFIED DEF ${s.next.id} (${s.next.surface}):\n${extractDiffFocusedSlice(s.next, prData.diffByPath?.[s.next.path])}`),
    ].join('\n\n') || '(none)';

    preparedEvents.set(ev.id, {
      event: ev,
      editablePagePaths,
      boundClaims,
      changedSymbols,
      newSymbols,
      deletedSymbols,
      bumpedSameHashCount,
      promptVars: {
        editablePagesBlock: editablePagePaths.join('\n'),
        sectionsAndDecisionsBlock,
        boundClaimsBlock,
        candidatePageExcerptsBlock,
        commitTitle: ev.title,
        prBody: String(prData.body || '').slice(0, 2500),
        astDeltaBlock,
        diffText,
      },
    });
  }

  ctx.state.preparedReplayEvents = preparedEvents;
  return {
    totalEvents: events.length,
    zeroLlmSkips,
    humanReconciles,
    judgeBatchesQueued: [...preparedEvents.values()].filter(p => p.promptVars).length,
  };
}

function buildReplayJudgeBatches(ctx) {
  const prepared = ctx.state.preparedReplayEvents || new Map();
  const batches = [];
  for (const [eventId, item] of prepared.entries()) {
    if (!item.promptVars) continue;
    batches.push({
      id: `replay-${eventId}`,
      eventId,
      vars: item.promptVars,
    });
  }
  return batches;
}

function applyReplayJudgeOutputs(ctx, outputs) {
  const byEvent = new Map();
  for (const { batch, result } of outputs) {
    byEvent.set(batch.eventId, result.data || {});
  }
  ctx.state.replayJudgeByEvent = byEvent;
  return { judgedEvents: byEvent.size };
}

function runApplyAndScoreReplay(ctx) {
  const events = ctx.state.replayEvents || [];
  const prepared = ctx.state.preparedReplayEvents || new Map();
  const judged = ctx.state.replayJudgeByEvent || new Map();
  const productCode = ctx.product.code || 'MCPA';
  const surfaces = ctx.product.surfaces || ['UI', 'API', 'MCP', 'TS', 'WEB', 'PY', 'RS'];
  const outlineChapters = Array.isArray(ctx.state.outline)
    ? ctx.state.outline
    : ctx.state.outline?.chapters || [];
  const useCases = ctx.state.useCases || ctx.state.outline?.useCases || [];
  const decisions = ctx.state.decisions || ctx.state.outline?.decisions || [];

  let facts = structuredClone(ctx.state.facts || []);
  let claims = structuredClone(ctx.state.claims || []);
  let register = ctx.state.register ? structuredClone(ctx.state.register) : null;
  let ucRegister = ctx.state.ucRegister ? structuredClone(ctx.state.ucRegister) : null;

  let totalLlmCalls = 0;
  let fastGateZeroLlmSkips = 0;
  let prematureFlaggedFactsMinted = 0;
  let orphanedClaimsAfterHumanEdit = 0;
  const stepLogs = [];

  for (const ev of events) {
    const pre = prepared.get(ev.id);
    if (ev.kind === 'human_docs_pr') {
      claims = structuredClone(pre.reconciledClaims);
      stepLogs.push({ id: ev.id, kind: 'human_docs_pr', action: 'soft_drift_reconciled', stats: pre.stats, llmCalls: 0 });
      continue;
    }

    if (pre.skipReason) {
      fastGateZeroLlmSkips++;
      stepLogs.push({
        id: ev.id,
        needsDocs: false,
        pages: [],
        llmCalls: 0,
        bumpedSameHashCount: pre.bumpedSameHashCount || 0,
        reason: pre.skipReason,
      });
      continue;
    }

    const rv = judged.get(ev.id) || {};
    totalLlmCalls++;

    let pages = rv.needs_docs && rv.change_kind
      ? [...new Set((rv.affected_pages || []).filter(p => pre.editablePagePaths.includes(p)))]
      : [];

    if (rv.needs_docs && (rv.contradicted_claim_codes || []).length > 0) {
      const contraSet = new Set(rv.contradicted_claim_codes);
      for (const cl of pre.boundClaims) {
        const code = cl.claimCode || cl.code;
        if (contraSet.has(code) && pre.editablePagePaths.includes(cl.pagePath) && !pages.includes(cl.pagePath)) {
          pages.push(cl.pagePath);
        }
      }
    }

    const deletedDefIds = new Set(pre.deletedSymbols.map(d => d.id));
    facts = facts.filter(f => !deletedDefIds.has(f.def));

    let mintedFactsThisStep = 0;
    const availableDefs = [...pre.newSymbols, ...pre.changedSymbols.map(s => s.next)];
    for (const nf of rv.new_facts || []) {
      const matchingDef = availableDefs.find(d => d.id === nf.def);
      if (!matchingDef) continue;
      const quote = String(nf.quote || '').trim();
      if (!quote || quote.includes('\n') || !matchingDef.sliceText.includes(quote)) continue;

      const surf = matchingDef.surface || surfaceForPath(ev.repo, matchingDef.path, ctx.product);
      const lKey = stableFactKey({ surface: surf, defId: nf.def, factType: nf.type, quote });
      if (facts.some(f => (f.leafKey || stableFactKey({ surface: f.surface, defId: f.def, factType: f.type, quote: f.quote })) === lKey)) {
        continue;
      }
      if (ev.isFlaggedUnreleased) prematureFlaggedFactsMinted++;

      facts.push({
        def: nf.def,
        repo: ev.repo,
        path: matchingDef.path,
        symbol: matchingDef.symbol,
        surface: surf,
        type: nf.type || 'fact',
        claim: nf.claim,
        quote,
        port: null,
        pin: matchingDef.pin,
        leafKey: lKey,
      });
      mintedFactsThisStep++;
    }

    const allLeavesNow = [
      ...facts.map(f => ({
        key: f.leafKey || stableFactKey({ surface: f.surface, defId: f.def, factType: f.type, quote: f.quote }),
        kind: 'F',
        surface: f.surface,
        title: String(f.claim || '').slice(0, 140),
        quote: f.quote,
      })),
      ...decisions.map(d => ({
        key: `d3:${String(d.surface || 'ALL').toLowerCase()}:${d.key}`,
        kind: 'D',
        surface: d.surface || 'ALL',
        title: d.title,
      })),
      ...claims.map(c => ({
        key: c.leafKey || `c3:${String(c.surface || 'ALL').toLowerCase()}:${c.pieceId}`,
        kind: 'C',
        surface: c.surface || 'ALL',
        title: String(c.plainText || c.text || '').slice(0, 140),
        quote: String(c.plainText || c.text || '').slice(0, 140),
      })),
    ];

    const recoded = assignDeweyCodesV3({
      productCode,
      surfaces,
      outline: outlineChapters,
      useCases,
      leaves: allLeavesNow,
      register,
      ucRegister,
      today: ev.date,
    });
    register = recoded.register;
    ucRegister = recoded.ucRegister;
    const codeByLeafKey = new Map(recoded.leaves.map(l => [l.key, l.code]));
    facts = facts.map(f => {
      const k = f.leafKey || stableFactKey({ surface: f.surface, defId: f.def, factType: f.type, quote: f.quote });
      const assignedCode = codeByLeafKey.get(k) || f.factCode || f.code;
      return { ...f, leafKey: k, factCode: assignedCode, code: assignedCode };
    });

    const finalNeedsDocs = Boolean(rv.needs_docs && rv.change_kind && (pages.length > 0 || rv.change_kind === 'create'));
    stepLogs.push({
      id: ev.id,
      needsDocs: finalNeedsDocs,
      changeKind: finalNeedsDocs ? rv.change_kind : null,
      pages,
      llmCalls: 1,
      bumpedSameHashCount: pre.bumpedSameHashCount || 0,
      mintedFactsThisStep,
      retiredLeavesTotal: register.retiredLeaves.length,
      reason: rv.reason || '',
    });
  }

  const codeEvents = events.filter(e => e.kind === 'code_pr');
  let tp = 0, fp = 0, fn = 0, tn = 0;
  let johnCorrect = 0, johnTotal = 0;
  let totalExpectedPages = 0, totalHitPages = 0, totalSurfacedPages = 0;

  for (const ev of codeEvents) {
    const log = stepLogs.find(l => l.id === ev.id);
    const pred = Boolean(log?.needsDocs);
    const truth = Boolean(ev.truthNeedsDocs);
    if (truth && pred) tp++;
    else if (!truth && pred) fp++;
    else if (truth && !pred) fn++;
    else tn++;

    if (ev.johnEvalRow !== undefined) {
      johnTotal++;
      if (pred === truth) johnCorrect++;
    }

    const expSet = new Set(ev.truthPages || []);
    const predSet = new Set(log?.pages || []);
    totalExpectedPages += expSet.size;
    totalSurfacedPages += predSet.size;
    for (const p of expSet) if (predSet.has(p)) totalHitPages++;
  }

  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(3)) : 1;
  const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(3)) : 0;
  const f1 = precision + recall > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(3)) : 0;

  const scorecard = {
    codePrCount: codeEvents.length,
    humanDocsPrCount: events.length - codeEvents.length,
    tp,
    fp,
    fn,
    tn,
    needsDocsPrecision: precision,
    needsDocsRecall: recall,
    needsDocsF1: f1,
    johnEvalAgreement: johnTotal > 0 ? `${johnCorrect}/${johnTotal} (${((100 * johnCorrect) / johnTotal).toFixed(1)}%)` : 'n/a',
    pageHitRatio: `${totalHitPages}/${totalExpectedPages}`,
    pageRecall: totalExpectedPages > 0 ? Number((totalHitPages / totalExpectedPages).toFixed(3)) : 1,
    pagePrecision: totalSurfacedPages > 0 ? Number((totalHitPages / totalSurfacedPages).toFixed(3)) : 1,
    totalLlmCalls,
    avgLlmCallsPerCodePr: codeEvents.length > 0 ? Number((totalLlmCalls / codeEvents.length).toFixed(2)) : 0,
    fastGateZeroLlmSkips,
    prematureFlaggedFactsMinted,
    orphanedClaimsAfterHumanEdit,
    finalLiveFactsCount: facts.length,
    finalRetiredLeavesCount: register ? register.retiredLeaves.length : 0,
    finalLiveClaimsCount: claims.length,
  };

  ctx.state.facts = facts;
  ctx.state.claims = claims;
  ctx.state.register = register;
  ctx.state.ucRegister = ucRegister;
  ctx.state.replayScorecard = { metrics: scorecard, stepLogs };
  return scorecard;
}

export const replayPrsWorkflow = defineWorkflow({
  id: 'replay-prs',
  title: 'Historical PR Replay & Drift Benchmark',
  description: 'Replay merged code and human .mdx pull requests through detached pin gates, 3-tier MDX soft-drift reconciliation, blast-radius routing, and Dewey v3 lifecycle scoring.',
  rfcSection: 'Drift, lifecycle, and audit trails',
  steps: [
    scriptStep({
      id: 'diff-and-reconcile-events',
      description: 'Run chronological 2-gate pin diffing, feature-flag deferral, and 3-tier human MDX soft-drift reconciliation (0 LLM)',
      run: runDiffAndReconcileEvents,
    }),
    agentStep({
      id: 'judge-replay-events',
      description: 'Evaluate changed/new/deleted symbol slices and section-windowed MDX excerpts for prose contradictions and new IA facts',
      model: 'gemini-4-neon',
      effort: 'medium',
      prompt: 'replay-pr.md',
      schema: 'replay-pr.schema.json',
      tools: [
        'read_pinned_slice',
        'lookup_facts_by_symbol',
        'trace_blast_radius',
        'verify_verbatim_quote',
        'query_page_claims',
      ],
      mcpServers: ['docs-ia-tools'],
      concurrency: 8,
      buildBatches: buildReplayJudgeBatches,
      applyOutputs: applyReplayJudgeOutputs,
    }),
    scriptStep({
      id: 'apply-and-score-replay',
      description: 'Apply Dewey v3 fact seating and tombstones chronologically and compute PR/page precision and recall (0 LLM)',
      run: runApplyAndScoreReplay,
    }),
  ],
});
