# Write the setup report

Write `posthog-setup-report.md` at the project root summarizing the integration.
Draw on two sources only:

- the run's queue log — `.posthog-wizard-cache/queue.json`, which holds each
  task's handoff inline — for what each step did, whether identify was wired
  or skipped, and any build conflict;
- `.posthog-events.json` — the events that were instrumented.

Include:

- A one-line summary of what was set up.
- What was installed and how PostHog was initialized.
- The events instrumented, as a table: event name, what it measures, and the file
  (from `.posthog-events.json`).
- Whether user identification was wired or skipped, and why.
- The error tracking added.
- The dashboard link.
- Any build conflict, in full.
- Clear next steps for the user.

Keep it skimmable. This is the artifact the user opens after the run.
