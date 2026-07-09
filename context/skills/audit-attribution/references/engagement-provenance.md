# Engagement provenance — why each check exists

Reference for skill maintainers. Each check in this skill traces back to a production failure observed during a PostHog FDE engagement or support escalation. This file captures that pedigree so the next maintainer who asks "why do we check for `attribution-survives-auth-redirect`?" sees the customer impact, not just the rule prose.

This file is NOT loaded by the audit at runtime — it's bundled with the skill so it ships alongside the checks but stays out of the subagent context. Treat it as institutional memory for code review and check-rule iteration.

## Source engagements (anonymized)

### Multi-SDK SaaS A — identity merges at scale

- **Dual `posthog.init()` race corrupting `$set_once` attribution** (~165k blocked merges/day). Two browser inits on the signup page raced to stamp `$initial_pathname` and `$initial_referrer`, producing contradictory `$set_once` values stamped at the same millisecond.
  - Now lives in **`audit/references/2-init.md`** (`init-not-duplicated`).
- **Sequential identify calls** (auth provider UID → internal user ID, ~30–35k blocked merges/day). The first identify stamped the auth-provider UID as device identity; the second was blocked from merging because the device was already "identified."
  - Now lives in **`audit-identify/references/2-identify-fix.md`** (`identify-sequential-calls`).
- **Backend `posthog.alias()` making UUIDs identified**, blocking web SDK merges (~80–100k blocked merges/day). The server aliased a browser anonymous UUID to a user id; the next client identify() with the same UUID as `$anon_distinct_id` was silently blocked.
  - Now lives in **`audit-identify/references/3-identify-lifecycle.md`** — `identify-alias-usage` (polarity tightened to error on this case).
- **Missing `posthog.reset()` on workspace / account switch** (~3–9k blocked merges/day).
  - Already covered by `audit-identify` → `identify-reset-on-logout`.
- **`bootstrap.distinctID` overriding identity chain.**
  - Now lives in **`audit-feature-flags/references/2-feature-flags-fix.md`** (`ff-bootstrap-distinct-id-mismatch`).

### Consumer app B — backend SDK property corruption + event loss

- **posthog-python `$os` auto-attach** corrupting person properties (24% of profiles with `$os = "Linux"` on a macOS-heavy product).
  - Now lives in **`audit-identify/references/5-server-sdk.md`** (`server-process-person-profile`).
- **Missing alias on identity transitions** — solved by tightened `identify-alias-usage`.
- **Logout race conditions** — covered by `identify-reset-on-logout`.
- **Integer user_id as distinct_id** instead of stable UUID — covered by `identify-stable-distinct-id`.
- **Redundant backend identify calls** — covered by `identify-set-discipline` + `identify-alias-usage`.
- **SDK event loss on Celery worker termination** (background workers exiting before buffer flush).
  - Now lives in **`audit-identify/references/5-server-sdk.md`** (`server-sdk-flush-on-exit`).
- **Backend local-eval missing person properties** — not directly covered (flag-eval, not setup); `audit-feature-flags` → `ff-identified-only-pre-auth-targeting` flags the same root-cause shape.

### B2B SaaS C — data gaps and integrations

- **Missing `groupIdentify` at org creation** — covered by `audit-identify` → `identify-groupidentify-correctness`.
- **Internal event suppression** — covered by `audit-events` → `events-env-pollution`.
- **`$set`-without-`$identify` anti-pattern** — now lives in **`audit-identify/references/5-server-sdk.md`** (`server-set-without-identify`).
- **Stripe webhook handler not syncing billing state to PostHog** — out of scope for static codebase audit.

### Multi-surface app D — flags, consent, attribution

- **`person_profiles: identified_only` silently breaking property-targeted flags for anonymous users** on pre-auth surfaces.
  - Now lives in **`audit-feature-flags/references/2-feature-flags-fix.md`** (`ff-identified-only-pre-auth-targeting`).
- **`cookieless_mode` interaction with attribution for ad campaigns.**
  - Now lives in **`audit-attribution/references/3-attribution-config.md`** (`attribution-cookieless-mode-impact`).
- **Consent posture affecting cross-session attribution measurement.**
  - Now lives in **`audit-attribution/references/3-attribution-config.md`** (`attribution-consent-integration`).

### Pre-launch SaaS E — UTM loss through OAuth

- **UTM params lost through OAuth redirects.** A user clicked an ad with `?utm_source=google`, started signup, got redirected to the auth provider, came back via callback URL with no UTMs, and the signup event fired without any campaign context. The fix is a sessionStorage / state-param / cookie stash before the redirect.
  - Now lives in **`audit-attribution/references/2-attribution-fix.md`** (`attribution-survives-auth-redirect`).
- Highest priority for this skill because there was no canonical PostHog docs page covering the pattern — a parallel docs PR proposing one is the long-term remediation home.

### Cross-engagement patterns absorbed elsewhere

- **Event naming drift between autocapture and custom events** — `audit-events` → `event-naming-standardization`, `event-duplicates-and-bloat`.
- **SDK distribution and version inventory** — `audit` → `sdk-installed`, `sdk-up-to-date`.

## How to use this when adding new checks

When a new failure pattern surfaces in an FDE engagement or support escalation:

1. Decide whether it fits an existing check (patch) or warrants a new check (action A from the consolidation plan).
2. If a new check, decide whether it belongs in an existing skill (`audit-identify`, `audit-attribution`, etc.) or warrants a whole new skill (action B). Action B has a very high bar — Area 2 (attribution) clearing it is the rare case.
3. Add a one-paragraph entry here citing the engagement (anonymized), the customer-scale impact (blocked merges/day, event-loss share, attribution-coverage drop), and the file:line of the new check.
4. Cross-link from the check's `details` JSON to this provenance file when a one-line citation helps the operator (e.g. `"source_pattern_scale": "~80k blocked merges/day at multi-SDK SaaS A"`).

The goal is that six months from now, "why does this check exist?" has a one-paragraph answer with real engagement scale, not a guess.
