---
type: init
flow: posthog-integration
label: Set up PostHog initialization
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-haiku-4-5-20251001
skills: [posthog-integration-init]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Initialize PostHog: create the framework's init point so the SDK is configured
once and available across the app, set the PostHog environment variables through
the wizard tools, and document those keys in `.env.example` for other developers.

## How you know you succeeded

The init file exists and the PostHog env keys are present. Keys live in the env
file, never hardcoded in source, and `.env.example` lists the key names (with
placeholder values) so the next developer knows what to set.
