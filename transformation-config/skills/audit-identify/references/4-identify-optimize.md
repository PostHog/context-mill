---
next_step: 5-report.md
---

# Step 4 — Identify (optimize)

This step resolves four cost-optimization checks **in parallel**, one subagent per check:

- `identify-person-profiles-mode`
- `identify-isidentified-guard`
- `identify-duplicate-identify-per-session`
- `identify-duplicate-groupidentify-per-session`

All four are grounded in PostHog's [product analytics cutting-costs guide](https://posthog.com/docs/product-analytics/cutting-costs). Three of them require PostHog MCP access to query the operator's tenant. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure <signal>"`. Do not block the audit.

## Status

Emit before dispatching:

```
[STATUS] Auditing identify cost optimization
```

## Action — dispatch four subagents in one message

Make **four `Task` tool calls in a single message** so they run concurrently. Wait for all four to return, then continue to `5-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `cutting-costs.md` reference holds PostHog's authoritative cost-reduction guidance. It's typically at `.claude/skills/audit-identify/references/cutting-costs.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-identify/references/cutting-costs.md`. Each subagent reads it once before judging.

### Task A — `identify-person-profiles-mode`

`description`: `Audit identify-person-profiles-mode`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-person-profiles-mode.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-identify/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/cutting-costs.md`). Focus on the `person_profiles` section — anonymous events are roughly 4x cheaper than identified events, so `'identified_only'` is the right default when most traffic is anonymous, and `'always'` is only justified when nearly all traffic is identified.

Step 1 — codebase pass:
Run **one** Grep: `person_profiles`. Read each file that contains a hit, once. Record:
- Whether `person_profiles` is set anywhere in the init config, and to what value (`'always'`, `'identified_only'`, `'never'`, or unset).
- The init file:line where it's set (or where init lives if unset; default is `'identified_only'` for posthog-js).

