---
next_step: 4-report.md
---

# Step 3 — Event capture (optimize)

This step resolves three cost-optimization checks **in parallel**, one subagent per check:

- `event-usage-coverage`
- `events-pageview-defaults`
- `events-env-pollution`

All three are grounded in PostHog's [product analytics cutting-costs guide](https://posthog.com/docs/product-analytics/cutting-costs). Two of them require PostHog MCP access to query the operator's tenant. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure <signal>"`. Do not block the audit.

## Status

Emit before dispatching:

```
[STATUS] Auditing event capture cost optimization
```

## Action — dispatch three subagents in one message

Make **three `Task` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `4-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `cutting-costs.md` reference holds PostHog's authoritative cost-reduction guidance. It's typically at `.claude/skills/audit-events/references/cutting-costs.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-events/references/cutting-costs.md`. Each subagent reads it once before judging.

### Task A — `event-usage-coverage`

`description`: `Audit event-usage-coverage`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: event-usage-coverage.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-events/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-events/references/cutting-costs.md`).

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

### Task B — `events-pageview-defaults`

`description`: `Audit events-pageview-defaults`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: events-pageview-defaults.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-events/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-events/references/cutting-costs.md`). Focus on the pageview / pageleave section — PostHog automatically captures `$pageview` and `$pageleave` events on web. On high-traffic SPAs this can dominate event volume. Operators who don't actively use pageview funnels can disable these by setting `capture_pageview: false` and `capture_pageleave: false` in the init config, and capture only the pageviews they need manually.

Step 1 — codebase pass:
Run **two** Greps in parallel:
- `capture_pageview|capture_pageleave` — explicit overrides in init config.
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(` — init call sites, so you can read the surrounding config object even when these keys are absent.

Read each file that contains a hit, once. Record:
- Whether `capture_pageview` is set, and to what value. If unset, the default is `true` for posthog-js (browser captures `$pageview` automatically).
- Whether `capture_pageleave` is set, and to what value. Default is `true` for posthog-js.
- Whether the project looks like a high-traffic SPA (React Router / Next.js client routes / Vue Router / SvelteKit / TanStack Router are good signals).
- The init file:line where these defaults are (or could be) set.

Step 2 — MCP pass (skip if MCP unavailable):
Call `mcp__posthog__execute-sql` with this query to measure pageview volume:

```sql
SELECT
  event,
  count() AS n
FROM events
WHERE event IN ('$pageview', '$pageleave')
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY event
```

Also fetch total event volume for the same window so you can compute the pageview share of total events:

```sql
SELECT count() AS total
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
```

Compute `pageview_share_pct = pageview_n / total * 100`.

Rule:
- pass: project is server-only (no browser init detected), OR `capture_pageview: false` is explicitly set, OR pageview_share_pct < 30.
- suggestion: pageview defaults are on (unset or `true`) AND pageview_share_pct is between 30 and 60 — meaningful share of event volume. Recommend evaluating whether automatic pageviews are actually used in insights / funnels.
- warning: pageview defaults are on AND pageview_share_pct >= 60 — pageviews dominate ingestion. Strongly recommend disabling automatic capture and instrumenting only the views the operator actually queries.
- suggestion: MCP unavailable — recommend the operator check pageview share manually.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `events-pageview-defaults`, including `file` (path:line of the init that sets or should set the pageview keys) and `details` as compact JSON:

```
{
  "capture_pageview_setting": "true | false | unset",
  "capture_pageleave_setting": "true | false | unset",
  "pageview_share_pct": <0-100 or null>,
  "recommendation": "keep | disable-pageview-defaults | review-manually",
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `events-env-pollution`

`description`: `Audit events-env-pollution`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: events-env-pollution.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure environment pollution"`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-events/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-events/references/cutting-costs.md`). Dev/staging events leaking into the production project inflate event volume, pollute funnels, and skew dashboards. They typically come from local dev environments where the prod token was used, or from preview / staging deploys that share the same project key.

Procedure:
1. Pick a **high-signal event** to break down. Prefer a frequent event with high coverage across runtimes. Good candidates in order:
   - `$pageview` (web-only)
   - `$autocapture` (web-only)
   - any custom event captured everywhere (run a quick `posthog\.capture\(` Grep + an MCP count to pick the highest-volume custom event)
2. Call `mcp__posthog__execute-sql` to break down that event by environment-signal properties over the last 7 days:

```sql
SELECT
  properties.$lib AS lib,
  properties.$current_url AS current_url,
  properties.$app_version AS app_version,
  count() AS n
FROM events
WHERE event = '<chosen_event>'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY lib, current_url, app_version
ORDER BY n DESC
LIMIT 50
```

3. Inspect the breakdown for environment leakage signals:
   - `current_url` values whose hostnames look like `localhost`, `127.0.0.1`, `*.local`, `*.ngrok.io`, `*.vercel.app` preview URLs, `staging.*`, `dev.*`, `qa.*`, `test.*` showing up alongside production hosts.
   - `app_version` values like `0.0.0-dev`, `dev`, `local`, `unreleased`, or version strings that obviously precede the current production release.
   - `$lib` values that mismatch the project's known runtime mix (e.g. a Python lib appearing in a JS-only project — possibly a misrouted server-side capture).
4. Compute `polluting_share_pct` — the percentage of events on the chosen event that come from non-production environments (sum of polluting rows / total).

Rule:
- pass: no detectable non-production traffic, OR polluting_share_pct < 2.
- suggestion: polluting_share_pct between 2 and 10 — some leakage. Recommend gating PostHog init on a production environment check (`NODE_ENV === 'production'` / framework equivalent) and / or using a separate project key for dev / staging.
- warning: polluting_share_pct >= 10 — material env pollution. Strongly recommend gating init on prod and switching dev / staging to a separate project.
- suggestion: MCP unavailable.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `events-env-pollution`, with `file` left blank (this finding is tenant-side, not tied to a specific code site), and `details` as compact JSON:

```
{
  "chosen_event": "<event>",
  "polluting_share_pct": <0-100 or null>,
  "top_polluting_hosts": ["<host>", ...],
  "top_polluting_app_versions": ["<version>", ...],
  "top_polluting_libs": ["<lib>", ...],
  "recommendation": "keep | gate-init-on-prod | use-separate-project-keys | review-manually",
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

## After all three return

Continue to **`4-report.md`**.
