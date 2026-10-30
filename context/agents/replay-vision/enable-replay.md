---
type: enable-replay
flow: replay-vision
label: Make session replay record
model_pi: openai/gpt-5.6-terra
effort_pi: low
model_sdk: claude-sonnet-5
effort_sdk: medium
skills: [replay-vision-enable-replay]
allowedTools: [Read, Edit, Glob, Grep, posthog_exec]
disallowedTools: [Write, Bash, enqueue_task]
dependsOn: [install, init]
---

## Goal

Make session replay actually record. Recording has a server half and a client
half, and either one can silently cancel the other.

Server half: call `products-enable` (via `exec`: `info products-enable`, then
`call products-enable {"products": ["session_replay"]}`). It is idempotent and
server-owned; `"enabled"` and `"already_enabled"` are both success.

- **Tool missing on this deploy**: don't fail the task — your handoff says
  session replay is **off** and the user must turn on "Record user sessions"
  under Settings → Session replay. Then finish.
- **Permission rejection**: same, from a project-admin account. Replay being
  off is a blocker, not a note: scanners created later sit idle until
  recording is on, then start working with no re-setup.

Client half, web apps only: check the `posthog.init(...)` options.
`disable_session_recording: true` cancels the server flip — remove it (or set
it `false`). If nothing overrides recording, leave the init alone. This is the
only code edit this task may make: never restructure the init, never add new
instrumentation. If you can't confidently locate or edit the init, record a
follow-up instead of guessing.

Pure backend or mobile app with no web surface: nothing records browser
sessions here. Say so in your handoff and finish — scanner tasks read your
handoff and skip what doesn't apply.

Then read what actually records: call `vision-scanners-estimate` once with no
`query` and read `matched_sessions_in_window` — the sessions this project
recorded in the last `window_days`. Turning the setting on does not make
recordings arrive: code changed on this machine records nothing until it
runs where real users reach it.

## How you know you succeeded

Your handoff states three facts plainly, because later tasks and the report
trust it:

- **Replay setting**: on, or off and why.
- **Code changed**: yes or no — yes when this run installed or initialized
  the SDK (upstream handoffs) or you edited the init. Name the files.
- **Recordings so far**: the count, or "unknown" if the estimate call failed.

When code changed, the handoff says the user must deploy (merge and release)
this change before any recording, and so any scanner observation, arrives.
A zero count with no code change is not a reason to ask for a deploy: the
setup may be complete and the app may have no traffic yet. Say that scanners
start with the first recording.