Step 2 — MCP pass (skip if MCP unavailable):
Call `mcp__posthog__execute-sql` with this query (adjust column names if the project's schema differs):

```sql
SELECT
  countIf(person_id IS NOT NULL) AS identified_count,
  countIf(person_id IS NULL) AS anon_count,
  count() AS total
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
```

Compute `anon_pct = anon_count / total * 100` and `identified_pct = identified_count / total * 100`.

Rule:
- pass: configuration matches traffic shape:
  - `person_profiles: 'always'` AND identified_pct >= 90, OR
  - `person_profiles: 'identified_only'` (or unset, defaulting to identified_only) AND anon_pct > 10
- suggestion: `person_profiles: 'always'` is set but anon_pct > 25 — switching to `'identified_only'` likely cuts event-pricing meaningfully. Quote the actual ratio in details.
- suggestion: `person_profiles: 'identified_only'` is set but identified_pct >= 99 — already optimal, but worth noting that any future anon traffic will not create person profiles (this is usually desired; mark pass unless project context suggests otherwise).
- suggestion: MCP unavailable — recommend the operator check the ratio manually.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-person-profiles-mode`, including `file` (path:line of the init that sets or should set person_profiles) and `details` as compact JSON:

```
{
  "person_profiles_setting": "always | identified_only | never | unset",
  "anon_pct": <0-100 or null>,
  "identified_pct": <0-100 or null>,
  "recommendation": "keep | switch-to-identified-only | switch-to-always | review-manually",
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `identify-isidentified-guard`

`description`: `Audit identify-isidentified-guard`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-isidentified-guard.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-identify/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/cutting-costs.md`). Focus on the section that recommends guarding `identify()` with `_isIdentified()` to avoid emitting a `$identify` event on every page load / re-render.

Run **two** Greps in parallel:
- `posthog\.identify\(` — every identify call site.
- `_isIdentified\(|isIdentified\(` — any guard usage.

Read each file that contains a `posthog.identify(` hit, once. For each identify call, determine whether it is guarded by an `_isIdentified()` check in its enclosing function, hook, or effect.

Rule:
- pass: every identify call is either guarded by `_isIdentified()` OR is in a code path that naturally runs once per session (e.g. login success handler, not a render-on-mount effect).
- suggestion: one or more identify calls are in render-on-mount paths (React `useEffect` with empty deps that runs every mount, Vue `onMounted`, etc.) without a `_isIdentified()` guard. Each unguarded call risks one extra `$identify` event per page navigation.
- warning: identify is called unconditionally inside a render body or a high-frequency interval / event handler.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-isidentified-guard`, including `file` (path:line of the most relevant unguarded identify call) and `details` as compact JSON:

```
{
  "identify_call_count": <N>,
  "unguarded_count": <N>,
  "examples": [
    {"file": "<path:line>", "context": "<one-line description of the enclosing scope>"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `identify-duplicate-identify-per-session`

`description`: `Audit identify-duplicate-identify-per-session`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-duplicate-identify-per-session.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure duplicate $identify events"`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-identify/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/cutting-costs.md`).

Call `mcp__posthog__execute-sql` with:

```sql
SELECT
  countIf(per_session_count > 1) AS sessions_with_duplicates,
  count() AS total_sessions_with_identify,
  avgIf(per_session_count, per_session_count > 1) AS avg_duplicates_in_duplicated_sessions,
  max(per_session_count) AS max_per_session
FROM (
  SELECT $session_id, count() AS per_session_count
  FROM events
  WHERE event = '$identify'
    AND timestamp > now() - INTERVAL 7 DAY
    AND $session_id IS NOT NULL
  GROUP BY $session_id
)
```

Also fetch the top offenders for the report:

```sql
SELECT $session_id, count() AS n
FROM events
WHERE event = '$identify'
  AND timestamp > now() - INTERVAL 7 DAY
  AND $session_id IS NOT NULL
GROUP BY $session_id
HAVING n > 1
ORDER BY n DESC
LIMIT 10
```

Compute `duplicate_session_pct = sessions_with_duplicates / total_sessions_with_identify * 100`.

Rule:
- pass: duplicate_session_pct < 5 (some duplicates are inevitable across genuine multi-device sessions).
- suggestion: duplicate_session_pct between 5 and 25 — meaningful room for improvement. Recommend guarding identify with `_isIdentified()`.
- warning: duplicate_session_pct >= 25 OR max_per_session >= 20 — identify is firing many times per session, likely on every page load. Strongly recommend `_isIdentified()` guard.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-duplicate-identify-per-session`, with `file` left blank (this finding is not tied to a single code site — the codebase pattern is captured by `identify-isidentified-guard`), and `details` as compact JSON:

```
{
  "duplicate_session_pct": <0-100 or null>,
  "sessions_with_duplicates": <N>,
  "total_sessions_with_identify": <N>,
  "max_per_session": <N>,
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task D — `identify-duplicate-groupidentify-per-session`

`description`: `Audit identify-duplicate-groupidentify-per-session`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-duplicate-groupidentify-per-session.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure duplicate $groupidentify events"`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-identify/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/cutting-costs.md`). The PostHog docs include the canonical SQL for this check.

First, verify the project actually uses groups. Run **one** Grep on the codebase: `posthog\.group\(|posthog\.groupIdentify\(|\$groupidentify`. If no matches AND a quick MCP probe returns zero `$groupidentify` events in the last 7 days, resolve `pass` with `details: "skip: project does not use group analytics"` and return.

Otherwise, call `mcp__posthog__execute-sql` with:

```sql
SELECT
  properties.$lib AS lib,
  countIf(per_session_count > 1) AS sessions_with_duplicates,
  count() AS total_sessions_with_groupidentify,
  avgIf(per_session_count, per_session_count > 1) AS avg_duplicates_in_duplicated_sessions,
  max(per_session_count) AS max_per_session
FROM (
  SELECT $session_id, properties.$lib AS lib, count() AS per_session_count
  FROM events
  WHERE event = '$groupidentify'
    AND timestamp > now() - INTERVAL 7 DAY
    AND $session_id IS NOT NULL
  GROUP BY $session_id, properties.$lib
)
GROUP BY lib
ORDER BY sessions_with_duplicates DESC
```

Compute `duplicate_session_pct = sessions_with_duplicates / total_sessions_with_groupidentify * 100` per `lib`. Group analytics events are billed the same as regular events but are typically not needed more than once per group per session.

Rule:
- pass: duplicate_session_pct < 10 across all libs.
- suggestion: duplicate_session_pct between 10 and 30 in any lib — likely room to deduplicate. Recommend calling `groupIdentify` only when group properties actually change.
- warning: duplicate_session_pct >= 30 OR max_per_session >= 20 in any lib — groupIdentify is firing on every page load or every capture. Strongly recommend conditional calling.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-duplicate-groupidentify-per-session`, with `file` left blank, and `details` as compact JSON:

```
{
  "by_lib": [
    {"lib": "<name>", "duplicate_session_pct": <0-100>, "sessions_with_duplicates": <N>, "max_per_session": <N>}
  ],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

## After all four return

Continue to **`5-report.md`**.
