---
type: instrument-metrics
flow: metrics
label: Instrument the service with metrics
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [metrics]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [verify-sdk]
---

## Goal

Instrument the service with application metrics, following your skill
end-to-end — it owns where metrics belong (request middleware, background
jobs, external calls, business commit sites), which of counter, gauge, and
histogram fits each site, and the low-cardinality attribute rules.

Import the client the way the verify handoff names it. Only additive changes:
add metric calls, never restructure the code they land in.

## How you know you succeeded

The hot paths and business commit sites record metrics through the one shared
client, the project still builds, and your handoff lists every metric name
with its type and where it fires.
