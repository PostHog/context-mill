---
next_step: 5-report.md
---

# Step 4 – Query PostHog (MCP) for volume

Pull 30-day volume and `last_seen` for every event the inventory references. The SQL filters to inventory event names — orphan detection is intentionally out of scope (PostHog projects often span multiple repos, so events without a code match are usually noise from another codebase). After merging, resort `rows[]` by `volume_30d` so the report's by-event table naturally surfaces highest-impact events first.

**Soft-degrade if MCP isn't available.** If the project is wrong, the connection fails, or the query errors, do not abort the run. Set a top-level flag in the inventory and continue to step 5 — the report renders with code-side findings only and a disclaimer at the top.

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

The active project is whatever the wizard's MCP session targets. If you can't confirm it, or the user said this codebase ships to a different project, **don't abort** — set `mcp_unavailable_reason: "project mismatch"` (see step (g)) and skip to (g) without running the query.

### b. Build the event-name list

`Read` `.posthog-events-inventory.json`. Collect every distinct `event_name` from `rows[]` where `call_kind == "capture"` and `is_dynamic == false` and `event_name != null`. Deduplicate. This is the IN-list for the SQL.

If the list is empty (every capture row is dynamic), skip the SQL call and proceed to (d) – every row will keep `volume_30d: 0` and `last_seen: null`. Set `mcp_available: true` and `mcp_skipped_reason: "no resolved event names to query"` so step 5 knows volume is available in principle but nothing was queried.

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

### g. Set the MCP-availability flag and write

Set top-level keys on the inventory based on what happened:

| Outcome | `mcp_available` | `mcp_skipped_reason` |
|---|---|---|
| Query ran successfully and returned rows | `true` | `null` |
| Query ran but the result was empty (zero matching events in last 30d) | `true` | `"empty result — likely wrong project, but proceeding"` |
| IN-list was empty (every capture is dynamic) | `true` | `"no resolved event names to query"` |
| Project couldn't be confirmed in (a) | `false` | `"project mismatch"` |
| `query-run` errored out (misconfigured project, schema drift, network) | `false` | `"query-run failed: <short reason>"` |
| No MCP connection at all | `false` | `"MCP unavailable"` |

When `mcp_available: false`, leave every row's `volume_30d: null`, `last_seen: null`, `status: "pending"`. Step 5 reads these flags and renders a disclaimer in place of volume-dependent sections. Step 6 reads `mcp_available` and skips dashboard creation entirely if false.

`Write` the inventory back. Continue to step 5 in every case — never abort here.

### h. Notes for the orchestrator

- **Don't retry on failure.** One attempt; if it fails, soft-degrade. The wizard logs the failure reason and the user can re-run with a corrected project.
- **Don't try to recover by guessing a different project.** The active project is the wizard's session — switching it is out of scope.
