---
next_step: 2-attribution-fix.md
---

# Step 1 — Presence detector

This step decides whether the rest of the audit has anything to look at, and records signals later steps need. Run it **before** any other work. Resolve zero ledger checks here — this step is gating only.

## Status

Emit:

```
[STATUS] Detecting PostHog and attribution surfaces
```

## Action

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. PostHog init surface — any of:
   `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(`
2. Attribution / acquisition signals — any of:
   `utm_source|utm_medium|utm_campaign|gclid|fbclid|msclkid|msfclkid|li_fat_id|ttclid|twclid|partner_id|referrer_id`

## Decision

- **Init grep returns zero hits anywhere in the project:** emit `[ABORT] No PostHog SDK initialization found` and stop. The wizard catches `[ABORT]` and terminates the run.
- **Init found:** continue, regardless of whether attribution signals were detected. Even projects with no explicit click-id capture rely on PostHog's built-in UTM auto-capture; each step's individual rules decide whether to skip or warn based on the kind of evidence present.

## Record acquisition signal for later steps

Keep the acquisition-signal grep result in working memory. Step 2's `attribution-custom-click-ids` check uses it to decide whether to warn on absence (project clearly runs paid acquisition but doesn't capture click ids) vs. skip (no paid-acquisition signal anywhere — silence is fine).

Do not read any files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-attribution-fix.md`**.
