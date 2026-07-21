---
type: dashboard
flow: integration-v2
label: Create a starter dashboard
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-dashboard, integration-v2-insight, integration-v2-mcp]
allowedTools: [Read]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [build]
---

## Goal

Create a starter PostHog dashboard with a few insights built on the events this
integration instruments, using the PostHog MCP.

Read `.posthog-wizard-cache/.posthog-events.json`, relative to the project root. That
is the event plan — every event this run instrumented, already decided and recorded.
It and the handoffs you were given are your only sources. Open nothing else: not the
project's source, not its config. Re-deriving events from code wastes the run and
risks tiles built on events that were never shipped. The cache folder is deleted when
the run ends, so read what you need in one pass and carry it in your handoff.

## How you know you succeeded

A dashboard exists with a handful of insights on the captured events, and you hand
off its URL for the report to link.
