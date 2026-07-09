---
next_step: 3-attribution-config.md
---

# Step 2 — Attribution capture (fix)

This step resolves five attribution-capture checks **in parallel**, one subagent per check:

- `attribution-utm-survives-landing`
- `attribution-survives-auth-redirect`
- `attribution-first-touch-set-once`
- `attribution-custom-click-ids`
- `attribution-on-conversion-events`

## Status

Emit before dispatching:

```
[STATUS] Auditing attribution capture
```

## Action — dispatch five subagents in one message

Make **five `Agent` tool calls in a single message** so they run concurrently. Wait for all five to return, then continue to `3-attribution-config.md`. Do not run any other tools between dispatch and the next step.

The bundled `utm-segmentation.md` reference holds PostHog's authoritative guidance on UTM auto-capture and campaign properties. It's typically at `.claude/skills/audit-attribution/references/utm-segmentation.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-attribution/references/utm-segmentation.md`. The bundled `identify-users.md` reference covers first-touch person properties. Each subagent reads only the references relevant to its check.

### Task A — `attribution-utm-survives-landing`

`description`: `Audit attribution-utm-survives-landing`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: attribution-utm-survives-landing.

Read this skill's bundled `utm-segmentation.md` reference once (typically `.claude/skills/audit-attribution/references/utm-segmentation.md`).

Background: PostHog auto-captures the standard `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` URL parameters from the page URL at PostHog init time. Several common patterns silently drop those params before PostHog gets to read them:
- Client-side router redirects (Next.js middleware redirects, locale rewrites, `www` → root redirects) that drop the query string.
- A landing page that strips its query string in a useEffect / mounted hook (often "for cleanliness") before `posthog.init` runs.
- Service workers or edge functions rewriting the request URL.
- PostHog init that runs after a route change — by then the `?utm_*` is gone from `window.location.search`.

Run **three** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — init sites.
- `searchParams|URLSearchParams|window\.location\.search|router\.replace|router\.push|history\.replaceState|history\.pushState|setQuery|\.replace\(\{[^}]*query` — URL/query-string manipulation sites.
- `middleware\.(ts|js)|next\.config\.(js|ts|mjs)|redirects\s*:|rewrites\s*:|locale.*redirect|i18n` — server-side routing config that might strip query params.

Read each file that contains a query-manipulation hit, once. For each manipulation site, determine whether it removes `utm_*` parameters before the PostHog init has had a chance to fire (look for evidence the manipulation runs in the same component / module that mounts before the PostHog provider, or in middleware that runs server-side before the page renders).

Rule:
- pass: no obvious UTM-stripping patterns detected, OR PostHog init clearly runs before any detected query manipulation.
- suggestion: the project has middleware / redirects that COULD strip query params but no direct evidence they touch `utm_*`. Recommend the operator add UTM passthrough to the redirect chain.
- warning: a code path explicitly strips query params before PostHog init runs (e.g. a top-level `useEffect` calling `router.replace(pathname)` in the same provider tree as `<PostHogProvider>`).

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-utm-survives-landing`, including `file` (path:line of the most relevant manipulation site) and `details` as compact JSON:

```
{
  "init_runs_before_query_manipulation": <true|false|unknown>,
  "manipulation_sites": ["<path:line>", ...],
  "recommendation": "keep | preserve-utms-in-redirects | reorder-init-before-strip"
}
```

Return when the call completes. Do not write the audit report.
````

### Task B — `attribution-survives-auth-redirect`

`description`: `Audit attribution-survives-auth-redirect`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: attribution-survives-auth-redirect.

Read this skill's bundled `utm-segmentation.md` reference once (typically `.claude/skills/audit-attribution/references/utm-segmentation.md`).

Background: OAuth / SSO authentication redirects the user away from the site (to Auth0 / Clerk / WorkOS / Supabase / Firebase / Google / GitHub / etc.) and back via a callback URL. UTM parameters present on the click that started the signup flow do NOT survive this redirect unless the application deliberately preserves them. Three preservation patterns are valid:
1. **sessionStorage / localStorage stash**: read `utm_*` before redirecting, store, restore on callback before firing `posthog.identify()` or the signup event.
2. **OAuth `state` param**: encode UTM values into the `state` string the auth provider echoes back on callback.
3. **Cookie stash**: set a short-lived first-party cookie with UTM values before the redirect.

Without preservation, PostHog's first-touch person properties (`$initial_utm_*`) may already have been set from the landing pageview, but the signup conversion event itself fires without UTMs — making it impossible to correlate ad spend with funnel completion.

Run **three** Greps in parallel:
- `(?i)(authorize|signin|signup|signIn|signUp|loginWith|signInWith|redirectToSignIn|workos|auth0|clerk|supabase\.auth|firebase\.auth|next-auth|auth-js|@oauth|oauth)` — auth redirect surfaces.
- `(?i)(utm_source|utm_campaign).{0,80}(sessionStorage|localStorage|setCookie|document\.cookie|state\s*:|state\s*=)` — UTM stash patterns.
- `(?i)(callback|/api/auth/callback|/auth/callback|onAuthStateChange)` — callback handlers.

Read files matching any of these once. Determine:
- Does the project have an OAuth / SSO redirect flow at all?
- If yes, is there logic that reads `utm_*` from the URL before the redirect AND restores them after the callback?

Rule:
- pass with details "skip: no OAuth/SSO redirect flow detected" — project has no detected auth redirect.
- pass: project has an auth-redirect flow AND a detectable UTM preservation pattern (stash + restore) is present.
- warning: project has an auth-redirect flow AND NO detected UTM preservation. The signup conversion event will not carry the original UTMs, breaking ad-attribution correlation. Recommend adding a sessionStorage stash before the redirect and a restore in the callback handler.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-survives-auth-redirect`, including `file` (path:line of the most relevant auth-redirect site or callback handler) and `details` as compact JSON:

