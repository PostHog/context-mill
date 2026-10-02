---
next_step: 2-fix.md
---

# Step 1 — Triage: which warnings are firing, and is there code to fix?

This step decides what the rest of the run works on. It reads the project's real ingestion warnings, confirms the project has PostHog instrumentation to fix, and writes a prioritized worklist to the scratch file. It does **not** fix anything — `2-fix.md` owns the fixes.

## Tools

Load once at the start of this step:
`ToolSearch select:Grep,mcp__posthog__execute-sql`

## Status

Emit, in order, as you reach each sub-step:

```
[STATUS] Querying ingestion warnings
[STATUS] Checking for PostHog instrumentation
[STATUS] Building the worklist
```

## a. Read which warning types are firing

Call `mcp__posthog__execute-sql` to group recent warnings by type over the last 7 days:

```sql
SELECT type, count() AS cnt
FROM system.ingestion_warnings
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY type
ORDER BY cnt DESC
```

If the table or a column name is rejected, retry once without the `WHERE` clause, then with `LIMIT 1000` over the raw rows (`SELECT type, details, timestamp FROM system.ingestion_warnings ...`) and aggregate the `type` values yourself. The exact schema can vary by project — adapt column names to what the error message reports rather than giving up.

For **each** firing `type`, pull a few example payloads so you can see the affected event shape (the offending property usually shows up in `details`):

```sql
SELECT details, timestamp
FROM system.ingestion_warnings
WHERE type = '<type>'
ORDER BY timestamp DESC
LIMIT 5
```

**If the query path is entirely unavailable** (no `mcp__posthog__execute-sql`, or it errors on every variant): don't abort yet. Fall through to (b), and if instrumentation exists, build the worklist from the **full** catalog in `2-fix.md` instead of from query results — i.e. scan for every known anti-pattern. Record in the scratch file that warnings could not be read, so the report says findings are code-derived, not data-confirmed.

## b. Confirm there's PostHog instrumentation to fix

Run a single `Grep` (`output_mode: "files_with_matches"`) for SDK init / capture surfaces:

```
posthog\.init\(|new PostHog\(|posthog\.capture\(|posthog\.identify\(|PostHog\(|usePostHog\(
```

- **Zero hits anywhere** and the query in (a) also failed → emit `[ABORT] Could not read ingestion warnings and no PostHog instrumentation found to scan` and stop.
- **Zero hits but (a) returned warnings** → the producing code may live in a sibling repo (e.g. a backend that sends events). Don't abort; record this and let the report flag that the offending sender wasn't found in this checkout.
- **Hits found** → continue.

## c. Write the worklist to the scratch file

`Write` `.posthog-ingestion-warnings.json` at the project root. One entry per warning type to act on (from the query in (a), or the full catalog if you fell back). Use the `type` string verbatim as it appeared in the data so `2-fix.md` can match it. Shape:

```json
{
  "source": "query",                  // "query" or "code-scan" (the fallback)
  "queriedAt": "<ISO timestamp or null>",
  "warnings": [
    { "type": "invalid_heatmap_data", "count": 1284, "examples": ["<trimmed details>"], "status": "pending" }
  ],
  "notes": ["<anything the report should mention, e.g. 'sender not found in this checkout'>"]
}
```

Order `warnings` by `count` descending (highest-volume first) when you have counts; otherwise keep catalog order. Set every `status` to `"pending"`.

Do not read project source files in this step beyond the single presence `Grep`. Do not preload `2-fix.md`.

Continue to **`2-fix.md`**.
