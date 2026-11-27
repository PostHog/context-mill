// Product-agnostic Dewey Decimal + Surface-Coded Permanent Register (v3).
//
// Guarantees:
//   1. Append-only permanent codes (`<PROD>-<SURF>-<KIND>-<ID>`, `<PROD>-<CH>.<SEC>`, `UC-<N>`).
//      Retired codes are NEVER recycled.
//   2. Backward-compatible wider padding (`P:3, PR:3, D:3, F:6, C:6`) while preserving
//      already-minted v2 codes verbatim.
//   3. O(N) reverse Map indexing (no O(N^2) linear scans).
//   4. 2-stage quote-signature relocation across file splits and symbol renames.
//   5. Explicit `retiredLeaves` tombstones + forward `to` pointers for full code-pin audit trails.
import { normalizeQuoteForIdentity } from './fact.mjs';
import { shortSha256 } from './pin.mjs';

export const LEAF_KINDS = new Set(['P', 'F', 'PR', 'D', 'C']);
export const ALLOW_ALL_SURFACE = new Set(['D', 'C']);
export const PAD_WIDTH_V3 = Object.freeze({ P: 3, PR: 3, D: 3, F: 6, C: 6 });

export function padLeafNum(kind, n) {
  const width = PAD_WIDTH_V3[kind] || 6;
  const s = String(n);
  return s.length >= width ? s : s.padStart(width, '0');
}

export function createEmptyRegister({ productCode, surfaces }) {
  return {
    version: 3,
    tool: productCode,
    surfaces: [...surfaces],
    live: {},
    titles: {},
    slugs: {},
    leaves: {},
    leafTitles: {},
    leafQuoteSigs: {},
    retired: [],
    retiredLeaves: [],
  };
}

export function createEmptyUcRegister() {
  return { tool: 'UC', live: {}, titles: {}, retired: [] };
}

/**
 * Mint or update Dewey structural codes (`<PROD>-<CH>.<SEC>`), leaf codes (`<PROD>-<SURF>-<KIND>-<NUM>`),
 * and cross-surface use-case codes (`UC-<N>`).
 */
