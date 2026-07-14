---
next_step: 4-report.md
---

# Step 3 — Feature flags (optimize)

This step resolves four cost-optimization checks **in parallel**, one subagent per check:

- `ff-active-but-unreferenced`
- `ff-local-eval-polling-interval`
- `ff-local-eval-in-edge-handlers`
- `ff-test-ci-gating`

All four are grounded in PostHog's [feature flag cutting-costs guide](https://posthog.com/docs/feature-flags/cutting-costs) and [local-evaluation guide](https://posthog.com/docs/feature-flags/local-evaluation). The billed endpoint is `/flags` — references to the "decide endpoint" in older docs map to it.

**Two of these checks (`ff-local-eval-polling-interval` and `ff-local-eval-in-edge-handlers`) only apply when server-side local evaluation is in use.** Step 1 recorded whether local eval was detected (server SDK initialized with `personal_api_key` / feature-flags secure API key, or a call to `getAllFlagsAndPayloads` / `getAllFlags`). If local eval was **not** detected, the two checks resolve with `status: "pass"` and `details: "skip: local evaluation not detected"` — do not dispatch their subagents at all.

One check (`ff-active-but-unreferenced`) requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, `mcp_skipped: true`, and `details: "PostHog MCP unavailable — could not list active flags"`. Do not block the audit.

{{> mcp-tool-calling}}

## Status

Emit before dispatching:

```
[STATUS] Auditing feature flag cost optimization
```

## Action — dispatch subagents in one message

Make **one `Agent` tool call per check that actually runs** in a single message so they run concurrently. For each local-eval-gated check that is skipping, emit its `audit_resolve_checks` update directly (as a `pass` with skip details) instead of dispatching a subagent. Wait for all dispatched subagents to return, then continue to `4-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `cutting-costs.md` reference holds PostHog's authoritative cost-reduction guidance. It's typically at `.claude/skills/audit-feature-flags/references/cutting-costs.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`. Each subagent reads it once before judging.

### Task A — `ff-active-but-unreferenced`

`description`: `Audit ff-active-but-unreferenced`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-active-but-unreferenced.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not list active flags"}`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-feature-flags/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`). Focus on the "unused flags still incur charges" callout — active flags continue to evaluate (and bill) even with zero code references, because survey targeting and the `/flags` endpoint evaluate all active flags. The only way to stop charges is to disable, delete, or archive the flag in PostHog (removing it from code is not enough).

Step 1 — list active flags from PostHog. Prefer `feature-flag-get-all` or the equivalent listing tool. If only `execute-sql` is available, fall back to:

```sql
SELECT key
FROM feature_flags
WHERE active = true AND deleted = false
```

Step 2 — for each active flag key, grep the codebase for the literal key (case-sensitive). Count any reference in any source-tree file (a flag is referenced even if it appears only in a config file, a test fixture, or a comment).

Rule:
- pass: every active flag has at least one reference in the codebase.
- suggestion: 1+ active flags have zero codebase references — they are still being evaluated (and billed) on every `/flags` request, especially via survey targeting. Recommend disabling, archiving, or deleting them in PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-active-but-unreferenced`, with `file` left blank (this finding is project-wide, not tied to a single code site), and `details` as compact JSON:

```
{
  "active_flag_count": <N>,
  "unreferenced_active_flag_count": <N>,
  "unreferenced_keys": ["<key>", ...],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `ff-local-eval-polling-interval`

**Skip this task entirely if Step 1 did not detect local evaluation.** In that case, emit a direct `audit_resolve_checks` update for `ff-local-eval-polling-interval` with `status: "pass"` and `details: "skip: local evaluation not detected"`.

`description`: `Audit ff-local-eval-polling-interval`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-local-eval-polling-interval.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-feature-flags/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/cutting-costs.md`). Focus on the "reducing local evaluation costs" section — by default, PostHog fetches flag definitions every 30 seconds. Each request is billed as 10 credits, so a constantly-running server makes `10 * 2 * 60 * 24 * 30 = 864,000` credits / month at the default. Increasing the polling interval (e.g. to 5 minutes) cuts that proportionally, at the cost of slower propagation of flag changes.

Run **one** Grep: `featureFlagsPollingInterval|feature_flags_polling_interval|featureFlagsRequestTimeoutMs|feature_flag_request_timeout_ms`.

Read each file that contains a server SDK init, once (locate via the Step 1 local-eval signals if needed: `personal_api_key` / `PostHog(`). For each init that uses local evaluation, determine whether `featureFlagsPollingInterval` (or the language-equivalent: `feature_flags_polling_interval`, `personal_api_key_request_timeout_seconds`, etc.) is set.

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

### Task C — `ff-local-eval-in-edge-handlers`

**Skip this task entirely if Step 1 did not detect local evaluation.** In that case, emit a direct `audit_resolve_checks` update for `ff-local-eval-in-edge-handlers` with `status: "pass"` and `details: "skip: local evaluation not detected"`.

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

### Task D — `ff-test-ci-gating`

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

## After all four checks are resolved

Continue to **`4-report.md`**.
