# Feature Flags Doctor — Checks

Two groups. **Static checks** read the source tree only and run first, as parallel subagents. **Live checks** run second, from the main loop (no subagents): they probe the project's real `/flags` endpoint and read the flag roster via MCP. Severity values are **fixed** — do not adjust them. Resolve every check via `mcp__wizard-tools__audit_resolve_checks` (skip ids missing from the ledger); append per-flag findings via `mcp__wizard-tools__audit_add_checks` exactly as each sweep section specifies.

Every check is independent and required. A failure in one does not block the others. Do not invent checks beyond the ones listed.

---

## Part 1 — Static checks (parallel subagents)

Emit `[STATUS] Auditing feature flag correctness`, then make **six `Agent` tool calls in a single message** for the correctness checks (Tasks A–E and Task I). When all five return, emit `[STATUS] Auditing feature flag cost optimization` and dispatch the cost checks (Tasks F–H) the same way — one `Agent` call per check that actually runs, in a single message. Two cost checks are gated on the pre-flight local-evaluation signal; for a gated check that is skipping, emit its `audit_resolve_checks` update directly (`status: "pass"`, `details: "skip: local evaluation not detected"`) instead of dispatching a subagent.

The bundled `best-practices.md`, `bootstrapping.md`, and `cutting-costs.md` references hold PostHog's authoritative guidance. They are typically at `.claude/skills/audit-feature-flags/references/<name>.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-feature-flags/references/<name>.md`. Each subagent reads its named reference once before judging.

### Task A — `ff-bootstrap-when-known-set`

`description`: `Audit ff-bootstrap-when-known-set`

`prompt`:
````
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
````

### Task B — `ff-await-readiness`

`description`: `Audit ff-await-readiness`

`prompt`:
````
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
````

### Task C — `ff-default-values`

`description`: `Audit ff-default-values`

`prompt`:
````
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
````

### Task D — `ff-bootstrap-distinct-id-mismatch`

`description`: `Audit ff-bootstrap-distinct-id-mismatch`

`prompt`:
````
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
````

### Task E — `ff-identified-only-pre-auth-targeting`

`description`: `Audit ff-identified-only-pre-auth-targeting`

`prompt`:
````
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

Step 4 — for each pre-auth flag-eval site, attempt to determine whether the flag's targeting condition references person properties. The subagent can't read PostHog flag definitions; instead, flag any pre-auth eval whose flag key suggests person-property targeting (variants gated on plan, country, persona, role, signup_method, etc.) — name patterns like `eu-banner`, `pro-only-cta`, `enterprise-pricing-variant`. When ambiguous, default to warning and let the operator confirm.

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
````

### Task I — `ff-eval-before-identify`

`description`: `Audit ff-eval-before-identify`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: ff-eval-before-identify.

Background: client-side flag evaluation resolves against the CURRENT distinct_id. A flag evaluated before `posthog.identify()` runs resolves against the anonymous id — targeting rules based on person properties or cohorts don't match, so the user gets one value pre-identify and potentially a different value after identify triggers a flag reload. Symptoms: UI flicker on login, users "randomly" switching variants, person-targeted flags never firing on first render.

Run **two** Greps in parallel:
- `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(` — where captures and flag evals happen.
- `posthog\.identify\(` — every identify call.

Read each file that contains hits from either grep, once. Compare the timing/ordering of `identify()` against the surrounding flag-eval calls:
- flag-eval in a code path that runs on initial mount of an authenticated area, where `identify()` is called LATER in the same flow (after a session fetch, inside a login callback, in a child effect) — the eval races identify.
- flag-eval inside auth/bootstrap code that runs strictly after `identify()` resolves — safe.
- flag-eval on genuinely anonymous surfaces (no identify in the flow) — safe by definition; not this rule's concern.

