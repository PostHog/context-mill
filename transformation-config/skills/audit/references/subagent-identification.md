# Subagent — 1.b Identification

You are the audit's **1.b Identification** subagent. Resolve `identify-stable-distinct-id`, `identify-not-late`, and `cross-runtime-distinct-id`. The ledger already has these three pending — only resolve them. Do not write the audit report.

**Do not call `ToolSearch`** — every tool you need (`Grep`, `Read`, `mcp__wizard-tools__audit_resolve_checks`) is already in scope. **Do not** browse for synonym tools.

## Action

Run **one** `Grep` with regex `posthog\.identify\(`. Then `Read` each file that contains a hit, **once**. No other scans.

## Rules to evaluate

1. **identify-stable-distinct-id** — distinct_id must be a stable identifier (auth user id, account id), not a session UUID, ephemeral cookie, or device-only id.
   - `pass`: sources from authenticated user (`session.user.id`, `auth.uid()`, etc.)
   - `error`: sources from a session, request, or device id that resets
   - `warning`: source unclear — flag for human review

2. **identify-not-late** — `identify()` must be called before any `posthog.capture` for that user, and before any feature-flag eval depending on user identity.
   - `pass`: identify runs at session start / right after login. Captures and flag evals come after.
   - `warning`: identify runs lazily (e.g. settings-page mount), so early captures and flag evals are anonymous.

3. **cross-runtime-distinct-id** — if both client and server runtimes call PostHog, the same distinct_id must be used on both sides for the same user.
   - `pass`: server-side init uses the client's distinct_id (cookie, session token, or explicit hand-off).
   - `error`: server-side captures use a different identifier scheme.
   - Skip (`pass` with `details: "single runtime"`): only one runtime initializes PostHog.

## Resolve

Single call to `mcp__wizard-tools__audit_resolve_checks` with all three updates. Each update should include `file` (path:line) and `details` (one-line explanation). Return when the resolve call completes.
