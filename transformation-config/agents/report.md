---
type: report
label: Write the setup report
model: claude-sonnet-4-6
skills: [report]
allowedTools: [Read, Write, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [build, dashboard]
---

## Goal

Write the setup report summarizing what this integration did, drawing on the
handoffs from the previous steps.

## How you know you succeeded

`posthog-setup-report.md` exists at the project root: what was installed and
initialized, the events captured, whether identify was wired or skipped, error
tracking added, the dashboard link, any build conflict in full, and the next
steps for the user.
