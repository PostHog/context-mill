---
next_step: 3-identify-lifecycle.md
---

# Step 2 — Identify (fix)

This step resolves five correctness checks **in parallel**, one subagent per check. The first four ids are reused by the broader PostHog audit so a fix once made here is observable from either entry point. The fifth (`identify-sequential-calls`) is audit-identify-specific.

- `identify-stable-distinct-id`
- `identify-not-late`
- `cross-runtime-distinct-id`
- `identify-reset-on-logout`
- `identify-sequential-calls`

## Skip case — no `posthog.identify` calls found

If Step 1's identify grep returned **zero** hits, resolve all five checks in a single `audit_resolve_checks` call with `status: "pass"` and `details: "skip: no posthog.identify call sites detected"`. Then continue to **`3-identify-optimize.md`**. Do not dispatch subagents.

## Status

Emit before dispatching:

```
[STATUS] Auditing identify correctness
```

## Action — dispatch five subagents in one message

Make **five `Agent` tool calls in a single message** so they run concurrently. Wait for all five to return, then continue to `3-identify-optimize.md`. Do not run any other tools between dispatch and the next step.

The bundled `identify-users.md` reference holds PostHog's authoritative guidance on `distinct_id`, `identify()` ordering, and cross-runtime identity. It's typically at `.claude/skills/audit-identify/references/identify-users.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-identify/references/identify-users.md`. Each subagent reads it once before judging.

### Task A — `identify-stable-distinct-id`

`description`: `Audit identify-stable-distinct-id`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-stable-distinct-id.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

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

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

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

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

Run **one** Grep: `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — locate every PostHog initialization across runtimes. Read each file that contains a hit, once. Determine whether both client and server runtimes initialize PostHog, and if so, how distinct_id flows between them.

Rule:
- If both client and server runtimes call PostHog, the same distinct_id must be used on both sides for the same user.
- pass: server-side captures source the client's distinct_id (cookie, session token, or explicit hand-off).
- error: server-side captures use a different identifier scheme.
- Skip (`pass` with details: "single runtime"): only one runtime initializes PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `cross-runtime-distinct-id`, including `file` (path:line of the most relevant init or capture site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task D — `identify-reset-on-logout`

`description`: `Audit identify-reset-on-logout`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-reset-on-logout.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

Locate logout, sign-out, and account-switching flows by issuing whatever `Grep` and `Read` calls are needed in parallel. Determine whether those flows clear PostHog state with `posthog.reset()`.

Rule:
- Logout or account-switching flows should call `posthog.reset()`. Without a reset, when user B logs in on the same device after user A, PostHog's anonymous ID is shared and the next `identify()` can merge both accounts into one person.
- pass: every detected logout/account-switch flow calls `posthog.reset()`.
- error: a logout/account-switch flow is missing `posthog.reset()`.
- Skip (`pass` with details: "no logout/account-switch flow found"): no detectable logout/account-switch flow exists.
- note: `posthog.reset(true)` is valid when a completely clean device ID reset is required.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-reset-on-logout`, including `file` (path:line of the most relevant logout or reset site) and `details` (one-line explanation). Return when the call completes. Do not write the audit report.
```

### Task E — `identify-sequential-calls`

`description`: `Audit identify-sequential-calls`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: identify-sequential-calls.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

Background: a common identity-merge failure is two `posthog.identify()` calls firing back-to-back in the same auth flow with different first arguments — for example, `posthog.identify(authProviderUid)` followed by `posthog.identify(internalUserId)`. The first call stamps the auth provider id as the device identity. By the time the second call runs, the SDK considers the device already-identified, so the merge from the *anonymous* distinct id to `internalUserId` is blocked. The user is now split across two profiles: the anon profile correctly merged to `authProviderUid`, and `internalUserId` as a brand-new profile with no anonymous activity. This pattern has caused 30k+ blocked merges/day at multi-SDK SaaS customers.

Run **one** Grep: `posthog\.identify\(`. Read each file that contains a hit, once.

For each file, find pairs of `posthog.identify()` calls that:
1. Live in the same enclosing function, hook, effect, or auth-callback handler (close enough that they reliably execute in one flow), AND
2. Pass **different** first arguments (different variable names, different property accesses, or one literal and one variable).

Pay special attention to auth-callback handlers, login success handlers, and middleware/route guards. Treat one identify() call wrapped in an `if`/`else` branching on the same condition as a SINGLE logical call site (it can't fire twice in one flow); only flag pairs that are actually sequential on the same code path.

Rule:
- pass: every flow has at most one identify() call, OR all identify() calls in the same flow pass the same first argument.
- error: one or more flows have two or more identify() calls with different first arguments executing in sequence. List the file:line of each offender and the names of the two distinct ids.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-sequential-calls`, including `file` (path:line of the most representative offending pair) and `details` as compact JSON:

```
{
  "sequential_pair_count": <N>,
  "examples": [
    {"file": "<path:line>", "first_id": "<expression>", "second_id": "<expression>", "flow": "<short description>"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

## After all five return

Continue to **`3-identify-lifecycle.md`**. Do not write the report yet — that's Step 4's job after Step 3 finishes.
