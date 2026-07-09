# Connector — Linear warehouse source

Creates the Linear warehouse source with at most **one click** from the user: Linear needs an OAuth'd Integration row, and the only part this run can't do is the user consenting in their browser. Hand them the authorize link, then check **once** for the integration — if it's there, create the source yourself (no UI form-filling); if it isn't, leave a dormant responder and move on. Never nudge or wait through retry rounds.

## Status

Emit:

```
[STATUS] Connecting Linear warehouse source
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__external-data-sources-create` (`integrations-list` from step 3 stays loaded).

## Do

1. **Check for an existing Linear integration**: call `integrations-list` and look for `kind: "linear"`. Present → skip ahead to create the source (below).

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
    { label: "Skip Linear", value: "skip" },
    { label: "Done — I've approved it", value: "done" }
  ]
}
```

   - **done** → call `integrations-list` **once**. `kind: "linear"` present → create the source (below). Still absent → **don't re-ask or wait** — record "picked but not connected" and return to step 5 (the dormant responder + follow-up cover it; the user can finish the one-click OAuth later). This run never nudges for Linear.
   - **skip** → record "picked but not connected" and return to step 5 (enable the dormant responder and add a follow-up — harmless, since it only emits once a warehouse source syncs).

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
   - Any other failure → don't send the user to the UI; record "picked but not connected" and return to step 5 (dormant responder + follow-up). A failed create never dead-ends the run.
   - Success returns the source `id` — record "connected by this setup (source id …, first sync started)".

Return to step 5 (responder enabling and class recording happen there).
