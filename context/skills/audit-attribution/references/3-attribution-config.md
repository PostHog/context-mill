---
next_step: 4-report.md
---

# Step 3 — Attribution configuration

This step resolves three configuration-side attribution checks **in parallel**, one subagent per check:

- `attribution-cross-subdomain-cookie`
- `attribution-cookieless-mode-impact`
- `attribution-consent-integration`

## Status

Emit before dispatching:

```
[STATUS] Auditing attribution configuration
```

## Action — dispatch three subagents in one message

Make **three `Agent` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `4-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `config.md` (posthog-js config reference) and `data-collection.md` (privacy / cookieless) references hold the canonical settings. Both are typically at `.claude/skills/audit-attribution/references/`. Each subagent reads only what its check needs.

### Task A — `attribution-cross-subdomain-cookie`

`description`: `Audit attribution-cross-subdomain-cookie`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: attribution-cross-subdomain-cookie.

Read this skill's bundled `config.md` reference once (typically `.claude/skills/audit-attribution/references/config.md`).

Background: when a project spans subdomains (e.g. `example.com` marketing site, `app.example.com` product, `dashboard.example.com` admin), PostHog's anonymous distinct_id by default lives in a cookie scoped to the exact subdomain. A user visiting `example.com?utm_source=google`, then clicking through to `app.example.com/signup`, gets two separate anonymous person profiles — the UTM-tagged one on the marketing host, and a fresh one on the app host. The cross-subdomain conversion isn't visible until they identify, and the initial UTMs never propagate to the app-side anonymous profile. The fix is `cross_subdomain_cookie: true` in the init config, which scopes the cookie to the registrable parent domain.

Run **two** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every init site.
- `cross_subdomain_cookie|crossSubdomainCookie` — explicit setting.

Read each init file once. Determine whether `cross_subdomain_cookie` is set. Also scan the project for subdomain signals to decide whether the project actually spans subdomains:
- README / package.json mentions of multiple subdomains.
- `next.config`, `vite.config`, `astro.config` with custom domains.
- Hard-coded URLs in source pointing at multiple subdomains of the same parent (e.g. `dashboard.example.com` and `example.com` both referenced).

Rule:
- pass: `cross_subdomain_cookie: true` is set, OR the project shows no signal of spanning subdomains (single-host project).
- suggestion: the project shows signals of spanning subdomains AND `cross_subdomain_cookie` is unset — recommend adding it on the browser init. Also verify the cookie `domain` value (when set explicitly) matches the parent (e.g. `.example.com`).
- warning: `cross_subdomain_cookie: true` is set but with a `cookie_domain` that doesn't match the parent (e.g. `.app.example.com` instead of `.example.com`) — the cookie is still scoped too narrowly.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-cross-subdomain-cookie`, including `file` (path:line of the init that sets or should set the option) and `details` as compact JSON:

