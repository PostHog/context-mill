# Connector — Linear warehouse source

Creates the Linear warehouse source with at most **one click** from the user: Linear needs an OAuth'd Integration row, and the only part this run can't do is the user consenting in their browser. Hand them the authorize link, then check **once** for the integration — if it's there, create the source yourself (no UI form-filling), then ask which Linear teams Self-driving reads; if it isn't, leave a dormant responder and move on. Never nudge or wait through retry rounds.

## Status

Emit:

```
[STATUS] Connecting Linear warehouse source
```

## Tools

Reach `external-data-sources-create` through the PostHog `exec` tool (`info` then `call`); `integrations-list` and `integrations-linear-teams-retrieve` are reached the same way.

## Do

1. **Check for an existing Linear integration**: call `integrations-list` and look for `kind: "linear"`. Present → skip ahead to create the source (step 3).

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
   - Success returns the source `id` — record "connected by this setup (source id …, first sync started)", then pick the teams (step 4).

4. **Ask which Linear teams Self-driving reads.** The warehouse syncs the whole workspace, but the responder only turns issues from the picked teams into signals. Without a pick it reads every team, which is how users end up with a report, and a draft PR, for issues they never meant to hand over. So ask once, right here, while the connection is fresh.

   Call `integrations-linear-teams-retrieve` with the Linear integration's `id`; it returns `teams` as `{ id, name }` rows. Then ask:

```
{
  id: "linear-teams",
  prompt: "Which Linear teams should Self-driving read? It reads open issues only from the teams you pick.",
  kind: "multi",
  options: [
    { label: "All teams", value: "all" },
    { label: "<team name>", value: "<team id>" },
    ...one option per returned team, in the order returned
  ]
}
```

   - One or more teams picked (and not "All teams") → record `linear_team_ids` as those team ids. Step 5's enable writes them as `config.linear_team_ids` on the `linear` / `issue` row.
   - "All teams" picked, or "All teams" together with teams → record `linear_team_ids: []`. An empty list means every team.
   - The teams call fails, or returns no teams → don't re-ask; record `linear_team_ids: []` and note in the report that the user can pick teams later in the inbox (the Linear source's Filters button).

   Existing Linear connections never get this question: the run only asks for a source it created itself.

Return to step 5 (responder enabling and class recording happen there).
