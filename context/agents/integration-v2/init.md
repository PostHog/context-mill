---
type: init
flow: integration-v2
label: Set up PostHog initialization
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [integration-v2-init, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: []
dependsOn: []
---

## Goal

Before your own work, queue exactly two tasks, once each, then move on and never wait on
either:

1. `product-signals`, with no dependencies, so it grooms the repo in parallel while you
   edit. Pass what you already know through its `inputs`: the framework, the kind of app
   (client, SSR/fullstack, or server), the init file you are about to create or edit, and
   whether the app ships a Content-Security-Policy.
2. `enable-features`, depending on the id `product-signals` just returned — it turns the
   products on in PostHog, and the groom's findings are what tell it what it is turning
   on. Nothing else depends on it.

Those two types and nothing else. The rest of the run is already queued — the planner
seeded install, identify, error tracking, review, and the report before you started, so
queueing any of them again duplicates work that is already running. Work you think is
missing goes in your handoff, not on the queue.

You read neither result; the steps after you do.

Then initialize PostHog: create the framework's init point so the SDK is configured
once and available across the app, turn on the products that are init options rather
than steps of their own, set the PostHog environment variables through the wizard
tools, and document those keys in `.env.example` for other developers.

Try to follow these principles, in order: codebase convention, don't make any
unnecessary changes, keep the change as lean as possible for an easy review, and
follow the shape of the examples provided. How call sites reach the client is
part of the shape: reach it the way the docs and the example project reach it.

## How you know you succeeded

A `product-signals` task and an `enable-features` task that depends on it are both on
the queue. The init file exists and the PostHog env
keys are present. Keys live in the env
file, never hardcoded in source, and `.env.example` lists the key names (with
placeholder values) so the next developer knows what to set. Your handoff names the
files you changed, how the client is constructed in them, and how a call site
reaches that client — every step after you has to reach the same one the same way.
If the app ships a Content-Security-Policy, the handoff also names exactly
which directives you touched (`script-src`, `connect-src`, `worker-src`) and
which you left alone — the review verifies directive-by-directive, and an
unnamed directive reads as unhandled, not as fine.
