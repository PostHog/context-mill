---
type: report
flow: posthog-integration
label: Write the setup report
model: openai/gpt-5.6-terra
skills: [posthog-integration-report]
allowedTools: [Read, Write, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [dashboard]
---

## Goal

Write the setup report summarizing what this integration did, drawing only on the
run's queue log and event plan in `.posthog-wizard-cache/` (`queue.json` and
`.posthog-events.json`).

## How you know you succeeded

`posthog-setup-report.md` exists at the project root: what was installed and
initialized, the events captured, whether identify was wired or skipped, error
tracking added, the dashboard link, any build conflict in full, and the next
steps for the user.
