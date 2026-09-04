---
next_step: 5-live-data.md
---

# Step 4 — Event capture

This step resolves four event-capture checks **in parallel**, one subagent per check:

- `capture-event-names-static`
- `capture-uses-proxy`
- `capture-growth-events`
- `capture-fires-on-success`

Each subagent owns its own grep, reads, evaluates its single rule, and emits one `audit_resolve_checks` call with one update. The ledger's mutex serializes concurrent writes.

## Status

Emit before dispatching:

```
[STATUS] Auditing event capture
```

## Action — dispatch four subagents in one message

Make **four `Agent` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `5-live-data.md`. Do not run any other tools between dispatch and the next step.

The bundled `best-practices.md` reference holds PostHog's authoritative guidance on event-name shape, reverse-proxy setup, and growth-event coverage. It's typically at `.claude/skills/audit/references/best-practices.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit/references/best-practices.md`. Each subagent reads it once before judging.

### Task A — `capture-event-names-static`

`description`: `Audit capture-event-names-static`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: capture-event-names-static.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit/references/best-practices.md`).

Run **one** Grep: `posthog\.capture\(`. Read each file that contains a hit, once. Inspect the first argument of every capture() call.

Rule:
- Event names in posthog.capture("name", …) must be static strings, not template literals or dynamic variables.
- pass: all capture calls use string literals.
- error: any call uses a template literal or variable as the event name.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `capture-event-names-static`, including `file` (path:line of the first violation if any, otherwise of a representative capture call) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task B — `capture-uses-proxy`

`description`: `Audit capture-uses-proxy`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: capture-uses-proxy.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit/references/best-practices.md`).

Run **one** Grep: `api_host`. Read each file that contains a hit, once. Determine the configured ingest host the SDK posts to, and whether any browser runtime initializes PostHog at all.

Rule:
- A reverse proxy fronts PostHog's ingest endpoint via `api_host`, so events keep flowing when ad/tracking blockers would otherwise drop them. Without one, a meaningful share of browser captures never reach PostHog.
- pass: `api_host` resolves to a first-party domain on the project's own infra (e.g. `e.example.com`, `posthog.example.com`, `/ingest`-style same-origin path, or a known proxy SaaS like `app.example.com/relay-...`).
- warning: `api_host` is the default PostHog host (`https://us.i.posthog.com`, `https://eu.i.posthog.com`, `https://app.posthog.com`, or omitted entirely so the SDK default applies).
- Skip (`pass` with details: "server-only SDK"): only server-side runtimes init PostHog — a proxy isn't needed when no browser sends captures.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `capture-uses-proxy`, including `file` (path:line of the init that sets api_host) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task C — `capture-growth-events`

`description`: `Audit capture-growth-events`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: capture-growth-events.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit/references/best-practices.md`).

Run **two** Greps in parallel:
- `posthog\.capture\(` — explicit capture calls
- `signup|signin|register|checkout|purchase|subscribe|onboard` — likely growth-funnel surfaces

Read each file that contains a hit, once. Cross-reference: do the growth-funnel surfaces actually emit explicit capture calls?

Rule:
- Signup, activation/first-key-action, and purchase/subscription should be tracked explicitly. Autocapture isn't enough for funnels.
- pass: at least signup + one activation + (purchase or subscribe) are captured explicitly.
- warning: one or more growth events missing — list which.
- Skip (`pass` with details: "no auth/billing paths detected"): no detectable signup/billing surfaces.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `capture-growth-events`, including `file` (path:line of the most relevant capture or growth-surface site) and `details` (one-line explanation, listing missing growth events when applicable). Return when the call completes. Do not write the audit report.
```

### Task D — `capture-fires-on-success`

`description`: `Audit capture-fires-on-success`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: capture-fires-on-success.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit/references/best-practices.md`).

Run **one** Grep: `posthog\.capture\(`. Read each file that contains a hit, once.

Consider only captures whose event name reads as a completed outcome — `_saved`, `_created`, `_updated`, `_deleted`, `_completed`, `_purchased`, `_submitted`, `_signed_up`, `_subscribed`, `_upgraded`, `_paid`, `_published`, or the project's own past-tense equivalent. Ignore intent-stage names (`_clicked`, `_started`, `_viewed`, `_opened`) — those are supposed to fire on the action itself, and flagging them is a false positive.

Rule:
- A completion event must fire only after the server confirms the action: inside the success branch, after the awaited call resolves. Fired at the top of a submit handler instead, a submission the server rejects still counts as a success, which over-reports the metric and inflates the event bill.
- pass: no completion-named capture waits on a server, OR every one of them sits in a success branch (after `if (response.ok)` / `if (!error)`, inside `.then()`, or after an `await` that throws on failure and is not swallowed by a `try`).
- warning: any completion-named capture runs before its `await`, or outside the success guard so it also runs on a failed response.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `capture-fires-on-success`, including `file` (path:line of the most material violation, otherwise a representative completion capture) and `details` (one-line explanation naming the branch the call belongs in). Return when the call completes. Do not write the audit report.
```
