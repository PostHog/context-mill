# Write the setup report

Write `posthog-setup-report.md` at the project root summarizing the integration.
It is a new file you create — write it directly, do not read it first.
Draw on two sources only:

- the run's queue log — `.posthog-wizard-cache/queue.json`, which holds each
  task's handoff inline — for what each step did, whether identify was wired
  or skipped, and any build conflict;
- `.posthog-wizard-cache/.posthog-events.json` — the events that were instrumented.
  If that file is missing or empty, reconstruct the list instead of dropping the
  table: grep the changed files for `capture(` calls and read the capture step's
  handoff in `queue.json`.

Include:

- A one-line summary of what was set up.
- What was installed and how PostHog was initialized.
- The events instrumented, as a table: event name, what it measures, and the file
  (from `.posthog-wizard-cache/.posthog-events.json`).
- Whether user identification was wired or skipped, and why.
- The error tracking added.
- The dashboard link.
- Any build conflict, in full.
- Clear next steps for the user.

End with a short "Before you merge" checklist, including only the items that
apply to what was set up:

- If the app ships minified browser bundles, source maps must be uploaded so
  error stack traces are readable — call it out with the docs link.
- The new env vars (the project token and host) are documented for other
  developers and set in the deploy environments, not just locally.
- Returning users are identified on load, not only at the login moment, so a
  returning user's events do not fragment across anonymous and identified.

Keep it skimmable. This is the artifact the user opens after the run.
