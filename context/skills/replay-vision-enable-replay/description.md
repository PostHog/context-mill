# Make session replay record — {display_name}

Session replay has a server half and a client half. Either one can silently
cancel the other, so this step always checks both.

## Server half

Enable recording with the `products-enable` tool (via `exec`:
`info products-enable`, then `call products-enable {"products": ["session_replay"]}`).
It is idempotent and server-owned; `"enabled"` and `"already_enabled"` are both
success. Never try to flip recording through any other endpoint.

## Client half

Only web apps record browser sessions. In the `posthog.init(...)` options,
`disable_session_recording: true` cancels the server flip — remove it or set it
`false`. If nothing overrides recording, leave the init alone.

The only code edit this step may make is removing or flipping
`disable_session_recording` in an existing init call. Never restructure the
init, never add new instrumentation, never touch anything else.

## What actually records

Both halves on does not mean recordings arrive. Read the project's recent
recording count once with `vision-scanners-estimate` and no `query`
(`matched_sessions_in_window`, measured over `window_days`). A code change
made here — this step's edit, or an SDK install earlier in the run — records
nothing until the user deploys it. Hand off whether the setting is on,
whether code changed (and which files), and the count, so the report can tell
the user to deploy when that is what stands between them and their first
recording.

The framework docs below show what this framework's init looks like, so you
can find it and read its options confidently.
