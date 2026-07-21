# Create insights

Populate the dashboard with up to five insights from the events this integration
instrumented — lead with the business-critical views: conversion funnels,
activation, and churn signals. Use the exact event names from the capture step's
handoff; never invent events that were not instrumented. Keep each name tagged
`(wizard)` with that exact casing.

Create the insights now, in this run — do not skip or defer them because the
newly instrumented events haven't been ingested yet. An insight is a definition
over event names, not a snapshot of current data: it is expected to render
empty until the first events arrive, and it fills in on its own once they do.
"No data ingested yet", "the events aren't in the schema", or "the query would
return nothing today" are never reasons to omit insights — a dashboard handed
off without them is an incomplete integration, not a cautious one.

Every call goes through `posthog_exec` (`call insight-create <json>`). Attach each
insight to the dashboard by passing its id in `dashboards: [<dashboard id>]`.

Use these known-good query shapes — they are verified against the MCP schema, and
the common variations around them are rejected.

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
