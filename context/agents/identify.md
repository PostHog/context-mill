---
type: identify
flow: posthog-integration
label: Wire user identification
model: claude-sonnet-4-6
skills: [basic-integration-identify]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Wire user identification: call PostHog identify wherever the app establishes who
the user is, typically at login and signup.

## How you know you succeeded

An identify call fires at the point the user becomes known, with a stable
distinct id. If the app has no auth or user concept, say so and stop.