```
{
  "cross_subdomain_cookie_setting": "true | false | unset",
  "cookie_domain_setting": "<value or null>",
  "subdomain_signals_detected": <true|false>,
  "recommendation": "keep | enable-cross-subdomain | fix-cookie-domain"
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `attribution-cookieless-mode-impact`

`description`: `Audit attribution-cookieless-mode-impact`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: attribution-cookieless-mode-impact.

Read this skill's bundled `data-collection.md` reference once (typically `.claude/skills/audit-attribution/references/data-collection.md`).

Background: `cookieless_mode` in posthog-js gives pseudonymous tracking without persistent identifiers. Two modes:
- `cookieless_mode: 'on_reject'` — falls back to cookieless tracking only for users who reject the consent banner.
- `cookieless_mode: 'always'` — cookieless for every user.

In cookieless mode, the SDK derives the anonymous identifier from a daily-rotating hash of user-agent + IP + day. This means **cross-session attribution is lost** — a user clicking an ad on Monday and signing up on Thursday cannot be linked. For sites running paid acquisition campaigns, this directly impacts the ability to measure ROAS. This is a legitimate tradeoff (privacy vs. measurement) but should be a conscious one, not silent.

Run **two** Greps in parallel:
- `cookieless_mode|cookielessMode` — explicit setting.
- `gtag\(|fbq\(|googletagmanager|google.ads|facebook.com/tr|googleads|meta-pixel|<script.*[gG]oogle.*[Aa]nalytics|utm_source|utm_campaign|gclid|fbclid` — paid-acquisition / attribution signals (re-use from Step 1 / 2 if already in working memory).

Read each file that contains a `cookieless_mode` hit, once. Record the value.

Rule:
- pass: `cookieless_mode` is unset, OR set to `'on_reject'` AND the project shows no paid-acquisition signal.
- suggestion: `cookieless_mode: 'on_reject'` is set AND the project shows paid-acquisition signals — note the cross-session attribution tradeoff so the operator is aware. Not necessarily a fix; this may be the intentional posture.
- warning: `cookieless_mode: 'always'` is set AND the project shows paid-acquisition signals — every user gets pseudonymous tracking. Cross-session attribution is impossible for ALL traffic, not just opted-out users. Recommend reviewing whether the posture matches the marketing goals.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-cookieless-mode-impact`, including `file` (path:line of the cookieless_mode setting, or the init if unset) and `details` as compact JSON:

```
{
  "cookieless_mode_setting": "on_reject | always | unset",
  "paid_acquisition_signal_detected": <true|false>,
  "recommendation": "keep | review-attribution-tradeoff"
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `attribution-consent-integration`

`description`: `Audit attribution-consent-integration`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: attribution-consent-integration.

Read this skill's bundled `data-collection.md` reference once (typically `.claude/skills/audit-attribution/references/data-collection.md`).

Background: cookie / tracking consent banners interact with PostHog in two attribution-relevant ways:
1. **PostHog loads BEFORE consent is granted** — landing pageview fires (and possibly captures UTMs) before the user has the chance to opt in. Depending on jurisdiction and consent posture, this may violate GDPR / ePrivacy.
2. **PostHog respects consent state via `opt_in_capturing()` / `opt_out_capturing()`** — when consent is granted, the SDK starts capturing; when revoked, it stops. If the integration is missing or the consent state isn't checked at init time, either no events are captured (silent attribution loss when consent IS granted but the check never fires) or every event is captured regardless of consent (legal risk).

Run **two** Greps in parallel:
- `opt_in_capturing|opt_out_capturing|optInCapturing|optOutCapturing|hasOptedIn|hasOptedOut` — explicit consent-API usage.
- `(?i)(cookie.?banner|cookie.?consent|consent.?banner|cookiebot|onetrust|osano|usercentrics|@iubenda|trackingConsent|gdprConsent|granted.*consent|consentGiven)` — consent surfaces.

Read each consent-surface file, once. Determine:
- Does the project have a detected consent surface at all? (If no, resolve `pass with details "skip: no consent surface detected"`.)
- Does the project call `posthog.opt_in_capturing()` / `opt_out_capturing()` when consent state changes?
- Is `posthog.init` called BEFORE or AFTER the consent state is known? (Look for init-after-consent patterns: init inside the consent banner's `onAccept` callback, or init gated on `consentGiven` state.)

Rule:
- pass with details "skip: no consent surface detected" — no consent banner detected.
- pass: consent surface exists AND `opt_in_capturing` / `opt_out_capturing` is integrated AND PostHog init either runs after consent OR explicitly starts in opt-out state.
- suggestion: consent surface exists but no PostHog opt-in/opt-out integration detected — recommend wiring the consent banner to PostHog's API so attribution capture respects user choice.
- warning: PostHog init runs before the consent surface mounts AND no `opt_out_capturing()` is called at init time — events fire before the user has chosen, with legal and attribution implications.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-consent-integration`, including `file` (path:line of the most relevant consent surface or init) and `details` as compact JSON:

```
{
  "consent_surface_detected": <true|false>,
  "opt_in_api_integrated": <true|false>,
  "init_runs_before_consent": <true|false|unknown>,
  "recommendation": "keep | wire-opt-in-api | gate-init-on-consent"
}
```

Return when the call completes. Do not write the audit report.
```

## After all three return

Continue to **`4-report.md`**.
