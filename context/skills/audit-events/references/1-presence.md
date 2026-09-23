---
next_step: 2-events-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog event capture usage
[STATUS] Seeding audit checklist
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes (web, server, mobile, wrapper utils).
2. `posthog\.capture\(|analytics\.capture\(` — any explicit capture call site.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] PostHog SDK initialization not found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found, capture not found:** continue. Step 2 (fix) will detect this and resolve its four ledger checks with skip details. Step 3 (optimize) still has work to do because pageview defaults and downstream usage may still matter.
- **Both found:** continue normally.

## Seed audit ledger

The runtime does not pre-seed this skill's ledger, so call `mcp__wizard-tools__audit_seed_checks` here with the exact payload below. The tool replaces the file atomically, so one call at the start of every run is safe. Do not seed when this step aborts.

```json
{
  "checks": [
    { "id": "capture-event-names-static", "area": "Event Capture", "label": "Event names use static strings", "status": "pending" },
    { "id": "event-naming-standardization", "area": "Event Capture", "label": "Event names follow a consistent convention", "status": "pending" },
    { "id": "event-duplicates-and-bloat", "area": "Event Capture", "label": "Event captures have no duplicates or bloat", "status": "pending" },
    { "id": "event-quality-context-review", "area": "Event Capture", "label": "Event captures contain no material quality issues", "status": "pending" },
    { "id": "event-usage-coverage", "area": "Event Capture — Optimize", "label": "Captured events are used in PostHog artifacts", "status": "pending" },
    { "id": "events-pageview-defaults", "area": "Event Capture — Optimize", "label": "Automatic pageviews do not dominate event volume", "status": "pending" },
    { "id": "events-env-pollution", "area": "Event Capture — Optimize", "label": "Production project excludes non-production events", "status": "pending" }
  ]
}
```

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-events-fix.md`**.
