---
next_step: 4-event-capture.md
---

# Step 3 — Identification

This step resolves four identification checks **in parallel**, one subagent per check:

- `identify-stable-distinct-id`
- `identify-not-late`
- `cross-runtime-distinct-id`
- `identify-reset-on-logout`

Each subagent owns its own grep, reads, evaluates its single rule, and emits one `audit_resolve_checks` call with one update. The ledger's mutex serializes concurrent writes — there's no race.

## Status

Emit before dispatching:

```
[STATUS] Auditing identification
```

## Action — dispatch four subagents in one message

Make **four `Agent` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `4-event-capture.md`. Do not run any other tools between dispatch and the next step.

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

**Check for a deliberate anonymous-event opt-out before calling a fallback broken.** A server that can't resolve a stable id sometimes emits `$process_person_profile: false` alongside the capture — PostHog's documented mechanism for exactly this situation. With that property set, even a random-UUID `distinct_id` creates no person profile, so it cannot merge with or corrupt person records. Those events are deliberately anonymous, not accidentally orphaned. Read the properties object, not just the `distinct_id` expression, before judging.

Rule:
- If both client and server runtimes call PostHog, the same distinct_id must be used on both sides for the same user.
- pass: server-side captures source the client's distinct_id (cookie, session token, or explicit hand-off).
- error: server-side captures use a different identifier scheme for the same user, with no hand-off and no anonymous opt-out.
- warning: the server falls back to a random or synthetic id for some captures. If `$process_person_profile: false` accompanies the fallback, the cost is limited to losing that dimension — say so, and do not claim it contaminates person counts, funnels, or retention. Prefer recommending an already-available stable id (org, account, or tenant id — check whether one is in scope at the call site, since it often is) over recommending the capture be dropped.
- Skip (`pass` with details: "single runtime"): only one runtime initializes PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `cross-runtime-distinct-id`, including `file` (path:line of the most relevant init or capture site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task D — `identify-reset-on-logout`

`description`: `Audit identify-reset-on-logout`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-reset-on-logout.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit/references/identify-users.md`).

Locate logout, sign-out, and account-switching flows by issuing whatever `Grep` and `Read` calls are needed in parallel. Determine whether those flows clear PostHog state with `posthog.reset()`.

Rule:
- Logout or account-switching flows should call `posthog.reset()`. Without a reset, when user B logs in on the same device after user A, PostHog's anonymous ID is shared and the next `identify()` can merge both accounts into one person.
- pass: every detected logout/account-switch flow calls `posthog.reset()`.
- error: a logout/account-switch flow is missing `posthog.reset()`.
- Skip (`pass` with details: "no logout/account-switch flow found"): no detectable logout/account-switch flow exists.
- note: `posthog.reset(true)` is valid when a completely clean device ID reset is required.

**Verify the location you recommend is safe — a wrong `reset()` placement is worse than a missing one.** A shared sign-out helper (`clearAuthState`, `clearBrowserStorageOnSignOut`, a storage-clearing utility) looks like the ideal single choke point, and recommending one is tempting because it covers every path at once. But these helpers are frequently also invoked when no session ever existed — on initial page load, or from an auth-state listener that fires for anonymous visitors. `posthog.reset()` on that path mints a fresh anonymous ID on **every visit**, which detaches pre-signup pageviews from the account that follows and inflates unique-visitor counts. That is a larger data problem than the identity merge being fixed.

Before naming a location:
- Trace every caller of the helper. If any caller can run without a prior session, the helper is unsafe — say so explicitly in `details` and recommend the individual sign-out call sites instead.
- A safe site runs only on a genuine identity transition: an explicit user sign-out action, or a listener branch guarded by a real sign-out event (e.g. `event === 'SIGNED_OUT'`) rather than merely "no session present".
- Enumerate every sign-out path you found, including forced sign-outs routed through an auth listener. Recommending only the obvious menu-driven `signOut()` methods leaves session-revocation and account-deletion paths unreset.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-reset-on-logout`, including `file` (path:line of the most relevant logout or reset site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```
