---
description: Subagent prompt for ff-await-readiness — read only by its dispatched subagent, never by the main loop
---

You are an audit subagent. Resolve exactly one rule and return: ff-await-readiness.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-feature-flags/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`). Focus on the readiness / "have the value before you need it" section — client-side flag evaluation is async, so any flag-eval before `onFeatureFlags` fires (or before the `loaded` callback runs, or before `bootstrap.featureFlags` is set) returns `undefined`, which is **not** `false`. Misreading the loading gap is one of the most common flag bugs.

Run **three** Greps in parallel:
- `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(` — every flag-eval call site.
- `onFeatureFlags\(|posthog\.onFeatureFlags\(` — readiness subscribers.
- `bootstrap\s*:|loaded\s*:|loaded\s*\(` — bootstrap config and `loaded` callbacks on init.

Read each file that contains a flag-eval hit, once. For each flag-eval call, determine whether it is gated against the loading window — i.e. it happens after `onFeatureFlags` fires, inside / after a `loaded` callback, after a bootstrap was provided, or behind a readiness guard the project defines itself.

Rule:
- pass: every flag-eval call site is either bootstrapped, behind `onFeatureFlags` / `loaded` gating, or inside a code path that only runs post-init (e.g. a click handler).
- warning: one or more flag-eval calls run in a render-on-mount path (React render body, `useEffect` with empty deps, Vue `onMounted`) without bootstrap or readiness gating — race-condition risk.
- error: a flag-eval call's return value is compared with `===` / `!==` to a non-undefined value in a path that can run before flags load, and the codebase has no bootstrap and no readiness subscribe — guaranteed undefined-handling bug.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-await-readiness`, including `file` (path:line of the most representative offending flag-eval call) and `details` as compact JSON:

```
{
  "flag_eval_call_count": <N>,
  "ungated_call_count": <N>,
  "bootstrap_present": true | false,
  "readiness_subscriber_present": true | false,
  "examples": [
    {"file": "<path:line>", "issue": "race-on-mount | undefined-misread"}
  ]
}
```

Return when the call completes. Do not write the audit report.
