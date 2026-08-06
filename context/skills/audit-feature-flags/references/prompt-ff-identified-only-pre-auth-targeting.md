---
description: Subagent prompt for ff-identified-only-pre-auth-targeting — read only by its dispatched subagent, never by the main loop
---

You are an audit subagent. Resolve exactly one rule and return: ff-identified-only-pre-auth-targeting.

Read this skill's bundled `best-practices.md` reference once (typically `.claude/skills/audit-feature-flags/references/best-practices.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/best-practices.md`).

Background: when `person_profiles: 'identified_only'` is set (the recommended default for most B2B SaaS), anonymous visitors don't create person profiles. If a feature flag targets users by person properties AND that flag is evaluated on a pre-auth surface (landing page, pricing page, signup form), the anonymous user has no person profile for the flag to evaluate against, so the flag silently returns its default value. The variant the operator intended to ship to "users in the EU" / "users on the Pro plan" never reaches anyone visiting before login. This is a silent failure — the flag appears to work for identified users but the anonymous-traffic branch quietly never fires.

Run **three** Greps in parallel:
- `person_profiles\s*:|personProfiles\s*:` — locate the person_profiles setting.
- `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(` — every flag-eval call site.
- `posthog\.identify\(` — every identify call (used to classify a surface as pre-auth or post-auth).

Step 1 — read the file(s) containing `person_profiles` hits to determine the configured value. If unset, the posthog-js default is `'identified_only'`. Record `mode` as `identified_only`, `always`, `never`, or `unset (defaults to identified_only)`.

Step 2 — if mode is NOT `identified_only` (or unset), resolve `pass` with `details: "skip: person_profiles is not identified_only"` and return.

Step 3 — for each flag-eval call site, read the surrounding file once. Classify it as **pre-auth** if it lives in: landing pages, marketing routes, pricing pages, signup/login UI components that render before the user authenticates, public homepage components, or any route gated to anonymous-only access. Classify as **post-auth** if the file also calls `posthog.identify()` in the same flow, requires authenticated session via middleware, or lives under a `/(app)/`, `/dashboard/`, `/(authenticated)/` style route.

Step 4 — for each pre-auth flag-eval site, attempt to determine whether the flag's targeting condition references person properties. The subagent can't read PostHog flag definitions; instead, flag any pre-auth eval whose flag key suggests person-property targeting (variants gated on plan, country, persona, role, signup_method, etc.) — name patterns like `eu-banner`, `pro-only-cta`, `enterprise-pricing-variant`. When ambiguous, default to warning and let the operator confirm.

Rule:
- pass: mode is not identified_only, OR no flag-eval call sites run on pre-auth surfaces, OR all pre-auth flag evals pass property overrides at eval time (`getFeatureFlag(key, { personProperties: {...} })` or equivalent).
- suggestion: 1–2 pre-auth flag-eval call sites exist but flag names don't strongly suggest person-property targeting — recommend the operator confirm flag definitions in PostHog.
- warning: 3+ pre-auth flag-eval call sites OR any pre-auth flag-eval whose flag name strongly suggests person-property targeting — anonymous users silently get default values. Recommend either passing property overrides at eval time, switching to `posthog.bootstrap.featureFlags` with server-computed values, or moving the eval behind authentication.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-identified-only-pre-auth-targeting`, including `file` (path:line of the most representative pre-auth flag-eval) and `details` as compact JSON:

```
{
  "person_profiles_mode": "identified_only | always | never | unset",
  "pre_auth_flag_eval_count": <N>,
  "examples": [
    {"file": "<path:line>", "flag_key": "<key>", "suspected_property_targeting": <true|false>}
  ]
}
```

Return when the call completes. Do not write the audit report.
