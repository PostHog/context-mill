---
next_step: 2-identify-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog identify usage
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes (web, server, mobile, wrapper utils).
2. `posthog\.identify\(|analytics\.identify\(` — any identify call site.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] No PostHog SDK initialization found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found, identify not found:** continue. Step 2 (fix) will detect this and resolve its four ledger checks with skip details. Step 3 (optimize) still has work to do because `person_profiles` config still matters even without identify calls.
- **Both found:** continue normally.

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-identify-fix.md`**.
