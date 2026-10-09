---
type: workflows
flow: integration-v2
label: Suggest workflows
runnerSeeded: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-5
effort_sdk: high
skills: [integration-v2-workflows]
allowedTools: [Read, Write, Glob, Grep]
disallowedTools: [Edit, Bash, enqueue_task]
dependsOn: [capture, identify, review]
---

## Goal

Read the events this run instrumented and the app they live in, and decide
whether any of them should start a PostHog workflow: an email that reaches a
user at a moment in their lifecycle, such as just after they sign up, when they
stall in onboarding, or after they cancel.

Where one fits, design it for this app: trigger it on this app's own event,
wait for this app's own follow-up event, and write the email for this product.
Then write your designs to `.posthog-wizard-cache/.posthog-workflows.json`. The
wizard shows them to the user after the run, and creates the ones the user
picks as drafts. You create nothing in PostHog yourself.

Touch no project code. The proposals file is the only file you write.

## How you know you succeeded

The proposals file exists and matches the format in the skill. Each proposal
is built only on events in `.posthog-wizard-cache/.posthog-events.json`, emails
a user whose email the app sends to PostHog, and has a reason a person can
check in one line. When nothing fits, the file holds an empty list and your
handoff says why.

Fewer, better proposals beat more of them. Three is the most you may write.
