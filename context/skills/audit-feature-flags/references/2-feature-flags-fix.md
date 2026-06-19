---
next_step: 3-feature-flags-optimize.md
---

# Step 2 — Feature flags (fix)

This step resolves five correctness checks **in parallel**, one subagent per check:

- `ff-bootstrap-when-known-set`
- `ff-await-readiness`
- `ff-default-values`
- `ff-bootstrap-distinct-id-mismatch`
- `ff-identified-only-pre-auth-targeting`

## Status

Emit before dispatching:

```
[STATUS] Auditing feature flag correctness
```

## Action — dispatch five subagents in one message

Make **five `Agent` tool calls in a single message** so they run concurrently. Wait for all five to return, then continue to `3-feature-flags-optimize.md`. Do not run any other tools between dispatch and the next step.

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

### Task D — `ff-bootstrap-distinct-id-mismatch`

`description`: `Audit ff-bootstrap-distinct-id-mismatch`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-bootstrap-distinct-id-mismatch.

Read this skill's bundled `bootstrapping.md` reference once (typically `.claude/skills/audit-feature-flags/references/bootstrapping.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/bootstrapping.md`).

Background: `bootstrap.distinctID` (or `bootstrap: { distinctID: ... }`) lets the host application seed the SDK's distinct_id at init time — usually for SSR/SSG scenarios where the server already knows the user. But if the value passed doesn't match either the user's eventual stable id (after `identify()`) or the SDK's natural anonymous id, it overrides the identity chain in ways that break later merges. Two failure modes:
1. `distinctID` set to a per-request random / session UUID — the SDK considers itself "already identified" with that UUID; the next `identify(realUserId)` is blocked from merging anonymous activity.
2. `distinctID` set to a known user id but the project ALSO calls `identify(differentId)` shortly after — the two ids race; whichever loses creates an orphan profile.

Run **two** Greps in parallel:
- `bootstrap[\s\S]{0,40}distinctID|bootstrap[\s\S]{0,40}distinct_id|distinctID\s*:` — bootstrap-with-distinctID sites.
- `posthog\.identify\(` — every identify call (so the subagent can cross-reference).

Read each file that contains a bootstrap.distinctID hit, once. For each site, determine:
- What value is being passed (literal, variable, request-scoped, randomly generated)?
- Is the same value later passed to `posthog.identify()`? If yes, that's the safe pattern (matching SSR hydration).
- Is the value request-scoped / per-render (e.g. `crypto.randomUUID()`, `Math.random()`, a Next.js per-request id)? If yes, this is the failure mode.

Rule:
- pass: no `bootstrap.distinctID` usage detected, OR the bootstrapped value is stable across requests and matches the value passed to a later identify() call.
- warning: `bootstrap.distinctID` is set to a value that appears request-scoped, randomly generated, or otherwise volatile — the next identify() call will be blocked from merging anonymous activity.
- error: `bootstrap.distinctID` is set to one value and `posthog.identify()` is called immediately after with a DIFFERENT value on the same code path — orphan profile guaranteed.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-bootstrap-distinct-id-mismatch`, including `file` (path:line of the bootstrap site) and `details` as compact JSON:

```
{
  "bootstrap_distinct_id_site_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "volatile-bootstrap-id | bootstrap-identify-mismatch | safe-ssr-hydration"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task E — `ff-identified-only-pre-auth-targeting`

`description`: `Audit ff-identified-only-pre-auth-targeting`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-identified-only-pre-auth-targeting.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-feature-flags/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`).

Background: when `person_profiles: 'identified_only'` is set (the recommended default for most B2B SaaS), anonymous visitors don't create person profiles. If a feature flag targets users by person properties AND that flag is evaluated on a pre-auth surface (landing page, pricing page, signup form), the anonymous user has no person profile for the flag to evaluate against, so the flag silently returns its default value. The variant the operator intended to ship to "users in the EU" / "users on the Pro plan" never reaches anyone visiting before login. This is a silent failure — the flag appears to work for identified users but the anonymous-traffic branch quietly never fires.

Run **three** Greps in parallel:
- `person_profiles\s*:|personProfiles\s*:` — locate the person_profiles setting.
- `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(` — every flag-eval call site.
- `posthog\.identify\(` — every identify call (used to classify a surface as pre-auth or post-auth).

Step 1 — read the file(s) containing `person_profiles` hits to determine the configured value. If unset, the posthog-js default is `'identified_only'`. Record `mode` as `identified_only`, `always`, `never`, or `unset (defaults to identified_only)`.

Step 2 — if mode is NOT `identified_only` (or unset), resolve `pass` with `details: "skip: person_profiles is not identified_only"` and return.

Step 3 — for each flag-eval call site, read the surrounding file once. Classify it as **pre-auth** if it lives in: landing pages, marketing routes, pricing pages, signup/login UI components that render before the user authenticates, public homepage components, or any route gated to anonymous-only access. Classify as **post-auth** if the file also calls `posthog.identify()` in the same flow, requires authenticated session via middleware, or lives under a `/(app)/`, `/dashboard/`, `/(authenticated)/` style route.

Step 4 — for each pre-auth flag-eval site, attempt to determine whether the flag's targeting condition references person properties. The skill can't read PostHog flag definitions; instead, flag any pre-auth eval whose flag key suggests person-property targeting (variants gated on plan, country, persona, role, signup_method, etc.) — name patterns like `eu-banner`, `pro-only-cta`, `enterprise-pricing-variant`. When ambiguous, default to warning and let the operator confirm.

Rule:
- pass: mode is not identified_only, OR no flag-eval call sites run on pre-auth surfaces, OR all pre-auth flag evals pass property overrides at eval time (`getFeatureFlag(key, { personProperties: {...} })` or equivalent).
- suggestion: 1–2 pre-auth flag-eval call sites exist but flag names don't strongly suggest person-property targeting — recommend the operator confirm flag definitions in PostHog.
- warning: 3+ pre-auth flag-eval call sites OR any pre-auth flag-eval whose flag name strongly suggests person-property targeting — anonymous users silently get default values. Recommend either passing property overrides at eval time, switching to `posthog.bootstrap.featureFlags` with server-computed values, or moving the eval behind authentication.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-identified-only-pre-auth-targeting`, including `file` (path:line of the most representative pre-auth flag-eval) and `details` as compact JSON:

```
{
  "person_profiles_mode": "identified_only | always | never | unset",
  "pre_auth_flag_eval_count": <N>,
  "examples": [
    {"file": "<path:line>", "flag_key": "<key>", "suspected_property_targeting": <true|false>}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

## After all five return

Continue to **`3-feature-flags-optimize.md`**.
