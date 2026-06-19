---
next_step: 2-attribution-fix.md
---

# Step 1 — Presence detector + seed the ledger

This step decides whether the rest of the audit has anything to look at, seeds the audit ledger, and records signals later steps need. Run it **before** any other work.

## Tools

Load via `ToolSearch select:Grep,mcp__wizard-tools__audit_seed_checks,mcp__wizard-tools__audit_resolve_checks` once at the start of this step. Subsequent steps reuse `audit_resolve_checks` to patch each check as it resolves, so it stays loaded.

## Status

Emit, in order:

```
[STATUS] Detecting PostHog and attribution surfaces
[STATUS] Seeding audit checklist
```

## Action

### a. Detect presence

Run **two `Grep` calls in parallel**, both with `output_mode: "files_with_matches"`:

1. PostHog init surface — any of:
   `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(`
2. Attribution / acquisition signals — any of:
   `utm_source|utm_medium|utm_campaign|gclid|fbclid|msclkid|msfclkid|li_fat_id|ttclid|twclid|partner_id|referrer_id`

### b. Abort or continue

- **Init grep returns zero hits anywhere in the project:** emit `[ABORT] No PostHog SDK initialization found` and stop. The wizard catches `[ABORT]` and terminates the run. Do NOT seed the ledger in this case.
- **Init found:** continue to (c). Even projects with no explicit click-id capture rely on PostHog's built-in UTM auto-capture; each step's individual rules decide whether to skip or warn based on the kind of evidence present.

### c. Seed the audit ledger

The ledger lives at `.posthog-audit-checks.json` and renders live in the wizard sidebar / "Audit plan" tab. **The runtime does not pre-seed this skill's ledger** — call `mcp__wizard-tools__audit_seed_checks` directly here with the exact payload below. The tool replaces the file atomically, so calling it once at the start of every run is safe.

```json
{
  "checks": [
    { "id": "attribution-utm-survives-landing",   "area": "Attribution", "label": "UTM params survive landing-page routing",                "status": "pending" },
    { "id": "attribution-survives-auth-redirect", "area": "Attribution", "label": "UTM params survive auth/OAuth redirects",                  "status": "pending" },
    { "id": "attribution-first-touch-set-once",   "area": "Attribution", "label": "First-touch attribution properties use $set_once",        "status": "pending" },
    { "id": "attribution-custom-click-ids",       "area": "Attribution", "label": "Ad-platform click ids captured (gclid, fbclid, msclkid)", "status": "pending" },
    { "id": "attribution-on-conversion-events",   "area": "Attribution", "label": "Conversion events carry attribution context",             "status": "pending" },
    { "id": "attribution-cross-subdomain-cookie",  "area": "Attribution — Configuration", "label": "cross_subdomain_cookie configured for multi-subdomain projects", "status": "pending" },
    { "id": "attribution-cookieless-mode-impact",  "area": "Attribution — Configuration", "label": "cookieless_mode tradeoff acknowledged",                          "status": "pending" },
    { "id": "attribution-consent-integration",     "area": "Attribution — Configuration", "label": "Consent banner wired to PostHog opt_in/opt_out",                 "status": "pending" },
    { "id": "write-report",                        "area": "Write report",                "label": "Render posthog-audit-attribution-report.md",                     "status": "pending" }
  ]
}
```

## Record acquisition signal for later steps

Keep the acquisition-signal grep result in working memory. Step 2's `attribution-custom-click-ids` check uses it to decide whether to warn on absence (project clearly runs paid acquisition but doesn't capture click ids) vs. skip (no paid-acquisition signal anywhere — silence is fine). Step 3's `attribution-cookieless-mode-impact` reuses the same signal.

Do not read any project files in this step. Do not call `audit_resolve_checks`. Do not preload future steps.

Continue to **`2-attribution-fix.md`**.
