---
next_step: 2-roster-checks.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog feature flag usage
```

## Action

Run **one `Grep` call** with `output_mode: "files_with_matches"`, scoped to source code only — exclude `node_modules`, `vendor`, build/dist output, and documentation (`*.md`, `*.mdx`, `README*`). A match inside a doc file or a code comment isn't a real call site; a match that's just a method name with no trailing `(` (e.g. inside the PostHog snippet loader's own stub method list, or an SDK config option like `preloadFeatureFlags: true`) isn't either.

- Flag API surface — any of:
  `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|onFeatureFlags\(|reloadFeatureFlags\(|getFeatureFlagPayload\(|featureFlags\.\w+\(|posthog\.feature_enabled\(|feature_enabled\(|is_feature_enabled\(|get_feature_flag\(|get_feature_flag_payload\(`

## Decision

- **Zero hits anywhere in the project:** emit `[ABORT] No PostHog feature flag usage found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Hits found:** continue.

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-roster-checks.md`**.
