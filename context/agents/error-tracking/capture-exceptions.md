---
type: capture-exceptions
flow: error-tracking
label: Wire up exception capture
model_pi: openai/gpt-5.6-terra
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-error-tracking-step, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Make the errors the app does not catch reach PostHog, by whatever means the
SDK offers for that. Which means depends on the SDK: some autocapture
exceptions once you enable it at init, some wire into the framework's own
error handler, some give you a boundary to mount at the app entry. Follow the
docs and the reference example for this one, and set it up in one place —
never manual capture calls sprinkled across files.

The SDK is installed and initialized — either it already was, or the install
and init tasks before you did it (see their handoffs); build on that, do not
re-check it.

This is an instrument-only task. Do not install dependencies, run the build,
run tests, or start the app — the user-driven test-setup step at the end of
the flow verifies, when the user wants it. Do not touch the build config
either way; when the flow includes a configure task, it owns those files.
Stay inside this project's directory and set up that one place; that is the
whole job.

## How you know you succeeded

An error the app does not catch reaches PostHog, through the mechanism this
SDK gives you rather than one you invented. You did not install anything, run
a build, lint, or tests, search outside the project, or read through the whole
app or hand-wrap individual components or routes. Your handoff names the files
you changed and the capture mechanism, so the report can explain it to the
user.
