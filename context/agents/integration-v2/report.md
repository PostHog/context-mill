---
type: report
flow: integration-v2
label: Write the setup report
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-report, integration-v2-notebook, integration-v2-mcp]
allowedTools: [Read, Write, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [review]
---

## Goal

Write the handoff for this project — half a record of what the run did, half a brief
for the agent that picks up after it. Draw only on what the run itself recorded: the
queue log at `.posthog-wizard-cache/queue.json`, which holds every step's handoff
inline, the `product-signals` groom among them. Then mirror it into a shareable
PostHog notebook.

This run deliberately instrumented no events and built no insights or dashboards, so
the report is where that work gets handed over: the events worth capturing, the
analyses they would unlock, the data sources worth connecting, and prompts the user
can paste straight into their own agent. Ground every suggestion in the
`product-signals` findings and the files this run actually touched. If that groom is
missing from the queue log, say so in those sections rather than filling them with
guesses.

Separate what the run verified from what it did not. A passing build proves the code
compiles, not that events flow — never write that an event was captured unless the run
observed it arrive, and this run captured none. Where a step failed or was skipped, say
so plainly instead of rounding it up to success. Anything only the user can confirm
belongs in a checklist to work through before merging, each item naming the file and
line to look at.

Where a handoff reports something a step could not resolve — attribution it could not
establish, a product it could not enable for lack of permissions, a question the step
before it left open — that is not a caveat to bury in prose. Raise it as its own issue
to follow up, saying what is unresolved and what it costs if left alone.

## How you know you succeeded

`posthog-setup-report.md` exists at the project root, in the section order the report
skill lays out: what is set up, what was left for their agent, suggested events, the
analyses those events unlock, how to drive PostHog from an agent, copy-paste prompts,
suggested data sources, the before-you-merge checklist, and what the run did not do and
why. Every claim traces to a handoff, every suggestion traces to a signal or a file,
and what the run could not confirm reads as unconfirmed. The report is also mirrored
into a PostHog notebook whose URL is emitted with the `[NOTEBOOK_URL]` marker.
