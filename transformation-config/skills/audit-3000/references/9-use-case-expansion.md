---
next_step: 10-report.md
---

# Step 9 — Use case expansion

This step resolves **up to seven** optional ledger checks in the **`Use Case: Expansion`** area. Each check only runs when its **presence detector** finds that PostHog product already used in the repo; otherwise resolve **`pass`** with `details` explaining the skip. **Never** recommend PostHog products that have no codebase signal (no Surveys without survey APIs, no Replay without replay config/APIs, etc.).

**Read-only:** do not edit application source files.

Docs pointers for fixes (not exhaustive): [Product analytics](https://posthog.com/docs/product-analytics/capture-events), [Feature flags](https://posthog.com/docs/feature-flags/installation), [Error tracking](https://posthog.com/docs/error-tracking/installation), [LLM analytics](https://posthog.com/docs/ai-engineering/observability), [Session replay](https://posthog.com/docs/session-replay/installation), [Surveys](https://posthog.com/docs/surveys/installation), [Logs](https://posthog.com/docs/logs/installation).

## Status

Emit before any subagent work:

```
[STATUS] Scanning ledger for expansion checks
[STATUS] Auditing use case expansion
```

## Action

### a. Ledger gate and dispatch plan

1. `Read` `.posthog-audit-checks.json` once.

2. Canonical expansion ids (in this order):

   - `expansion-analytics-surface-coverage`
   - `expansion-feature-flag-rollout-candidates`
   - `expansion-error-tracking-coverage`
   - `expansion-llm-analytics-coverage`
   - `expansion-session-replay-coverage`
   - `expansion-surveys-coverage`
   - `expansion-logs-coverage`

3. Let `S` be the ids from that list that **actually appear** in the ledger (same `id` field on check rows). If `S` is **empty**, continue immediately to `10-report.md` — do **not** spawn `Task` subagents and do **not** call `mcp__wizard-tools__audit_resolve_checks` for expansion ids.

4. Otherwise build ordered lists: walk the canonical list top to bottom and keep ids that are in `S`. Split into **`S1`** = the first **up to four** ids, **`S2`** = the remainder (zero to three ids).

5. **Batch 1:** Make **one `Task` call per id in `S1`**, all in **a single message**, so they run concurrently. Wait for every Task to return.

6. **Batch 2:** If `S2` is non-empty, make **one `Task` call per id in `S2`** in **one message**. Wait for all to return. If `S2` is empty, skip this batch.

Do not run other tools between batch 1 dispatch and waiting for batch 1, or between batch 2 dispatch and waiting for batch 2, except waiting on Tasks.

Each Task resolves **exactly one** ledger id and returns when `mcp__wizard-tools__audit_resolve_checks` completes (or when the ledger gate says to skip).

---

### Task — `expansion-analytics-surface-coverage`

`description`: `Audit expansion-analytics-surface-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-analytics-surface-coverage.

1. Read `.posthog-audit-checks.json`. If no check row has "id": "expansion-analytics-surface-coverage", stop immediately — do not call `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: run Grep for posthog\.capture\( across the repo. If there are no meaningful matches (no product analytics in use), call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: posthog.capture not found in codebase", file optional path to posthog init if any — then stop.

3. Otherwise run Bash once for recent touched source files, e.g. git log --since=30.days --name-only --pretty=format: (adjust if not a git repo — then Glob app/pages routes components instead). Filter to code extensions you see in the repo (tsx, ts, jsx, js, vue, svelte).

4. Rule: flag as suggestion recent high-signal UI/route files that contain no posthog.capture (and no obvious wrapper re-exporting capture) when sibling areas already use capture — be conservative; cap to a handful of paths in details one line.

5. Status: pass if no gaps; suggestion if you list concrete paths; pass with details "skip: insufficient git history" if you cannot establish recency.

Emit one `mcp__wizard-tools__audit_resolve_checks` update for id expansion-analytics-surface-coverage with file path:line of the most relevant capture or new surface. Do not write the audit report.
```

---

### Task — `expansion-feature-flag-rollout-candidates`

`description`: `Audit expansion-feature-flag-rollout-candidates`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-feature-flag-rollout-candidates.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for getFeatureFlag|isFeatureEnabled|useFeatureFlag|onFeatureFlags|reloadFeatureFlags|getFeatureFlagPayload|featureFlags\. If no matches, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: feature flag APIs not found" — stop.

3. Read files with flag usage and sample large user-facing branches (routes, layout toggles) via Grep for relevant route segments. Prefer evidence from the integration skill under **/skills/** if present (Glob **/skills/**/SKILL.md once).

4. Rule: suggestion or warning only with file:line when a user-visible rollout or environment-only gate clearly could use the same flag patterns already used elsewhere — never invent flag keys.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-feature-flag-rollout-candidates. Do not write the audit report.
```

---

### Task — `expansion-error-tracking-coverage`

`description`: `Audit expansion-error-tracking-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-error-tracking-coverage.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for captureException|\$exception|posthog\.capture\(\s*['\"]?\$exception. If PostHog error reporting is not already used anywhere, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: PostHog error tracking not detected" — stop.

3. Grep for try\s*\{|catch\s*\( in ts/tsx/js/jsx alongside files that import posthog or use the client. Read a bounded sample of catch blocks.

4. Rule: suggestion when a catch or error boundary handles user-visible errors but does not report to PostHog while other files already use the project's PostHog error pattern — include file:line.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-error-tracking-coverage. Do not write the audit report.
```

---

### Task — `expansion-llm-analytics-coverage`

`description`: `Audit expansion-llm-analytics-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-llm-analytics-coverage.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for \$ai_generation|posthog\.ai|@posthog/ai|withTracing|captureAi|ai_generation. If no matches, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: LLM analytics / PostHog AI SDK not detected" — stop.

3. Grep for openai\.|@ai-sdk|generateText|streamText|Anthropic|bedrock|langchain in parallel. Read entrypoint files.

4. Rule: suggestion when an LLM call path lacks the same tracing/wrapper pattern used elsewhere in the repo — cite file:line. Stay conservative.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-llm-analytics-coverage. Do not write the audit report.
```

---

### Task — `expansion-session-replay-coverage`

`description`: `Audit expansion-session-replay-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-session-replay-coverage.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for sessionRecording|session_recording|get_session_replay_url|getSessionReplayUrl|onSessionId|startSessionRecording|disableSessionRecording. If no matches, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: session replay APIs/config not detected" — stop.

3. Use the same recent-files signal as analytics (git or Glob) and compare to files that already attach replay URLs or session metadata vs new surfaces that do not — especially when error tracking coexists and sibling handlers include replay context.

4. Rule: suggestion only with file:line when an obvious high-value surface omits a pattern already established in the codebase.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-session-replay-coverage. Do not write the audit report.
```

---

### Task — `expansion-surveys-coverage`

`description`: `Audit expansion-surveys-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-surveys-coverage.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for getActiveMatchingSurveys|displaySurvey|renderSurvey|getSurveys|posthog\.getSurveys|SurveysAPI. If no matches, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: PostHog surveys API not detected" — stop.

3. Grep for onboard|feedback|nps|survey|rating in routes/pages; cross-check which files already call survey helpers.

4. Rule: suggestion when a feedback/onboarding-style page has no survey hook but other pages already use the same survey integration pattern — do not invent survey content or IDs; only wiring gaps with file:line.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-surveys-coverage. Do not write the audit report.
```

---

### Task — `expansion-logs-coverage`

`description`: `Audit expansion-logs-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one ledger id: expansion-logs-coverage.

1. Read `.posthog-audit-checks.json`. If that id is missing, stop without calling `mcp__wizard-tools__audit_resolve_checks`.

2. Presence detector: Grep for @posthog/otel|OTEL_EXPORTER|posthog.*logs|sendLog|logsProcessor|@opentelemetry.*posthog|ingest.*logs (case insensitive ok). Check package manifests for posthog logging/otel packages. If no PostHog logs pipeline signal, call `mcp__wizard-tools__audit_resolve_checks` once with status pass, details "skip: PostHog logs / OTLP pipeline not detected" — stop.

3. Grep for console\.(log|error|warn|info) in server directories (api, server, worker, actions) and compare to files that already emit structured logs toward PostHog.

4. Rule: suggestion for handlers with noisy unstructured logging where sibling modules already use the project's PostHog log sink — file:line.

Emit one `mcp__wizard-tools__audit_resolve_checks` call for expansion-logs-coverage. Do not write the audit report.
```

---

Continue to **`10-report.md`**.
