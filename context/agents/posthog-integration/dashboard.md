---
type: dashboard
flow: posthog-integration
label: Create a starter dashboard
model: openai/gpt-5.6-terra
skills: [posthog-integration-dashboard]
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [build]
---

## Goal

Create a starter PostHog dashboard with a few insights built on the events this
integration instruments, using the PostHog MCP.

## How you know you succeeded

A dashboard exists with a handful of insights on the captured events, and you hand
off its URL for the report to link.
