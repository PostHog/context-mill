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
half, and either one can silently cancel the other. Every path, including the
early finishes below, ends with the handoff in "How you know you succeeded".

Server half: call `products-enable` (via `exec`: `info products-enable`, then
`call products-enable {"products": ["session_replay"]}`). It is idempotent and
server-owned; `"enabled"` and `"already_enabled"` are both success.

- **Tool missing on this deploy**: you cannot tell whether replay is on. Hand
  off the replay setting as **unknown**, with a follow-up to check "Record
  user sessions" under Settings → Session replay. Continue with the client
  half.
- **Permission rejection**: the setting stays as it is, and this token cannot
  turn it on. Hand off the replay setting as **off**, with a follow-up for a
  project admin to turn on "Record user sessions". Scanners created later sit
  idle until recording is on, then start working with no re-setup. Continue
  with the client half.

Client half, web apps only: check the `posthog.init(...)` options.
`disable_session_recording: true` cancels the server flip — remove it (or set
it `false`). If nothing overrides recording, leave the init alone. This is the
only code edit this task may make: never restructure the init, never add new
instrumentation. If you can't confidently locate or edit the init, record a
follow-up instead of guessing.

Pure backend or mobile app with no web surface: nothing records browser
sessions here. Say so in your handoff — scanner tasks read your handoff and
skip what doesn't apply.

Then read what actually records. Turning the setting on does not make
recordings arrive: code changed on this machine records nothing until it runs
where real users reach it.

- **Recordings**: run `execute-sql` with
  `SELECT uniq(session_id) AS recordings FROM session_replay_events WHERE start_time >= now() - INTERVAL 30 DAY`.
  This counts every recording, however short.
- **Scannable sessions**: call `vision-scanners-estimate` once with no
  `query`, and read `matched_sessions_in_window` and `window_days`. This
  counts only sessions long enough to scan, over the last `window_days`.
  Scanner tasks size from it.

## How you know you succeeded

Your handoff states these facts plainly, because later tasks and the report
trust it:

- **Replay setting**: on, off, or unknown, and why.
- **Code changed**: yes or no — yes when this run installed or initialized
  the SDK (upstream handoffs) or you edited the init. Name the files.
- **Env vars**: when this run wrote the init and it reads the project key or
  host from environment variables, name those variables, never their values.
  They are usually in a gitignored env file, so a deploy records nothing until
  they are set in production too.
- **Recordings**: the 30-day count, or "unknown" if the query failed.
- **Scannable sessions**: `matched_sessions_in_window` and `window_days`, or
  "unknown" if the estimate failed.

When code changed, the handoff says the user must deploy (merge and release)
this change, with the env vars above set in production, before any recording,
and so any scanner observation, arrives. A zero count with no code change is
not a reason to ask for a deploy: the setup may be complete and the app may
have no traffic yet. Say that scanners start with the first recording.
