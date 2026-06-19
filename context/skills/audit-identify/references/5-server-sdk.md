---
next_step: 6-report.md
---

# Step 5 — Server SDK identity hygiene

This step resolves three server-side identity checks **in parallel**, one subagent per check:

- `server-process-person-profile`
- `server-sdk-flush-on-exit`
- `server-set-without-identify`

These cover failure patterns that are invisible in client-only audits but cause silent data corruption and event loss at scale: backend events overwriting client-set person properties (e.g. `$os` → `"Linux"` on 24% of profiles), serverless / edge / worker processes terminating before the SDK flushes, and `$set` properties firing from server captures with no canonical `identify()` to anchor them.

## Skip case — no server SDK init detected

If Step 1's init grep returned hits only for browser-runtime locations (no `posthog-node`, `posthog-python`, `posthog-ruby`, `posthog-go`, `posthog-php`, `posthog-java`, etc. imports; no server-only init), resolve all three checks in a single `audit_resolve_checks` call with `status: "pass"` and `details: "skip: no server-side SDK init detected"`. Then continue to **`6-report.md`**. Do not dispatch subagents.

## Status

Emit before dispatching:

```
[STATUS] Auditing server-side identity hygiene
```

## Action — dispatch three subagents in one message

Make **three `Agent` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `6-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `anonymous-vs-identified-events.md` reference holds PostHog's authoritative guidance on `$process_person_profile`, person-mode selection, and when person processing should be disabled. It's typically at `.claude/skills/audit-identify/references/anonymous-vs-identified-events.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-identify/references/anonymous-vs-identified-events.md`. Each subagent reads it once before judging.

### Task A — `server-process-person-profile`

`description`: `Audit server-process-person-profile`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: server-process-person-profile.

Read this skill's bundled `anonymous-vs-identified-events.md` reference once (typically `.claude/skills/audit-identify/references/anonymous-vs-identified-events.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/anonymous-vs-identified-events.md`).

Background: posthog-node, posthog-python, and other backend SDKs default to processing person profiles on every `capture()` call. The SDK auto-attaches runtime metadata (`$os`, `$lib`, `$lib_version`, etc.) that overwrites whatever the client SDK previously set on the same person. The canonical failure pattern: a backend captures `subscription_upgraded` from a Linux server; the user's profile gets `$os = "Linux"` even though they're a macOS user, because the server SDK's `$os` overrode the client's. The fix is to set `$process_person_profile: false` on backend events that aren't supposed to update person properties (most server-side capture calls fit this).

Run **two** Greps in parallel:
- `posthog\.capture\(|posthog\.Capture\(|new PostHog\(.+\.capture` — every server-side capture call site. Filter to files that are server-side (Node/Python/Go/Java/Ruby/PHP) — exclude browser files.
- `\$process_person_profile|process_person_profile|processPersonProfile` — explicit usage of the property anywhere.

Read each file that contains a server-side `capture(` hit, once. For each server-side capture, determine whether:
- The capture is intended to update person properties (it should follow a corresponding `identify()` and pass `$set` / `$set_once`), OR
- The capture is a transactional/business event that shouldn't touch person properties (most cases — `subscription_upgraded`, `webhook_received`, `cron_job_completed`).

For the second category, check whether `$process_person_profile: false` is set in the properties object.

Rule:
- pass: every server-side capture either passes `$process_person_profile: false` OR is paired with an explicit identify()/$set in the same flow (intentional person-property update).
- suggestion: 1–3 server-side captures lack `$process_person_profile: false` and don't appear to update person properties intentionally — recommend adding the flag to prevent silent property corruption.
- warning: 4+ server-side captures or any high-frequency server-side capture (cron, webhook, polling loop) without `$process_person_profile: false` — high blast radius for property corruption.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `server-process-person-profile`, including `file` (path:line of the most representative offending capture) and `details` as compact JSON:

```
{
  "server_capture_call_count": <N>,
  "captures_without_flag_count": <N>,
  "examples": [
    {"file": "<path:line>", "event": "<event name>", "issue": "missing-flag-on-business-event | missing-flag-on-hot-path"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

### Task B — `server-sdk-flush-on-exit`

`description`: `Audit server-sdk-flush-on-exit`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: server-sdk-flush-on-exit.

Background: posthog-node, posthog-python, and posthog-ruby buffer events in memory and flush asynchronously. In long-running servers this is fine — the buffer drains during operation. In serverless functions (AWS Lambda, Vercel Functions, Cloudflare Workers), edge handlers, and background workers (Celery, Sidekiq, BullMQ, RQ), the process can terminate before the buffer drains. Events captured in the last few milliseconds before exit are silently lost. The fix is to call `posthog.shutdown()` (Node, Python) or `await posthog.flush()` before the handler returns or the worker exits.

Run **three** Greps in parallel:
- `posthog\.shutdown\(|posthog\.Shutdown\(|posthog\.flush\(|await posthog\.flush|posthog\.disable\(` — explicit flush/shutdown calls.
- `posthog\.capture\(|posthog\.Capture\(` — every server-side capture call site.
- `exports\.handler|export\s+(default\s+)?(async\s+)?function\s+handler|app/api/.*/route\.(ts|js)|runtime\s*=\s*['"]edge['"]|celery|sidekiq|bullmq|defineEventHandler|onRequest|export\s+(const|let|var)\s+config\s*=\s*\{[^}]*runtime` — short-lived runtime signals.

Read each file that contains both a short-lived signal AND a server-side capture, once. Determine whether the handler / worker function calls `posthog.shutdown()` or awaits `posthog.flush()` before returning.

Rule:
- pass: no short-lived server-side capture sites detected, OR every short-lived capture site flushes/shutdowns before exit.
- pass with details "skip: long-running server only": only persistent-server captures detected (Express middleware, Django views, etc.).
- warning: 1–2 short-lived capture sites without flush/shutdown — events captured in the last milliseconds before exit will be silently lost.
- error: 3+ short-lived capture sites without flush/shutdown, OR any capture inside a background worker (Celery, Sidekiq, BullMQ, RQ) without flush — high event-loss risk. One customer lost a measurable share of subscription events to this pattern in Celery workers.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `server-sdk-flush-on-exit`, including `file` (path:line of the most representative un-flushed handler) and `details` as compact JSON:

```
{
  "short_lived_capture_site_count": <N>,
  "unflushed_site_count": <N>,
  "examples": [
    {"file": "<path:line>", "runtime": "lambda | vercel-function | edge | worker | cron", "issue": "missing-shutdown | missing-flush-await"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

### Task C — `server-set-without-identify`

`description`: `Audit server-set-without-identify`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: server-set-without-identify.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`).

Background: a backend `posthog.capture()` with `$set` / `$set_once` properties on a user-scoped distinct_id makes that person *appear* identified in PostHog — the profile shows the properties — but no canonical `$identify` event fired and no anonymous → identified merge happened. Anonymous activity from that user's earlier sessions stays orphaned. The fix is either to call `posthog.identify(userId, properties)` (which fires the canonical merge event) instead of `posthog.capture(event, { $set: ... })`, or to ensure a prior `posthog.identify()` call from the client SDK preceded this capture for the same distinct_id.

Run **two** Greps in parallel:
- `posthog\.capture\(|posthog\.Capture\(` — every server-side capture call site.
- `posthog\.identify\(|posthog\.Identify\(` — every server-side identify call site.

Read each file that contains a server-side capture, once. For each capture whose properties include `$set`, `$set_once`, `setPersonProperties`, or `setOnce`:
- Is there a `posthog.identify()` call in the same file (or imported module) using the same distinct_id?
- Is the capture's distinct_id sourced from a server-known user record (a stable user id) rather than a request-scoped anonymous id?

If the project uses ONLY server-side captures (no client SDK detected in Step 1), the canonical identify must come from the server — flag every server $set-without-identify as a problem.

If the project also has a client SDK, the canonical identify can come from the client; the server-side $set is fine as long as the same distinct_id is used and the client has identified that user at least once.

Rule:
- pass: no server-side captures include `$set` / `$set_once`, OR every server-side `$set` capture is preceded by a server-side `identify()` for the same distinct_id, OR the client SDK identifies the same distinct_id elsewhere in the codebase.
- warning: 1–2 server-side `$set` captures with no server `identify()` AND no obvious client-side identify covering the same distinct_id. Person properties will be set but no merge happens.
- error: 3+ server-side `$set` captures with no `identify()` anywhere in the project — every affected user has an orphan profile.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `server-set-without-identify`, including `file` (path:line of the most representative offending capture) and `details` as compact JSON:

```
{
  "server_set_capture_count": <N>,
  "uncovered_count": <N>,
  "examples": [
    {"file": "<path:line>", "event": "<event name>", "issue": "set-without-server-identify | set-without-any-identify"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

## After all three return

Continue to **`6-report.md`**.
