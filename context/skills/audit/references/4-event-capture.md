---
next_step: 5-report.md
---

# Step 4 — Event capture

This step resolves three event-capture checks **in parallel**, one subagent per check:

- `capture-event-names-static`
- `capture-uses-proxy`
- `capture-growth-events`

Each subagent owns its own grep, reads, evaluates its single rule, and emits one `audit_resolve_checks` call with one update. The ledger's mutex serializes concurrent writes.

## Status

Emit before dispatching:

```
[STATUS] Auditing event capture
```

## Action — dispatch three subagents in one message

Make **three `Agent` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `5-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `best-practices.md` reference holds PostHog's authoritative guidance on event-name shape, reverse-proxy setup, and growth-event coverage. It's typically at `.claude/skills/audit/references/best-practices.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit/references/best-practices.md`. Each subagent reads it once before judging.

### Task A — `capture-event-names-static`

`description`: `Audit capture-event-names-static`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: capture-event-names-static.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit/references/best-practices.md`).

Run **one** Grep: `posthog\.capture\(`. Read each file that contains a hit, once. Inspect the first argument of every capture() call.

**Resolve the name before judging it.** A first argument that isn't a bare string literal is not automatically a violation. What matters is the set of event names that can reach PostHog at runtime:

- A reference to a module-level constant, enum, or registry whose value is a literal (`EVENTS.SIGNUP_COMPLETED`, `POSTHOG_EVENTS.BILLING.UPGRADED`) is the **recommended** pattern, not a violation. Follow the reference, confirm it resolves to a literal, and pass it.
- A ternary or switch over string literals resolves to a bounded, statically knowable set. Enumerate the branches and count them.
- A template literal or concatenation that interpolates a runtime value (`` `${action}_clicked` ``, `'event_' + type`) resolves to an unbounded set. This is the case that actually breaks queryability.

Rule:
- Event names must resolve to a fixed, greppable set of strings.
- pass: every capture name is a string literal, or a constant/enum reference that resolves to one.
- warning: a name is selected from a bounded set of literals (ternary or switch). PostHog still sees a fixed number of definitions, so nothing is unbounded — the real costs are that the literals can't be found by searching the codebase for a name seen in PostHog, and that any dimension folded into the name (origin, plan, variant) belongs in a property where it can drive a breakdown instead.
- error: a name interpolates runtime data, so the set of event definitions is unbounded and each new value creates another definition.

When reporting, state the resolved names or the interpolated expression you found. Never describe a bounded ternary as "unbounded", and don't warn about event-definition or rate limits for a case whose name count is fixed.

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

Run **three** Greps in parallel:
- `posthog\.capture\(` — browser-SDK capture calls
- `\.capture\(\s*\{` — server-SDK (`posthog-node`) captures, which take a single object (`{ distinctId, event }`) and usually sit behind a wrapper
- `signup|signin|register|checkout|purchase|subscribe|onboard` — likely growth-funnel surfaces

Read each file that contains a hit, once. Cross-reference: do the growth-funnel surfaces emit capture calls, on either runtime?

**Growth events are most often emitted server-side or behind a wrapper, so a browser-only search will wrongly report them missing.** Before concluding any event is absent:

- Follow any in-house analytics wrapper (`analyticsTrack`, `track`, `captureEvent`, an `analytics.*` module) to check whether it forwards to PostHog. A wrapper that fans out to several vendors still counts as instrumentation.
- Look for a central event-name registry — a union type, enum, or constants map of permitted event names. Entries like `user created` or `subscription purchased` are strong evidence the event exists; grep the call sites to confirm it actually fires.
- Signup and purchase in particular tend to live in backend or queue/worker code (billing webhooks, post-signup jobs), not in the UI surface that matched the third grep.
- Note any environment gate on the wrapper (e.g. `if (NODE_ENV === 'production')`). The event exists but won't appear in non-production projects — report that as context, not as a missing event.

Rule:
- Signup, activation/first-key-action, and purchase/subscription should be tracked explicitly. Autocapture isn't enough for funnels.
- pass: at least signup + one activation + (purchase or subscribe) are captured explicitly, on either the client or the server.
- warning: one or more growth events missing — list which, and state where you looked (browser captures, server captures, wrappers, registry) so the reader can judge the claim.
- Skip (`pass` with details: "no auth/billing paths detected"): no detectable signup/billing surfaces.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `capture-growth-events`, including `file` (path:line of the most relevant capture or growth-surface site) and `details` (one-line explanation, listing missing growth events when applicable). Return when the call completes. Do not write the audit report.
```
