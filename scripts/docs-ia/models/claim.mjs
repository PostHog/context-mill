// Canonical RFC claim & fact lifecycle state machines (pure transitions).

export const CLAIM_STATES = Object.freeze([
  'fresh',            // bound to code-pinned facts and verified accurate
  'prose-backed',     // backed only by quarantined spec prose (reported separately from fresh)
  'stale',            // pinned symbol hash changed; needs agent re-check
  'contradicted',     // second-pass judge confirmed doc contradicts pinned code
  'structural',       // heading, frontmatter, import, or human framing (manual-only)
  'unverified',       // screenshot, video, or external vendor claim
  'unbound',          // checkable doc statement with no matching code fact yet
  'unverified_human', // human edited live MDX prose without updating claim mapping
]);

export const FACT_STATES = Object.freeze([
  'fresh',    // pin commit & MD5 match source
  'recheck',  // symbol MD5 changed, verbatim quote still present
  'stale',    // symbol MD5 changed and verbatim quote disappeared
  'gone',     // pinned symbol or file was deleted/renamed
  'retired',  // archived in register with tombstone or forward pointer
]);

const CLAIM_TRANSITIONS = Object.freeze({
  unbound: {
    bind_code: 'fresh',
    bind_prose: 'prose-backed',
    mark_structural: 'structural',
    mark_unverified: 'unverified',
    contradict: 'contradicted',
  },
  fresh: {
    pin_changed: 'stale',
    human_edit: 'unverified_human',
    contradict: 'contradicted',
    rebind_code: 'fresh',
  },
  'prose-backed': {
    bind_code: 'fresh',
    pin_changed: 'stale',
    human_edit: 'unverified_human',
    contradict: 'contradicted',
  },
  stale: {
    judge_ok: 'fresh',
    judge_contradicted: 'contradicted',
    rebind_code: 'fresh',
    unbind: 'unbound',
  },
  unverified_human: {
    groom_ok: 'fresh',
    groom_contradicted: 'contradicted',
    unbind: 'unbound',
  },
  contradicted: {
    fix_docs: 'fresh',
    rebind_code: 'fresh',
  },
  unverified: {
    verify_media: 'fresh',
    contradict: 'contradicted',
  },
  structural: {
    promote_claim: 'unbound',
  },
});

const FACT_TRANSITIONS = Object.freeze({
  fresh: {
    hash_match: 'fresh',
    hash_changed_quote_present: 'recheck',
    hash_changed_quote_missing: 'stale',
    symbol_deleted: 'gone',
    retire: 'retired',
  },
  recheck: {
    judge_no_change: 'fresh',
    judge_changed: 'fresh',
    retire: 'retired',
  },
  stale: {
    judge_updated: 'fresh',
    retire: 'retired',
  },
  gone: {
    relocate: 'fresh',
    retire: 'retired',
  },
  retired: {},
});

export function nextClaimState(current, event) {
  if (!CLAIM_STATES.includes(current)) {
    throw new Error(`Unknown claim state: ${current}`);
  }
  const next = CLAIM_TRANSITIONS[current]?.[event];
  if (!next) {
    throw new Error(`Illegal claim transition: ${current} --(${event})--> ?`);
  }
  return next;
}

export function nextFactState(current, event) {
  if (!FACT_STATES.includes(current)) {
    throw new Error(`Unknown fact state: ${current}`);
  }
  const next = FACT_TRANSITIONS[current]?.[event];
  if (!next) {
    throw new Error(`Illegal fact transition: ${current} --(${event})--> ?`);
  }
  return next;
}
