// Closed fact taxonomy, 10 typed platform ports, source quarantine,
// anti-bloat quote gates, and commit-free stable fact identity keys.
import { shortSha256 } from './pin.mjs';

export const FACT_TYPES = Object.freeze([
  'fact',      // core outside-in behavior or outcome
  'schema',    // public request/response JSON keys, event properties, SDK signatures, exported enums
  'guard',     // auth, scope, permission, entitlement, opt-in, OS/SDK version check
  'input',     // payload/param/config shape or validation rule
  'limit',     // numeric bound, max/min, rate limit
  'default',   // default value or fallback
  'error',     // thrown error, HTTP error status, silent no-op
  'branch',    // conditional branch changing behavior or rendering
  'control',   // user-visible UI control (button, switch, input, link)
  'storage',   // DB/cache/localStorage/$set read or write artifact
  'schedule',  // periodic task, timer, cron
  'wiring',    // implicit framework hook, signal, delegate, decorator, mixin
  'port',      // cross-boundary seam (must include a valid `port` object)
]);

export const PORT_KINDS = Object.freeze([
  'http',
  'event',
  'store',
  'model_hook',
  'task',
  'query',
  'sdk_hook',
  'ui_nav',
  'mcp',
  'external',
]);

export const PORT_DIRS = Object.freeze(['emit', 'handle', 'guard', 'write', 'read']);

export const PORT_RULES = Object.freeze({
  http: {
    dirs: ['emit', 'handle', 'guard'],
    re: /^(GET|POST|PATCH|PUT|DELETE|OPTIONS|\*)\s+\/\S+$/i,
    hint: 'METHOD /path/{}/... (e.g. "POST /api/projects/{}/surveys" or "* /api/projects/*")',
  },
  event: {
    dirs: ['emit', 'handle'],
    re: /^[\w$ .-]{2,80}$/,
    hint: 'exact event name (e.g. "survey sent") or "*"',
  },
  store: {
    dirs: ['write', 'read'],
    re: /^(model|hypercache|redis|localStorage|sessionStorage|UserDefaults|SharedPreferences|person_prop|cache):[^\s]{2,120}$/,
    hint: '<kind>:<key> (e.g. "model:Survey", "hypercache:surveys", "person_prop:$survey_responded/{}")',
  },
  model_hook: {
    dirs: ['emit', 'handle'],
    re: /^[A-Z][A-Za-z0-9_]+:(pre_save|post_save|pre_delete|post_delete|m2m_changed)$/,
    hint: '<Model>:<signal> (e.g. "Survey:post_save", "Team:post_save")',
  },
  task: {
    dirs: ['emit', 'handle'],
    re: /^(beat:)?[a-zA-Z0-9_.-]{3,100}$/,
    hint: '<task_name> or beat:<schedule_key>',
  },
  query: {
    dirs: ['emit', 'handle'],
    re: /^(hogql|clickhouse|sql):[^\s]{2,100}$/,
    hint: 'hogql:<runner_or_table>',
  },
  sdk_hook: {
    dirs: ['emit', 'handle'],
    re: /^[a-z0-9_-]+:[^\s]{2,100}$/,
    hint: '<sdk>:<hook_or_channel>',
  },
  ui_nav: {
    dirs: ['emit', 'handle'],
    re: /^(route|panel|action|modal):[^\s]{2,120}$/,
    hint: 'route:<path>, panel:<name>, modal:<name>, or action:<logic>.<action>',
  },
  mcp: {
    dirs: ['emit', 'handle', 'guard'],
    re: /^(tool:[a-z0-9_-]+|\*)$/,
    hint: 'tool:<tool_name> or "*"',
  },
  external: {
    dirs: ['emit'],
    re: /^[a-z0-9_-]+:[^\s]{2,120}$/,
    hint: '<vendor>:<target> (e.g. "slack:chat.postMessage")',
  },
});

// Source quarantine: docs cannot prove themselves.
const REFUSED_PIN_PREFIXES = ['contents/docs/', 'contents/tutorials/', 'docs/onboarding/'];

