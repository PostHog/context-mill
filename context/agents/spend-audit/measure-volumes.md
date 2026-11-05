---
type: measure-volumes
flow: spend-audit
label: Measure 30-day volumes
model_pi: openai/gpt-5.6-sol
effort_pi: low
model_sdk: claude-sonnet-5
effort_sdk: medium
skills: [spend-audit-queries]
allowedTools: [posthog_exec]
disallowedTools: [Read, Write, Edit, Bash, Glob, Grep, enqueue_task]
dependsOn: []
---

## Goal

Measure, once, the volumes every later task sizes its savings from. Run the
shared measurement set from the queries skill against the last 30 days: events
by name, anonymous versus identified events, `$identify` and `$groupidentify`
per session, `$feature_flag_called` by flag, `$exception` by issue, recordings
and their duration distribution. Run the queries that apply to the products
your task input or the seed named; skip the rest.

Record every number together with the query that produced it. A later task
cites that query as the evidence for a saving, so a number without its query is
useless to it.

## How you know you succeeded

Your handoff carries one JSON block, shaped as the queries skill describes,
with every measured number and its query. A query that failed is listed with
its error instead of a guessed number, so downstream tasks mark that area
unmeasured rather than sizing it.
