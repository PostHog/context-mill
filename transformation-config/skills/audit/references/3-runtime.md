# Step 3 — Identification & event capture (parallel)

This step resolves six checks split into two independent groups: **identification** (3 rules) and **event capture** (3 rules). The two groups share **no state** — run them in parallel via subagents.

## TodoWrite

Mark `Setup` as `completed` and `Audit` as `in_progress`. Keep all three items in the list. Do **not** rotate any `activeForm` — use `[STATUS]` for sub-step labels instead.

## Status

Emit before dispatching:

```
[STATUS] Auditing identification + capture in parallel
```

## Action — fan out

Make **two `Task` tool calls in a single message**, so they run concurrently. Each subagent does its own grep, evaluates its rules, and emits a single `mcp__wizard-tools__audit_resolve_checks` call. The `audit_resolve_checks` tool serializes internally — concurrent calls cannot lose updates.

When both Task calls return, this step is done. Do not run any other tools between dispatch and the report step.

### Task call A — Identification subagent

`description`: `Audit identification rules`

`prompt`:
```
You are an audit subagent. Resolve three identification rules and return.

Run **one** Grep with this regex: `posthog\.identify\(`. Read each file that contains a hit, once. No other scans.

Evaluate these three rules from the call-site reads:

1. identify-stable-distinct-id
   - distinct_id must be a stable identifier (auth user id, account id), not a session UUID, ephemeral cookie, or device-only id.
   - pass: sources from authenticated user (session.user.id, auth.uid(), etc.)
   - error: sources from a session, request, or device id that resets
   - warning: source unclear — flag for human review

2. identify-not-late
   - identify() must be called before any posthog.capture for that user, and before any feature-flag eval depending on user identity.
   - pass: identify runs at session start / right after login. Captures and flag evals come after.
   - warning: identify runs lazily (e.g. settings-page mount), so early captures and flag evals are anonymous.

3. cross-runtime-distinct-id
   - If both client and server runtimes call PostHog, the same distinct_id must be used on both sides for the same user.
   - pass: server-side init uses the client's distinct_id (cookie, session token, or explicit hand-off).
   - error: server-side captures use a different identifier scheme.
   - Skip (`pass` with details: "single runtime"): only one runtime initializes PostHog.

Resolve all three with **one** call to mcp__wizard-tools__audit_resolve_checks. Each update should include `file` (path:line) and `details` (one-line explanation).

Return when the resolve call completes. Do not write the audit report — that's the parent agent's job.
```

### Task call B — Event capture subagent

`description`: `Audit event capture rules`

`prompt`:
```
You are an audit subagent. Resolve three event capture rules and return.

Run **two** Greps in parallel:
- `posthog\.capture\(` — all capture call sites
- `signup|signin|register|checkout|purchase|subscribe|onboard` — likely growth-funnel surfaces

Read each file with a hit, once. No other scans.

Evaluate these three rules:

1. capture-event-names-static
   - Event names in posthog.capture("name", …) must be **static strings**, not template literals or dynamic variables.
   - pass: all capture calls use string literals.
   - error: any call uses a template literal or variable as the event name.

2. capture-anon-distinct-id
   - For events from code paths with no authenticated user: do not share a single hardcoded "system" / "anonymous" distinct_id across users. Either pass `$process_person_profile: false` in properties, or omit distinct_id.
   - pass: anonymous captures disable person processing or use a per-session id.
   - error: anonymous captures share a single hardcoded distinct_id without `$process_person_profile: false`.
   - Skip (`pass` with details: "no anonymous captures"): all captures happen post-identify.

3. capture-growth-events
   - Signup, activation/first-key-action, and purchase/subscription should be tracked explicitly. Autocapture isn't enough for funnels.
   - pass: at least signup + one activation + (purchase or subscribe) are captured explicitly.
   - warning: one or more growth events missing — list which.
   - Skip (`pass` with details: "no auth/billing paths detected"): no detectable signup/billing surfaces.

Resolve all three with **one** call to mcp__wizard-tools__audit_resolve_checks. Each update should include `file` (path:line) and `details` (one-line explanation).

Return when the resolve call completes. Do not write the audit report.
```
