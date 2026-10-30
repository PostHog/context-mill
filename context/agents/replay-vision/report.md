---
type: report
flow: replay-vision
label: Report and hand off
sink: true
model_pi: openai/gpt-5.6-terra
effort_pi: low
model_sdk: claude-sonnet-5
effort_sdk: medium
skills: []
allowedTools: [Read, Glob, Grep, Write, posthog_exec]
disallowedTools: [enqueue_task]
dependsOn: [scanner-broken-experiences, scanner-user-frustration, scanner-session-summaries]
---

## Goal

Tell the user what Replay vision is now doing for them, from the handoffs of
every task in the run.

Open the report with whatever still stands between the user and their first
observation, from the enable-replay handoff, before anything else:

- **Session replay is off**: lead with it as an error, not a follow-up —
  session replay is off in this project, and no scanner runs until a project
  admin turns on "Record user sessions" under Settings → Session replay.
- **This run changed code**: lead with "Deploy this change: session replay
  only records from code your users run, so your scanners start when the
  first recording arrives." Name the files the run changed. Say the scanners
  cost nothing until then.
- **Nothing changed, but the project has no recordings yet**: don't ask for a
  deploy. Say the scanners start with the first recording and cost nothing
  until then. Add that if people already use the app, the version they run
  may not include the PostHog SDK yet.

Say session replay is recording only when the project already has
recordings. Then, briefly and concretely:

- Each scanner created or updated: its name, what it watches, its query
  scope, and its estimated monthly credit spend.
- Anything skipped or deferred, with the reason — a skipped scanner on a
  backend-only project is an outcome, not an apology.
- Where results appear: the Replay vision page in PostHog, with the first
  observations arriving as new recordings complete.

If the run also installed and initialized the SDK, say so — the user started
this command without PostHog and now has it.

Write the report to `./posthog-replay-vision-report.md` (the wizard shows this
file at the end of the run), then publish the same content as your handoff.

## How you know you succeeded

A user who reads only your report knows what watches their product, what it
costs, what still needs them, and where to look first.
