---
next_step: 3-edit.md
title: PostHog Setup - Dashboard
description: Create the analytics dashboard and insights from the event plan, before implementing any code
---

Now that the event plan exists, we create the dashboard and insights *first* — before writing any tracking code — so the analytics we want to answer drive the instrumentation that follows.

Search for a file called `.posthog-events.json` and read it for the planned events. These are the exact events the next phase will implement.

Use the PostHog MCP to create a new dashboard named "Analytics basics (wizard)". Keep the `(wizard)` tag with that exact casing so anyone browsing PostHog can see the wizard created this dashboard, and so a quick search for `(wizard)` surfaces every wizard-created artifact in one go. Populate it with up to five insights, with special emphasis on things like conversion funnels, churn events, and other business critical insights.

**Use the exact `event_name` values from `.posthog-events.json`** when building each insight. The implementation phase is bound to these same names, so the insights and the code will line up.

**These events have no data yet** — the tracking code hasn't been written. That is expected and correct at this stage: PostHog insights can reference event names that haven't been ingested yet, and the dashboard will begin populating once the instrumented code ships and runs. Do not skip an insight because its event has no data.

Note the created dashboard's id and URL, and the ids of the insights you added. The final phase re-locates them via the PostHog MCP to build the report and surface the link — **do not emit the `[DASHBOARD_URL]` marker in this phase.**

Do not spawn subagents.

## Status

Status to report in this phase:

- Creating analytics dashboard from event plan
- Adding insights based on planned events (name each insight as you add it)
- Dashboard ready: [insert PostHog dashboard URL]
