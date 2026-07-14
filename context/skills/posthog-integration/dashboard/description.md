# Create a starter dashboard

Create a live PostHog dashboard named `Analytics basics (wizard)` from the events
this integration instrumented, then populate it with up to five insights — lead
with the business-critical views: conversion funnels, activation, and churn
signals. Use the exact event names from the capture step's handoff; never invent
events that were not instrumented. Keep the `(wizard)` tag with that exact casing
so a search for `(wizard)` surfaces every wizard-created artifact.

Everything here goes through `posthog_exec` (`call <tool> <json>`).

## Create the dashboard, then attach insights

Create the parent dashboard first with `dashboard-create`, capture its returned
`id`, then attach every insight to it via `dashboards: [<id>]`:

```json
{ "name": "Analytics basics (wizard)", "description": "Key views for the events instrumented by the PostHog wizard.", "tags": ["wizard"] }
```

For `insight-create`, use these known-good query shapes — they are verified
against the MCP schema, and the common variations around them are rejected.

A trends insight with a breakdown (breakdowns go in `breakdownFilter.breakdowns`,
an array — there is NO top-level `breakdown` field on `TrendsQuery`):

```json
{
  "name": "Signups by plan (wizard)",
  "dashboards": [<dashboard id>],
  "query": { "kind": "InsightVizNode", "source": {
    "kind": "TrendsQuery",
    "series": [{ "kind": "EventsNode", "event": "user_signed_up", "math": "total" }],
    "interval": "day",
    "dateRange": { "date_from": "-30d" },
    "breakdownFilter": { "breakdowns": [{ "type": "event", "property": "plan" }] },
    "trendsFilter": { "display": "ActionsBar" }
  }}
}
```

A conversion funnel (window fields are camelCase and live INSIDE `funnelsFilter`,
not at the top level of `FunnelsQuery`, and not snake_case):

```json
{
  "name": "Signup funnel (wizard)",
  "dashboards": [<dashboard id>],
  "query": { "kind": "InsightVizNode", "source": {
    "kind": "FunnelsQuery",
    "series": [
      { "kind": "EventsNode", "event": "page_viewed" },
      { "kind": "EventsNode", "event": "user_signed_up" }
    ],
    "dateRange": { "date_from": "-30d" },
    "funnelsFilter": { "funnelVizType": "steps", "funnelOrderType": "ordered", "funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day" }
  }}
}
```

Valid `trendsFilter.display` values: `ActionsLineGraph`, `ActionsBar`,
`ActionsAreaGraph`, `ActionsPie`, `ActionsStackedBar`, `BoldNumber`,
`ActionsTable`. Names like `ActionsBarChart`/`ActionsBarGraph` are rejected. If an
insight call is rejected, fix the payload against these examples rather than
retrying variations.

## Hand off the dashboard

Emit the dashboard URL on its own line in your final message with this exact
marker so the wizard surfaces it: `[DASHBOARD_URL] <full https url>`. A URL only
in prose, without the marker, is dropped. Also record the dashboard URL in your
handoff so the report step can link it.
