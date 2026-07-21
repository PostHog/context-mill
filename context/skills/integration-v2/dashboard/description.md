# Create a starter dashboard

Create a live PostHog dashboard named `Analytics basics (wizard)` to hold the
views for the events this integration instrumented. Keep the `(wizard)` tag with
that exact casing so a search for `(wizard)` surfaces every wizard-created
artifact.

Everything here goes through `posthog_exec` (`call <tool> <json>`).

## Create the dashboard

Create the parent dashboard first with `dashboard-create`, and capture its
returned `id` — the insight step attaches every insight to it via
`dashboards: [<id>]`:

```json
{ "name": "Analytics basics (wizard)", "description": "Key views for the events instrumented by the PostHog wizard.", "tags": ["wizard"] }
```

Then create the insights (see the insight step) and attach each one to this
dashboard's `id`. The dashboard is not done until those insights are attached —
an empty dashboard shell is not a success, even when no events have been
ingested yet (fresh insights render empty and fill in as events arrive; that is
the expected state of a brand-new integration, not a reason to hold back).

## Hand off the dashboard

Emit the dashboard URL on its own line in your final message with this exact
marker so the wizard surfaces it: `[DASHBOARD_URL] <full https url>`. A URL only
in prose, without the marker, is dropped. Also record the dashboard URL in your
handoff so the report step can link it.
