---
type: report
flow: integration-v2
label: Write the setup report
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-report, integration-v2-notebook]
allowedTools: [Read, Write, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [dashboard]
---

## Goal

Write the setup report summarizing what this integration did, drawing only on the
run's queue log and event plan in `.posthog-wizard-cache/` (`queue.json` and
`.posthog-events.json`), then mirror it into a shareable PostHog notebook.

## How you know you succeeded

`posthog-setup-report.md` exists at the project root: what was installed and
initialized, the events captured, whether identify was wired or skipped, error
tracking added, the dashboard link, any build conflict in full, and the next
steps for the user. The report is also mirrored into a PostHog notebook whose URL
is emitted with the `[NOTEBOOK_URL]` marker.
