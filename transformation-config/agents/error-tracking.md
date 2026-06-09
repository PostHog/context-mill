---
type: error-tracking
label: Add error tracking
model: claude-sonnet-4-6
skills: [error-tracking-step]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Add PostHog error tracking around the app's critical flows and boundaries, so
failures that matter reach PostHog.

## How you know you succeeded

Exceptions in the important paths — the routes, actions, and boundaries where a
failure hurts the user — are captured. If the app already reports errors
elsewhere, add PostHog alongside it rather than replacing it.
