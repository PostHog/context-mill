# Connector — Linear warehouse source

Creates the Linear warehouse source with at most **one click** from the user: Linear needs an OAuth'd Integration row, and the only part this run can't do is the user consenting in their browser. Hand them the authorize link, then check **once** for the integration — if it's there, create the source yourself (no UI form-filling); if it isn't, leave a dormant responder and move on. Never nudge or wait through retry rounds.

## Status

Emit:

```
[STATUS] Connecting Linear warehouse source
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__external-data-sources-create` (`integrations-list` from step 4 stays loaded).

If `external-data-sources-create` isn't available (older server), skip this file and treat Linear as picked-but-not-connected — arm the dormant responder and add a follow-up (step 6's picked-but-not-connected path) — instead. **Not an abort.**

## Do

1. **Check for an existing Linear integration**: call `integrations-list` and look for `kind: "linear"`. Present → skip to step 3.

2. **Send the authorize link.** Build it from the run prompt's project URLs — same host, project id as path segment:

```
<posthog host>/api/environments/<project id>/integrations/authorize?kind=linear
```

   Opening it in the user's logged-in browser runs the whole OAuth dance and creates the integration. Ask:

```
{
  id: "linear-connect",
  prompt: "One click connects Linear: open this link in your browser and approve access —\n\n<authorize URL>\n\nThen come back here.",
  kind: "single",
  options: [
    { label: "Done — I've approved it", value: "done" },
    { label: "Skip Linear", value: "skip" }
  ]
}
```

   - **done** → call `integrations-list` **once**. `kind: "linear"` present → step 3 (create the source). Still absent → **don't re-ask or wait** — record "picked but not connected" and return to step 6 (the dormant responder + follow-up cover it; the user can finish the one-click OAuth later). This run never nudges for Linear.
   - **skip** → record "picked but not connected" and return to step 6 (enable the dormant responder and add a follow-up — harmless, since it only emits once a warehouse source syncs).

3. **Create the source** with `external-data-sources-create`, using the Linear integration's `id`:

```json
{
  "source_type": "Linear",
  "payload": {
    "linear_integration_id": <integration id>,
    "schemas": [
      {
        "name": "issues",
        "should_sync": true,
        "sync_type": "incremental",
        "incremental_field": "updatedAt",
        "incremental_field_type": "datetime"
      }
    ]
  }
}
```

   Sync **only** `issues` — the one table Signals consumes; more tables can be enabled in the UI later (note this in the report).

   - 400 "Prefix is required" (a Linear source already exists) → retry once with `prefix: "signals"`.
   - Any other failure → don't send the user to the UI; record "picked but not connected" and return to step 6 (dormant responder + follow-up). A failed create never dead-ends the run.
   - Success returns the source `id` — record "connected by this setup (source id …, first sync started)".

Return to step 6 (responder enabling and class recording happen there).
