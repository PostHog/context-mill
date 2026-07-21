---
type: subscribe
flow: integration-v2
label: Subscribe the user to the dashboard
model_pi: openai/gpt-5.6-luna
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [dashboard-subscriptions, wizard-ask, integration-v2-mcp]
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [dashboard]
---

## Goal

A dashboard nobody revisits is dead weight. Set up a weekly email subscription for
the dashboard the previous step created, plus up to two alerts on its
highest-signal insights, so the wizard's output reaches an inbox and the metrics
that actually matter get flagged.

This step schedules a real recurring email and enrols the user in alert
notifications, standing side effects beyond the code integration they asked for.
Get consent before creating anything.

## The question

Ask exactly this, then follow the answer:

- "Want a weekly email digest of your new dashboard, plus alerts on up to two of
  its most important insights that email you when they move the wrong way?"
- Yes: create the subscription and the alerts.
- No: skip this whole step and create nothing.

## How you know you succeeded

Either the user declined and nothing was created, or what they agreed to exists in
PostHog with a link to each created record in your handoff, plus which insight(s)
got an alert and why. The report step relays this to the user.