```
{
  "auth_redirect_detected": <true|false>,
  "preservation_pattern_detected": "session-storage | local-storage | oauth-state | cookie | none",
  "callback_handler_site": "<path:line or null>",
  "recommendation": "keep | add-stash-and-restore"
}
```

Return when the call completes. Do not write the audit report.
````

### Task C — `attribution-first-touch-set-once`

`description`: `Audit attribution-first-touch-set-once`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: attribution-first-touch-set-once.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-attribution/references/identify-users.md`).

Background: first-touch attribution properties — `$initial_referrer`, `$initial_referring_domain`, `$initial_utm_*`, `signup_date`, `first_seen_*`, `original_*` — should be written with `$set_once`, not `$set`. PostHog's own `$initial_*` properties are managed by the SDK and use `$set_once` automatically; the risk is project-defined first-touch attrs (e.g. `original_partner_id`, `signup_landing_page`, `first_seen_plan_intent`) being written with `$set`, which overwrites the first-touch value on every subsequent identify and corrupts attribution analytics.

Run **two** Greps in parallel:
- `posthog\.identify\(|setPersonProperties\(` — identify and person-property-setter call sites.
- `\$set\b|\$set_once\b|setOnce\(|setPersonPropertiesOnce` — every $set / $set_once usage in the project.

Read each file that contains a `$set` or `$set_once` hit, once. For each usage, classify the property keys being passed:
- Project-defined first-touch property — name starts with `initial_`, `first_`, `original_`, or contains `signup_date`, `landing_`, `first_seen_`, `acquisition_`.
- General mutable property — `plan`, `email`, `last_seen_*`, `account_status`, etc.

Flag any project-defined first-touch property written with `$set` (not `$set_once`).

Rule:
- pass: no project-defined first-touch properties detected, OR every project-defined first-touch property is written with `$set_once`.
- warning: 1+ project-defined first-touch properties written with `$set` — every subsequent identify() overwrites the original-touch value.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-first-touch-set-once`, including `file` (path:line of the most representative offending $set) and `details` as compact JSON:

```
{
  "first_touch_using_set_count": <N>,
  "examples": [
    {"file": "<path:line>", "property": "<key>", "issue": "first-touch-using-set"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

### Task D — `attribution-custom-click-ids`

`description`: `Audit attribution-custom-click-ids`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: attribution-custom-click-ids.

Read this skill's bundled `utm-segmentation.md` reference once (typically `.claude/skills/audit-attribution/references/utm-segmentation.md`).

Background: PostHog auto-captures the standard UTM parameters but does NOT auto-capture ad-platform click identifiers: `gclid` (Google Ads), `fbclid` (Facebook / Meta), `msclkid` (Microsoft / Bing), `ttclid` (TikTok), `twclid` (Twitter / X), `li_fat_id` (LinkedIn), `pinterest_click_id`, etc. These click ids are what enable downstream conversion APIs (Google Ads "Enhanced Conversions", Meta CAPI, etc.) and revenue-attribution platforms to credit specific ad clicks for specific conversions. Without them, paid acquisition campaigns can't measure ROAS accurately.

Run **two** Greps in parallel:
- `gclid|fbclid|msclkid|msfclkid|ttclid|twclid|li_fat_id|wbraid|gbraid|pinterest_click_id|sccid` — explicit click-id handling in the codebase.
- `gtag\(|fbq\(|window\.dataLayer|googletagmanager|google.ads|facebook.com/tr|googleads|meta-pixel|<script.*[gG]oogle.*[Aa]nalytics` — paid-acquisition signals (ad pixels, GTM, ad-platform integrations).

If the second grep returns ZERO hits and Step 1's acquisition-signal grep also showed no `utm_*` references, resolve `pass` with `details: "skip: no paid-acquisition signal detected"` and return.

Otherwise, for projects that show acquisition signals, check whether any click ids are captured at all:
- A `posthog.capture()` or `posthog.setPersonProperties()` call that reads click ids from the URL (`searchParams.get('gclid')`, `URLSearchParams(location.search).get('fbclid')`, etc.) and passes them as event or person properties.
- A `before_send` hook or similar that decorates events with click ids.

Rule:
- pass: no paid-acquisition signal detected, OR at least Google + one social click id are captured.
- suggestion: project shows paid-acquisition signal but captures NO click ids — recommend capturing at least `gclid`, `fbclid`, and `msclkid` as event or person properties on landing pageviews so downstream conversion APIs can correlate.
- warning: project shows paid-acquisition signal AND captures some click ids but the capture only fires on a specific surface (e.g. signup page) that misses the original landing URL — recommend capturing them as `$set_once` at PostHog init time or on the first pageview.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-custom-click-ids`, including `file` (path:line of any click-id handling site, or the most relevant ad-pixel site) and `details` as compact JSON:

```
{
  "paid_acquisition_signals": ["gtag" | "fbq" | "gtm" | "meta-pixel" | "linkedin-insight" | ...],
  "click_ids_captured": ["gclid" | "fbclid" | "msclkid" | ...],
  "click_ids_missing": ["gclid" | "fbclid" | ...],
  "recommendation": "keep | capture-major-click-ids | move-capture-to-landing"
}
```

Return when the call completes. Do not write the audit report.
````

### Task E — `attribution-on-conversion-events`

`description`: `Audit attribution-on-conversion-events`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: attribution-on-conversion-events.

Read this skill's bundled `utm-segmentation.md` reference once (typically `.claude/skills/audit-attribution/references/utm-segmentation.md`).

Background: PostHog's auto-captured `$initial_utm_*` and `$initial_referrer` person properties get set on the first pageview and persist on the person profile. But the signup / activation / purchase EVENT itself — the conversion event used in funnel analytics and revenue attribution — does not automatically carry those values. Without explicit attribution properties on the conversion event, you can't slice "signups by utm_campaign" or "MRR by referring_domain" in event-side insights; you can only do it via person-property breakdown, which loses event-time fidelity.

Run **two** Greps in parallel:
- `posthog\.capture\(` — every capture call site.
- `(?i)(sign.?up|signed.?up|user.?registered|user.?created|account.?created|trial.?started|subscribe|purchase|checkout.?completed|payment.?completed|activated|onboarded)` — conversion-event name and surface signals.

Read files matching the conversion-event signals once. For each `posthog.capture()` call whose first argument names a conversion event (signup, signed_up, user_registered, subscription_started, purchase_completed, etc.), inspect the properties object.

Determine whether the properties include attribution context:
- UTM properties (`utm_source`, `utm_campaign`, etc.) OR
- Click ids (`gclid`, `fbclid`, etc.) OR
- `$initial_*` properties echoed back OR
- A `referrer` / `landing_url` / `acquisition_channel` field.

Rule:
- pass with details "skip: no conversion events detected" — no obvious conversion captures found.
- pass: every conversion-event capture includes attribution context.
- suggestion: 1–2 conversion-event captures lack attribution context — recommend enriching with UTMs / click ids at capture time so event-side breakdowns work.
- warning: 3+ conversion-event captures (or any high-priority conversion like `purchase`/`subscription_started`) lack attribution context — paid-acquisition ROI cannot be measured at event-time fidelity.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `attribution-on-conversion-events`, including `file` (path:line of the most representative un-enriched capture) and `details` as compact JSON:

```
{
  "conversion_capture_count": <N>,
  "captures_without_attribution_count": <N>,
  "examples": [
    {"file": "<path:line>", "event": "<event name>", "issue": "missing-utm | missing-click-id | missing-referrer"}
  ]
}
```

Return when the call completes. Do not write the audit report.
````

## After all five return

Continue to **`3-attribution-config.md`**.
