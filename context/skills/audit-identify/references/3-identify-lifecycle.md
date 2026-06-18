---
next_step: 4-identify-optimize.md
---

# Step 3 — Identify (lifecycle quality)

This step resolves three lifecycle-quality checks **in parallel**, one subagent per check. These cover *how* identify-adjacent APIs are used over time — distinct from Step 2's basic correctness checks and from Step 4's cost-side checks.

- `identify-set-discipline`
- `identify-alias-usage`
- `identify-groupidentify-correctness`

## Skip case — no `posthog.identify` calls found

If Step 1's identify grep returned **zero** hits, resolve all three checks in a single `audit_resolve_checks` call with `status: "pass"` and `details: "skip: no posthog.identify call sites detected"`. Then continue to **`4-identify-optimize.md`**. Do not dispatch subagents.

## Status

Emit before dispatching:

```
[STATUS] Auditing identify lifecycle quality
```

## Action — dispatch three subagents in one message

Make **three `Agent` tool calls in a single message** so they run concurrently. Wait for all three to return, then continue to `4-identify-optimize.md`. Do not run any other tools between dispatch and the next step.

The bundled `identify-users.md` reference holds PostHog's authoritative guidance on `identify()`, `$set` / `$set_once`, `alias()`, and `groupIdentify()`. It's typically at `.claude/skills/audit-identify/references/identify-users.md`; if that path doesn't exist, discover it with `Glob` `**/skills/audit-identify/references/identify-users.md`. Each subagent reads it once before judging.

### Task A — `identify-set-discipline`

`description`: `Audit identify-set-discipline`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-set-discipline.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`). Focus on the `$set` vs `$set_once` guidance: `$set` overwrites every time and should be reserved for properties that genuinely change (plan tier, last_seen_app_version). `$set_once` is for first-touch attributes that should never be overwritten (initial_referrer, signup_date, first_seen_country). Calling `$set` on every `capture()` inflates person-property version count and is the most common form of "person property bloat".

Run **two** Greps in parallel:
- `posthog\.identify\(` — identify call sites (where $set / $set_once belong).
- `\$set\b|\$set_once\b|setPersonProperties\(|setOnce\(` — every $set / $set_once usage across capture, identify, and standalone calls.

Read each file that contains a hit, once. For every `$set` / `$set_once` usage, classify where it lives:
- **inside identify()** — the canonical location. Fine.
- **inside a dedicated person-properties setter** (e.g. `posthog.setPersonProperties()`) — fine.
- **inside capture() calls** — possibly fine if intentional, but flag if it happens in many call sites or with a wide property surface.
- **inside render-on-mount paths** (React useEffect with empty deps, Vue onMounted) — high risk of firing on every navigation.

Also flag patterns where `$set` is being used for first-touch attributes (initial_referrer, signup_date, first_seen_*, original_*) — these should use `$set_once`.

Rule:
- pass: $set / $set_once is used inside identify() or a dedicated setter, and first-touch attributes use $set_once.
- suggestion: $set appears inside ≤3 capture() call sites — minor person-property bloat risk.
- warning: $set appears inside ≥4 capture() call sites OR inside a render-on-mount path OR first-touch attributes (initial_referrer, signup_date, first_seen_*) use $set instead of $set_once.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-set-discipline`, with `file` set to the most representative offending path:line, and `details` as compact JSON:

```
{
  "set_inside_identify_count": <N>,
  "set_inside_capture_count": <N>,
  "set_in_render_path_count": <N>,
  "first_touch_using_set_not_set_once": ["<property>", ...],
  "examples": [
    {"file": "<path:line>", "issue": "set-on-capture | set-in-render | first-touch-wrong-api"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `identify-alias-usage`

`description`: `Audit identify-alias-usage`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-alias-usage.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`). Focus on the `alias()` guidance: modern PostHog SDKs handle the anonymous → identified merge automatically when `identify()` is called for the first time. `alias()` is mostly legacy and is only needed in narrow cases (e.g. linking a server-side distinct_id to a known account_id when the client never called identify).

Run **one** Grep: `posthog\.alias\(|posthog\.createAlias\(`. If zero matches, resolve `pass` with `details: "no alias() usage detected"` and return — this is the healthy default.

Otherwise read each file that contains a hit, once. For each alias() call, determine:
- **Is there also a posthog.identify() call for the same user in the same flow?** If yes, the alias() call is likely redundant — identify() already handles merging.
- **Is alias() being called with the same id as the current distinct_id?** That's a no-op that still emits a `$create_alias` event.
- **Is alias() being used in a server-side context to link an anonymous client distinct_id to a server-known user id?** That's a legitimate use case — pass.

Rule:
- pass: no alias() calls, OR alias() is used only for legitimate server-side identity linking.
- suggestion: alias() is called alongside identify() for the same user — likely redundant. Recommend removal.
- warning: alias() is called with the same id as the current distinct_id, OR alias() is the only identity API used (no identify() anywhere) — the project should switch to identify().

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-alias-usage`, with `file` set to the most representative alias() path:line if any, and `details` as compact JSON:

```
{
  "alias_call_count": <N>,
  "redundant_with_identify_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "redundant-with-identify | self-alias | only-identity-api"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

### Task C — `identify-groupidentify-correctness`

`description`: `Audit identify-groupidentify-correctness`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: identify-groupidentify-correctness.

Read this skill's bundled `identify-users.md` reference once (typically `.claude/skills/audit-identify/references/identify-users.md`; otherwise discover with `Glob` `**/skills/audit-identify/references/identify-users.md`). Focus on the group analytics section: `posthog.group(type, key, properties?)` sets the active group context (so subsequent events are attributed to that group) and may call `groupIdentify` internally to set group properties. `posthog.groupIdentify(type, key, properties)` is the lower-level API that emits a `$groupidentify` event to set group properties without changing the active context.

Run **one** Grep: `posthog\.group\(|posthog\.groupIdentify\(|\$groupidentify`. If zero matches, resolve `pass` with `details: "skip: project does not use group analytics"` and return.

Otherwise read each file that contains a hit, once. For each `group()` / `groupIdentify()` call, check:
- **Valid groupType:** the first argument should match one of the project's configured group types in `posthog.init({ ..., groups: { ... } })`. Read the init file once if not already in memory.
- **Stable groupKey:** the second argument should be a stable identifier (account_id, org_id), not a session UUID or ephemeral value.
- **Properties shape:** if a third properties argument is passed, it should be flat and intentional (not a JSON-stringified blob or 20+ keys).
- **Call placement:** `group()` should be called when the user enters a group context (e.g. after login, on org switch). `groupIdentify()` should be called when group properties change, not on every page load.

Rule:
- pass: group / groupIdentify calls use valid configured group types, stable keys, and reasonable placement.
- warning: groupKey is unstable (session UUID, request id) OR groupType is not in the init's `groups` config OR groupIdentify is called inside a render-on-mount path with no condition.
- error: group() or groupIdentify() is called with a literal empty string, undefined, or null for type/key.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `identify-groupidentify-correctness`, with `file` set to the most representative group/groupIdentify call path:line, and `details` as compact JSON:

```
{
  "group_call_count": <N>,
  "groupidentify_call_count": <N>,
  "invalid_group_type_count": <N>,
  "unstable_key_count": <N>,
  "render_path_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "invalid-type | unstable-key | render-path | empty-arg"}
  ]
}
```

Return when the call completes. Do not write the audit report.
```

## After all three return

Continue to **`4-identify-optimize.md`**.
