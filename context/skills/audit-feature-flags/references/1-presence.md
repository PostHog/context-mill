---
next_step: 2-feature-flags-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at, and records whether **server-side local evaluation** is in use (which gates several optimize checks). Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog feature flag usage
[STATUS] Seeding audit checklist
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. Flag API surface — any of:
   `getFeatureFlag|isFeatureEnabled|useFeatureFlag|onFeatureFlags|reloadFeatureFlags|getFeatureFlagPayload|featureFlags\.|posthog\.feature_enabled`
2. Local-evaluation signals — any of:
   `personal_api_key|getAllFlagsAndPayloads|getAllFlags`

## Decision

- **Surface grep returns zero hits anywhere in the project:** emit `[ABORT] No PostHog feature flag usage found` and stop. The wizard catches `[ABORT]` and terminates the run. Do not seed the ledger.
- **Surface grep finds hits:** continue.

## Seed the audit ledger

The ledger lives at `.posthog-audit-checks.json` and renders live in the wizard sidebar / "Audit plan" tab. **The runtime does not pre-seed this skill's ledger**, so call `mcp__wizard-tools__audit_seed_checks` here with the exact payload below. Do not seed when this step aborts. The tool replaces the file atomically, so one call at the start of every run is safe.

```json
{
  "checks": [
    { "id": "ff-bootstrap-when-known-set", "area": "Feature Flags", "label": "Known initial flag sets use bootstrap", "status": "pending" },
    { "id": "ff-await-readiness", "area": "Feature Flags", "label": "Flag evaluation waits for readiness", "status": "pending" },
    { "id": "ff-default-values", "area": "Feature Flags", "label": "Flag evaluations have safe default values", "status": "pending" },
    { "id": "ff-bootstrap-distinct-id-mismatch", "area": "Feature Flags", "label": "Bootstrap distinct ID matches stable identity", "status": "pending" },
    { "id": "ff-identified-only-pre-auth-targeting", "area": "Feature Flags", "label": "Pre-auth flag targeting works for anonymous users", "status": "pending" },
    { "id": "ff-active-but-unreferenced", "area": "Feature Flags — Optimize", "label": "Active flags have codebase references", "status": "pending" },
    { "id": "ff-local-eval-polling-interval", "area": "Feature Flags — Optimize", "label": "Local evaluation uses an intentional polling interval", "status": "pending" },
    { "id": "ff-local-eval-in-edge-handlers", "area": "Feature Flags — Optimize", "label": "Edge handlers avoid local flag evaluation", "status": "pending" },
    { "id": "ff-test-ci-gating", "area": "Feature Flags — Optimize", "label": "Test and CI runs gate flag evaluation", "status": "pending" }
  ]
}
```

## Record local-evaluation detection

Local evaluation is detected when the second grep returns **at least one hit** (the project either initializes a server SDK with `personal_api_key` / a feature-flags secure API key, or calls a local-evaluation-only API like `getAllFlagsAndPayloads` / `getAllFlags` on the server). Keep this signal in working memory — Step 3 uses it to decide whether to run two of the optimize subagents or skip them as `pass` with `details: "skip: local evaluation not detected"`.

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-feature-flags-fix.md`**.
