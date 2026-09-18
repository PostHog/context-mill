---
next_step: 2-session-replay-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at and seeds the audit ledger. Run it **before** any other work. Resolve zero ledger checks here — this step gates execution and seeds the ledger.

## Status

Emit:

```
[STATUS] Detecting PostHog session replay configuration
[STATUS] Seeding audit checklist
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `sessionRecording|session_recording|disable_session_recording|startSessionRecording|enableSessionReplay` — any session replay API or config across runtimes (web, mobile, wrapper utils).
2. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] No PostHog session replay configuration found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found, replay APIs not found:** continue. Some Step 3 (optimize) checks still apply via MCP project settings (sampling rate, triggers) even when the codebase has no replay-specific config.
- **Both found:** continue normally.

## Seed the audit ledger

Only after continuing from the decision above, seed the ledger. **The runtime does not pre-seed this skill's ledger** — call `mcp__wizard-tools__audit_seed_checks` directly here with the exact payload below. The tool replaces the file atomically, so calling it once at the start of every run is safe. Do not seed the ledger if this step aborts.

```json
{
  "checks": [
    { "id": "replay-minimum-duration-set", "area": "Session Replay", "label": "Replay has a positive minimum duration", "status": "pending" },
    { "id": "replay-mask-config", "area": "Session Replay", "label": "Replay keeps inputs masked on PII surfaces", "status": "pending" },
    { "id": "replay-disabled-in-test-envs", "area": "Session Replay", "label": "Replay is disabled in test and CI environments", "status": "pending" },
    { "id": "replay-strict-minimum-duration", "area": "Session Replay", "label": "Replay uses strict minimum duration", "status": "pending" },
    { "id": "replay-sampling-rate", "area": "Session Replay — Optimize", "label": "Replay sampling rate matches recording volume", "status": "pending" },
    { "id": "replay-triggers-configured", "area": "Session Replay — Optimize", "label": "Replay triggers focus on important sessions", "status": "pending" },
    { "id": "replay-network-recording-filtered", "area": "Session Replay — Optimize", "label": "Replay network recording filters payloads", "status": "pending" },
    { "id": "replay-mobile-sampling", "area": "Session Replay — Optimize", "label": "Mobile replay uses sampling below 100%", "status": "pending" }
  ]
}
```

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-session-replay-fix.md`**.
