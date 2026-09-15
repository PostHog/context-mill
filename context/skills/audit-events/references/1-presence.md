---
next_step: 2-events-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at, then seeds the ledger the later steps resolve against. Run it **before** any other work. Resolve zero ledger checks here — this step gates and seeds only.

## Status

Emit:

```
[STATUS] Detecting PostHog event capture usage
```

## Load the tools

Load via `ToolSearch select:Grep,mcp__wizard-tools__audit_seed_checks,mcp__wizard-tools__audit_resolve_checks` once at the start of this step. Later steps reuse `audit_resolve_checks` to patch each check as it resolves, so it stays loaded.

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes (web, server, mobile, wrapper utils).
2. `posthog\.capture\(|analytics\.capture\(` — any explicit capture call site.

## Decision

- **Both greps return zero hits anywhere in the project:** emit `[ABORT] PostHog SDK initialization not found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found, capture not found:** continue. Step 2 (fix) will detect this and resolve its five ledger checks with skip details. Step 3 (optimize) still has work to do because pageview defaults and downstream usage may still matter.
- **Both found:** continue normally.

## Seed the audit ledger

Do this only on the continue paths above — never after an `[ABORT]`.

The ledger lives at `.posthog-audit-checks.json` and renders live in the wizard sidebar / "Audit plan" tab. **The runtime does not pre-seed this skill's ledger** — `wizard audit events` runs through the generic skill program, which seeds nothing, so `audit_resolve_checks` rejects every id until the ledger exists. Call `mcp__wizard-tools__audit_seed_checks` directly here with the exact payload below. The tool replaces the file atomically, so calling it once at the start of every run is safe.

```json
{
  "checks": [
    { "id": "capture-event-names-static",    "area": "Event Capture", "label": "Event names are static string literals",              "status": "pending" },
    { "id": "event-naming-standardization",  "area": "Event Capture", "label": "Event names follow one consistent convention",        "status": "pending" },
    { "id": "event-duplicates-and-bloat",    "area": "Event Capture", "label": "No duplicate or kitchen-sink events",                 "status": "pending" },
    { "id": "event-quality-context-review",  "area": "Event Capture", "label": "Capture calls are free of PII and hot-path issues",   "status": "pending" },
    { "id": "capture-fires-on-success",      "area": "Event Capture", "label": "Completion events fire on success, not on intent",    "status": "pending" },
    { "id": "event-usage-coverage",          "area": "Event Capture — Optimize", "label": "Captured events are used downstream",      "status": "pending" },
    { "id": "events-pageview-defaults",      "area": "Event Capture — Optimize", "label": "Pageview / pageleave defaults are sized right", "status": "pending" },
    { "id": "events-env-pollution",          "area": "Event Capture — Optimize", "label": "Dev / staging events are not leaking into production", "status": "pending" }
  ]
}
```

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-events-fix.md`**.
