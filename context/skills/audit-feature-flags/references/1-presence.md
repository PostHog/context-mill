---
next_step: 2-feature-flags-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at, and records whether **server-side local evaluation** is in use (which gates several optimize checks). Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog feature flag usage
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. Flag API surface — any of:
   `getFeatureFlag|isFeatureEnabled|useFeatureFlag|onFeatureFlags|reloadFeatureFlags|getFeatureFlagPayload|featureFlags\.|posthog\.feature_enabled`
2. Local-evaluation signals — any of:
   `personal_api_key|getAllFlagsAndPayloads|getAllFlags`

## Decision

- **Surface grep returns zero hits anywhere in the project:** emit `[ABORT] No PostHog feature flag usage found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Surface grep finds hits:** continue.

## Record local-evaluation detection

Local evaluation is detected when the second grep returns **at least one hit** (the project either initializes a server SDK with `personal_api_key` / a feature-flags secure API key, or calls a local-evaluation-only API like `getAllFlagsAndPayloads` / `getAllFlags` on the server). Keep this signal in working memory — Step 3 uses it to decide whether to run two of the optimize subagents or skip them as `pass` with `details: "skip: local evaluation not detected"`.

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-feature-flags-fix.md`**.
