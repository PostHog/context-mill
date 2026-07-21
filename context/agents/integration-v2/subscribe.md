---
type: subscribe
flow: integration-v2
label: Subscribe the user to the dashboard
model_pi: openai/gpt-5.6-luna
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-subscribe, integration-v2-mcp]
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [dashboard]
---

## Goal

A dashboard nobody revisits is dead weight. Offer to put the one just created in
the user's inbox: a weekly email subscription for the dashboard, plus an alert on
at most two of its insights — only ones whose movement would actually cost the
business something, like a conversion funnel dropping or signups stalling.

Both are standing side effects beyond the code integration the user asked for, so
ask consent first: say in one line what each is and get a yes or no. If they
decline, skip this whole step and say so. If nothing on the dashboard clearly
deserves an alert, create zero rather than padding to the ceiling.

## How you know you succeeded

Either the user declined and nothing was created, or what they agreed to exists in
PostHog: the weekly subscription addressed to their account email, and alerts only
on insights that earn one. Your handoff names each created record with its link —
built with the URL tool, never hand-constructed — which insight each alert watches
and why it was judged highest-signal, or the reason nothing was created.
