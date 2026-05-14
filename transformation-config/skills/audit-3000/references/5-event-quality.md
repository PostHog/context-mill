---
next_step: 6-feature-flags.md
---

# Step 5 — Event quality

Step 4 confirmed that capture **call sites** are technically correct (static names, proxy, growth coverage). This step takes the next view up: **across all captures**, are the events themselves *high-quality*? Naming consistency, duplication, bloat, and actual downstream usage in PostHog. The goal is a report that tells the operator what to fix or rename, not a unilateral cleanup — every finding is documented in the report, nothing is auto-renamed.

The bundled [`best-practices.md`](best-practices.md) reference (PostHog's [Product analytics best practices](https://posthog.com/docs/product-analytics/best-practices.md)) is the canonical source for what "good" looks like. Each subagent reads it once before judging.

This step resolves four checks **in parallel**, one subagent per check:

- `event-naming-standardization`
- `event-duplicates-and-bloat`
- `event-usage-coverage` _(requires PostHog MCP access; gracefully skips otherwise)_
- `event-quality-context-review` _(open-ended; AI flags anything notable in this specific codebase)_

The first three are rule-based. The fourth is intentionally open-ended — different customers ship under different constraints (mobile-first, server-first, regulated industries, legacy taxonomies they cannot rewrite), so this subagent reads the codebase and flags only what's actually present and material. It does **not** invent findings to fill a checklist.

## Status

Emit before dispatching:

```
[STATUS] Auditing event quality
```

## Action — dispatch four subagents in one message

Make **four `Task` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `6-feature-flags.md`. Do not run any other tools between dispatch and the next step.

The bundled `best-practices.md` reference is typically at `.claude/skills/audit-3000/references/best-practices.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-3000/references/best-practices.md`. Each subagent reads it once before judging.

### Task A — `event-naming-standardization`

`description`: `Audit event-naming-standardization`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: event-naming-standardization.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-3000/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/best-practices.md`). Pay attention to PostHog's recommended event-naming convention (snake_case, `noun_verb` shape, descriptive over generic).

Run **one** Grep: `posthog\.capture\(` (and any framework-specific variants the project uses, e.g. `capture(` in React Native, `analytics.capture(` in wrapper utils). Read each file that contains a hit, once. Collect every static event name passed to `capture()`.

Procedure:
1. **Detect the project's current convention.** From the collected names, infer the dominant pattern: snake_case / camelCase / PascalCase / kebab-case / "verb_object" / "object_verb" / mixed / no convention. If 80%+ of names share a pattern, the project HAS a convention. Otherwise treat as "no convention".
2. **Score compliance.** Compute the % of event names that fit the dominant convention. Compute a second % for compliance with PostHog's recommended convention (snake_case, descriptive `noun_verb` shape).
3. **Pick a recommendation:**
   - If the project's convention is at least *somewhat compliant* with PostHog's (e.g. uses snake_case with object_verb instead of noun_verb) AND compliance with their own convention is ≥80%, recommend **sticking with their convention** and tightening to 100%. Don't force a migration.
   - If their convention is incompatible with PostHog's (e.g. PascalCase, mixed shapes, no convention) OR their own compliance is <80%, recommend **migrating toward PostHog's standard**.
4. **Pick 2–3 concrete bad examples** from the collected names that don't fit the chosen target standard, and show what the renamed version would look like. Use real names from this codebase; do not invent.

Rule:
- pass: project has a convention AND their own compliance is 100% AND it's at least partially aligned with PostHog best practice. No action needed.
- suggestion: project has a convention but compliance is 80–99%, OR the convention diverges from PostHog standard in a recoverable way. Recommend the path you picked above.
- warning: no detectable convention, OR own-compliance <80%, OR multiple incompatible conventions in the same codebase.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `event-naming-standardization`, with `file` set to a representative capture site path:line and `details` as a compact JSON object:

```
{
  "detected_convention": "snake_case_noun_verb | camelCase | mixed | none | ...",
  "own_compliance_pct": <0-100>,
  "posthog_compliance_pct": <0-100>,
  "recommendation": "stick-and-tighten | migrate-to-posthog | adopt-a-convention",
  "bad_examples": [
    {"current": "<name>", "suggested": "<rewrite>", "file": "<path:line>"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `event-duplicates-and-bloat`

`description`: `Audit event-duplicates-and-bloat`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: event-duplicates-and-bloat.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-3000/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/best-practices.md`).

Run **one** Grep: `posthog\.capture\(`. Read each file that contains a hit, once. For each capture call, record: event name, file:line, property keys passed (the object shape, not values).

Find three kinds of issues:

1. **Exact-name duplicates fired from multiple sites with divergent property shapes.** The same event captured from two+ places with different property keys suggests one site was added without checking the other — analytics consumers can't trust the contract.
2. **Semantic duplicates** — distinct names that almost certainly mean the same thing: `signup_completed` vs `user_signed_up`, `checkout_started` vs `begin_checkout`, `video_played` vs `play_video`. Use fuzzy matching on the lemma (verb + object) — don't over-report (skip when one event obviously fires *before* the other in a multi-step flow).
3. **Bloat / kitchen-sink events** — capture calls passing 15+ property keys, or props that look like dumped JSON blobs (`metadata`, `payload`, `data`, `context` with nested objects). PostHog event properties should be flat and intentional; "kitchen-sink" events hurt query performance and signal poor instrumentation.

Rule:
- pass: no exact-name conflicts, no semantic duplicates, no bloat events found.
- warning: any of the three issues found. List them.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `event-duplicates-and-bloat`, with `file` set to the most representative finding's path:line and `details` as compact JSON:

```
{
  "exact_duplicates": [
    {"event": "<name>", "sites": ["<path:line>", "<path:line>"], "property_diff": "<one-line summary>"}
  ],
  "semantic_duplicates": [
    {"events": ["<name_a>", "<name_b>"], "files": ["<path:line>", "<path:line>"]}
  ],
  "bloat_events": [
    {"event": "<name>", "property_count": <N>, "file": "<path:line>"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `event-usage-coverage`

`description`: `Audit event-usage-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: event-usage-coverage.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-3000/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/best-practices.md`).

This check needs PostHog MCP access to query the operator's tenant. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure event usage in tenant"`. Do not block the audit.

Procedure:
1. Run **one** Grep: `posthog\.capture\(`. Collect every distinct static event name passed to `capture()` from the project source.
2. Call **`posthog:execute-sql`** with a query that joins event names captured in code against PostHog metadata. Specifically check whether each event is referenced by:
   - `system.insights` (saved insights) — search `query::TEXT ILIKE '%<event>%'`
   - `system.dashboards` (via insight membership)
   - `system.cohorts` — `filters::TEXT ILIKE '%<event>%'`
   - `system.experiments` — exposure or metric events
   - Actions and destinations: check `event-definition` and `cdp-functions` MCP tools for references
3. Classify each captured event:
   - **`used`** — referenced by at least one of the above.
   - **`captured-only`** — captured in code but no PostHog artifact uses it (potential dead instrumentation, billing noise).
   - **`heavily-used`** — referenced in ≥5 artifacts (these are important; flag any breaking changes here).

Use a single SQL pass when possible — one query with ILIKE OR-conditions covering all the event names — rather than N queries.

Rule:
- pass: all captured events are at least lightly used, OR captured-only events are 0.
- warning: some events captured in code are not referenced anywhere downstream (`captured-only` is non-empty). List them — the operator may want to delete those capture sites OR start using the data.
- suggestion: MCP unavailable.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `event-usage-coverage`, with `file` set to the most representative captured-only event's path:line if any, and `details` as compact JSON:

```
{
  "captured_count": <N>,
  "captured_only": ["<event>", ...],
  "heavily_used": ["<event>", ...],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task D — `event-quality-context-review`

`description`: `Audit event-quality-context-review`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: event-quality-context-review.

This check is intentionally open-ended. Different projects have different constraints — some can't change their taxonomy, some operate under regulatory restrictions, some are server-only with no browser captures, etc. Your job is to read THIS codebase's capture calls and flag what's notable for this specific project, not to fill a checklist with invented findings.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-3000/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-3000/references/best-practices.md`).

Run **one** Grep: `posthog\.capture\(`. Read each file that contains a hit, once. Look across the captures for the following classes of issues, but only report those that are actually present:

- **PII in event properties** — property keys named `email`, `phone`, `ssn`, `password`, `address`, or full names passed as property values. PostHog recommends keeping PII out of events (use person properties on `identify()` instead, where access controls apply).
- **High-cardinality properties** — properties that look unique per request (`request_id`, `trace_id`, `timestamp` as ISO string, `uuid`). High-cardinality props pollute breakdowns and inflate ingestion.
- **`$set` / `$set_once` on every capture** — setting person properties on every event capture inflates person-property version count. Recommend setting once on `identify()` or only when the value actually changes.
- **JSON.stringify'd property values** — `{ payload: JSON.stringify(obj) }`. PostHog properties should be flat and queryable, not opaque strings.
- **Captures in hot paths** — `capture` inside React `useEffect` without dependency arrays, inside render loops, inside high-frequency interval callbacks, on every scroll/mousemove without throttling.
- **Test/staging events in production builds** — event names with `test_`, `staging_`, emoji, debug-y wording, profanity, that look like instrumentation never meant to ship.
- **Missing `$session_id`** on key conversion events in projects where it's expected (web with `posthog-js`).
- **Anything else specific to this codebase** that violates PostHog's best practices and that the operator would benefit from knowing — but only when materially present, with `file:line` evidence.

If you find **nothing** notable, that is a valid outcome — resolve as `pass` with `details: "No quality issues identified for this codebase."` Do not invent issues to fill the slot.

Rule:
- pass: no material issues found.
- suggestion: one or more findings of the "minor improvement" variety — high-cardinality props, `$set` on every capture, missing `$session_id`, etc.
- warning: one or more findings that are likely contaminating downstream data — PII leakage, hot-path captures, test events in prod, JSON-stringified payloads.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `event-quality-context-review`, with `file` set to the most material finding's path:line if any, and `details` as a compact JSON list:

```
{
  "findings": [
    {"category": "pii | cardinality | set-bloat | json-stringify | hot-path | test-leak | missing-session-id | other", "event_or_property": "<name>", "file": "<path:line>", "note": "<one-line specific to this codebase>"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

## After all four return

Continue to **`6-feature-flags.md`**. Do not write the report yet — that's Step 7's job after Step 6 finishes.
