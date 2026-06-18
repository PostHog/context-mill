---
type: init
flow: posthog-integration
label: Set up PostHog initialization
model: claude-haiku-4-5-20251001
skills: [init]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Initialize PostHog: create the framework's init point so the SDK is configured
once and available across the app, and set the PostHog environment variables
through the wizard tools.

## How you know you succeeded

The init file exists and the PostHog env keys are present. Keys live in the env
file, never hardcoded in source.
