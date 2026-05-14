---
next_step: 3-autocapture-optimize.md
---

# Step 2 — Autocapture (fix)

This step resolves three correctness checks **in parallel**, one subagent per check:

- `autocapture-intentional`
- `autocapture-mask-config`
- `autocapture-allowlists`

## Skip case — autocapture explicitly disabled everywhere

If Step 1 detected `autocapture: false` on every init site, Step 1 has already resolved these three checks with skip details. Do not dispatch subagents — continue to **`3-autocapture-optimize.md`**.

## Status

Emit before dispatching:

```
[STATUS] Auditing autocapture correctness
```

## Action — dispatch three subagents in one message

Make **three `Task` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `3-autocapture-optimize.md`. Do not run any other tools between dispatch and the next step.

The bundled `autocapture.md` reference holds PostHog's authoritative guidance on autocapture config, allowlists, ignorelists, and PII handling. It's typically at `.claude/skills/audit-autocapture/references/autocapture.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-autocapture/references/autocapture.md`. Each subagent reads it once before judging.

### Task A — `autocapture-intentional`

`description`: `Audit autocapture-intentional`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-intentional.

Read this skill's bundled `autocapture.md` reference once (typically `.claude/skills/audit-autocapture/references/autocapture.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/autocapture.md`).

Run **two** Greps in parallel:
- `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` — every init site.
- `(?i)(password|credit.?card|ssn|social.?security|patient|health|medical|hipaa|phi|bank|routing.?number|payment|checkout|billing|invoice)` — sensitivity hints across the project. Use `output_mode: "files_with_matches"` and `head_limit: 25`.

Read each init file once. Determine whether `autocapture` is explicitly configured in the init options (either `autocapture: false`, `autocapture: true`, or `autocapture: { ... }`).

Also Glob `**/*.{html,jsx,tsx,vue,svelte}` and quickly Grep for `<form|<input|<textarea` to confirm the project renders form UIs.

Rule:
- pass: `autocapture` is explicitly configured (true, false, or an object) on the init site — operator has made an intentional choice.
- suggestion: `autocapture` is unset (silently on for posthog-js) AND the project shows no sensitivity hints AND no form rendering — silent default is acceptable but explicit config is recommended.
- warning: `autocapture` is unset AND the project shows sensitivity hints (form rendering, payment/healthcare keywords) — silent autocapture on a sensitive project risks capturing PII. Recommend explicit `autocapture: { url_allowlist: [...], element_allowlist: [...], element_attribute_ignorelist: [...] }` config.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-intentional`, including `file` (path:line of the init site) and `details` as compact JSON:

```
{
  "autocapture_setting": "true | false | object | unset",
  "form_rendering_detected": <true|false>,
  "sensitivity_keywords_hit_count": <N>,
  "recommendation": "keep | add-explicit-config | add-allowlists"
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `autocapture-mask-config`

`description`: `Audit autocapture-mask-config`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-mask-config.

Read this skill's bundled `autocapture.md` reference once (typically `.claude/skills/audit-autocapture/references/autocapture.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/autocapture.md`). Focus on PII handling: autocapture sanitizes `password`, `credit-card`, and OTP fields by default and respects `mask_all_text` / `mask_all_element_attributes`. Explicitly setting either to `false` opens the door to capturing visible PII in form fields and attributes.

Run **two** Greps in parallel:
- `mask_all_text\s*:|mask_all_element_attributes\s*:` — look for explicit mask config.
- `<form|<input|<textarea` across `**/*.{html,jsx,tsx,vue,svelte}` — confirm form rendering.

Read every file that contains a `mask_*` hit, once.

Rule:
- pass: neither `mask_all_text: false` nor `mask_all_element_attributes: false` is set, OR the project renders no forms.
- warning: `mask_all_text: false` OR `mask_all_element_attributes: false` is explicitly set AND the project renders forms — PII (passwords mid-typing, billing data, healthcare fields) may now be visible in `$autocapture` and `$snapshot` events.
- error: both `mask_all_text: false` AND `mask_all_element_attributes: false` are set on a project with form rendering — strong PII leak risk.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-mask-config`, with `file` set to the most representative mask-config path:line (or the init file if no mask hits), and `details` as compact JSON:

```
{
  "mask_all_text": "true | false | unset",
  "mask_all_element_attributes": "true | false | unset",
  "form_rendering_detected": <true|false>,
  "recommendation": "keep | restore-default-masking | re-enable-element-attr-mask"
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `autocapture-allowlists`

`description`: `Audit autocapture-allowlists`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: autocapture-allowlists.

Read this skill's bundled `autocapture.md` reference once (typically `.claude/skills/audit-autocapture/references/autocapture.md`; otherwise discover with `Glob` `**/skills/audit-autocapture/references/autocapture.md`). Focus on the autocapture allow/ignorelist section: `url_allowlist`, `url_ignorelist`, `element_allowlist`, and `css_selector_allowlist` are the main levers for scoping `$autocapture` event volume on high-traffic projects.

Run **one** Grep: `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(`. Read each init file once. Determine:
- Is `autocapture: true` or `autocapture: { ... }` set?
- If an object, does it contain `url_allowlist`, `url_ignorelist`, `element_allowlist`, OR `css_selector_allowlist`?

Also Glob for route files to estimate traffic surface:
- `**/{app,pages,routes,src/routes,src/pages}/**/*.{js,jsx,ts,tsx,vue,svelte}` — count matches.

A project with **5+ route/page files** is "high-traffic-looking" for this check.

Rule:
- pass: `autocapture: false`, OR `autocapture` is an object with at least one allowlist/ignorelist, OR the project is not high-traffic-looking (<5 route files).
- suggestion: `autocapture: true` (or unset, defaulting to on) is set on a high-traffic-looking project (5+ route files) with no allowlist or ignorelist — recommend scoping with `url_allowlist` / `url_ignorelist` / `css_selector_allowlist` to cut `$autocapture` volume.
- warning: `autocapture: true` is explicitly set on a high-traffic-looking project AND no allowlist/ignorelist AND the project also shows sensitivity hints — strongly recommend scoping.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `autocapture-allowlists`, including `file` (path:line of the init site) and `details` as compact JSON:

```
{
  "autocapture_setting": "true | false | object | unset",
  "has_url_allowlist": <true|false>,
  "has_url_ignorelist": <true|false>,
  "has_element_allowlist": <true|false>,
  "has_css_selector_allowlist": <true|false>,
  "route_file_count": <N>,
  "recommendation": "keep | add-url-allowlist | add-css-selector-allowlist"
}
```

Return when the call completes. Do not write the audit report.
```

## After all three return

Continue to **`3-autocapture-optimize.md`**.
