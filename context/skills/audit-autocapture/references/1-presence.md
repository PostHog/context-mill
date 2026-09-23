---
next_step: 2-autocapture-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at. Run it **before** any other work. Resolve zero ledger checks here unless the explicit-disable case below applies.

## Status

Emit:

```
[STATUS] Detecting PostHog autocapture configuration
[STATUS] Seeding audit checklist
```

## Action

Run **one `Grep` call** with `output_mode: "files_with_matches"`:

1. `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — any PostHog initialization across runtimes (web, server, mobile, wrapper utils).

If init sites are found, `Read` each file once and inspect the init options for `autocapture` configuration. Record:

- Whether `autocapture` is set at all.
- Whether `autocapture: false` is explicitly set (disabled).
- Whether `autocapture: true` or `autocapture: { ... }` is explicitly set (enabled).
- Whether `autocapture` is unset (silently on for posthog-js, off for other SDKs).

## Decision

- **Grep returns zero hits anywhere in the project:** emit `[ABORT] PostHog SDK initialization not found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found:** seed the audit ledger, then continue based on the autocapture configuration.

## Seed the audit ledger

The runtime does not pre-seed this skill's ledger, so call `mcp__wizard-tools__audit_seed_checks` with the exact payload below. The tool replaces the file atomically, so one call at the start of every run is safe. Do not seed the ledger when this step aborts. Seeding is not resolving checks.

```json
{
  "checks": [
    { "id": "autocapture-intentional", "area": "Autocapture", "label": "Autocapture is explicitly configured", "status": "pending" },
    { "id": "autocapture-mask-config", "area": "Autocapture", "label": "Autocapture PII masking stays enabled", "status": "pending" },
    { "id": "autocapture-allowlists", "area": "Autocapture", "label": "Autocapture is scoped on high-traffic projects", "status": "pending" },
    { "id": "autocapture-ratio-to-custom", "area": "Autocapture — Optimize", "label": "Autocapture and custom events have a healthy mix", "status": "pending" },
    { "id": "autocapture-copied-text", "area": "Autocapture — Optimize", "label": "Copied text capture stays off on high-traffic sites", "status": "pending" },
    { "id": "autocapture-dead-clicks-vs-heatmap", "area": "Autocapture — Optimize", "label": "Dead-click autocapture is off when heatmaps suffice", "status": "pending" }
  ]
}
```

## Continue

- **Init found, `autocapture: false` is explicitly set on every init site:** autocapture is fully off. Resolve all three Step 2 fix checks (`autocapture-intentional`, `autocapture-mask-config`, `autocapture-allowlists`) in a single `audit_resolve_checks` call with `status: "pass"` and `details: "skip: autocapture explicitly disabled in init config"`. Then continue to Step 3 — optimize-side checks still have work to do for the dead-clicks and ratio checks.
- **Init found, autocapture not fully disabled:** continue normally.

Do not call `audit_resolve_checks` for any other ids in this step. Do not preload future steps.

Continue to **`2-autocapture-fix.md`**.
