// Single deterministic tool catalog.
//
// Every deterministic action callable by workflow scripts OR by an agent over MCP lives here.
// Workflow steps declare `tools: ['read_pinned_slice', ...]` by name; the runtime validates
// every name against this catalog and spawns the MCP server with ONLY those tools enabled.
import { validateFact } from '../models/fact.mjs';
import { refreshDetachedPin } from '../models/pin.mjs';
import { assignDeweyCodesV3, auditTrailForCode } from '../models/register.mjs';
import { queryByPage, queryBySymbol, queryFact, traceBlastRadius } from './blast-radius.mjs';
import { reconcileHumanMdxDrift } from './mdx-splitter.mjs';

export function createToolCatalog(getState) {
  const definitions = [
    {
      name: 'read_pinned_slice',
      description: 'Read the exact pinned AST symbol slice and metadata for a definition ID.',
      inputSchema: {
        type: 'object',
        required: ['def_id'],
        properties: { def_id: { type: 'string' } },
      },
      handler: ({ def_id }) => {
        const state = getState();
        const def = state.defsById?.get(def_id) || state.anchors?.[def_id] || null;
        if (!def) return { found: false, def_id };
        return {
          found: true,
          def_id,
          repo: def.repo,
          path: def.path,
          symbol: def.symbol,
          surface: def.surface,
          start: def.start,
          end: def.end,
          pin: def.pin,
          sliceText: def.sliceText ?? null,
        };
      },
    },
    {
      name: 'verify_verbatim_quote',
      description: 'Deterministically check whether a single-line quote exists verbatim inside a pinned symbol slice.',
      inputSchema: {
        type: 'object',
        required: ['def_id', 'quote'],
        properties: {
          def_id: { type: 'string' },
          quote: { type: 'string' },
        },
      },
      handler: ({ def_id, quote }) => {
        const state = getState();
        const def = state.defsById?.get(def_id) || state.anchors?.[def_id];
        if (!def?.sliceText) return { ok: false, reason: `Unknown or unloaded definition: ${def_id}` };
        const q = String(quote ?? '');
        const ok = q.length >= 10 && !q.includes('\n') && def.sliceText.includes(q);
        return { ok, def_id, quote: q };
      },
    },
    {
      name: 'validate_fact_batch',
      description: 'Run all deterministic fact schema, source quarantine, port, and verbatim quote checks on candidate facts.',
      inputSchema: {
        type: 'object',
        required: ['facts'],
        properties: { facts: { type: 'array', items: { type: 'object' } } },
      },
      handler: ({ facts }) => {
        const state = getState();
        const accepted = [];
        const rejected = [];
        for (const f of facts || []) {
          const def = state.defsById?.get(f.def) || state.anchors?.[f.def];
          const err = def
            ? validateFact(f, def.sliceText || '')
            : `unknown definition "${f.def}"`;
          if (err) rejected.push({ fact: f, error: err });
          else accepted.push(f);
        }
        return { acceptedCount: accepted.length, rejectedCount: rejected.length, rejected };
      },
    },
    {
      name: 'hash_refresh_pins',
      description: 'Run the two-gate commit -> MD5 detached pin check across all pinned definitions (0 LLM calls).',
      inputSchema: {
        type: 'object',
        required: ['head_commits'],
        properties: { head_commits: { type: 'object' } },
      },
      handler: ({ head_commits }) => {
        const state = getState();
        const results = { fresh: 0, bumped: 0, recheck: [], stale: [], gone: [] };
        for (const [defId, anchor] of Object.entries(state.anchors || {})) {
          const headCommit = head_commits?.[anchor.repo] || anchor.pin?.commit;
          const res = refreshDetachedPin({
            pin: anchor.pin,
            headCommit,
            getSliceText: () => state.readSlice?.(anchor.repo, headCommit, anchor.path, anchor.ownLines) ?? anchor.sliceText,
          });
          if (res.state === 'fresh') {
            results.fresh++;
            if (res.bumped) results.bumped++;
          } else {
            results[res.state].push({ defId, state: res.state, candidatePin: res.candidatePin ?? null });
          }
        }
        return results;
      },
    },
    {
      name: 'lookup_facts_by_symbol',
      description: 'Look up pinned anchors and derived facts matching a symbol or file path substring.',
      inputSchema: {
        type: 'object',
        required: ['symbol'],
        properties: { symbol: { type: 'string' } },
      },
      handler: ({ symbol }) => queryBySymbol(getState(), symbol),
    },
    {
      name: 'query_fact',
      description: 'Look up a single derived fact by Dewey code or fact ID.',
      inputSchema: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string' } },
      },
      handler: ({ code }) => queryFact(getState(), code),
    },
    {
      name: 'query_page_claims',
      description: 'Look up all bound claims and states for a live docs page path.',
      inputSchema: {
        type: 'object',
        required: ['page'],
        properties: { page: { type: 'string' } },
      },
      handler: ({ page }) => queryByPage(getState().coverage || { claims: getState().claims || [] }, page),
    },
    {
      name: 'trace_blast_radius',
      description: 'Trace changed symbol IDs through F -> 1-hop ports -> PR -> UC -> C -> live docs pages.',
      inputSchema: {
        type: 'object',
        required: ['changed_def_ids'],
        properties: {
          changed_def_ids: { type: 'array', items: { type: 'string' } },
        },
      },
      handler: ({ changed_def_ids }) => {
        const state = getState();
        return traceBlastRadius({
          changedDefIds: changed_def_ids,
          driftedContracts: state.driftedContracts || [],
          facts: state.facts || [],
          portLinks: state.portLinks || [],
          procedures: state.procedures || [],
          useCases: state.useCases || [],
          claims: state.claims || [],
        });
      },
    },
    {
      name: 'reconcile_human_mdx_drift',
      description: 'Run the 3-tier deterministic human MDX reconciler against current pieces (0 LLM calls).',
      inputSchema: {
        type: 'object',
        required: ['next_pieces'],
        properties: {
          next_pieces: { type: 'array', items: { type: 'object' } },
          docs_commit: { type: 'string' },
        },
      },
      handler: ({ next_pieces, docs_commit }) => {
        const state = getState();
        return reconcileHumanMdxDrift({
          prevClaims: state.claims || [],
          nextPieces: next_pieces,
          docsCommit: docs_commit || null,
        });
      },
    },
    {
      name: 'lookup_audit_trail',
      description: 'Follow retired code tombstones and forward pointers in the Dewey register beyond git blame.',
      inputSchema: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string' } },
      },
      handler: ({ code }) => auditTrailForCode(getState().register, code),
    },
    {
      name: 'assign_dewey_codes',
      description: 'Mint or update permanent Dewey v3 codes and retire missing leaves with forward pointers.',
      inputSchema: {
        type: 'object',
        required: ['product_code', 'surfaces'],
        properties: {
          product_code: { type: 'string' },
          surfaces: { type: 'array', items: { type: 'string' } },
          outline: { type: 'array', items: { type: 'object' } },
          leaves: { type: 'array', items: { type: 'object' } },
          use_cases: { type: 'array', items: { type: 'object' } },
        },
      },
      handler: ({ product_code, surfaces, outline = [], leaves = [], use_cases = [] }) => {
        const state = getState();
        return assignDeweyCodesV3({
          productCode: product_code,
          surfaces,
          outline,
          leaves,
          useCases: use_cases,
          register: state.register || null,
          ucRegister: state.ucRegister || null,
        });
      },
    },
  ];

  const byName = new Map(definitions.map(d => [d.name, d]));

  return {
    has: name => byName.has(name),
    get: name => byName.get(name),
    list: (allowlist = null) => {
      if (!allowlist) return [...definitions];
      const allowed = new Set(allowlist);
      return definitions.filter(d => allowed.has(d.name));
    },
    invoke: (name, args, allowlist = null) => {
      if (allowlist && !allowlist.includes(name)) {
        throw new Error(`Tool "${name}" is not bound to this workflow step (allowed: ${allowlist.join(', ')})`);
      }
      const tool = byName.get(name);
      if (!tool) throw new Error(`Unknown deterministic tool: "${name}"`);
      return tool.handler(args || {});
    },
  };
}
