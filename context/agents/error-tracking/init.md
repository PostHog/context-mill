---
type: init
flow: error-tracking
label: Set up PostHog initialization
model_pi: openai/gpt-5.6-terra
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [integration-v2-init, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Make sure PostHog is initialized. If the project already has a working
`posthog.init(...)` (or the framework's equivalent) with its env keys wired,
leave it alone and say so in your handoff. If it doesn't, create it following
your skill — it owns the how: the framework's init point, the env-var wiring
through the wizard tools, and `.env.example`.

You only exist in this flow because the user asked for error tracking on a
repo without PostHog. Initialize the SDK so exceptions can flow and stop —
no instrumentation, no extras. Don't set up exception capture either way;
the capture-exceptions task after you owns that.

## How you know you succeeded

An init point exists with the PostHog env keys present — whether it already
did or you just created it — keys in the env file, never hardcoded. Your
handoff names the files involved and how the client is constructed, so the
capture-exceptions task can find the init options without re-discovering them.
