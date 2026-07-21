---
type: error-tracking
flow: integration-v2
label: Add error tracking
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-error-tracking-step]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Set up the framework's single global error boundary so uncaught errors reach
PostHog. One place — the init or app entry — following the docs and the reference
example, not manual capture calls sprinkled across files. The SDK is already
installed and initialized (see the context from previous steps); build on that,
do not re-check it.

This is an instrument-only task. Do not install dependencies, run the build, run
tests, or start the app — a later `build` step does all verification. Stay inside
this project's directory and edit the one global handler; that is the whole job.

## How you know you succeeded

A global error handler forwards exceptions to PostHog. You did not install
anything, run a build or tests, search outside the project, or read through the
whole app or hand-wrap individual components or routes.
