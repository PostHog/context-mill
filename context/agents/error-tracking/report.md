---
type: report
flow: error-tracking
label: Summarise and hand off
sink: true
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: []
allowedTools: [Read, Glob, Grep, Write, posthog_exec]
disallowedTools: [enqueue_task]
dependsOn: [capture-exceptions, wire-ci, test-setup]
---

## Goal

Tell the user what error tracking now does for them and what they still have
to do, from the handoffs of every task in the run. `read_handoffs` gives you
each task's report — the capture mechanism, the files changed, the env
variable names, the CI secret to create, and any deploy path that could not be
traced. Do not re-derive any of it from the project.

First, turn on the Error Tracking product for the team (`products-enable`
through `posthog_exec`) so the captured exceptions have a UI to land in. If
the call fails or the tool is missing, carry it as a follow-up — never fail
the report over it.

Write the hand-off to `posthog-error-tracking-report.md` at the top level of
this project's directory. When the run wired source-map upload, START it with
a **"What you still need to do"** section — numbered, copy-pasteable:

1. Create a personal API key with the 'Source map upload' preset at
   `<UI_HOST>/settings/user-api-keys` (skip when the credentials handoff says
   the key is already written).
2. Add it as the CI secret the wire-ci step referenced, named exactly as in
   the pipeline config.
3. Any other manual follow-up the handoffs carry (an untraceable deploy path,
   provider-side settings).

Then cover, briefly and concretely:

- How uncaught errors reach PostHog now — the capture mechanism and the files
  that carry it.
- If the run also installed and initialized the SDK, say so — the user
  started this command without PostHog and now has it.
- When source-map upload was wired: the files changed (paths only), the exact
  production build command, and that every production build now uploads.
- When it was skipped: one line saying why (readable stack traces on this
  platform) — an outcome, not an apology.
- How to verify: trigger any error and look at
  `<UI_HOST>/project/<PROJECT_ID>/error_tracking`; uploaded symbol sets appear
  at `<UI_HOST>/project/<PROJECT_ID>/error_tracking/configuration`.

Never write a secret value into the report — only variable names. Replace
`<UI_HOST>` and `<PROJECT_ID>` from your project context. Give the same
summary in chat.

## How you know you succeeded

`posthog-error-tracking-report.md` exists and a user who reads only it knows
how errors reach PostHog, the follow-ups they still owe (the API key and the
CI secret named exactly, when upload was wired), and where in PostHog to see
the first captured exception.
