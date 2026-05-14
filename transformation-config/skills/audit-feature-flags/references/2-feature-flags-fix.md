---
next_step: 3-feature-flags-optimize.md
---

# Step 2 — Feature flags (fix)

This step resolves three correctness checks **in parallel**, one subagent per check:

- `ff-bootstrap-when-known-set`
- `ff-await-readiness`
- `ff-default-values`

## Status

Emit before dispatching:

```
[STATUS] Auditing feature flag correctness
```

## Action — dispatch three subagents in one message

Make **three `Task` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `3-feature-flags-optimize.md`. Do not run any other tools between dispatch and the next step.

The bundled `best-practices.md` reference holds PostHog's authoritative guidance on flag bootstrapping, readiness, and default values. It's typically at `.claude/skills/audit-feature-flags/references/best-practices.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`. Each subagent reads it once before judging.

### Task A — `ff-bootstrap-when-known-set`

`description`: `Audit ff-bootstrap-when-known-set`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-bootstrap-when-known-set.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-feature-flags/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`). Focus on the bootstrapping guidance — when an initial flag set is already known at app start (e.g. computed server-side, persisted in a cookie, or passed through SSR props), client-side `posthog.init` should set `bootstrap.featureFlags` so the first render has the right values without a `/flags` round trip.

Run **two** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every PostHog init site.
- `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(` — every flag-eval call site.

Read each file that contains an init hit, once. For each init, inspect the options object: is `bootstrap.featureFlags` (or `bootstrap: { featureFlags: ... }`) provided?

Then check whether the codebase has a known initial flag set referenced **before init returns** — common signals:
- SSR / server-rendered props that pass flag values into a `<PostHogProvider>` / init call.
- A `cookies` / `headers` read that yields flag values, used near init.
- An explicit constant or map of flag keys imported into the init module.
- Flag-eval call sites running synchronously inside the same render path that mounts the provider.

Rule:
- pass: bootstrap is set when a known initial flag set exists, OR no known initial set is referenced before init (nothing to bootstrap with).
- warning: a known initial flag set is referenced before init returns but `bootstrap.featureFlags` is not set on init — early flag evals will return `undefined` and cause flicker.
- suggestion: init has neither bootstrap nor any `onFeatureFlags` / `loaded` callback gating early evals — recommend either bootstrap (preferred) or readiness gating.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-bootstrap-when-known-set`, including `file` (path:line of the init that lacks bootstrap) and `details` as compact JSON:

```
{
  "init_call_count": <N>,
  "init_with_bootstrap_count": <N>,
  "known_initial_set_detected": true | false,
  "examples": [
    {"file": "<path:line>", "issue": "missing-bootstrap | no-readiness-gate"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `ff-await-readiness`

`description`: `Audit ff-await-readiness`

`prompt`:
```
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
```

### Task C — `ff-default-values`

`description`: `Audit ff-default-values`

`prompt`:
```
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
```

## After all three return

Continue to **`3-feature-flags-optimize.md`**.
