# Step 3 — Identification

This step resolves three identification checks **in parallel**, one subagent per check:

- `identify-stable-distinct-id`
- `identify-not-late`
- `cross-runtime-distinct-id`

Each subagent owns its own grep, reads, evaluates its single rule, and emits one `audit_resolve_checks` call with one update. The ledger's mutex serializes concurrent writes — there's no race.

## Status

Emit before dispatching:

```
[STATUS] Auditing identification
```

## Action — dispatch three subagents in one message

Make **three `Task` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `4-event-capture.md`. Do not run any other tools between dispatch and the next step.

The bundled `identify-users.md` reference holds PostHog's authoritative guidance on `distinct_id`, `identify()` ordering, and cross-runtime identity. It's typically at `.claude/skills/audit/references/identify-users.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit/references/identify-users.md`. Each subagent reads it once before judging.

### Task A — `identify-stable-distinct-id`

`description`: `Audit identify-stable-distinct-id`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-stable-distinct-id.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit/references/identify-users.md`).

Run **one** Grep: `posthog\.identify\(`. Read each file that contains a hit, once. Inspect the first argument passed to identify().

Rule:
- distinct_id must be a stable identifier (auth user id, account id), not a session UUID, ephemeral cookie, or device-only id.
- pass: sources from authenticated user (session.user.id, auth.uid(), etc.)
- error: sources from a session, request, or device id that resets
- warning: source unclear — flag for human review

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-stable-distinct-id`, including `file` (path:line) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task B — `identify-not-late`

`description`: `Audit identify-not-late`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-not-late.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit/references/identify-users.md`).

Run **two** Greps in parallel:
- `posthog\.identify\(` — where identity is established
- `posthog\.capture\(|getFeatureFlag\(|isFeatureEnabled\(` — where captures and flag evals happen

Read each file that contains a hit, once. Compare the timing/ordering of identify() against the surrounding capture / flag-eval calls.

Rule:
- identify() must be called before any posthog.capture for that user, and before any feature-flag eval depending on user identity.
- pass: identify runs at session start / right after login. Captures and flag evals come after.
- warning: identify runs lazily (e.g. settings-page mount), so early captures and flag evals are anonymous.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-not-late`, including `file` (path:line of the identify call) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task C — `cross-runtime-distinct-id`

`description`: `Audit cross-runtime-distinct-id`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: cross-runtime-distinct-id.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit/references/identify-users.md`).

Run **one** Grep: `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — locate every PostHog initialization across runtimes. Read each file that contains a hit, once. Determine whether both client and server runtimes initialize PostHog, and if so, how distinct_id flows between them.

Rule:
- If both client and server runtimes call PostHog, the same distinct_id must be used on both sides for the same user.
- pass: server-side captures source the client's distinct_id (cookie, session token, or explicit hand-off).
- error: server-side captures use a different identifier scheme.
- Skip (`pass` with details: "single runtime"): only one runtime initializes PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `cross-runtime-distinct-id`, including `file` (path:line of the most relevant init or capture site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```
