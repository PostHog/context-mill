# Make session replay record — {display_name}

Session replay has a server half and a client half. Either one can silently
cancel the other, so this step always checks both.

## Server half

Enable recording with the `products-enable` tool (via `exec`:
`info products-enable`, then `call products-enable {"products": ["session_replay"]}`).
It is idempotent and server-owned; `"enabled"` and `"already_enabled"` are both
success. Never try to flip recording through any other endpoint.

A missing tool or a permission rejection means this token cannot turn replay
on, not that it is off. Read the real setting with `project-get`
(`session_recording_opt_in`): `true` is **on**, `false` is **off** until a
project admin turns it on, and a failed read is **unknown**.

## Client half

Only web apps record browser sessions. In the `posthog.init(...)` options,
`disable_session_recording: true` cancels the server flip — remove it or set it
`false`. If nothing overrides recording, leave the init alone.

The only code edit this step may make is removing or flipping
`disable_session_recording` in an existing init call. Never restructure the
init, never add new instrumentation, never touch anything else.

## What actually records

Both halves on does not mean recordings arrive. Read two counts:

- **Recordings**: every recording in the last 30 days, however short, with
  `execute-sql`:
  `SELECT uniq(session_id) AS recordings FROM session_replay_events WHERE start_time >= now() - INTERVAL 30 DAY`.
- **Scannable sessions**: `vision-scanners-estimate` with no `query`, read
  `matched_sessions_in_window` and `window_days`. It counts only sessions long
  enough to scan, so a site with short visits can read 0 here and still
  record.

A code change made here — this step's edit, or an SDK install earlier in the
run — records nothing until the user deploys it. When the init reads the
project key or host from environment variables, name them (never their
values): a deploy records nothing until they are set in production. Hand off
the setting (on, off, or unknown), whether code changed (and which files to
deploy, without env files or anything gitignored),
the env vars, and both counts with `window_days`.

The framework docs below show what this framework's init looks like, so you
can find it and read its options confidently.
