---
next_step: 2-identify-fix.md
---

# Step 1 — Presence detector + seed the ledger

This step decides whether the rest of the audit has anything to look at and seeds the audit ledger. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog identify usage
[STATUS] Seeding audit checklist
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes (web, server, mobile, wrapper utils).
2. `posthog\.identify\(|analytics\.identify\(` — any identify call site.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] PostHog SDK initialization not found` and stop. The wizard catches `[ABORT]` and terminates the run. Do not seed the ledger.
- **Init found, identify not found:** continue. Step 2 (fix) will detect this and resolve its five ledger checks with skip details. Step 3 (optimize) still has work to do because `person_profiles` config still matters even without identify calls.
- **Both found:** continue normally.

## Seed the audit ledger

The ledger lives at `.posthog-audit-checks.json` and renders live in the wizard sidebar / "Audit plan" tab. **The runtime does not pre-seed this skill's ledger** — call `mcp__wizard-tools__audit_seed_checks` directly here with the exact payload below. The tool replaces the file atomically, so calling it once at the start of every run is safe. Do not seed when this step aborts.

```json
{
  "checks": [
    { "id": "identify-stable-distinct-id", "area": "Identification", "label": "Identify uses stable authenticated distinct IDs", "status": "pending" },
    { "id": "identify-not-late", "area": "Identification", "label": "Identify runs before captures and flag evaluations", "status": "pending" },
    { "id": "cross-runtime-distinct-id", "area": "Identification", "label": "Client and server use the same distinct ID", "status": "pending" },
    { "id": "identify-reset-on-logout", "area": "Identification", "label": "Logout and account switches call posthog.reset()", "status": "pending" },
    { "id": "identify-sequential-calls", "area": "Identification", "label": "Each flow has one consistent identify call", "status": "pending" },
    { "id": "identify-set-discipline", "area": "Identification — Lifecycle", "label": "Person properties use $set and $set_once correctly", "status": "pending" },
    { "id": "identify-alias-usage", "area": "Identification — Lifecycle", "label": "Alias usage does not block identity merges", "status": "pending" },
    { "id": "identify-groupidentify-correctness", "area": "Identification — Lifecycle", "label": "Group calls use valid types and stable keys", "status": "pending" },
    { "id": "identify-person-profiles-mode", "area": "Identification — Optimize", "label": "person_profiles matches traffic shape", "status": "pending" },
    { "id": "identify-isidentified-guard", "area": "Identification — Optimize", "label": "Identify calls are guarded against repeat firing", "status": "pending" },
    { "id": "identify-duplicate-identify-per-session", "area": "Identification — Optimize", "label": "$identify events do not repeat within sessions", "status": "pending" },
    { "id": "identify-duplicate-groupidentify-per-session", "area": "Identification — Optimize", "label": "$groupidentify events do not repeat within sessions", "status": "pending" },
    { "id": "server-process-person-profile", "area": "Identification — Server SDK", "label": "Server captures disable unwanted person processing", "status": "pending" },
    { "id": "server-sdk-flush-on-exit", "area": "Identification — Server SDK", "label": "Short-lived server SDKs flush before exit", "status": "pending" },
    { "id": "server-set-without-identify", "area": "Identification — Server SDK", "label": "Server $set captures have a canonical identify call", "status": "pending" }
  ]
}
```

Seeding is not resolving. Do not call `audit_resolve_checks` in this step.

Do not read any files in this step. Do not preload future steps.

Continue to **`2-identify-fix.md`**.
