---
next_step: 2-session-replay-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog session replay configuration
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `sessionRecording|session_recording|disable_session_recording|startSessionRecording|enableSessionReplay` — any session replay API or config across runtimes (web, mobile, wrapper utils).
2. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] No PostHog session replay configuration found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found, replay APIs not found:** continue. Some Step 3 (optimize) checks still apply via MCP project settings (sampling rate, triggers) even when the codebase has no replay-specific config.
- **Both found:** continue normally.

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-session-replay-fix.md`**.
