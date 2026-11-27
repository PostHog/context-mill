// Deterministic 0-LLM cross-boundary port linker + versioned platform PortContract matcher.
import { factPorts, normalizePortKey } from '../models/fact.mjs';
import { refreshDetachedPin } from '../models/pin.mjs';

export function httpPortMatches(emitNorm, handleNorm) {
  if (emitNorm === handleNorm) return true;
  const em = /^(\S+)\s+(\S+)$/.exec(emitNorm);
  const ha = /^(\S+)\s+(\S+)$/.exec(handleNorm);
  if (!em || !ha) return false;
  const [, emMethod, emPath] = em;
  const [, haMethod, haPath] = ha;
  const methodOk = haMethod === '*' || emMethod === '*' || emMethod === haMethod;
  if (!methodOk) return false;
  if (emPath === haPath) return true;
  if (haPath.endsWith('/*')) {
    const prefix = haPath.slice(0, -2);
    if (emPath === prefix || emPath.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/**
 * Deterministically wire internal fact emitters to handlers (0 LLM calls):
 *   1. Exact normalized port match across definitions (`http`, `event`, `store`, `task`, `query`, `sdk_hook`, `ui_nav`, `mcp`).
 *   2. Wildcard HTTP route matching (`POST /api/projects/{}/surveys` ~> `* /api/projects/*`).
 *   3. Implied Django/ORM model hooks (`store:write(model:X)` -> `model_hook:handle(X:post_save|post_delete)`).
 */
export function wireDeterministicPorts(facts) {
  const links = [];
  const seen = new Set();
  const addLink = (from, to, by, kind, key) => {
    const sig = `${from}->${to}:${kind}:${key}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      links.push({ from, to, by, kind, key });
    }
  };

  const emitters = [];
  const handlers = [];
  for (const f of facts || []) {
    for (const p of factPorts(f)) {
      if (['emit', 'write'].includes(p.dir)) emitters.push({ f, p });
      if (['handle', 'read', 'guard'].includes(p.dir)) handlers.push({ f, p });
    }
  }

  for (const { f: a, p: pa } of emitters) {
    const ka = normalizePortKey(pa.kind, pa.key);
    for (const { f: b, p: pb } of handlers) {
      if (a.def === b.def || pa.kind !== pb.kind) continue;
      const kb = normalizePortKey(pb.kind, pb.key);
      if (ka === kb) {
        addLink(a.id, b.id, 'exact-port', pa.kind, ka);
      } else if (pa.kind === 'http' && httpPortMatches(ka, kb)) {
        addLink(a.id, b.id, 'exact-http-wildcard', 'http', `${ka} ~> ${kb}`);
      }
    }

    if (pa.kind === 'store' && pa.dir === 'write' && /^model:([A-Za-z0-9_]+)/i.test(pa.key)) {
      const model = pa.key.split(':')[1].split('.')[0].toLowerCase();
      const isDel = /\b(delete|destroy)\b/i.test(`${a.quote || ''} ${a.claim || ''}`);
      const targets = isDel
        ? [`${model}:pre_delete`, `${model}:post_delete`]
        : [`${model}:pre_save`, `${model}:post_save`];
      for (const { f: b, p: pb } of handlers) {
        if (a.def === b.def) continue;
        if (pb.kind === 'model_hook' && targets.some(t => pb.key.toLowerCase().startsWith(t))) {
          addLink(a.id, b.id, 'implied-model-hook', 'model_hook', pb.key);
        }
      }
    }
  }

  return links;
}

/**
 * Refresh pinned platform PortContracts against current repo commits so upstream platform
 * changes (Capture, Ingestion, HyperCache, Flags, CDP, MCP) deterministically bubble up
 * to consuming product sections, use cases, and docs pages.
 */
export function checkPortContracts({ contracts = [], headCommits = {}, readSlice }) {
  const driftedContracts = [];
  const freshContracts = [];

  for (const contract of contracts) {
    const sourceResults = [];
    let anyChanged = false;
    for (const src of contract.sources || []) {
      const headCommit = headCommits[src.repo] || src.pin?.commit;
      const res = refreshDetachedPin({
        pin: src.pin,
        headCommit,
        getSliceText: () => readSlice(src.repo, headCommit, src.path, src.ownLines),
      });
      sourceResults.push({ ...src, refresh: res });
      if (res.state !== 'fresh') anyChanged = true;
    }
    if (anyChanged) {
      driftedContracts.push({
        id: contract.id,
        area: contract.area,
        carrier: contract.carrier,
        consumers: contract.consumers || { sections: [], useCases: [], docsPages: [] },
        sources: sourceResults,
      });
    } else {
      freshContracts.push(contract.id);
    }
  }

  return { driftedContracts, freshContracts };
}
