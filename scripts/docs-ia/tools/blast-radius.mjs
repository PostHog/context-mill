// Deterministic blast-radius graph walk (`symbol -> F -> PR -> UC -> C -> page`)
// and thin lookup query helpers over derived knowledge & docs coverage.
import { auditTrailForCode } from '../models/register.mjs';

/**
 * Given a set of changed/deleted symbol IDs (and optional drifted platform contracts),
 * deterministically trace every impacted fact, 1-hop port neighbor, procedure, use case,
 * bound doc claim, and live docs page (0 LLM calls).
 */
export function traceBlastRadius({
  changedDefIds = [],
  driftedContracts = [],
  facts = [],
  portLinks = [],
  procedures = [],
  useCases = [],
  claims = [],
}) {
  const defSet = new Set(changedDefIds);
  const directFacts = facts.filter(f => defSet.has(f.def));
  const affectedFactIds = new Set(directFacts.map(f => f.code || f.id));

  // 1-hop port propagation from changed facts
  const oneHopFactIds = new Set();
  for (const link of portLinks) {
    if (affectedFactIds.has(link.from) && !affectedFactIds.has(link.to)) {
      oneHopFactIds.add(link.to);
    }
    if (affectedFactIds.has(link.to) && !affectedFactIds.has(link.from)) {
      oneHopFactIds.add(link.from);
    }
  }

  const allFactCodes = new Set([...affectedFactIds, ...oneHopFactIds]);

  const affectedProcedures = procedures.filter(pr =>
    (pr.steps || []).some(st => (st.facts || []).some(fid => allFactCodes.has(fid)))
  );
  const affectedProcCodes = new Set(affectedProcedures.map(p => p.code || p.id));

  const affectedUseCases = useCases.filter(uc =>
    (uc.procedures || []).some(pid => affectedProcCodes.has(pid)) ||
    driftedContracts.some(dc => (dc.consumers?.useCases || []).includes(uc.code || uc.id))
  );

  const affectedClaims = claims.filter(cl =>
    (cl.factCodes || cl.facts || []).some(fc => allFactCodes.has(fc))
  );

  const pagesSet = new Set(affectedClaims.map(cl => cl.pagePath || cl.page).filter(Boolean));
  for (const dc of driftedContracts) {
    for (const p of dc.consumers?.docsPages || []) pagesSet.add(p);
  }

  return {
    changedDefIds: [...defSet],
    directFactCodes: [...affectedFactIds],
    oneHopFactCodes: [...oneHopFactIds],
    affectedProcedureCodes: [...affectedProcCodes],
    affectedUseCaseCodes: affectedUseCases.map(u => u.code || u.id),
    affectedClaimCodes: affectedClaims.map(c => c.claimCode || c.code || c.pieceId),
    affectedDocsPages: [...pagesSet].sort(),
  };
}

export function queryFact(ia, codeOrId) {
  const facts = ia?.facts || [];
  return facts.find(f => f.code === codeOrId || f.id === codeOrId) || null;
}

export function queryBySymbol(ia, symbolQuery) {
  const q = String(symbolQuery || '').toLowerCase();
  const facts = (ia?.facts || []).filter(f => String(f.def || '').toLowerCase().includes(q));
  const anchors = Object.entries(ia?.anchors || {})
    .filter(([id]) => id.toLowerCase().includes(q))
    .map(([id, a]) => ({ id, ...a }));
  return { query: symbolQuery, anchors, facts };
}

export function queryByPage(coverage, pageQuery) {
  const q = String(pageQuery || '').toLowerCase();
  const claims = (coverage?.claims || []).filter(c =>
    String(c.pagePath || c.page || '').toLowerCase().includes(q)
  );
  return { query: pageQuery, count: claims.length, claims };
}

export function queryAuditTrail(register, code) {
  return auditTrailForCode(register, code);
}
