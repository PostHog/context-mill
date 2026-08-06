---
description: Subagent prompt for ff-bootstrap-when-known-set — read only by its dispatched subagent, never by the main loop
---

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
