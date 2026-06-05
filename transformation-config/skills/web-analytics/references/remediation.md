# Web Analytics Doctor — Remediation

How to fix each check's finding. Apply a fix **only** for findings the user selected in the confirm step, and make only the change described here.

Each finding has a **fix type**:

- **code** — edit the user's project (usually the PostHog initialization / config).
- **settings** — change a PostHog project setting via the settings-mutation MCP tool. If no such tool is available, record it as manual guidance instead — do not fabricate a tool call.
- **manual** — environment- or app-specific. The doctor explains it in the report; the user acts. Not offered in the `wizard_ask` multi-select.

## Mapping

| checkId | Fix type | Action |
| --- | --- | --- |
| `pageleave_coverage` | code | Enable pageleave capture in the PostHog init. |
| `web_vitals_coverage` | code (+ settings) | Enable web vitals in the PostHog init; optionally enable web-vitals autocapture in settings. |
| `dark_authorized_urls` | settings | Remove the stale authorized URL(s) from the project's `app_urls`. |
| `partial_reverse_proxy` | manual (code where obvious) | Explain the proxy inconsistency; normalize `api_host` only if one obvious init is clearly wrong. |
| `duplicate_canonical_urls` | manual | Explain the duplication; recommend `$current_url`/`$host` and canonicalization review. No automatic change. |

## Per-check detail

### `pageleave_coverage` — code

Find the PostHog initialization (Grep for `posthog.init`, `new PostHog`, `PostHogProvider`, or `posthog/react`/`posthog-js/react` wrappers) and ensure pageleave capture is on:

```js
posthog.init('<token>', {
  api_host: '...',
  capture_pageleave: true,
})
```

Notes:
- In recent `posthog-js`, `capture_pageleave` defaults to `true`, so a low ratio usually means it was explicitly set to `false` or a single-page app isn't firing it on route changes — set it to `true` (or `'history_change'` for SPA route-based pageleaves).
- If the SDK is wrapped (Next.js `PostHogProvider`, a custom provider, etc.), edit the options object passed there.
- Change only this one option. Do not touch unrelated init config.

### `web_vitals_coverage` — code (+ settings)

Code: enable web vitals performance capture in the init:

```js
posthog.init('<token>', {
  capture_performance: { web_vitals: true },
})
```

Settings (optional): web-vitals autocapture can also be toggled in PostHog project settings (Web Analytics / Autocapture). If a settings-mutation MCP tool is available, enable it; otherwise note it under "Manual follow-up". Web vitals is `info` severity — keep the change minimal and don't override an existing `capture_performance` object's other keys.

### `dark_authorized_urls` — settings

The finding is an authorized URL (`app_urls`) with effectively zero traffic. Because the user selected this finding, treat that as consent to remove the stale URL:

- If a PostHog settings-mutation MCP tool is available, fetch the current `app_urls` (via `project-get`), remove the dark URL(s), and write the updated list back.
- If no settings tool is available, record manual guidance: list the exact URL(s) to remove and link the project settings page.

Caveat to surface in the report: zero traffic can also mean an ad blocker is eating events (not a stale URL). If the host is one the user clearly still ships to, recommend a reverse proxy (`partial_reverse_proxy` docs) instead of removal.

### `partial_reverse_proxy` — manual (code where obvious)

Reverse-proxy setup spans infrastructure (edge rewrites, proxy config) and SDK config (`api_host`/`ui_host`), so default to manual guidance: explain which hosts are proxied vs. direct, with counts, and link `https://posthog.com/docs/advanced/proxy`.

Only if there is a single, unambiguous PostHog init with a clearly wrong or missing `api_host` (e.g. pointing straight at `*.posthog.com` while the rest of the app proxies) may you normalize it as a code fix. When in doubt, leave it manual.

### `duplicate_canonical_urls` — manual

App-specific; no automatic change. In the report, name the duplicated path and the hosts it appears under, and recommend: review `$current_url`/`$host` capture, and canonicalize hosts (e.g. redirect `www.` → apex, or ensure a single consistent `$host`) so the same page isn't split across domains.
