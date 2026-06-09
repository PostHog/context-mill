---
type: error-tracking
label: Add error tracking
model: claude-sonnet-4-6
skills: [error-tracking-step]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [capture]
---

## Goal

Set up the framework's single global error boundary so uncaught errors reach
PostHog. One place, following the docs and the reference example — not manual
capture calls sprinkled across files.

## How you know you succeeded

A global error handler forwards exceptions to PostHog. You did not read through the
whole app or hand-wrap individual components or routes.
