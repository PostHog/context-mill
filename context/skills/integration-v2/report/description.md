# Compose and publish the setup report

Compose the full setup report as markdown, then publish it in **one**
`publish_handoff` call. That call is how the report reaches the user's wizard
session. Do not write a report file. The same call mirrors the markdown into a
shareable PostHog notebook. The notebook skill says what its result means.

## Sources

Draw on two sources only:

- the run's queue log — `.posthog-wizard-cache/queue.json`, which holds each
  task's handoff inline — for what each step did, whether identify was wired
  or skipped, and any build conflict;
- `.posthog-wizard-cache/.posthog-events.json` — the events that were instrumented.
  If that file is missing or empty, reconstruct the list instead of dropping the
  table: grep the changed files for `capture(` calls and read the capture step's
  handoff in `queue.json`.

Handoffs are written mid-run, in task order, so a later handoff supersedes an
earlier one's forward-looking claims. Something an early task deferred — a
dependency to install, a check to run — was either done by a later task or
never done at all: report the final state, and let no "deferred" or "pending"
claim survive into the report.

## What to include

- A one-line summary of what was set up.
- What was installed and how PostHog was initialized.
- The events instrumented, as a table: event name, what it measures, and the file
  (from `.posthog-wizard-cache/.posthog-events.json`).
- Whether user identification was wired or skipped, and why.
- The error tracking added.
- AI Observability and Logs: what was configured or already present, or why each
  was skipped or failed. Use the task handoffs, including changed files and
  outstanding verification; do not treat a skipped or failed task as a
  successful setup. When AI Observability was configured, include its **Privacy
  mode** handoff section, opening with the plain disclaimer that prompt and
  completion content is captured and stored in PostHog, then the effective
  setting, the file and line to edit, when to enable privacy mode, and the
  [privacy-mode docs](https://posthog.com/docs/ai-observability/privacy-mode).
  Preserve any existing privacy decision; do not infer the setting from the
  default. When Logs was configured, say that only log lines added by this run
  are exported, and include the handoff's one-line pointer for routing the
  app's existing loggers into the same exporter if the user wants more. A
  product whose task was never queued because the run excluded it is not
  skipped work — leave it out of the report entirely.
- MCP analytics, when its task ran: the server instrumented and the path used,
  or why it was skipped or failed. Name any other MCP servers its handoff lists,
  with `npx @posthog/wizard mcp-analytics` as the way to instrument them. When
  review reverted the instrumentation over a version pin or toolchain, say what
  to raise before running that command. On a STDIO server, say to set the env
  variables in the `env` block of the MCP client's server config, because the
  client starts the server and nothing there reads the env file. For a Ruby or
  Rust server, say plainly that the SDK is experimental and not officially
  supported.
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
- If the app ships a Content-Security-Policy: load the app and check the console
  for CSP violations — a blocked SDK queues events silently and never sends.
- If AI Observability was set up: trigger the instrumented call path and confirm
  `$ai_generation` events appear in PostHog.
- If Logs was set up: trigger the code path that emits one of the added log
  lines and confirm the entry appears in PostHog Logs with the expected service
  and severity.
- If MCP analytics was set up: connect an agent, invoke a tool that is safe to
  run, and confirm a `$mcp_tool_call` event appears in PostHog.
- If auth exists and identify was wired: the returning-visitor path also calls
  identify, so returning sessions don't fragment onto anonymous distinct IDs.

Keep it skimmable. This is the artifact the user opens after the run.

## Publish

Compose the entire report in one model turn, starting with an `#` H1 heading.
Then call `publish_handoff` once, passing the full markdown as `content`:

```
publish_handoff({ "content": "<the full report markdown>" })
```

Do not fall back to writing a file. Then follow the notebook skill for what
the result means. The notebook is best effort and never fails this step.
Record its outcome in your final message. Do not call `publish_handoff` again.
