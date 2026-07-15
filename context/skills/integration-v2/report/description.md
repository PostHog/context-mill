# Write the setup report

Write `posthog-setup-report.md` at the project root summarizing the integration.
When the file doesn't exist, write it directly — don't attempt a read first. If
a previous run left one behind, `Read` it, then replace it wholesale (harnesses
refuse to overwrite a file that wasn't read; nothing in the old report is worth
merging).
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

End with a "Before you merge" checklist as GitHub-style checkboxes (`- [ ] …`),
including only the items that apply to what was set up — judge each against the
code changed this run and drop the ones that don't fit:

- Always: run a full production build (the wizard only verified the files it
  touched) and fix any lint or type errors the generated code introduced.
- Always: run the test suite — instrumented call sites may need updated mocks or
  fixtures.
- If env vars were added: their exact names are in `.env.example` and any
  monorepo/bootstrap scripts, and set in the deploy environments, not just locally.
- If the app ships minified browser bundles: wire source-map upload into CI so
  production stack traces de-minify — call it out with the docs link.
- If LLM analytics was set up: trigger the instrumented call path and confirm
  `$ai_generation` events appear in PostHog.
- If auth exists and identify was wired: the returning-visitor path also calls
  identify, so returning sessions don't fragment onto anonymous distinct IDs.

Keep it skimmable. This is the artifact the user opens after the run.