Rule:
- pass: no flag-eval races an identify() in the same flow, OR the project re-evaluates after identify (an `onFeatureFlags` subscriber re-renders, or an explicit `reloadFeatureFlags()` follows identify).
- suggestion: 1–2 racing sites with a re-evaluation path present but indirect — recommend making the ordering explicit.
- warning: any racing site with NO re-evaluation after identify — person-targeted flags will be evaluated against the anonymous id and stay wrong until the next natural reload.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-eval-before-identify`, including `file` (path:line of the most representative racing eval) and `details` as compact JSON:

```
{
  "racing_site_count": <N>,
  "reeval_after_identify": true | false,
  "examples": [
    {"file": "<path:line>", "issue": "eval-races-identify"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

### Task F — `ff-local-eval-polling-interval`

**Skip this task entirely if pre-flight did not detect local evaluation.** In that case, emit a direct `audit_resolve_checks` update for `ff-local-eval-polling-interval` with `status: "pass"` and `details: "skip: local evaluation not detected"`.

`description`: `Audit ff-local-eval-polling-interval`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-local-eval-polling-interval.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-feature-flags/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`). Focus on the "reducing local evaluation costs" section — by default, PostHog fetches flag definitions every 30 seconds. Each request is billed as 10 credits, so a constantly-running server makes `10 * 2 * 60 * 24 * 30 = 864,000` credits / month at the default. Increasing the polling interval (e.g. to 5 minutes) cuts that proportionally, at the cost of slower propagation of flag changes.

Run **one** Grep: `featureFlagsPollingInterval|feature_flags_polling_interval|featureFlagsRequestTimeoutMs|feature_flag_request_timeout_ms`.

Read each file that contains a server SDK init, once (locate via the pre-flight local-eval signals if needed: `personal_api_key` / `PostHog(`). For each init that uses local evaluation, determine whether `featureFlagsPollingInterval` (or the language-equivalent: `feature_flags_polling_interval`, `personal_api_key_request_timeout_seconds`, etc.) is set.

Rule:
- pass: every local-eval init sets `featureFlagsPollingInterval` (or equivalent) to a non-default value, OR sets it explicitly to the default with an intentional comment.
- suggestion: polling interval is unset (defaulting to 30s) — at constant load that's ~864k `/flags` credits / month. Recommend setting a larger interval (e.g. 300_000 ms / 5 min) if real-time flag updates are not required.
- warning: polling interval is set to a value **smaller** than the 30s default (e.g. 10s) — increases cost without operational benefit.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-local-eval-polling-interval`, including `file` (path:line of the local-eval init) and `details` as compact JSON:

```
{
  "polling_interval_ms": <N or null>,
  "uses_default": true | false,
  "estimated_monthly_credits": <N or null>,
  "examples": [
    {"file": "<path:line>", "issue": "unset-default | sub-default"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task G — `ff-local-eval-in-edge-handlers`

**Skip this task entirely if pre-flight did not detect local evaluation.** In that case, emit a direct `audit_resolve_checks` update for `ff-local-eval-in-edge-handlers` with `status: "pass"` and `details: "skip: local evaluation not detected"`.

`description`: `Audit ff-local-eval-in-edge-handlers`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-local-eval-in-edge-handlers.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-feature-flags/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`). Focus on the edge/Lambda callout — local evaluation in an edge or Lambda environment initializes a PostHog instance on every invocation, which defeats the polling cache and inflates cost drastically. For these environments, use regular flag evaluation, or share flag definitions via an external cache (see local-evaluation/distributed-environments).

Run **two** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every PostHog init site.
- `runtime\s*=\s*['"]edge['"]|export\s+const\s+runtime|export\s+const\s+config\s*=\s*\{[^}]*runtime|lambda|exports\.handler|handler\s*:\s*async\s*\(|app/api/.*/route\.(ts|js)` — edge / Lambda handler signals.

Read each file that contains a PostHog init, once. For each init, classify whether the file is an edge handler (`runtime = 'edge'`, `app/api/*/route.ts` on Next.js edge runtime, Vercel/Cloudflare edge, Lambda handler shape `exports.handler` / `handler: async (event) =>`, or paths under `lambda/` / `edge/` / `functions/`). For each edge/Lambda file, check whether the init is configured for **local evaluation** (presence of `personal_api_key` / feature-flags secure key, or calls to `getAllFlagsAndPayloads` / `getAllFlags`).

Rule:
- pass: no PostHog init runs in an edge / Lambda handler, OR every edge/Lambda init is configured for remote (non-local) evaluation.
- error: a PostHog init in an edge / Lambda handler is configured for local evaluation — per-invocation init negates the polling cache and inflates cost.
- warning: a PostHog init in an edge / Lambda handler has ambiguous configuration (e.g. reuses a shared init module that does configure local evaluation, but only some call sites are edge-runtime).

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-local-eval-in-edge-handlers`, including `file` (path:line of the offending edge/Lambda init) and `details` as compact JSON:

```
{
  "edge_init_count": <N>,
  "edge_local_eval_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "local-eval-in-edge | ambiguous-shared-init"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task H — `ff-test-ci-gating`

`description`: `Audit ff-test-ci-gating`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-test-ci-gating.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-feature-flags/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`). Focus on the "configuring test and CI environments" section — test runners, CI pipelines, and staging environments often don't need real-time flag evaluation but silently rack up `/flags` requests on every init. The recommended pattern is to detect the test/CI environment (`process.env.NODE_ENV === 'test'`, `process.env.CI`, `BuildConfig.DEBUG`, etc.) and either skip init, disable flags (`advanced_disable_feature_flags: true`), or bootstrap deterministically.

Run **three** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every PostHog init site.
- `NODE_ENV.*test|process\.env\.CI|ProcessInfo\.processInfo\.environment\["CI"\]|BuildConfig\.DEBUG` — test/CI detection signals near init.
- `jest\.config|vitest\.config|playwright\.config|cypress\.config|\.test\.|\.spec\.|__tests__|tests/` (use `output_mode: "files_with_matches"`) — does the project have a test runner at all?

If the third grep returns zero hits, resolve `pass` with `details: "skip: no test runner detected"` and return — this rule only applies to projects that actually run tests.

Otherwise, read each file that contains a PostHog init, once. For each init, determine whether it is gated by a test/CI check:
- An `if (process.env.NODE_ENV !== 'test')` guard around the whole init call.
- An `advanced_disable_feature_flags: true` (or `preloadFeatureFlags: false`) conditional spread into the options when in test/CI.
- An early-return / `null` SDK shim in test mode.

Rule:
- pass: every PostHog init is either gated against test/CI, or disables flags / preloading in test/CI, or the project's test runner setup makes the init unreachable in tests (e.g. a global setup file that monkey-patches PostHog).
- suggestion: init is unconditional but the project's tests do not appear to exercise it heavily (1–2 test files importing the init module).
- warning: init is unconditional and the project's test suite has 3+ files that load it — each test run silently incurs `/flags` requests.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-test-ci-gating`, including `file` (path:line of the init that lacks gating) and `details` as compact JSON:

```
{
  "init_call_count": <N>,
  "test_gated_count": <N>,
  "test_runner_detected": true | false,
  "examples": [
    {"file": "<path:line>", "issue": "unguarded-in-tests"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

---

## Part 2 — Live checks (main loop, sequential)

These run after the static fan-out returns. They need two inputs; establish both up front:

**The project token and host.** Prefer the values the wizard passed in the run context (project API key `phc_…` and API host). Otherwise: `mcp__wizard-tools__check_env_keys` to learn which env keys exist, then Grep/Read the init site to find how the token and `api_host` are wired (the token is a public client value; personal API keys are never used here). Record BOTH hosts when they differ: the **app path** (what the SDK is configured to use — often a first-party proxy like `/ingest` on the app's own domain) and the **direct cloud host** (`https://us.i.posthog.com` or `https://eu.i.posthog.com` by region).

**The flag roster.** List the project's flags via `feature-flag-get-all` (or the equivalent MCP listing tool). Fallback if only SQL is available:

```sql
SELECT key, active, filters
FROM feature_flags
WHERE deleted = false
```

If the roster call fails with a permissions error, emit `[ABORT] Insufficient permissions`. If the MCP server is simply unavailable, resolve the roster-dependent comparisons (`ff-flags-delivered`, `ff-unknown-flags`, `ff-stale-rolled-out`, `ff-active-but-unreferenced`) as `suggestion` with `details: {"mcp_skipped": true, "reason": "PostHog MCP unavailable"}`.

**MCP loss degrades ONLY the roster comparisons — nothing else.** Every check below that runs on probes or greps MUST still execute in full when MCP is down: Check I (`ff-key-authenticates` — curl only), Check J (`ff-flags-endpoint` — curl only), Check L's code-key collection (grep only; record the keys in `details` even when the roster comparison is skipped), and Check M's code signal (`ff-evaluated-not-reported` — grep only; a `send_event: false` suppression is a full-strength warning with or without the data signal, and it still sets `gates_cleanup: true`). Resolve every check individually; never batch-skip the live phase because one dependency failed.

### The probe (used by the next three checks)

Emit `[STATUS] Probing /flags delivery`. One plain curl per target host — **the User-Agent matters** (tenet 4): PostHog's server filters clients whose UA looks automated (contains `HeadlessChrome`, `bot`, crawler names, etc.) and returns `{"errorsWhileComputingFlags": false, "flags": {}}` with HTTP 200 for them. That is expected product behavior, and it means a probe with a default curl-adjacent or headless UA manufactures a false failure. Always send a realistic browser UA:

```
curl -s -X POST "<host>/flags/?v=2" \
  -H "Content-Type: application/json" \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -d '{"api_key": "<project token>", "distinct_id": "ff-doctor-probe"}'
```

Run it once against the direct cloud host and — when the app is configured with a different `api_host` — once against the app path (e.g. `https://app.example.com/ingest/flags/?v=2`). Keep both raw responses in memory for the checks below. Do not retry more than once per host.

### Check I — `ff-key-authenticates`

What it verifies: the token the app actually ships **authenticates**. Static analysis can see an env var referenced; it cannot know the value works — or that the env file is even populated (an empty `.env` fails silently: the SDK inits, nothing ever arrives).

Classify the direct-host probe:
- HTTP 200 with a JSON body (flags present or legitimately empty) → the key authenticates.
- HTTP 401 / 403, or a body with an authentication error → the key is wrong or revoked.
- No token found anywhere in env or code → the key is not wired at all.

Rule:
- pass: 200 with valid JSON.
- error: 401/403/auth error — the app cannot receive flags with this key.
- error: no token wired — the SDK initializes with nothing; flags silently never load. (`file`: the init site expecting the env var.)
- error: a **personal API key** (`phx_…` pattern, or an env var named like `POSTHOG_PERSONAL_API_KEY`) is referenced in client-side code or a client bundle path — personal keys grant account access and must never ship to browsers; flags client-side use the public project key. (`file`: the offending reference. Report the variable name only, never the value.)
- suggestion: probe could not run (no network / no token discoverable AND wizard context absent) — `details` explains.

`details` (compact JSON): `{"status_code": <N>, "host": "<direct host>", "token_source": "wizard-context | env | code | missing"}`. Never include the token value.

### Check J — `ff-flags-endpoint`

What it verifies: the **path the app actually uses** serves flags. Projects using a first-party reverse proxy (`api_host: "/ingest"` etc.) can break the flags route in the proxy rewrite while everything else looks fine — a class of silent failure the static audit cannot see.

Only meaningful when the app path differs from the direct host; if the app talks to PostHog Cloud directly, resolve `pass` with `details: "app uses the direct PostHog host"`.

Compare the two probe responses:
- Both 200 with the same flag keys → pass.
- Direct host healthy but the app path errors (non-200, HTML error page, timeout) → **error**: the proxy route is broken; every client behind it silently gets no flags.
- Direct host healthy but the app path returns 200 with a *different* (e.g. empty) flag set → **warning**: something between the app and PostHog is altering the response.

`details`: `{"direct_status": <N>, "proxy_status": <N>, "direct_flag_count": <N>, "proxy_flag_count": <N>, "proxy_host": "<host/path>"}`.

Emit `[STATUS] Cross-checking delivered flags against definitions` before the next check.

### Check K — `ff-flags-delivered` (sweep)

What it verifies: every **active** flag in the roster actually appears in the probe response, and what each evaluates to. `/flags?v=2` returns a per-flag `reason` (e.g. `condition_match`, `out_of_rollout_bound`) — surface it: it converts "my flag isn't working" from a mystery into a stated cause.

Compare roster (active, non-deleted flags) against the app-path probe response (fall back to the direct response if there is no proxy):

- Every active flag present in the response → resolve `ff-flags-delivered` as `pass` with `details: {"active_flag_count": <N>, "delivered_count": <N>}`.
- One or more active flags missing from the response, or present with a surprising evaluation → resolve `ff-flags-delivered` as `warning` with the counts, AND append one row per affected flag via a single `audit_add_checks` call:
  - `id`: `delivered-<flag-key>` (kebab-case; append `-2` on collision — a duplicate id rejects the whole batch; never call with an empty array).
  - `area`: `Feature Flags — Delivery`.
  - `label`: `<flag-key> not delivered` (≤40 chars, no trailing period).
  - `status`: `warning`, `file`: omit.
  - `details`: one line — what the roster says vs what the probe returned, including the `reason` code when present.

Report copy note (teaching callout, NOT a finding): if the operator's own verification method is an automated browser (Playwright/Cypress/headless), remind them in the report's "Notes on expected behavior" section that such clients intentionally receive zero flags — with the docs link — because that is the single most common false alarm when people test flags.

### Check L — `ff-unknown-flags` (sweep)

Emit `[STATUS] Checking flag keys referenced in code exist in PostHog`.

What it verifies: the **reverse direction** — every flag key referenced in code exists in the roster. A typo'd or deleted key returns `undefined` on every evaluation, forever, with no error anywhere. The static audit checks tenant→code (unreferenced flags); this is code→tenant, and nothing else covers it.

Collect the set of flag keys used in code: Grep flag-eval call sites (`getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(`) and extract the first string-literal argument of each call. Keys built dynamically (template strings, variables) are recorded as `dynamic` and excluded from the comparison (note the count in `details`).

Compare against the roster (all non-deleted flags, active or not):
- Every literal key exists in the roster → resolve `ff-unknown-flags` as `pass` with `details: {"code_key_count": <N>, "dynamic_key_count": <N>}`.
- One or more keys missing → resolve `ff-unknown-flags` as `error` with the counts, AND append one row per ghost key via a single `audit_add_checks` call:
  - `id`: `ghost-<flag-key>`, `area`: `Feature Flags — Delivery`, `label`: `<flag-key> not found in PostHog` (≤40 chars), `status`: `error`, `file`: the `path:line` of the call site, `details`: one line naming the nearest-matching roster key if one exists (likely typo) or `no similar flag — deleted or never created`.

### Check M — `ff-evaluated-not-reported`

Emit `[STATUS] Verifying evaluation events are reported`.

What it verifies: flags being **evaluated** and evaluations being **reported** are different things. SDKs report evaluations via `$feature_flag_called` events; PostHog uses those events for experiment exposure AND for flag staleness ("not evaluated in 30+ days"). A project that evaluates flags but suppresses these events breaks its experiments silently — and makes every used flag look stale, which is why this check gates cleanup (tenet 2).

Two signals, either sufficient for a finding:

1. **Code signal:** Grep for `send_feature_flag_events|sendFeatureFlagEvents|sendFeatureFlagEvent|advanced_disable_feature_flags|send_event\s*:\s*false|sendEvent\s*:\s*false` and read each hit. Two suppression forms count: config-level (an init/config option that disables flag-called events) and per-call (posthog-js `isFeatureEnabled('key', { send_event: false })` / `getFeatureFlag(..., { send_event: false })`). A suppression in production paths (not test/CI-gated blocks — those are the correct pattern from Task H) is a finding; per-call suppressions matter per flag — a single suppressed flag is enough to make THAT flag look stale.
2. **Data signal (when MCP query access is available):** count recent `$feature_flag_called` events:

```sql
SELECT count() AS calls
FROM events
WHERE event = '$feature_flag_called'
  AND timestamp > now() - INTERVAL 7 DAY
```

Rule:
- pass: no production-path suppression in code AND (query unavailable OR calls > 0 OR the project has no production traffic yet — do not fail a brand-new project on zero events alone; record `details: "no traffic baseline"`).
- warning: code suppresses `$feature_flag_called` in production paths, OR the project has flag call sites and recent traffic but zero `$feature_flag_called` events in 7 days.
- error: suppression is unconditional AND the roster shows flags used in experiments (roster `filters`/experiment linkage) — experiment exposure is silently broken.

`details` (compact JSON): `{"suppression_sites": [{"file": "<path:line>"}], "calls_7d": <N or null>, "gates_cleanup": true | false}` — set `gates_cleanup: true` whenever status is warning/error; Phase 2 reads this to withhold tenant-side cleanup options.

### Check N — `ff-stale-rolled-out` (sweep)

What it verifies: flags at **100% rollout with no conditions** that are still gated in code — the check is equivalent to a hardcoded value: dead branches, needless evaluations, cleanup candidates. (The tenant-side twin, zero-reference active flags, is Task I in Part 1 — `ff-active-but-unreferenced`.)

From the roster, select active flags whose filters release to 100% with no property/cohort conditions and no experiment linkage. Intersect with the code-key set from Check L (flags that ARE referenced).

- None → resolve `ff-stale-rolled-out` as `pass`.
- One or more → resolve as `suggestion` with counts, AND append one row per flag via a single `audit_add_checks` call: `id`: `stale-<flag-key>`, `area`: `Feature Flags — Optimize`, `label`: `<flag-key> at 100% but still gated` (≤40 chars), `status`: `suggestion`, `file`: a representative call site, `details`: one line — rollout state + reference count + "safe order: remove the gate, deploy, then disable in PostHog".

**Interlock note:** when `ff-evaluated-not-reported` has `gates_cleanup: true`, these rows still appear (they're real observations) but their fixes are withheld in Phase 2 and the report explains why.

### Check O — `ff-active-but-unreferenced`

What it verifies: the tenant→code direction of drift — **active** flags with zero references anywhere in the source tree. Per the cutting-costs guidance: active flags continue to evaluate (and bill) even with zero code references, because survey targeting and the `/flags` endpoint evaluate all active flags. The only way to stop the charges is to disable, archive, or delete the flag in PostHog — removing it from code is not enough.

Using the roster (active flags) and the code-key set from Check L: for each active flag key with zero literal references, grep once more for the literal key across the whole tree (any file counts — config, test fixture, comment) to rule out non-eval references before flagging.

Rule:
- pass: every active flag has at least one reference in the codebase.
- suggestion: 1+ active flags have zero references — still evaluated (and billed) on every `/flags` request. Recommend disabling, archiving, or deleting them in PostHog.

Resolve `ff-active-but-unreferenced` with `file` omitted (project-wide) and `details` as compact JSON:

```
{
  "active_flag_count": <N>,
  "unreferenced_active_flag_count": <N>,
  "unreferenced_keys": ["<key>", ...],
  "mcp_skipped": false
}
```

**Interlock note:** archive fixes for these flags are the ones most directly gated by `ff-evaluated-not-reported` — "zero code references" and "zero evaluation events" are only trustworthy together when evaluation reporting is verified working.
