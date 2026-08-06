---
description: Subagent prompt for ff-default-values — read only by its dispatched subagent, never by the main loop
---

You are an audit subagent. Resolve exactly one rule and return: ff-default-values.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-feature-flags/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`). Focus on the "undefined is not false" and per-flag default guidance — `getFeatureFlag('key')` returns `undefined` during the loading window and may also return `undefined` when PostHog is unreachable or quota-limited. A per-flag default (via `?? 'control'`, a wrapper helper, or the SDK's `default_value`/`defaultValue` option when supported) controls what users see during these windows.

Run **one** Grep: `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(` — every flag-eval call site.

Read each file that contains a hit, once. For each flag-eval call, classify whether the result is consumed with a default-value fallback:
- **explicit `??` / `||` fallback** on the call expression — fine.
- **wrapped in a helper** that supplies a default (e.g. `function useBetaFeature() { return posthog.isFeatureEnabled('beta') ?? false }`) — fine.
- **explicit `=== 'variant'` / `!== 'variant'` comparison** treated as the default-handling — fine *only if* the surrounding code path can tolerate `undefined` (i.e. the variant branch is the opt-in and the fallthrough is safe).
- **bare consumption** — the call result feeds into a conditional, prop, or render without a default — flag.

Rule:
- pass: every flag-eval call site either has a per-flag default fallback or is consumed via a safe variant comparison.
- suggestion: 1–2 bare flag-eval call sites — low risk, recommend adding `?? <default>`.
- warning: 3+ bare flag-eval call sites, OR any bare call in a code path the user always hits (top-level render, app shell).

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-default-values`, including `file` (path:line of the most representative bare call) and `details` as compact JSON:

```
{
  "flag_eval_call_count": <N>,
  "bare_consumption_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "no-default-fallback"}
  ]
}
```

Return when the call completes. Do not write the audit report.
