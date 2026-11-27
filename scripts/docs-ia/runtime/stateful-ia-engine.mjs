// Reusable, product-agnostic Stateful Read/Write Docs IA Maintenance Engine + MCP Server.
// Supports the full Docs IA maintenance decision tree across chronological PR replays:
//   1. Inspect AST pin delta & principled +/- feature-flag gate (`ia_pin_delta`)
//   2. Invalidate / update / retire existing IA facts (`ia_update_fact`, `ia_retire_fact`)
//   3. Map new or unmapped code / new SDKs into live IA (`ia_map_code`, `ia_inspect_code`)
//   4. Trace blast radius (`ia_blast_radius`) and update docs + claim bindings together (`ia_update_doc_bindings`)
//   5. Deterministic post-edit & human `.mdx` soft-drift reconciliation (line shifts, page moves, deletions)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defaultLoadClaudeSdk } from './claude-sdk-adapter.mjs';
import { normalizeQuoteForIdentity, stableFactKey } from '../models/fact.mjs';
import { createDetachedPin, refreshDetachedPin, shortSha256 } from '../models/pin.mjs';
import { auditTrailForCode, padLeafNum } from '../models/register.mjs';
import {
  classifyFileExclusion,
  indexSourceFile,
  isWatchedManifest,
  surfaceForPath,
} from '../tools/ast-pins.mjs';
import {
  inferDocSurfaceHint,
  reconcileHumanMdxDrift,
  splitMdxFile,
} from '../tools/mdx-splitter.mjs';

const GENERIC_STOPWORDS = new Set([
  'return', 'const', 'export', 'import', 'function', 'class', 'async', 'await', 'default',
  'interface', 'string', 'number', 'boolean', 'object', 'undefined', 'false', 'true', 'null',
  'public', 'private', 'static', 'readonly', 'typeof', 'instanceof', 'switch', 'break', 'continue',
  'catch', 'throw', 'finally', 'yield', 'super', 'extends', 'implements', 'package', 'module',
  'require', 'props', 'state', 'value', 'values', 'index', 'length', 'items', 'result', 'results',
  'error', 'errors', 'response', 'request', 'params', 'config', 'options', 'query', 'event', 'events',
  'client', 'server', 'source', 'target', 'status', 'count', 'total', 'label', 'title', 'content',
]);

/**
 * Determine whether a docs page is dedicated to ONE specific surface strictly from its file path
 * (never from body text regexes!). Shared cross-surface pages (`events.mdx`, `installation/index.mdx`,
 * `identifying-users.mdx`, etc.) return `'ALL'` so editing one SDK mention inside a shared row never
 * hides that row from other SDKs on subsequent PRs.
 */
export function pageLevelSurface(pagePath, surfaceHints = []) {
  for (const rule of surfaceHints) {
    if (rule.scope === 'path') {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
      if (re.test(pagePath)) return String(rule.surface).toUpperCase();
    }
  }
  const p = String(pagePath || '').toLowerCase();
  if (/\/surfaces\/web-app\.mdx$/.test(p)) return 'UI';
  if (/\/surfaces\/api\.mdx$/.test(p)) return 'API';
  if (/\/surfaces\/mcp\.mdx$/.test(p)) return 'MCP';
  if (/\/typescript\.mdx$/.test(p)) return 'TS';
  if (/\/python\.mdx$/.test(p)) return 'PY';
  if (/\/rust\.mdx$/.test(p)) return 'RS';
  if (/\/webmcp\.mdx$/.test(p)) return 'WEB';
  if (/\/ios\.mdx$/.test(p)) return 'IOS';
  if (/\/android\.mdx$/.test(p)) return 'AND';
  if (/\/flutter\.mdx$/.test(p)) return 'FLT';
  if (/\/react-native\.mdx$/.test(p)) return 'RN';
  return 'ALL';
}

export function isInProductScope(repo, relPath, diffChunk, product) {
  if (isWatchedManifest(repo, relPath, product, diffChunk)) return true;
  if (/\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|snap|lock)$/i.test(relPath)) return false;
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

/**
 * Principled feature-flag gate inspection over actual `+` vs `-` diff lines (ZERO dataset cheat labels).
 * Distinguishes:
 *   - `addedFlags`: flags introduced on `+` lines without matching `-` removals (new unreleased gated work)
 *   - `removedFlags`: flags removed on `-` lines (unflagging / shipping a previously gated feature!)
 */
