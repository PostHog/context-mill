---
type: enable-features
flow: integration-v2
label: Enable the PostHog products
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-haiku-4-5-20251001
skills: [integration-v2-enable-features, integration-v2-mcp]
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [product-signals]
---

## Goal

Turn on the PostHog products that self-driving reads from, in the project. The SDK is
installed and initialized by now, so this is the switch that decides whether what it
sends is collected at all. `init` queued you behind the repo groom, so its findings are
already in your context.

Enable the products, then say what the groom's findings change about them. You change
nothing in the repo — a product that needs code to work is a follow-up you name, not an
edit you make.

## Status

Complete with **done** whenever you established each product's state and recorded it —
including when PostHog refused the change. A missing tool, a missing scope, or a
permission wall is an outcome to report, not a failure: the integration in the repo is
untouched and every later step can still run, so failing here would abort a run that
actually succeeded. Reserve **failed** for being unable to determine any product's state
at all.

## How you know you succeeded

Every product has a recorded result — enabled, already enabled, or refused with the
reason. Your handoff names each one, carries forward the `product-signals` block
verbatim so the steps after you see it by the shortest path, and lists every follow-up:
a product needing project admin or a broader token scope, a product inert on this
platform until the SDK is configured for it, a Support inbox with no channel connected
yet. If no product signals were available, say that plainly rather than implying you had
them.
