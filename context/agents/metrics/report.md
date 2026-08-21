---
type: report
flow: metrics
label: Report and hand off
sink: true
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [integration-v2-notebook]
allowedTools: [Read, Glob, Grep, posthog_exec]
disallowedTools: [enqueue_task]
dependsOn: [instrument-metrics]
---

## Goal

Tell the user what their service now measures, from the handoffs of every task
in the run. Briefly and concretely:

- Each metric now recording: its name, type (counter, gauge, histogram), and
  where in the code it fires.
- The service name the client reports under, and the SDK version the run
  verified or installed.
- Anything skipped or deferred, with the reason — an environment that blocked
  an upgrade is an outcome, not an apology.
- Where results appear: the Metrics page in PostHog, with the first series
  arriving as traffic flows.

If the run also installed or initialized the SDK, say so — the user started
this command without PostHog and now has it.

Publish the report with a single `publish_handoff` call, and mirror the same
markdown into a shareable PostHog notebook, emitting its URL with the
`[NOTEBOOK_URL]` marker. Do not write a report file — the handoff call and the
notebook are how the report reaches the user.

## How you know you succeeded

A user who reads only your report knows what their service measures, where
each number comes from, what still needs them, and where to look first. The
report went through one `publish_handoff` call and is mirrored into a PostHog
notebook whose URL is emitted with the `[NOTEBOOK_URL]` marker.