export function inspectFeatureFlagDelta(title, fullDiffText, nonExcludedDiffText) {
  const extractFlags = (text, prefixChar) => {
    const found = new Set();
    for (const line of String(text || '').split('\n')) {
      if (!line.startsWith(prefixChar) || line.startsWith(`${prefixChar}${prefixChar}${prefixChar}`)) continue;
      for (const m of line.matchAll(/FEATURE_FLAGS\.([A-Z0-9_]+)/g)) found.add(m[1]);
      for (const m of line.matchAll(/useFeatureFlag\(\s*['"]([A-Z0-9_-]+)['"]/gi)) found.add(m[1].toUpperCase().replace(/-/g, '_'));
      for (const m of line.matchAll(/feature_flag\s*[:=]\s*['"]([a-z0-9_-]+)['"]/gi)) found.add(m[1].toUpperCase().replace(/-/g, '_'));
    }
    return found;
  };

  const addedAll = extractFlags(fullDiffText, '+');
  const removedAll = extractFlags(fullDiffText, '-');
  const addedFlags = [...addedAll].filter(f => !removedAll.has(f));
  const removedFlags = [...removedAll].filter(f => !addedAll.has(f));

  const titleSaysFlagged = /\bbehind a (?:feature )?flag\b|\btrial\b/i.test(String(title || ''));
  const titleSaysUnflag = /\b(remove|drop|delete|clean up)\b.*\bflag\b|\bship\b.*\bonly\b/i.test(String(title || ''));

  // A PR is deferred as unreleased ONLY if:
  //   1. It does NOT remove/unflag an existing feature flag, AND
  //   2. Either it introduces a brand-new FEATURE_FLAGS.* constant/check on `+` lines (and title doesn't say unflag),
  //      OR title explicitly says "behind a flag" and diff contains flag gating on `+` lines.
  const addsFlagCheckInScoped = extractFlags(nonExcludedDiffText, '+').size > 0;
  const isDeferredNewFlag =
    removedFlags.length === 0 &&
    !titleSaysUnflag &&
    ((addedFlags.length > 0 && (addsFlagCheckInScoped || titleSaysFlagged)) ||
      (titleSaysFlagged && /\bfeature_?flag|FEATURE_FLAGS|flag\b/i.test(fullDiffText)));

  return { addedFlags, removedFlags, isDeferredNewFlag };
}

export class StatefulIaStore {
  constructor({ anchors, facts, claims, outline, register, productConfig }) {
    this.productConfig = productConfig;
    this.productCode = productConfig.code || 'MCPA';
    this.surfaces = productConfig.surfaces || ['UI', 'API', 'MCP', 'TS', 'WEB', 'PY', 'RS'];
    this.anchorsById = new Map((anchors || []).map(a => [a.id, structuredClone(a)]));
    this.factsByCode = new Map((facts || []).map(f => [f.factCode || f.code, structuredClone(f)]));
    this.claimsByCode = new Map((claims || []).map(c => [c.claimCode || c.code, structuredClone(c)]));
    this.outline = structuredClone(outline);
    this.register = structuredClone(register);
    this.register.leaves ??= {};
    this.register.leafTitles ??= {};
    this.register.leafQuoteSigs ??= {};
    this.register.retiredLeaves ??= [];

    this.issuedLeaves = new Set([
      ...Object.keys(this.register.leaves),
      ...this.register.retiredLeaves.map(r => r.code),
    ]);
    this.activeFlags = new Set();
    this.history = [];
  }

  allFacts() {
    return [...this.factsByCode.values()];
  }

  allClaims() {
    return [...this.claimsByCode.values()];
  }

  allSections() {
    const chs = Array.isArray(this.outline) ? this.outline : this.outline?.chapters || [];
    return chs.flatMap(ch => ch.sections || []);
  }

  allocateLeafCode(surface, kind) {
    const surf = String(surface || 'ALL').toUpperCase();
    const validSurf = this.surfaces.includes(surf) || (surf === 'ALL' && (kind === 'C' || kind === 'D'));
    const safeSurf = validSurf ? surf : (kind === 'C' || kind === 'D' ? 'ALL' : this.surfaces[0]);
    const prefix = `${this.productCode}-${safeSurf}-${kind}-`;
    let hi = 0;
    for (const c of this.issuedLeaves) {
      if (!c.startsWith(prefix)) continue;
      const num = Number(c.slice(prefix.length));
      if (Number.isFinite(num)) hi = Math.max(hi, num);
    }
    const code = `${prefix}${padLeafNum(kind, hi + 1)}`;
    this.issuedLeaves.add(code);
    return code;
  }

  pickBestSectionCode({ surface, path = '', symbol = '', claim = '', quote = '' }) {
    const sections = this.allSections();
    if (!sections.length) return null;
    const fToks = `${path} ${symbol} ${claim} ${quote}`.toLowerCase().match(/[a-z0-9$_-]{3,}/g) || [];
    let best = sections[0];
    let bestScore = -1;
    for (const sec of sections) {
      const sToks = new Set(
        `${sec.key || ''} ${sec.title || ''} ${sec.summary || ''} ${(sec.live_doc_pages || []).join(' ')}`
          .toLowerCase()
          .match(/[a-z0-9$_-]{3,}/g) || []
      );
      let sc = 0;
      for (const t of fToks) if (sToks.has(t)) sc++;
      if (surface === 'WEB' && sToks.has('webmcp')) sc += 8;
      if (surface === 'RS' && (sToks.has('install') || sToks.has('sdk') || sToks.has('prerequisites'))) sc += 2;
      if (sc > bestScore) { bestScore = sc; best = sec; }
    }
    return best.code;
  }

  registerFact({ def, repo, path, symbol, surface, type = 'fact', claim, quote, port = null, sectionCode = null, pin, today }) {
    const leafKey = stableFactKey({ surface, defId: def, factType: type, quote });
    // Check if an identical live fact already exists -> update in place instead of duplicating
    for (const existing of this.factsByCode.values()) {
      if (existing.leafKey === leafKey || (existing.def === def && existing.claim === claim)) {
        existing.claim = claim;
        existing.quote = quote;
        existing.port = port || existing.port || null;
        if (sectionCode) existing.sectionCode = sectionCode;
        if (pin) existing.pin = pin;
        return { factCode: existing.factCode, created: false, fact: existing };
      }
    }
    const code = this.allocateLeafCode(surface, 'F');
    const resolvedSection = sectionCode && this.allSections().some(s => s.code === sectionCode)
      ? sectionCode
      : this.pickBestSectionCode({ surface, path, symbol, claim, quote });
    // Auto-extract an explicit event (`$...`) or REST API route (`/api/...`) port when omitted
    // so newly mapped facts immediately wire into the 1-hop port graph for cross-surface blast radius!
    let resolvedPort = port || null;
    if (!resolvedPort) {
      const hay = `${claim || ''} ${quote || ''}`;
      const evMatch = hay.match(/(\$[a-z][a-z0-9_]{3,})/i);
      const apiMatch = hay.match(/(\/api\/[a-z0-9_/{}-]+)/i);
      if (evMatch) resolvedPort = { kind: 'event', dir: 'ref', key: evMatch[1] };
      else if (apiMatch) resolvedPort = { kind: 'route', dir: 'handle', key: apiMatch[1] };
    }
    const fact = {
      factCode: code,
      leafKey,
      def,
      repo,
      path,
      symbol,
      surface: String(surface || 'API').toUpperCase(),
      type,
      claim: String(claim || '').trim(),
      quote: String(quote || '').trim(),
      port: resolvedPort,
      sectionCode: resolvedSection,
      pin: pin || null,
      createdDate: today,
    };
    this.factsByCode.set(code, fact);
    this.register.leaves[code] = leafKey;
    this.register.leafTitles[code] = fact.claim.slice(0, 140);
    if (fact.quote) {
      this.register.leafQuoteSigs[code] = `${fact.surface}:F:${shortSha256(normalizeQuoteForIdentity(fact.quote))}`;
    }
    const sec = this.allSections().find(s => s.code === resolvedSection);
    if (sec) {
      sec.factCodes ??= [];
      if (!sec.factCodes.includes(code)) sec.factCodes.push(code);
    }
    return { factCode: code, created: true, fact };
  }

  updateFact({ factCode, claim, quote, port, sectionCode, nextPin }) {
    const fact = this.factsByCode.get(factCode);
    if (!fact) return { ok: false, error: `Fact ${factCode} not found in live IA.` };
    if (claim) fact.claim = String(claim).trim();
    if (quote) fact.quote = String(quote).trim();
    if (port !== undefined) fact.port = port;
    if (sectionCode && this.allSections().some(s => s.code === sectionCode)) {
      fact.sectionCode = sectionCode;
    }
    if (nextPin) fact.pin = nextPin;
    this.register.leafTitles[factCode] = fact.claim.slice(0, 140);

    // Track impacted claims for this PR without permanently poisoning future PRs' blast radius
    const impactedClaims = [];
    for (const c of this.claimsByCode.values()) {
      if ((c.factCodes || []).includes(factCode)) {
        impactedClaims.push({ claimCode: c.claimCode, pagePath: c.pagePath, startLine: c.startLine, endLine: c.endLine });
      }
    }
    return { ok: true, factCode, fact, impactedClaims };
  }

  retireFact({ factCode, reason, replacedBy = null, today }) {
    const fact = this.factsByCode.get(factCode);
    if (!fact) {
      const existingTombstone = this.register.retiredLeaves.find(r => r.code === factCode);
      if (existingTombstone) return { ok: true, alreadyRetired: true, tombstone: existingTombstone, impactedClaims: [] };
      return { ok: false, error: `Fact ${factCode} not found in live IA.` };
    }
    this.factsByCode.delete(factCode);
    const oldKey = this.register.leaves[factCode] || fact.leafKey;
    delete this.register.leaves[factCode];
    const tombstone = {
      code: factCode,
      key: oldKey,
      title: fact.claim.slice(0, 140),
      op: replacedBy ? 'replace' : 'retire',
      to: replacedBy ? (Array.isArray(replacedBy) ? replacedBy : [replacedBy]) : [],
      date: today,
      reason: String(reason || 'Code removed or behavior retired'),
      pin: fact.pin || null,
    };
    this.register.retiredLeaves.push(tombstone);

    const impactedClaims = [];
    for (const c of this.claimsByCode.values()) {
      if ((c.factCodes || []).includes(factCode)) {
        c.state = 'contradicted';
        impactedClaims.push({ claimCode: c.claimCode, pagePath: c.pagePath, startLine: c.startLine, endLine: c.endLine });
      }
    }
    return { ok: true, tombstone, impactedClaims };
  }

  retireClaim({ claimCode, reason, today }) {
    const cl = this.claimsByCode.get(claimCode);
    if (!cl) return false;
    this.claimsByCode.delete(claimCode);
    const oldKey = this.register.leaves[claimCode] || cl.leafKey;
    delete this.register.leaves[claimCode];
    this.register.retiredLeaves.push({
      code: claimCode,
      key: oldKey,
      title: String(cl.plainText || cl.text || '').slice(0, 140),
      op: 'retire',
      to: [],
      date: today,
      reason: String(reason || 'Documentation claim removed'),
    });
    return true;
  }

  /**
   * Reconcile live `.mdx` files on disk into the IA (used after BOTH human `.mdx` PRs and agent edits!).
   * Fixes line shifts, cross-page moves (updating `pageUrl` and refining `surface`), and retires deleted pages cleanly.
   */
  reconcileDocsMap(docsMap, { docsCommit = null, today = null, onlyPages = null } = {}) {
    const surfaceHints = this.productConfig.doc_surface_hints || [];
    const targetPages = onlyPages ? new Set(onlyPages) : null;

    const prevClaimsToReconcile = [];
    const untouchedClaims = [];
    for (const c of this.claimsByCode.values()) {
      if (!targetPages || targetPages.has(c.pagePath)) prevClaimsToReconcile.push(c);
      else untouchedClaims.push(c);
    }

    const nextPieces = [];
    for (const [pagePath, text] of docsMap.entries()) {
      if (!/\.(md|mdx)$/i.test(pagePath)) continue;
      if (targetPages && !targetPages.has(pagePath)) continue;
      if (typeof text !== 'string') continue;
      nextPieces.push(...splitMdxFile(pagePath, text, { surfaceHints }));
    }

    const rec = reconcileHumanMdxDrift({
      prevClaims: prevClaimsToReconcile,
      nextPieces,
      docsCommit,
    });

    // Refine `pageUrl` and `surface` strictly from page-level path (NEVER demote shared `ALL` pages to one SDK!)
    const nextMap = new Map(untouchedClaims.map(c => [c.claimCode, c]));
    for (const c of rec.reconciledClaims) {
      const refinedUrl = `https://posthog.com/${c.pagePath.replace(/^contents\//, '').replace(/\/index\.mdx$/, '').replace(/\.mdx$/, '')}`;
      const pageSurf = pageLevelSurface(c.pagePath, surfaceHints);
      const refinedSurf = pageSurf !== 'ALL' ? pageSurf : 'ALL';
      const updated = { ...c, pageUrl: refinedUrl, surface: refinedSurf };
      nextMap.set(updated.claimCode, updated);
    }

    // Write tombstones for retired claims (e.g., deleted pages like surfaces/desktop.mdx)
    for (const code of rec.retiredClaimCodes) {
      const old = this.claimsByCode.get(code);
      if (old) {
        const oldKey = this.register.leaves[code] || old.leafKey;
        delete this.register.leaves[code];
        this.register.retiredLeaves.push({
          code,
          key: oldKey,
          title: String(old.plainText || old.text || '').slice(0, 140),
          op: 'retire',
          to: [],
          date: today || '2026-11-01',
          reason: docsMap.has(old.pagePath) ? 'Claim removed in docs edit' : `Page deleted: ${old.pagePath}`,
        });
      }
    }

    this.claimsByCode = nextMap;
    return rec;
  }

  /**
   * Compute deterministic AST pin delta for a code PR against the CURRENT live `anchorsById` + `factsByCode`.
   * Also prepares a map of live parsed AST definitions for this PR (`prDefsById` & `prFileTexts`) so
   * `ia_inspect_code` and `ia_map_code` can inspect & pin brand-new/changed symbols immediately.
   */
  async analyzePrDelta({ event: ev, prData, readFileAtCommit, parseAst }) {
    const allFiles = prData.files || [];
    const inScopeFiles = allFiles.filter(f =>
      isInProductScope(ev.repo, f.path, prData.diffByPath?.[f.path] || '', this.productConfig)
    );
    const nonExcludedFiles = inScopeFiles.filter(
      f => !classifyFileExclusion(ev.repo, f.path, this.productConfig, prData.diffByPath?.[f.path] || '').excluded
    );

    const fullDiffText = allFiles.map(f => prData.diffByPath?.[f.path] || '').filter(Boolean).join('\n');
    const scopedDiffText = nonExcludedFiles.map(f => prData.diffByPath?.[f.path] || '').filter(Boolean).join('\n');

    let preGateSkipReason = null;
    const changedSymbols = [];
    const newSymbols = [];
    const deletedSymbols = [];
    const watchedManifests = [];
    let bumpedSameHashCount = 0;

    const prDefsById = new Map();
    const prFileTexts = new Map();
    const pendingAnchorUpdates = [];

    if (!nonExcludedFiles.length) {
      preGateSkipReason = 'zero_llm_excl_or_out_of_scope_gate';
    } else {
      for (const f of nonExcludedFiles) {
        const fileDiff = prData.diffByPath?.[f.path] || '';
        if (isWatchedManifest(ev.repo, f.path, this.productConfig, fileDiff)) {
          watchedManifests.push(f.path);
        }
        const oldPath = f.oldPath || f.path;
        const prevFileAnchors = [...this.anchorsById.values()].filter(
          a => a.repo === ev.repo && a.path === oldPath
        );
        if (f.status === 'D') {
          for (const a of prevFileAnchors) {
            deletedSymbols.push(a);
            pendingAnchorUpdates.push({ op: 'delete', id: a.id });
          }
          continue;
        }
        const fileText = f.text !== undefined ? f.text : readFileAtCommit(ev.repo, ev.commit, f.path);
        if (fileText !== null) prFileTexts.set(f.path, fileText);
        const nextDefs = await indexSourceFile({
          repo: ev.repo,
          commit: ev.commit,
          path: f.path,
          text: fileText,
          productConfig: this.productConfig,
          parseAst,
        });
        for (const d of nextDefs) prDefsById.set(d.id, d);
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
            pendingAnchorUpdates.push({ op: 'set', id: oldA.id, value: { ...nextD, sliceText: undefined, pin: ref.pin } });
          } else if (ref.state === 'gone') {
            deletedSymbols.push(oldA);
            pendingAnchorUpdates.push({ op: 'delete', id: oldA.id });
          } else {
            changedSymbols.push({ prev: oldA, next: nextD });
            pendingAnchorUpdates.push({ op: 'set', id: oldA.id, value: { ...nextD, sliceText: undefined, pin: ref.candidatePin } });
          }
        }
        for (const nextD of nextDefs) {
          if (!prevFileAnchors.some(a => a.id === nextD.id)) {
            newSymbols.push(nextD);
            pendingAnchorUpdates.push({ op: 'set', id: nextD.id, value: { ...nextD, sliceText: undefined } });
          }
        }
      }

      if (!changedSymbols.length && !newSymbols.length && !deletedSymbols.length && !watchedManifests.length) {
        preGateSkipReason = 'zero_llm_detached_md5_unchanged';
      }
    }

    const flagDelta = inspectFeatureFlagDelta(ev.title, fullDiffText, scopedDiffText);
    if (!preGateSkipReason && flagDelta.isDeferredNewFlag) {
      preGateSkipReason = 'deferred_behind_feature_flag_gate';
      for (const fl of flagDelta.addedFlags) this.activeFlags.add(fl);
    }
    if (flagDelta.removedFlags.length > 0) {
      for (const fl of flagDelta.removedFlags) this.activeFlags.delete(fl);
    }

    // Apply anchor updates unless deferred behind a brand-new unreleased flag
    if (preGateSkipReason !== 'deferred_behind_feature_flag_gate') {
      for (const u of pendingAnchorUpdates) {
        if (u.op === 'delete') this.anchorsById.delete(u.id);
        else this.anchorsById.set(u.id, u.value);
      }
    }

    // Attach existing pinned facts onto changed and deleted symbols
    const factsByDef = new Map();
    for (const f of this.factsByCode.values()) {
      if (!factsByDef.has(f.def)) factsByDef.set(f.def, []);
      factsByDef.get(f.def).push(f);
    }

    const changedWithFacts = changedSymbols.slice(0, 25).map(s => ({
      id: s.prev.id,
      surface: s.prev.surface,
      existingFacts: (factsByDef.get(s.prev.id) || []).slice(0, 4).map(f => ({
        factCode: f.factCode,
        claim: f.claim.slice(0, 140),
        sectionCode: f.sectionCode,
      })),
    }));

    const unmappedChangedSymbols = changedSymbols
      .filter(s => (factsByDef.get(s.prev.id) || []).length === 0)
      .slice(0, 20)
      .map(s => ({ id: s.prev.id, surface: s.prev.surface }));

    const deletedWithFacts = deletedSymbols.slice(0, 30).map(d => ({
      id: d.id,
      surface: d.surface,
      existingFacts: (factsByDef.get(d.id) || []).slice(0, 4).map(f => ({
        factCode: f.factCode,
        claim: f.claim.slice(0, 120),
      })),
    }));

    // Compact summary of new symbols (group by file when > 40, e.g. brand-new SDK!)
    const newByFile = new Map();
    for (const d of newSymbols) {
      if (!newByFile.has(d.path)) newByFile.set(d.path, []);
      newByFile.get(d.path).push(d);
    }
    const prioritizedFiles = [...newByFile.entries()]
      .sort((a, b) => {
        const rank = p => (/(options|types|events|properties|limits|contract|analytics|manual|webmcp|instrument|handler|virtual_tools|mod\.rs|index\.ts)/i.test(p) ? 0 : 1);
        return rank(a[0]) - rank(b[0]) || b[1].length - a[1].length;
      });

    const newSymbolsSummary = newSymbols.length <= 40
      ? newSymbols.map(d => ({ id: d.id, surface: d.surface, kind: d.kind, lines: d.lines }))
      : {
          totalNewSymbols: newSymbols.length,
          totalNewFiles: newByFile.size,
          note: 'Large brand-new surface/module detected. Inspect key public API files with ia_inspect_code and map customer-facing behaviors with ia_map_code.',
          files: prioritizedFiles.slice(0, 25).map(([path, defs]) => ({
            path,
            surface: defs[0]?.surface,
            symbolCount: defs.length,
            sampleDefIds: defs.slice(0, 5).map(d => d.id),
          })),
        };

    // Detect brand-new surfaces (0 prior live IA facts on this surface!)
    const priorSurfaceCounts = new Map();
    for (const f of this.factsByCode.values()) {
      const s = String(f.surface || '').toUpperCase();
      priorSurfaceCounts.set(s, (priorSurfaceCounts.get(s) || 0) + 1);
    }
    const prSurfaces = [...new Set([
      ...changedSymbols.map(s => String(s.prev.surface || '').toUpperCase()),
      ...newSymbols.map(d => String(d.surface || '').toUpperCase()),
      ...deletedSymbols.map(d => String(d.surface || '').toUpperCase()),
      ...nonExcludedFiles.map(f => surfaceForPath(ev.repo, f.path, this.productConfig)),
    ].filter(Boolean))];
    const brandNewSurfaces = prSurfaces.filter(s => (priorSurfaceCounts.get(s) || 0) === 0);

    return {
      preGateSkipReason,
      fullDiffText,
      scopedDiffText,
      flagDelta,
      brandNewSurfaces,
      inScopeFiles: inScopeFiles.map(f => ({ status: f.status, path: f.path })),
      nonExcludedFiles: nonExcludedFiles.map(f => ({ status: f.status, path: f.path })),
      watchedManifests,
      bumpedSameHashCount,
      changedSymbols,
      newSymbols,
      deletedSymbols,
      prDefsById,
      prFileTexts,
      pinDeltaView: {
        repo: ev.repo,
        prNumber: ev.prNumber,
        commit: ev.commit,
        title: ev.title,
        batchTip: 'Batch multiple updates/retirements/mappings/bindings in one tool call using items/entries/pages arrays.',
        inScopeFiles: inScopeFiles.map(f => ({ status: f.status, path: f.path })),
        nonExcludedFiles: nonExcludedFiles.map(f => ({ status: f.status, path: f.path })),
        watchedManifests,
        brandNewSurfaces,
        unflaggedFlags: flagDelta.removedFlags,
        bumpedSameHashCount,
        changedSymbols: changedWithFacts,
        unmappedChangedSymbols,
        deletedSymbols: deletedWithFacts,
        newSymbols: newSymbolsSummary,
        availableSections: this.allSections().map(
          s => `${s.code}: ${s.title}${s.live_doc_pages?.length ? ` (${s.live_doc_pages.slice(0, 3).map(p => p.replace(/^contents\/docs\/mcp-analytics\//, '')).join(', ')})` : ''}`
        ),
      },
    };
  }

  /**
   * Compute dynamic blast radius using CURRENT live IA state (including any facts the agent
   * JUST updated, retired, or newly mapped in Steps 2–3 of the decision tree!).
   */
  computeBlastRadius({ delta, extraFactCodes = [], retiredFactSnapshots = [], maxPages = 12 }) {
    const facts = this.allFacts();
    const claims = this.allClaims();

    const changedDefIds = new Set([
      ...delta.changedSymbols.map(s => s.prev.id),
      ...delta.deletedSymbols.map(d => d.id),
    ]);
    const extraSet = new Set(extraFactCodes);

    const directlyAffectedFacts = [
      ...facts.filter(f => changedDefIds.has(f.def) || extraSet.has(f.factCode)),
      ...retiredFactSnapshots,
    ];
    const directFactCodes = new Set(directlyAffectedFacts.map(f => f.factCode));
    const touchedSectionCodes = new Set(directlyAffectedFacts.map(f => f.sectionCode).filter(Boolean));
    const touchedSurfaces = new Set(
      [
        ...delta.changedSymbols.map(s => String(s.prev.surface || '').toUpperCase()),
        ...delta.newSymbols.map(s => String(s.surface || '').toUpperCase()),
        ...delta.deletedSymbols.map(s => String(s.surface || '').toUpperCase()),
        ...directlyAffectedFacts.map(f => String(f.surface || '').toUpperCase()),
        ...delta.nonExcludedFiles.map(f => surfaceForPath(delta.pinDeltaView.repo, f.path, this.productConfig)),
      ].filter(Boolean)
    );

    const changedPorts = new Set(
      directlyAffectedFacts
        .map(f => (f.port ? `${f.port.kind}:${String(f.port.key || '').toLowerCase()}` : null))
        .filter(Boolean)
    );
    const portFactCodes = new Set();
    for (const f of facts) {
      if (f.port && changedPorts.has(`${f.port.kind}:${String(f.port.key || '').toLowerCase()}`)) {
        portFactCodes.add(f.factCode);
      }
    }

    const changedLinesOnly = String(delta.scopedDiffText || delta.fullDiffText || '')
      .slice(0, 85_000)
      .split('\n')
      .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
      .join('\n');

    // Detect release / maturity / version promotion PRs (watched manifests or explicit stability changes)
    const isReleaseOrStatusChange =
      (delta.watchedManifests || []).length > 0 ||
      /\b(1\.0\.0|pre-1\.0|declare.*stable|release.*1\.0|general availability|\bsemver\b)\b/i.test(
        `${delta.pinDeltaView.title}\n${changedLinesOnly.slice(0, 12_000)}`
      );
    const STATUS_CLAIM_RE = /\b(beta|alpha|experimental|pre-1\.0|stable|semver|support|version|release|1\.0|v1|ga|deprecated)\b/i;

    const rawTokens =
      changedLinesOnly.match(/(\$[a-z][a-z0-9_]{3,}|[a-z]+_[a-z0-9_]{3,}|[a-z]{2,}[A-Z][A-Za-z0-9]{2,}|@[a-z0-9-]+\/[a-z0-9-]+)/g) || [];
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

    const isBrandNewSurface = (delta.brandNewSurfaces || []).length > 0;
    const hasSurfaceFilter = touchedSurfaces.size > 0;
    const surfaceHints = this.productConfig.doc_surface_hints || [];
    const scored = [];
    for (const c of claims) {
      // Only filter out claims on dedicated single-surface pages (e.g. typescript.mdx on a PY PR).
      // Shared cross-surface pages (events.mdx, installation/index.mdx, etc.) ALWAYS remain eligible!
      const pageSurf = pageLevelSurface(c.pagePath, surfaceHints);
      const effectiveSurf = pageSurf !== 'ALL' ? pageSurf : 'ALL';
      if (hasSurfaceFilter && effectiveSurf !== 'ALL' && !touchedSurfaces.has(effectiveSurf)) continue;

      let score = 0;
      let graphHit = false;
      const matchedDirect = [];
      const matchedPort = [];
      for (const fc of c.factCodes || []) {
        if (directFactCodes.has(fc)) {
          score += 15;
          graphHit = true;
          matchedDirect.push(fc);
        } else if (portFactCodes.has(fc)) {
          score += 8;
          graphHit = true;
          matchedPort.push(fc);
        }
      }
      const touchedByThisPr = matchedDirect.length > 0 || matchedPort.length > 0;
      if (touchedByThisPr && (c.state === 'stale' || c.state === 'contradicted')) {
        score += 10;
      }
      for (const sc of c.sectionCodes || []) {
        if (touchedSectionCodes.has(sc)) {
          score += 4;
          graphHit = true;
        }
      }
      const lowerClaim = `${c.text || ''} ${c.plainText || ''}`.toLowerCase();
      if (isReleaseOrStatusChange && STATUS_CLAIM_RE.test(lowerClaim)) {
        score += 16;
        graphHit = true;
      }
      const matchedTokens = [];
      for (const tok of diffTokens) {
        if (lowerClaim.includes(tok)) {
          score += tok.startsWith('$') ? 5 : 3;
          matchedTokens.push(tok);
        }
      }
      if (score > 0 && (graphHit || matchedTokens.length >= 1)) {
        scored.push({ claim: c, score, graphHit, matchedDirect, matchedPort, matchedTokens });
      }
    }

    const byPage = new Map();
    for (const item of scored) {
      const p = item.claim.pagePath;
      if (!byPage.has(p)) byPage.set(p, []);
      byPage.get(p).push(item);
    }

    const candidatePages = [...byPage.entries()]
      .map(([pagePath, items]) => {
        items.sort((a, b) => b.score - a.score);
        const hasDirectGraph = items.some(x => x.graphHit);
        const pageScore = items.slice(0, 3).reduce((s, x) => s + x.score, 0) + (hasDirectGraph ? 6 : 0);
        return {
          pagePath,
          pageScore,
          claims: items.slice(0, 4).map(x => ({
            claimCode: x.claim.claimCode,
            lines: `${x.claim.startLine}-${x.claim.endLine}`,
            state: x.claim.state,
            text: String(x.claim.plainText || x.claim.text || '').slice(0, 150),
            ...(x.matchedDirect.length ? { direct: x.matchedDirect.slice(0, 3) } : {}),
            ...(x.matchedPort.length ? { port: x.matchedPort.slice(0, 2) } : {}),
          })),
        };
      })
      .sort((a, b) => b.pageScore - a.pageScore)
      .slice(0, Math.min(maxPages, 9));

    const matchingSections = this.allSections()
      .filter(s => touchedSectionCodes.has(s.code))
      .slice(0, 8)
      .map(s => ({ code: s.code, title: s.title, live_doc_pages: s.live_doc_pages || [] }));

    // When introducing a brand-new surface (0 prior IA facts on that surface), list ALL cross-surface pages
    // that contain multi-SDK matrices or per-SDK notes so the agent updates every cross-cutting page too!
    let newSurfaceCrossCuttingPages = [];
    if (isBrandNewSurface) {
      const crossMap = new Map();
      for (const c of claims) {
        if (String(c.surface || 'ALL').toUpperCase() !== 'ALL') continue;
        const txt = `${c.text || ''} ${c.plainText || ''}`;
        const isMatrixOrMultiSdk =
          c.kind === 'table_row' ||
          /\b(sdk|typescript|python|go|ruby|install|support|only|beta|experimental|stable)\b/i.test(txt);
        if (!isMatrixOrMultiSdk) continue;
        if (!crossMap.has(c.pagePath)) crossMap.set(c.pagePath, []);
        crossMap.get(c.pagePath).push({
          claimCode: c.claimCode,
          lines: `${c.startLine}-${c.endLine}`,
          text: String(c.plainText || c.text || '').slice(0, 130),
        });
      }
      newSurfaceCrossCuttingPages = [...crossMap.entries()]
        .map(([pagePath, hits]) => ({ pagePath, count: hits.length, samples: hits.slice(0, 3) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);
    }

    // Surface dedicated landing pages for every touched surface (generic across all products: e.g. UI -> web-app.mdx, API -> api.mdx, RS -> rust.mdx)
    const surfaceLandingSet = new Set();
    for (const c of claims) {
      const pSurf = pageLevelSurface(c.pagePath, surfaceHints);
      if (pSurf !== 'ALL' && touchedSurfaces.has(pSurf)) surfaceLandingSet.add(c.pagePath);
    }
    const surfaceLandingPages = [...surfaceLandingSet].sort();

    return {
      touchedSurfaces: [...touchedSurfaces],
      brandNewSurfaces: delta.brandNewSurfaces || [],
      isReleaseOrStatusChange,
      surfaceLandingPages,
      directFactsCount: directlyAffectedFacts.length,
      directFacts: directlyAffectedFacts.slice(0, 15).map(f => ({
        factCode: f.factCode,
        surface: f.surface,
        claim: f.claim.slice(0, 130),
        sectionCode: f.sectionCode,
      })),
      retiredFactsCount: retiredFactSnapshots.length,
      retiredFacts: retiredFactSnapshots.slice(0, 12).map(f => ({
        factCode: f.factCode,
        claim: f.claim.slice(0, 110),
      })),
      matchingSections,
      candidatePages,
      ...(newSurfaceCrossCuttingPages.length ? { newSurfaceCrossCuttingPages } : {}),
      diffTokens: diffTokens.slice(0, 12),
    };
  }
}

/**
 * Create the live read/write `docs-ia` SDK MCP Server bound to the current PR and `StatefulIaStore`.
 * Every write tool mutates `store` in place and logs into `prMutations` for full auditability & scoring.
 */
export async function createStatefulDocsIaMcpServer({ store, delta, event: ev, workspaceRoot, parseAst, sdk = null }) {
  const loadedSdk = sdk || await defaultLoadClaudeSdk();
  const { createSdkMcpServer, tool: claudeTool, z } = loadedSdk;
  const prMutations = {
    updatedFacts: [],
    retiredFacts: [],
    mappedFacts: [],
    updatedBindings: [],
    mintedClaims: [],
    retiredClaims: [],
    toolCallCounts: {},
  };
  const retiredFactSnapshots = [];
  const touchedFactCodesThisPr = new Set();

  const track = name => {
    prMutations.toolCallCounts[name] = (prMutations.toolCallCounts[name] || 0) + 1;
  };
  const textResult = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

  const server = createSdkMcpServer({
    name: 'docs-ia',
    version: '2.1.0',
    alwaysLoad: true,
    tools: [
      // Step 1: Check what changed in the IA
      claudeTool(
        'ia_pin_delta',
        'Step 1: Inspect the deterministic AST pin delta for this PR: changed symbols (with existing IA facts), deleted symbols (with existing IA facts), new/unmapped symbols, watched release manifests, brand-new surfaces, unflagged feature flags, and available IA sections.',
        {},
        async () => {
          track('ia_pin_delta');
          return textResult(delta.pinDeltaView);
        }
      ),

      // Helper for Step 2 & 3: inspect one or multiple post-PR source files or symbol bodies
      claudeTool(
        'ia_inspect_code',
        'Read source lines of one or more changed/added files (or a specific symbol) from this PR. Pass { path, symbol?, startLine?, endLine? } OR batch { paths: ["file1", "file2"] } to inspect multiple key public files in 1 call.',
        {
          path: z.string().optional().describe('Single repo-relative file path.'),
          paths: z.array(z.string()).max(6).optional().describe('Batch list of up to 6 repo-relative file paths to inspect together.'),
          symbol: z.string().optional().describe('Optional symbol name when inspecting a single file.'),
          startLine: z.number().int().min(1).optional().describe('Optional 1-based start line (default 1).'),
          endLine: z.number().int().min(1).optional().describe('Optional 1-based end line.'),
        },
        async ({ path: relPath, paths, symbol, startLine = 1, endLine }) => {
          track('ia_inspect_code');
          if (Array.isArray(paths) && paths.length > 0) {
            const perFileChars = Math.floor(14_000 / paths.length);
            const results = paths.map(p => {
              const text = delta.prFileTexts.get(p);
              if (typeof text !== 'string') return { path: p, error: 'Not in non-excluded PR files' };
              const lines = text.split('\n');
              const defs = [...delta.prDefsById.values()].filter(d => d.path === p).map(d => d.id).slice(0, 12);
              const numbered = lines.slice(0, 90).map((l, i) => `${i + 1}: ${l}`).join('\n').slice(0, perFileChars);
              return { path: p, totalLines: lines.length, defs, code: numbered };
            });
            return textResult({ files: results });
          }
          if (!relPath) {
            return textResult({ error: 'Provide path or paths[]', availableFiles: [...delta.prFileTexts.keys()].slice(0, 30) });
          }
          if (symbol) {
            const defId = `${ev.repo}:${relPath}#${symbol}`;
            const def = delta.prDefsById.get(defId) || [...delta.prDefsById.values()].find(d => d.path === relPath && d.symbol === symbol);
            if (def) {
              return textResult({ defId: def.id, surface: def.surface, kind: def.kind, start: def.start, end: def.end, code: def.sliceText.slice(0, 7000) });
            }
          }
          const text = delta.prFileTexts.get(relPath);
          if (typeof text !== 'string') {
            return textResult({ error: `File not in non-excluded PR files: ${relPath}`, availableFiles: [...delta.prFileTexts.keys()].slice(0, 30) });
          }
          const lines = text.split('\n');
          const s = Math.max(1, startLine);
          const e = Math.min(lines.length, endLine || s + 130);
          const numbered = lines.slice(s - 1, e).map((l, i) => `${s + i}: ${l}`).join('\n');
          const defs = [...delta.prDefsById.values()].filter(d => d.path === relPath).map(d => ({ id: d.id, symbol: d.symbol, kind: d.kind, start: d.start, end: d.end }));
          return textResult({ path: relPath, totalLines: lines.length, showing: `${s}-${e}`, defs: defs.slice(0, 20), code: numbered.slice(0, 8000) });
        }
      ),

      // Step 2a: Update one or many existing IA facts whose pinned code changed (supports batch `items`)
      claudeTool(
        'ia_update_fact',
        'Step 2: Update one or more existing IA facts whose pinned code changed behavior. Pass either { factCode, claim, ... } OR a batch { items: [{ factCode, claim, ... }] }. Refreshes pins, marks bound docs claims stale, and returns impacted pages.',
        {
          factCode: z.string().optional().describe('Single factCode (or use items[] for batch updates).'),
          claim: z.string().optional().describe('Updated outside-in factual claim.'),
          quote: z.string().optional(),
          sectionCode: z.string().optional(),
          items: z.array(
            z.object({
              factCode: z.string(),
              claim: z.string().min(8),
              quote: z.string().optional(),
              sectionCode: z.string().optional(),
            })
          ).optional().describe('Batch array of fact updates to apply in a single call.'),
        },
        async ({ factCode, claim, quote, sectionCode, items }) => {
          track('ia_update_fact');
          const batch = Array.isArray(items) && items.length
            ? items
            : (factCode && claim ? [{ factCode, claim, quote, sectionCode }] : []);
          const results = [];
          const impactedPages = new Set();
          for (const it of batch) {
            const existing = store.factsByCode.get(it.factCode);
            const def = existing ? delta.prDefsById.get(existing.def) : null;
            const res = store.updateFact({
              factCode: it.factCode,
              claim: it.claim,
              quote: it.quote,
              sectionCode: it.sectionCode,
              nextPin: def?.pin || existing?.pin || null,
            });
            if (res.ok) {
              touchedFactCodesThisPr.add(it.factCode);
              prMutations.updatedFacts.push({ factCode: it.factCode, claim: it.claim });
              for (const c of res.impactedClaims || []) impactedPages.add(c.pagePath);
            }
            results.push({ ok: res.ok, factCode: it.factCode, impactedClaimsCount: (res.impactedClaims || []).length, error: res.error });
          }
          return textResult({ updatedCount: results.filter(r => r.ok).length, impactedPages: [...impactedPages], results });
        }
      ),

      // Step 2b: Retire one or many existing IA facts whose code was deleted or superseded (supports batch `items`)
      claudeTool(
        'ia_retire_fact',
        'Step 2: Retire one or more IA facts whose code symbol or behavior was removed. Pass either { factCode, reason, replacedBy? } OR a batch { items: [{ factCode, reason, replacedBy? }] }. Writes permanent Dewey v3 tombstones and marks bound docs claims contradicted.',
        {
          factCode: z.string().optional().describe('Single factCode to retire (or use items[] to retire all deleted facts in 1 call).'),
          reason: z.string().optional(),
          replacedBy: z.string().optional(),
          items: z.array(
            z.object({
              factCode: z.string(),
              reason: z.string().min(4),
              replacedBy: z.string().optional(),
            })
          ).optional().describe('Batch array of facts to retire in one call.'),
        },
        async ({ factCode, reason, replacedBy, items }) => {
          track('ia_retire_fact');
          const batch = Array.isArray(items) && items.length
            ? items
            : (factCode ? [{ factCode, reason: reason || 'Code removed or deprecated', replacedBy }] : []);
          const results = [];
          const impactedPages = new Set();
          for (const it of batch) {
            const snap = store.factsByCode.get(it.factCode);
            const res = store.retireFact({ factCode: it.factCode, reason: it.reason, replacedBy: it.replacedBy, today: ev.date });
            if (res.ok && snap) {
              retiredFactSnapshots.push(structuredClone(snap));
              touchedFactCodesThisPr.add(it.factCode);
              prMutations.retiredFacts.push({ factCode: it.factCode, reason: it.reason, replacedBy: it.replacedBy || null });
              for (const c of res.impactedClaims || []) impactedPages.add(c.pagePath);
            }
            results.push({ ok: res.ok, factCode: it.factCode, impactedClaimsCount: (res.impactedClaims || []).length, error: res.error });
          }
          return textResult({ retiredCount: results.filter(r => r.ok).length, impactedPages: [...impactedPages], results });
        }
      ),

      // Step 3: Map new or unmapped code into live IA (supports single entry OR batch `entries[]`)
      claudeTool(
        'ia_map_code',
        'Step 3: Map new or unmapped code (options, events, APIs, UI features, release status, or a brand-new SDK/surface) into the live IA. Pass { defId?, path?, symbol?, facts } OR batch { entries: [{ defId?, path?, symbol?, facts }] } to map multiple files in 1 call.',
        {
          defId: z.string().optional(),
          path: z.string().optional(),
          symbol: z.string().optional(),
          facts: z.array(
            z.object({
              type: z.enum(['fact', 'rule', 'default', 'limit', 'event', 'option', 'endpoint', 'tool']).optional(),
              claim: z.string().min(8),
              quote: z.string().min(4),
              port: z.object({ kind: z.string(), dir: z.string(), key: z.string() }).optional(),
              sectionCode: z.string().optional(),
            })
          ).optional(),
          entries: z.array(
            z.object({
              defId: z.string().optional(),
              path: z.string().optional(),
              symbol: z.string().optional(),
              facts: z.array(
                z.object({
                  type: z.enum(['fact', 'rule', 'default', 'limit', 'event', 'option', 'endpoint', 'tool']).optional(),
                  claim: z.string().min(8),
                  quote: z.string().min(4),
                  port: z.object({ kind: z.string(), dir: z.string(), key: z.string() }).optional(),
                  sectionCode: z.string().optional(),
                })
              ).min(1).max(12),
            })
          ).optional().describe('Batch array of code definitions/files to map into the IA in one call.'),
        },
        async ({ defId, path: relPath, symbol, facts: singleFacts, entries }) => {
          track('ia_map_code');
          const batchEntries = Array.isArray(entries) && entries.length
            ? entries
            : (Array.isArray(singleFacts) && singleFacts.length ? [{ defId, path: relPath, symbol, facts: singleFacts }] : []);

          const allMinted = [];
          for (const entry of batchEntries) {
            let def = entry.defId ? delta.prDefsById.get(entry.defId) : null;
            if (!def && entry.defId) def = store.anchorsById.get(entry.defId) || null;
            if (!def && entry.path) {
              def = [...delta.prDefsById.values()].find(d => d.path === entry.path && (!entry.symbol || d.symbol === entry.symbol)) ||
                [...store.anchorsById.values()].find(d => d.repo === ev.repo && d.path === entry.path && (!entry.symbol || d.symbol === entry.symbol));
            }
            if (!def && entry.path && delta.prFileTexts.has(entry.path)) {
              const parsed = await indexSourceFile({
                repo: ev.repo,
                commit: ev.commit,
                path: entry.path,
                text: delta.prFileTexts.get(entry.path),
                productConfig: store.productConfig,
                parseAst,
              });
              def = parsed.find(d => !entry.symbol || d.symbol === entry.symbol) || parsed[0] || null;
              if (def) {
                delta.prDefsById.set(def.id, def);
                store.anchorsById.set(def.id, { ...def, sliceText: undefined });
              }
            }
            const resolvedPath = def?.path || entry.path || delta.nonExcludedFiles[0]?.path || 'unknown';
            const resolvedSymbol = def?.symbol || entry.symbol || '<module>';
            const resolvedDefId = def?.id || entry.defId || `${ev.repo}:${resolvedPath}#${resolvedSymbol}`;
            const resolvedSurface = def?.surface || surfaceForPath(ev.repo, resolvedPath, store.productConfig);
            const resolvedPin = def?.pin || createDetachedPin({
              commit: ev.commit,
              text: delta.prFileTexts.get(resolvedPath) || delta.scopedDiffText.slice(0, 4000) || resolvedDefId,
            });
            if (!store.anchorsById.has(resolvedDefId)) {
              store.anchorsById.set(resolvedDefId, {
                id: resolvedDefId,
                repo: ev.repo,
                path: resolvedPath,
                symbol: resolvedSymbol,
                kind: def?.kind || 'module',
                surface: resolvedSurface,
                pin: resolvedPin,
              });
            }

            for (const item of entry.facts) {
              const res = store.registerFact({
                def: resolvedDefId,
                repo: ev.repo,
                path: resolvedPath,
                symbol: resolvedSymbol,
                surface: resolvedSurface,
                type: item.type || 'fact',
                claim: item.claim,
                quote: item.quote,
                port: item.port || null,
                sectionCode: item.sectionCode || null,
                pin: resolvedPin,
                today: ev.date,
              });
              touchedFactCodesThisPr.add(res.factCode);
              prMutations.mappedFacts.push({ factCode: res.factCode, def: resolvedDefId, claim: item.claim, created: res.created });
              allMinted.push({ factCode: res.factCode, defId: resolvedDefId, created: res.created, sectionCode: res.fact.sectionCode, surface: res.fact.surface });
            }
          }
          return textResult({ ok: true, mintedCount: allMinted.length, minted: allMinted });
        }
      ),

      // Step 4a: Trace blast radius from changed, retired, and newly mapped facts to live docs pages
      claudeTool(
        'ia_blast_radius',
        'Step 4: Trace changed, retired, updated, and newly mapped IA facts through direct pins, 1-hop ports, and capability sections to ranked live docs pages and claims (with current line numbers).',
        {
          maxPages: z.number().int().min(1).max(15).optional(),
          includeFactCodes: z.array(z.string()).optional().describe('Optional extra factCodes (e.g. newly mapped facts) to include in blast radius.'),
        },
        async ({ maxPages = 10, includeFactCodes = [] }) => {
          track('ia_blast_radius');
          const res = store.computeBlastRadius({
            delta,
            extraFactCodes: [...touchedFactCodesThisPr, ...includeFactCodes],
            retiredFactSnapshots,
            maxPages,
          });
          return textResult(res);
        }
      ),

      // Supporting lookup tools
      claudeTool(
        'ia_lookup_facts',
        'Search live facts in the Docs IA by symbol, file path, event name, or keyword.',
        {
          query: z.string().min(2),
          surface: z.string().optional(),
          limit: z.number().int().min(1).max(30).optional(),
        },
        async ({ query, surface, limit = 15 }) => {
          track('ia_lookup_facts');
          const q = query.toLowerCase();
          const surf = surface ? surface.toUpperCase() : null;
          const matches = store.allFacts()
            .filter(f => {
              if (surf && String(f.surface || '').toUpperCase() !== surf) return false;
              return `${f.factCode} ${f.def} ${f.claim} ${f.quote}`.toLowerCase().includes(q);
            })
            .slice(0, limit)
            .map(f => ({
              factCode: f.factCode,
              def: f.def,
              surface: f.surface,
              sectionCode: f.sectionCode,
              claim: f.claim,
              quote: f.quote,
            }));
          return textResult({ query, count: matches.length, facts: matches });
        }
      ),

      claudeTool(
        'ia_lookup_page_claims',
        'List all bound documentation claims on a live .mdx page with their current line numbers, states, and linked factCodes.',
        {
          pagePath: z.string().describe('Repo-relative page path, e.g. contents/docs/mcp-analytics/events.mdx'),
        },
        async ({ pagePath }) => {
          track('ia_lookup_page_claims');
          const norm = pagePath.replace(/^\/+/, '');
          const pageClaims = store.allClaims()
            .filter(c => c.pagePath === norm || c.pagePath.endsWith(norm))
            .sort((a, b) => (a.startLine || 0) - (b.startLine || 0))
            .map(c => ({
              claimCode: c.claimCode,
              startLine: c.startLine,
              endLine: c.endLine,
              headingPath: c.headingPath || '',
              state: c.state,
              surface: c.surface,
              factCodes: c.factCodes || [],
              text: String(c.plainText || c.text || '').slice(0, 240),
            }));
          return textResult({ pagePath: norm, count: pageClaims.length, claims: pageClaims });
        }
      ),

      claudeTool(
        'ia_audit_trail',
        'Inspect live and retired Dewey v3 register entries (tombstones and replacement pointers).',
        {
          query: z.string().min(2),
        },
        async ({ query }) => {
          track('ia_audit_trail');
          const direct = auditTrailForCode(store.register, query);
          if (direct?.found) return textResult(direct);
          const q = query.toLowerCase();
          const retiredMatches = (store.register.retiredLeaves || [])
            .filter(r => JSON.stringify(r).toLowerCase().includes(q))
            .slice(0, 15);
          return textResult({ query, direct, retiredMatches });
        }
      ),

      // Step 4b: Update docs claim bindings right after editing/creating one or more .mdx pages (supports batch `pages[]`)
      claudeTool(
        'ia_update_doc_bindings',
        'Step 4: After editing or creating .mdx page(s) on disk, re-anchor claims and bind edited/new docs pieces to live IA factCodes. Pass either { pagePath, bindings, retireClaimCodes } OR batch { pages: [{ pagePath, bindings, retireClaimCodes }] } in 1 call.',
        {
          pagePath: z.string().optional(),
          bindings: z.array(
            z.object({
              claimCode: z.string().optional(),
              matchText: z.string().optional(),
              startLine: z.number().int().min(1).optional(),
              endLine: z.number().int().min(1).optional(),
              factCodes: z.array(z.string()),
              state: z.enum(['fresh', 'prose-backed', 'contradicted']).optional(),
              sectionCodes: z.array(z.string()).optional(),
              note: z.string().optional(),
            })
          ).optional(),
          retireClaimCodes: z.array(z.string()).optional(),
          pages: z.array(
            z.object({
              pagePath: z.string(),
              bindings: z.array(
                z.object({
                  claimCode: z.string().optional(),
                  matchText: z.string().optional(),
                  startLine: z.number().int().min(1).optional(),
                  endLine: z.number().int().min(1).optional(),
                  factCodes: z.array(z.string()),
                  state: z.enum(['fresh', 'prose-backed', 'contradicted']).optional(),
                  sectionCodes: z.array(z.string()).optional(),
                  note: z.string().optional(),
                })
              ).optional(),
              retireClaimCodes: z.array(z.string()).optional(),
            })
          ).optional().describe('Batch array of pages to re-bind in a single call.'),
        },
        async ({ pagePath, bindings = [], retireClaimCodes = [], pages }) => {
          track('ia_update_doc_bindings');
          const batchPages = Array.isArray(pages) && pages.length
            ? pages
            : (pagePath ? [{ pagePath, bindings, retireClaimCodes }] : []);
          const pageResults = [];
          const surfaceHints = store.productConfig.doc_surface_hints || [];

          for (const pg of batchPages) {
            const normPath = pg.pagePath.replace(/^\/+/, '');
            const absPath = join(workspaceRoot, normPath);
            if (!existsSync(absPath)) {
              pageResults.push({ ok: false, pagePath: normPath, error: `File does not exist on disk yet: ${normPath}.` });
              continue;
            }
            const rawText = readFileSync(absPath, 'utf8');
            const singleMap = new Map([[normPath, rawText]]);
            store.reconcileDocsMap(singleMap, { docsCommit: `agent:${ev.id}`, today: ev.date, onlyPages: [normPath] });

            const pieces = splitMdxFile(normPath, rawText, { surfaceHints }).filter(p => p.mappable);
            const applied = [];

            for (const rc of pg.retireClaimCodes || []) {
              if (store.retireClaim({ claimCode: rc, reason: `Removed during PR #${ev.prNumber}`, today: ev.date })) {
                prMutations.retiredClaims.push({ claimCode: rc, pagePath: normPath });
              }
            }

            for (const b of pg.bindings || []) {
              const validFacts = (b.factCodes || []).filter(fc => store.factsByCode.has(fc));
              const factSurfs = validFacts.map(fc => store.factsByCode.get(fc)?.surface).filter(Boolean);
              const factSections = [...new Set(validFacts.map(fc => store.factsByCode.get(fc)?.sectionCode).filter(Boolean))];

              let piece = null;
              if (b.matchText && b.matchText.trim().length >= 4) {
                const needle = b.matchText.trim().toLowerCase();
                piece = pieces.find(p => p.text.toLowerCase().includes(needle) || p.plainText.toLowerCase().includes(needle)) || null;
              }
              if (!piece && typeof b.startLine === 'number') {
                const eLine = b.endLine || b.startLine;
                piece = pieces.find(p => p.startLine <= eLine + 2 && p.endLine >= b.startLine - 2) || null;
              }
              if (!piece && b.claimCode && store.claimsByCode.has(b.claimCode)) {
                const cur = store.claimsByCode.get(b.claimCode);
                piece = pieces.find(p => p.pieceId === cur.pieceId) || null;
              }

              if (b.claimCode && store.claimsByCode.has(b.claimCode)) {
                const cl = store.claimsByCode.get(b.claimCode);
                if (piece) {
                  cl.pieceId = piece.pieceId;
                  cl.startLine = piece.startLine;
                  cl.endLine = piece.endLine;
                  cl.headingPath = piece.headingPath;
                  cl.text = piece.text;
                  cl.plainText = piece.plainText;
                }
                cl.factCodes = [...new Set([...(validFacts.length ? validFacts : cl.factCodes || [])])];
                cl.state = b.state || 'fresh';
                if (b.sectionCodes?.length) cl.sectionCodes = b.sectionCodes;
                else if (factSections.length) cl.sectionCodes = [...new Set([...(cl.sectionCodes || []), ...factSections])];
                if (b.note) cl.note = b.note;
                prMutations.updatedBindings.push({ claimCode: cl.claimCode, pagePath: normPath, factCodes: cl.factCodes });
                applied.push({ op: 'updated', claimCode: cl.claimCode, lines: `${cl.startLine}-${cl.endLine}` });
              } else {
                const existingOnPiece = piece
                  ? store.allClaims().find(c => c.pagePath === normPath && c.pieceId === piece.pieceId)
                  : null;
                if (existingOnPiece) {
                  existingOnPiece.factCodes = [...new Set([...(existingOnPiece.factCodes || []), ...validFacts])];
                  existingOnPiece.state = b.state || 'fresh';
                  if (factSections.length) existingOnPiece.sectionCodes = [...new Set([...(existingOnPiece.sectionCodes || []), ...factSections])];
                  if (b.note) existingOnPiece.note = b.note;
                  prMutations.updatedBindings.push({ claimCode: existingOnPiece.claimCode, pagePath: normPath, factCodes: existingOnPiece.factCodes });
                  applied.push({ op: 'updated_piece', claimCode: existingOnPiece.claimCode, lines: `${existingOnPiece.startLine}-${existingOnPiece.endLine}` });
                } else {
                  const pageSurf = pageLevelSurface(normPath, surfaceHints);
                  const surf = pageSurf !== 'ALL' ? pageSurf : 'ALL';
                  const claimCode = store.allocateLeafCode(surf, 'C');
                  const claimText = piece ? piece.text : (b.matchText || `Claim on ${normPath}`);
                  const plainText = piece ? piece.plainText : claimText;
                  const sLine = piece?.startLine || b.startLine || 1;
                  const eLine = piece?.endLine || b.endLine || sLine;
                  const leafKey = `c3:${surf.toLowerCase()}:${normPath}:${shortSha256(normalizeQuoteForIdentity(plainText))}:${sLine}`;
                  const newClaim = {
                    claimCode,
                    leafKey,
                    pieceId: piece?.pieceId || `${normPath}#L${sLine}-L${eLine}`,
                    pagePath: normPath,
                    pageUrl: `https://posthog.com/${normPath.replace(/^contents\//, '').replace(/\/index\.mdx$/, '').replace(/\.mdx$/, '')}`,
                    kind: piece?.kind || 'paragraph',
                    headingPath: piece?.headingPath || '',
                    startLine: sLine,
                    endLine: eLine,
                    text: claimText,
                    plainText,
                    surface: surf,
                    state: b.state || (validFacts.length ? 'fresh' : 'prose-backed'),
                    factCodes: validFacts,
                    sectionCodes: b.sectionCodes?.length ? b.sectionCodes : factSections,
                    note: b.note || `Bound during PR #${ev.prNumber}`,
                    docsCommit: `agent:${ev.id}`,
                  };
                  store.claimsByCode.set(claimCode, newClaim);
                  store.register.leaves[claimCode] = leafKey;
                  store.register.leafTitles[claimCode] = plainText.slice(0, 140);
                  for (const sc of newClaim.sectionCodes || []) {
                    const sec = store.allSections().find(s => s.code === sc);
                    if (sec) {
                      sec.live_doc_pages ??= [];
                      if (!sec.live_doc_pages.includes(normPath)) sec.live_doc_pages.push(normPath);
                    }
                  }
                  prMutations.mintedClaims.push({ claimCode, pagePath: normPath, factCodes: validFacts });
                  applied.push({ op: 'minted', claimCode, lines: `${sLine}-${eLine}` });
                }
              }
            }
            pageResults.push({ ok: true, pagePath: normPath, appliedCount: applied.length, applied });
          }

          return textResult({ ok: true, pagesProcessed: pageResults.length, pageResults });
        }
      ),
    ],
  });

  return { server, prMutations };
}
