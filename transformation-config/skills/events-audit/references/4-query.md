---
next_step: 5-report.md
---

# Step 4 – Query PostHog (MCP) for volume

Pull 30-day volume and `last_seen` for every event the inventory references. The SQL filters to inventory event names — orphan detection is intentionally out of scope (PostHog projects often span multiple repos, so events without a code match are usually noise from another codebase). After merging, resort `rows[]` by `volume_30d` so the report's by-event table naturally surfaces highest-impact events first.

## Output discipline

This step is one MCP call, one in-place merge, one `Write`. Do not re-emit the entire inventory in assistant text before writing — prior runs spent ~150 seconds streaming the JSON into the conversation before invoking `Write`, which is pure output-token waste. The flow is:

1. Read the inventory.
2. Build the IN-list and call `query-run`.
3. Merge volume/`last_seen` into rows in your working memory.
4. Sort and tag.
5. `Write` directly. No "here's the updated inventory:" preamble. No `details` recap.

## Status

Emit:

```
[STATUS] Querying PostHog MCP for volume
```

## MCP tools

| MCP tool | When | Use |
|----------|------|-----|
| `mcp__posthog-wizard__query-run` | (c) below | Execute HogQL/SQL. Filtered query returns volume + last_seen for inventory events. |
| `mcp__posthog-wizard__entity-search` | **Avoid.** | Requires project-key permissions; personal API keys get "permission denied". The SQL approach below works regardless. |

The active project comes from the wizard session – don't pick or switch projects yourself.

## Action

### a. Confirm the project

The active project is whatever the wizard's MCP session targets. If you can't confirm it, or the user said this codebase ships to a different project, emit `[ABORT] MCP project mismatch – enrichment unsafe`.

### b. Build the event-name list

`Read` `.posthog-events-inventory.json`. Collect every distinct `event_name` from `rows[]` where `call_kind == "capture"` and `is_dynamic == false` and `event_name != null`. Deduplicate. This is the IN-list for the SQL.

If the list is empty (every capture row is dynamic), skip the SQL call and proceed to (d) – every row will keep `volume_30d: 0` and `last_seen: null`.

### c. Query volume for inventory events

`mcp__posthog-wizard__query-run` with:

```sql
SELECT event,
       count() AS volume_30d,
       max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
  AND event IN (<inventory event names>)
GROUP BY event
ORDER BY volume_30d DESC
```

The result covers only events the code already references – there is no `definitions[]` of the project's full event universe, by design.

### d. Merge into the inventory

For each `row` with `call_kind == "capture"` and a non-null `event_name`, copy `volume_30d` and `last_seen` from the SQL result keyed by `event`. Rows whose name isn't in the SQL result keep `volume_30d: 0` and `last_seen: null` – this is the phantom signal the data-quality check uses.

### e. Resort by volume

Sort `rows[]` in place by `volume_30d` descending (rows with `null` or `0` volume sink to the bottom; tie-break by `file:line` so ordering is stable). Non-capture rows (`identify`, `set`, `group`, etc.) have no volume – sort them after capture rows but keep them in scan order amongst themselves.

This is the only place the inventory is reordered. The report step reads in this order – the by-event table benefits from "highest-impact first" without any extra sorting.

### f. Tag status from volume

Walk `rows[]` once and set `status` on every `call_kind == "capture"` row:

- `is_dynamic == true` → `status = "dynamic"`.
- `volume_30d > 0` → `status = "resolved"` (event fired in last 30 days).
- `volume_30d == 0` and `last_seen == null` → `status = "phantom"`, `details = "event referenced in code but not seen in PostHog in last 30 days"`.

Phantom is the inverse of orphan: the code references an event that PostHog hasn't seen recently. Could be a typo, a code path that no longer fires, or instrumentation that hasn't shipped yet. The data-quality check uses this as undercount risk.

If the SQL call in (c) was skipped or errored (every row has `volume_30d: null`), leave `status: "pending"` on every row – the report step will note "no MCP volume data available" and judge only on code presence.

`Write` the inventory back.

### g. Failure handling

Three failure modes, in order of severity:

- **No MCP connection or no project id.** Emit `[ABORT] MCP project mismatch – enrichment unsafe`. The wizard halts the run.
- **`query-run` errors out** (misconfigured project, schema drift). Set `volume_30d = null` and `last_seen = null` on every row and continue. The report step's data-quality check will note "no MCP volume data available" and judge only on code presence.
- **Empty result** (zero events in the last 30 days for every inventory event). Treat as "no events in PostHog – likely the wrong project" and let the data-quality check flag it.
