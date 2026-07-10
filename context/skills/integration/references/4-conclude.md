---
next_step: null
title: PostHog Setup - Conclusion
description: Review and fix any errors in the PostHog integration implementation
---

Create a live PostHog dashboard named "Analytics basics (wizard)" from the events you just instrumented, then populate it with up to five insights — lead with the business-critical views: conversion funnels, churn events, and other key signals. Use the exact same event names as implemented in the code. Keep the `(wizard)` tag with that exact casing so anyone browsing PostHog can see the wizard created this dashboard, and so a quick search for `(wizard)` surfaces every wizard-created artifact in one go.

{{> mcp-tool-calling}}

Create the parent dashboard first with `dashboard-create`, capture its returned `id`, then attach every insight to it via `dashboards: [<id>]`:

```json
{
  "name": "Analytics basics (wizard)",
  "description": "Key views for the events instrumented by the PostHog wizard.",
  "tags": ["wizard"]
}
```

When calling `insight-create`, use these known-good query shapes — they are verified against the MCP schema, and the common variations around them are rejected:

A trends insight with a breakdown (breakdowns go in `breakdownFilter.breakdowns`, an array — there is NO top-level `breakdown` field on `TrendsQuery`):

```json
{
  "name": "Signups by plan (wizard)",
  "dashboards": [<dashboard id from dashboard-create>],
  "query": {
    "kind": "InsightVizNode",
    "source": {
      "kind": "TrendsQuery",
      "series": [{ "kind": "EventsNode", "event": "user_signed_up", "math": "total" }],
      "interval": "day",
      "dateRange": { "date_from": "-30d" },
      "breakdownFilter": { "breakdowns": [{ "type": "event", "property": "plan" }] },
      "trendsFilter": { "display": "ActionsBar" }
    }
  }
}
```

A conversion funnel (the window fields are camelCase and live INSIDE `funnelsFilter` — not at the top level of `FunnelsQuery`, and not snake_case):

```json
{
  "name": "Signup funnel (wizard)",
  "dashboards": [<dashboard id from dashboard-create>],
  "query": {
    "kind": "InsightVizNode",
    "source": {
      "kind": "FunnelsQuery",
      "series": [
        { "kind": "EventsNode", "event": "page_viewed" },
        { "kind": "EventsNode", "event": "user_signed_up" }
      ],
      "dateRange": { "date_from": "-30d" },
      "funnelsFilter": {
        "funnelVizType": "steps",
        "funnelOrderType": "ordered",
        "funnelWindowInterval": 14,
        "funnelWindowIntervalUnit": "day"
      }
    }
  }
}
```

Valid `trendsFilter.display` values are `ActionsLineGraph`, `ActionsBar`, `ActionsAreaGraph`, `ActionsPie`, `ActionsStackedBar`, `BoldNumber`, and `ActionsTable` — names like `ActionsBarChart` or `ActionsBarGraph` are rejected. If an insight call is rejected anyway, fix the payload against these examples rather than retrying variations.

Once the dashboard exists, emit its URL on its own line in your assistant message using this exact marker: `[DASHBOARD_URL] <full https url>`. The wizard parses this marker from your visible message and surfaces the link in the success summary. Mentioning the URL only in thinking or in prose without the marker means the link is dropped.

Search for a file called `.posthog-events.json` and read it for available events.

Do not spawn subagents.

Create the file posthog-setup-report.md. It should include a summary of the integration edits, a table with the event names, event descriptions, and files where events were added, a list of links for the dashboard and insights created, and a "Verify before merging" checklist (see below). Follow this format:

<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. [Detailed summary of changes]

[table of events/descriptions/files]

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

[links]

## Verify before merging

[checklist]

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

For the "Verify before merging" checklist, write GitHub-style checkboxes (`- [ ] ...`) covering what the developer (or their coding agent) still needs to do to take this from "wizard finished" to "merged". Include ONLY the items that actually apply to the integration you just performed — judge each against the code you changed in this run, and drop any that don't fit. Phrase each item as a concrete, checkable action. Candidate items, with the condition for including each:

- Always: "Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code."
- Always: "Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures."
- If you added environment variables: "Add the exact PostHog env var names you added to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set."
- If this integration ships a minified production browser bundle (most SPA/SSR web frameworks — e.g. Next.js, Nuxt, SvelteKit, Astro, Vite-based apps): "Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify."
- If LLM analytics was set up in this run: "Trigger the LLM call path(s) you instrumented and confirm `$ai_generation` events appear in PostHog AI Observability."
- If the app has user auth and an `identify` call was added: "Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs."

Do not invent items beyond what applies. If only the two "Always" items apply, the checklist is just those two.

Upon completion, update `.posthog-events.json` so it matches the events you actually implemented, then remove it with your file tools. If removal is blocked or fails in your environment, leave the file in place and move on — the wizard host cleans it up after the run. Do not retry the removal or reach for shell commands to force it.

## Status

Status to report in this phase:

- Configured dashboard: [insert PostHog dashboard URL]
- Created setup report: [insert full local file path]