export function assignDeweyCodesV3({
  productCode,
  surfaces,
  outline = [],
  useCases = [],
  leaves = [],
  register = null,
  ucRegister = null,
  changes = [],
  leafChanges = [],
  autoRetireMissingLeaves = true,
  today = new Date().toISOString().slice(0, 10),
}) {
  if (!productCode) throw new Error('productCode is required (e.g. "SV", "MCPA")');
  if (!Array.isArray(surfaces) || !surfaces.length) throw new Error('surfaces list is required');

  const surfSet = new Set(surfaces);
  const next = register ? structuredClone(register) : createEmptyRegister({ productCode, surfaces });
  const nextUC = ucRegister ? structuredClone(ucRegister) : createEmptyUcRegister();

  next.version = 3;
  next.surfaces = [...new Set([...(next.surfaces || []), ...surfaces])];
  next.live ??= {};
  next.titles ??= {};
  next.slugs ??= {};
  next.leaves ??= {};
  next.leafTitles ??= {};
  next.leafQuoteSigs ??= {};
  next.retired ??= [];
  next.retiredLeaves ??= [];

  const chSecRe = new RegExp(`^${productCode}-(0|[1-9][0-9]*)(?:\\.([1-9][0-9]*))?$`);
  const leafRe = new RegExp(`^${productCode}-(${[...next.surfaces, 'ALL'].join('|')})-(P|F|PR|D|C)-([0-9]+)$`);
  const ucRe = /^UC-([1-9][0-9]*)$/;

  const issuedStruct = new Set([
    ...Object.keys(next.live),
    ...next.retired.filter(r => chSecRe.test(r.code)).map(r => r.code),
  ]);
  const issuedLeaves = new Set([
    ...Object.keys(next.leaves),
    ...next.retiredLeaves.map(r => r.code),
  ]);
  const issuedUC = new Set([
    ...Object.keys(nextUC.live),
    ...nextUC.retired.map(r => r.code),
  ]);

  const parseChSec = code => {
    const m = code.match(chSecRe);
    if (!m) throw new Error(`Invalid chapter/section code: ${code}`);
    return { ch: Number(m[1]), sec: m[2] === undefined ? null : Number(m[2]) };
  };

  const structCodeByKey = new Map(Object.entries(next.live).map(([c, k]) => [k, c]));
  const leafCodeByKey = new Map(Object.entries(next.leaves).map(([c, k]) => [k, c]));
  const leafCodesByQuoteSig = new Map();
  for (const [code, sig] of Object.entries(next.leafQuoteSigs)) {
    if (!next.leaves[code]) continue;
    if (!leafCodesByQuoteSig.has(sig)) leafCodesByQuoteSig.set(sig, []);
    leafCodesByQuoteSig.get(sig).push(code);
  }

  const allocChapter = key => {
    if (key === 'ch-prerequisites') {
      const code = `${productCode}-0`;
      issuedStruct.add(code);
      return code;
    }
    let hi = 0;
    for (const c of issuedStruct) hi = Math.max(hi, parseChSec(c).ch);
    const code = `${productCode}-${hi + 1}`;
    issuedStruct.add(code);
    return code;
  };

  const allocSection = chCode => {
    let hi = 0;
    for (const c of issuedStruct) {
      if (!c.startsWith(`${chCode}.`)) continue;
      const p = parseChSec(c);
      if (p.sec !== null) hi = Math.max(hi, p.sec);
    }
    const code = `${chCode}.${hi + 1}`;
    issuedStruct.add(code);
    return code;
  };

  const allocLeaf = (surface, kind) => {
    const prefix = `${productCode}-${surface}-${kind}-`;
    let hi = 0;
    for (const c of issuedLeaves) {
      if (!c.startsWith(prefix)) continue;
      const num = Number(c.slice(prefix.length));
      if (Number.isFinite(num)) hi = Math.max(hi, num);
    }
    const code = `${prefix}${padLeafNum(kind, hi + 1)}`;
    issuedLeaves.add(code);
    return code;
  };

  const allocUC = () => {
    let hi = 0;
    for (const c of issuedUC) {
      const m = c.match(ucRe);
      if (m) hi = Math.max(hi, Number(m[1]));
    }
    const code = `UC-${hi + 1}`;
    issuedUC.add(code);
    return code;
  };

  const minted = [];
  const relocated = [];
  const retiredNow = [];

  // 1. Explicit structural retirements / renames / splits / merges
  for (const ch of changes) {
    for (const oldCode of ch.retire || []) {
      const oldKey = next.live[oldCode];
      if (!oldKey) continue;
      delete next.live[oldCode];
      structCodeByKey.delete(oldKey);
      next.retired.push({
        code: oldCode,
        key: oldKey,
        title: next.titles[oldCode] || oldKey,
        op: ch.op || 'retire',
        to: ch.to || [],
        date: today,
        reason: ch.reason || '',
        commit: ch.commit || null,
      });
    }
  }

  // 2. Chapters and sections
  const assignedOutline = [];
  for (const chapter of outline) {
    let chCode = structCodeByKey.get(chapter.key);
    if (!chCode) {
      chCode = allocChapter(chapter.key);
      next.live[chCode] = chapter.key;
      structCodeByKey.set(chapter.key, chCode);
      minted.push(chCode);
    }
    if (chapter.title) next.titles[chCode] = chapter.title;
    if (chapter.slug) next.slugs[chCode] = chapter.slug;

    const assignedSections = [];
    for (const sec of chapter.sections || []) {
      let secCode = structCodeByKey.get(sec.key);
      if (!secCode) {
        secCode = allocSection(chCode);
        next.live[secCode] = sec.key;
        structCodeByKey.set(sec.key, secCode);
        minted.push(secCode);
      }
      if (sec.title) next.titles[secCode] = sec.title;
      if (sec.slug) next.slugs[secCode] = sec.slug;
      assignedSections.push({ ...sec, code: secCode });
    }
    assignedOutline.push({ ...chapter, code: chCode, sections: assignedSections });
  }

  // 3. Explicit leaf retirements / forward pointers
  for (const lc of leafChanges) {
    for (const oldCode of lc.retire || []) {
      const oldKey = next.leaves[oldCode];
      if (!oldKey) continue;
      delete next.leaves[oldCode];
      leafCodeByKey.delete(oldKey);
      const entry = {
        code: oldCode,
        key: oldKey,
        title: next.leafTitles[oldCode] || oldKey,
        op: lc.op || 'retire',
        to: lc.to || [],
        date: today,
        reason: lc.reason || '',
        pin: lc.pin || null,
      };
      next.retiredLeaves.push(entry);
      retiredNow.push(entry);
    }
  }

  // 4. Leaf allocation with exact-key match -> legacyKey match -> quote-signature relocation -> fresh mint
  const seenLeafCodes = new Set();
  const assignedLeaves = [];
  for (const leaf of leaves) {
    if (!LEAF_KINDS.has(leaf.kind)) throw new Error(`Invalid leaf kind: ${leaf.kind}`);
    const surf = String(leaf.surface || '').toUpperCase();
    const validSurf = surfSet.has(surf) || (surf === 'ALL' && ALLOW_ALL_SURFACE.has(leaf.kind));
    if (!validSurf) throw new Error(`Invalid surface "${surf}" for leaf kind "${leaf.kind}"`);

    const quoteSig = leaf.quote
      ? `${surf}:${leaf.kind}:${shortSha256(normalizeQuoteForIdentity(leaf.quote))}`
      : null;

    let code = leafCodeByKey.get(leaf.key);
    if (!code && Array.isArray(leaf.legacyKeys)) {
      for (const lk of leaf.legacyKeys) {
        const hit = leafCodeByKey.get(lk);
        if (hit && !seenLeafCodes.has(hit)) {
          code = hit;
          leafCodeByKey.delete(lk);
          next.leaves[code] = leaf.key;
          leafCodeByKey.set(leaf.key, code);
          relocated.push({ code, fromKey: lk, toKey: leaf.key, via: 'legacyKey' });
          break;
        }
      }
    }
    if (!code && quoteSig && leafCodesByQuoteSig.has(quoteSig)) {
      const cand = leafCodesByQuoteSig.get(quoteSig).find(c => !seenLeafCodes.has(c) && leafRe.test(c));
      if (cand) {
        const prevKey = next.leaves[cand];
        code = cand;
        leafCodeByKey.delete(prevKey);
        next.leaves[code] = leaf.key;
        leafCodeByKey.set(leaf.key, code);
        relocated.push({ code, fromKey: prevKey, toKey: leaf.key, via: 'quoteSig' });
      }
    }
    if (!code) {
      code = allocLeaf(surf, leaf.kind);
      next.leaves[code] = leaf.key;
      leafCodeByKey.set(leaf.key, code);
      minted.push(code);
    }

    seenLeafCodes.add(code);
    if (leaf.title) next.leafTitles[code] = leaf.title;
    if (quoteSig) next.leafQuoteSigs[code] = quoteSig;
    assignedLeaves.push({ ...leaf, code });
  }

  // 5. Auto-retire missing leaves into `retiredLeaves` tombstones (never silently dropped)
  if (autoRetireMissingLeaves && register !== null) {
    for (const [code, key] of Object.entries({ ...next.leaves })) {
      if (!seenLeafCodes.has(code)) {
        delete next.leaves[code];
        const entry = {
          code,
          key,
          title: next.leafTitles[code] || key,
          op: 'delete',
          to: [],
          date: today,
          reason: 'Absent from current extraction pass',
          pin: null,
        };
        next.retiredLeaves.push(entry);
        retiredNow.push(entry);
      }
    }
  }

  // 6. Use cases (`UC-*`)
  const ucCodeByKey = new Map(Object.entries(nextUC.live).map(([c, k]) => [k, c]));
  const assignedUseCases = [];
  for (const uc of useCases) {
    let code = ucCodeByKey.get(uc.key);
    if (!code) {
      code = allocUC();
      nextUC.live[code] = uc.key;
      ucCodeByKey.set(uc.key, code);
      minted.push(code);
    }
    if (uc.title) nextUC.titles[code] = uc.title;
    assignedUseCases.push({ ...uc, code });
  }

  return {
    register: next,
    ucRegister: nextUC,
    outline: assignedOutline,
    leaves: assignedLeaves,
    useCases: assignedUseCases,
    stats: {
      minted: minted.length,
      relocated: relocated.length,
      retired: retiredNow.length,
      liveStruct: Object.keys(next.live).length,
      liveLeaves: Object.keys(next.leaves).length,
      retiredLeavesTotal: next.retiredLeaves.length,
    },
    minted,
    relocated,
    retiredNow,
  };
}

/**
 * Follow forward pointers (`to`) and tombstones for any live or retired code.
 * Lets a later agent trace why a doc claim or feature disappeared beyond `git blame`.
 */
export function auditTrailForCode(register, code) {
  if (!register || !code) return { code, status: 'unknown', hops: [] };
  if (register.live?.[code] || register.leaves?.[code]) {
    return {
      code,
      status: 'live',
      key: register.live?.[code] || register.leaves?.[code],
      title: register.titles?.[code] || register.leafTitles?.[code] || null,
      hops: [],
    };
  }
  const allRetired = [...(register.retired || []), ...(register.retiredLeaves || [])];
  const byCode = new Map(allRetired.map(r => [r.code, r]));
  const hops = [];
  const queue = [code];
  const visited = new Set();
  const liveTargets = [];

  while (queue.length) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (register.live?.[cur] || register.leaves?.[cur]) {
      liveTargets.push(cur);
      continue;
    }
    const rec = byCode.get(cur);
    if (!rec) continue;
    hops.push(rec);
    for (const target of rec.to || []) queue.push(target);
  }

  return {
    code,
    status: hops.length ? (liveTargets.length ? 'forwarded' : 'tombstoned') : 'unknown',
    liveTargets,
    hops,
  };
}