// Reject 1-token bare JSX tags or generic handler props that inflate behavior-point coverage.
const GENERIC_QUOTE_RE = /^(?:<[A-Z][A-Za-z0-9_]*|onChange=\{onChange\}|onClick=\{onClick\}|onSubmit=\{onSubmit\}|value=\{value\}|fullWidth|return|else\s*\{|\}\s*else\s*\{)$/;

const CONNECT_CUE_RE = /\b(TeamAndOrgViewSetMixin|AccessControlViewSetMixin|ModelViewSet|scope_object|extract_token|auth|Bearer|api_key|hypercache|update_cache|get_cached_data|super\(\)\.destroy|post_save|post_delete|\.delay\(|capture\(|reloadFeatureFlags|\$set\b|execute_hogql_query|hogql|hog_function|hogFunction|slack|discord|webhook|loadExternalDependency|remote_config|remoteConfig|\/api\/|\/array\/|\/flags\/|\/i\/v0\/e|api\.\w+\.|create_flag|update_flag|usage_report)\b/i;

export function refusedPinReason(path) {
  const p = String(path ?? '');
  const prefix = REFUSED_PIN_PREFIXES.find(x => p.startsWith(x));
  return prefix ? `pin under ${prefix} is circular (docs cannot prove docs)` : null;
}

export function normalizeQuoteForIdentity(quote) {
  return String(quote ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Commit-free, batch-order-free canonical key for a runtime/platform/external fact.
 * Moving a repo commit SHA never mints a duplicate Dewey code.
 */
export function stableFactKey({ surface, defId, factType = 'fact', quote }) {
  const surf = String(surface || 'ALL').toLowerCase();
  const qNorm = normalizeQuoteForIdentity(quote);
  return `f3:${surf}:${defId}:${factType}:${shortSha256(qNorm)}`;
}

export function normalizePortKey(kind, key) {
  const s = String(key ?? '').trim();
  if (kind === 'http') {
    const m = /^(\S+)\s+(\S+)$/.exec(s);
    if (m) {
      const method = m[1].toUpperCase();
      const path = m[2]
        .replace(/\$?\{[^}]*\}|<[^>]*>|(?<=\/):[a-zA-Z0-9_]+/g, '{}')
        .replace(/\/+$/, '') || '/';
      return `${method} ${path}`.toLowerCase();
    }
  }
  return s
    .replace(/\$?\{[^}]*\}|<[^>]*>|(?<=\/):[a-zA-Z0-9_]+/g, '{}')
    .replace(/\s+/g, ' ')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function factPorts(fact) {
  const out = [];
  if (fact?.port) out.push(fact.port);
  if (Array.isArray(fact?.ports)) out.push(...fact.ports);
  return out;
}

export function validatePort(p) {
  if (!p || typeof p !== 'object') return 'port object is required';
  const rule = PORT_RULES[p.kind];
  if (!rule) return `port.kind must be one of ${PORT_KINDS.join(', ')}`;
  if (!rule.dirs.includes(p.dir)) return `port.dir for ${p.kind} must be one of ${rule.dirs.join(', ')}`;
  const key = String(p.key ?? '').trim();
  if (!rule.re.test(key)) return `port.key ${JSON.stringify(key)} does not match ${p.kind} format: ${rule.hint}`;
  return null;
}

export function validateFact(fact, defText, defLines = null) {
  if (!fact || typeof fact !== 'object') return 'fact must be an object';
  if (!FACT_TYPES.includes(fact.type)) return `type must be one of ${FACT_TYPES.join(', ')}`;
  if (fact.path) {
    const quarantineErr = refusedPinReason(fact.path);
    if (quarantineErr) return quarantineErr;
  }
  const claim = String(fact.claim ?? '').trim();
  if (claim.length < 18) return 'claim must be at least 18 characters';
  const quote = String(fact.quote ?? '');
  const trimmedQ = quote.trim();
  if (trimmedQ.length < 10) return 'quote must be at least 10 characters';
  if (quote.includes('\n')) return 'quote must be a single source line (no newline)';
  if (!String(defText ?? '').includes(quote)) {
    return `quote is not an exact substring of the pinned definition: ${JSON.stringify(quote.slice(0, 80))}`;
  }
  if (GENERIC_QUOTE_RE.test(trimmedQ)) {
    return `quote ${JSON.stringify(trimmedQ)} is a generic 1-token tag/prop; quote a distinctive line`;
  }
  if (defLines && trimmedQ.length < 24) {
    const matches = defLines.filter(([, text]) => text.includes(quote)).length;
    if (matches >= 3) {
      return `quote ${JSON.stringify(trimmedQ)} matches ${matches} lines; quote a more distinctive line`;
    }
  }
  const ports = factPorts(fact);
  if (fact.type === 'port' && ports.length === 0) return 'type "port" requires a port object';
  for (const p of ports) {
    const perr = validatePort(p);
    if (perr) return perr;
  }
  return null;
}

export function isConnectCandidate(fact) {
  const ports = factPorts(fact);
  if (ports.length > 0) {
    const hasCrossBoundaryPort = ports.some(
      p => !(p.kind === 'ui_nav' && /^(action|modal|panel):/i.test(p.key))
    );
    if (hasCrossBoundaryPort) return true;
    return CONNECT_CUE_RE.test(`${fact.claim} ${fact.quote}`);
  }
  if (['guard', 'wiring', 'storage', 'input', 'fact', 'branch'].includes(fact.type)) {
    return CONNECT_CUE_RE.test(`${fact.claim} ${fact.quote}`);
  }
  return false;
}
