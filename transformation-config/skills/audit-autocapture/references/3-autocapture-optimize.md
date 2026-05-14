---
next_step: 4-report.md
---

# Step 3 — Autocapture (optimize)

This step resolves three cost-optimization checks **in parallel**, one subagent per check:

- `autocapture-ratio-to-custom`
- `autocapture-copied-text`
- `autocapture-dead-clicks-vs-heatmap`

Two of them require PostHog MCP access to query the operator's tenant. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure <signal>"`. Do not block the audit.

## Status

Emit before dispatching:

```
[STATUS] Auditing autocapture cost optimization
```

## Action — dispatch three subagents in one message

Make **three `Task` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `4-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `cutting-costs.md` reference holds PostHog's authoritative cost-reduction guidance. It's typically at `.claude/skills/audit-autocapture/references/cutting-costs.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-autocapture/references/cutting-costs.md`. Each subagent reads it once before judging.

### Task A — `autocapture-ratio-to-custom`

`description`: `Audit autocapture-ratio-to-custom`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-ratio-to-custom.

This check requires PostHog MCP access. If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion` and `details: "PostHog MCP unavailable — could not measure $autocapture ratio"`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-autocapture/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/cutting-costs.md`). Focus on the "Configure autocapture" section — when `$autocapture` dominates event volume and few high-value custom events exist, the project is paying for noisy click data instead of meaningful product signals.

Call `mcp__posthog__execute-sql` with:

```sql
SELECT
  countIf(event = '$autocapture') AS autocapture_count,
  countIf(event NOT IN ('$autocapture', '$pageview', '$pageleave', '$identify', '$groupidentify', '$feature_flag_called', '$rageclick', '$dead_click', '$web_vitals', '$exception', '$snapshot')) AS custom_event_count,
  count() AS total
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
```

Compute `autocapture_pct = autocapture_count / total * 100` and `custom_pct = custom_event_count / total * 100`.

Rule:
- pass: autocapture_pct < 60 OR custom_event_count > 0 AND custom_pct >= 10 — the project has a healthy mix.
- suggestion: autocapture_pct >= 60 AND custom_pct < 5 — `$autocapture` dominates with few custom events. Recommend defining custom events for high-value flows (signup, purchase, key feature use) to enable richer funnels and reduce dependence on autocapture inference.
- warning: autocapture_pct >= 80 AND custom_event_count = 0 — the project is paying entirely for autocapture noise. Strongly recommend custom events for the top 3-5 user-value flows.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-ratio-to-custom`, with `file` left blank (this finding is not tied to a code site), and `details` as compact JSON:

```
{
  "autocapture_pct": <0-100 or null>,
  "custom_pct": <0-100 or null>,
  "autocapture_count": <N or null>,
  "custom_event_count": <N or null>,
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `autocapture-copied-text`

`description`: `Audit autocapture-copied-text`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-copied-text.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-autocapture/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/cutting-costs.md`). `capture_copied_text: true` emits a `$copy_autocapture` event every time a user copies or cuts text. On a high-traffic site this can balloon event volume without delivering proportional product insight.

Run **one** Grep: `capture_copied_text`. Read each file that contains a hit, once.

Also Glob route files to estimate traffic surface:
- `**/{app,pages,routes,src/routes,src/pages}/**/*.{js,jsx,ts,tsx,vue,svelte}` — count matches. A project with **5+ route/page files** is "high-traffic-looking".

Rule:
- pass: `capture_copied_text` is unset OR set to `false`, OR the project is not high-traffic-looking.
- suggestion: `capture_copied_text: true` is set AND the project is high-traffic-looking (5+ route files) — every copy event is billed. Recommend disabling unless there is a documented analytics use case for clipboard data.
- warning: `capture_copied_text: true` is set AND the project has 20+ route files — likely large event-volume cost with minimal value.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-copied-text`, with `file` set to the path:line of the `capture_copied_text` setting if found (else blank), and `details` as compact JSON:

```
{
  "capture_copied_text_setting": "true | false | unset",
  "route_file_count": <N>,
  "recommendation": "keep | disable"
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `autocapture-dead-clicks-vs-heatmap`

`description`: `Audit autocapture-dead-clicks-vs-heatmap`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-dead-clicks-vs-heatmap.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/audit-autocapture/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/cutting-costs.md`). Focus on the autocapture section. Per PostHog docs, "The PostHog heatmap captures dead clicks for free, collecting only the coordinates of dead clicks to display in heatmaps. Enabling the autocapture of dead clicks here allows for deeper analysis and is priced as a standard product analytics event." If heatmap coordinates are enough for the operator, `capture_dead_clicks: true` is paying twice.

Step 1 — codebase pass:
Run **one** Grep: `capture_dead_clicks`. Read each file that contains a hit, once. Record whether it's set to `true`, `false`, or unset.

Step 2 — MCP pass (skip if MCP unavailable):
Call `mcp__posthog__execute-sql` with:

```sql
SELECT
  countIf(event = '$dead_click') AS dead_click_count,
  countIf(event = '$rageclick') AS rageclick_count,
  count() AS total
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
  AND event IN ('$dead_click', '$rageclick')
```

If MCP fails, set `mcp_skipped: true` in details but still resolve based on the codebase signal.

Rule:
- pass: `capture_dead_clicks` is unset OR `false`.
- suggestion: `capture_dead_clicks: true` is set AND dead_click_count > 0 — heatmaps already capture dead-click coordinates for free; consider disabling the autocapture event unless deeper per-event analysis is needed. Quote the 7-day count in details.
- suggestion: `capture_dead_clicks: true` is set AND MCP unavailable — recommend the operator confirm they need full event-level dead-click data rather than heatmap coordinates.
- warning: `capture_dead_clicks: true` is set AND dead_click_count > rageclick_count * 10 — the project is paying for a high volume of dead-click events but very few rage-clicks (which are usually the actionable signal). Strong candidate for disabling.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-dead-clicks-vs-heatmap`, with `file` set to the path:line of the `capture_dead_clicks` setting if found (else blank), and `details` as compact JSON:

```
{
  "capture_dead_clicks_setting": "true | false | unset",
  "dead_click_count_7d": <N or null>,
  "rageclick_count_7d": <N or null>,
  "mcp_skipped": false,
  "recommendation": "keep | disable | review-manually"
}
```

Return when the call completes. Do not write the audit report.
```

## After all three return

Continue to **`4-report.md`**.
