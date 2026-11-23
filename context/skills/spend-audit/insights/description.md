# Spend audit — insights for value findings

Value findings are events the user already pays for and never looks at. The
fix is an insight that answers a real question about them, not a count for its
own sake. Everything goes through `posthog_exec` (`info` first, then `call`).

## Decide the shape from the code

For each value finding, read the capture site the finding names (file and line)
and the code around it, then pick:

- **A start and a finish** (`checkout_started` and `order_completed`,
  `upload_started` and `upload_finished`): a funnel, 14-day window, ordered.
- **A repeated action with a property that matters** (a `plan`, a `type`, a
  `source`): a trend broken down by that property.
- **A repeated action with no properties**: a daily trend over 30 days, bar
  display. In the description, name one property the code has in scope that
  would make the event more useful; that goes to the notebook as a suggestion,
  not a code change.
- **Several events from one feature** (same file or folder): one dashboard for
  the feature, the events as separate insights on it.
- **Group analytics identified but never aggregated** (`groups-identified-not-used`):
  a trend of a core event aggregated by the group type
  (`aggregation_group_type_index` on the `TrendsQuery`), and a table of the
  group keys seen in 30 days.
- **Autocapture nobody uses**: do not create insights. A value finding on
  autocapture is a notebook line, since the elements have no names.

Never invent an event name. Use the exact names from the finding.

## Naming, tags, description

- Dashboard name: `Spend audit: <feature or area>`.
- Insight name: the question, under 60 characters, for example
  `How often is checkout started?` or `Checkout funnel`.
- Every dashboard and every insight gets `tags: ["spend-audit"]`.
- Every description starts with `Created by the spend audit on <YYYY-MM-DD>. `
  followed by what it shows and where the event fires (`src/checkout/pay.ts`).

Create the dashboard first, capture its `id`, then create each insight with
`dashboards: [<id>]`. Capture every insight `id` and `short_id` from the create
responses; the result file lists ids and the notebook embeds by `short_id`.

## Known-good query shapes

Trend with a breakdown (breakdowns live in `breakdownFilter.breakdowns`, an
array; `TrendsQuery` has no top-level `breakdown`):

```json
{
  "name": "Checkouts by plan",
  "description": "Created by the spend audit on 2026-11-05. Daily checkout_started events by plan. Fires in src/checkout/pay.ts.",
  "tags": ["spend-audit"],
  "dashboards": [412],
  "query": { "kind": "InsightVizNode", "source": {
    "kind": "TrendsQuery",
    "series": [{ "kind": "EventsNode", "event": "checkout_started", "math": "total" }],
    "interval": "day",
    "dateRange": { "date_from": "-30d" },
    "breakdownFilter": { "breakdowns": [{ "type": "event", "property": "plan" }] },
    "trendsFilter": { "display": "ActionsBar" }
  }}
}
```

Funnel (window fields are camelCase inside `funnelsFilter`):

```json
{
  "name": "Checkout funnel",
  "description": "Created by the spend audit on 2026-11-05. checkout_started to order_completed within 14 days. Both fire in src/checkout/.",
  "tags": ["spend-audit"],
  "dashboards": [412],
  "query": { "kind": "InsightVizNode", "source": {
    "kind": "FunnelsQuery",
    "series": [
      { "kind": "EventsNode", "event": "checkout_started" },
      { "kind": "EventsNode", "event": "order_completed" }
    ],
    "dateRange": { "date_from": "-30d" },
    "funnelsFilter": { "funnelVizType": "steps", "funnelOrderType": "ordered", "funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day" }
  }}
}
```

Trend aggregated by a group type:

```json
{ "kind": "InsightVizNode", "source": {
  "kind": "TrendsQuery",
  "series": [{ "kind": "EventsNode", "event": "$pageview", "math": "unique_group", "math_group_type_index": 0 }],
  "interval": "week",
  "dateRange": { "date_from": "-30d" },
  "trendsFilter": { "display": "ActionsLineGraph" }
}}
```

Valid `trendsFilter.display` values: `ActionsLineGraph`, `ActionsBar`,
`ActionsAreaGraph`, `ActionsPie`, `ActionsStackedBar`, `BoldNumber`,
`ActionsTable`. A rejected call is fixed against these shapes, not retried with
variations.

## Hand off

List every dashboard `{ id, name, url }` and every insight
`{ id, short_id, name, dashboard_id, events, question }`. The report embeds the
insights by `short_id` and the result file lists the ids.
