---
next_step: 3-report.md
---

# Step 2 — Roster alignment checks

This step resolves five checks **in parallel**, one subagent per check. All five need PostHog MCP access; four of the five also need the repository:

- `ff-active-but-unreferenced` — PostHog + repo
- `ff-ghost-flag-key` — PostHog + repo
- `ff-stale-full-rollout` — PostHog + repo
- `ff-multivariate-as-boolean` — PostHog + repo
- `ff-flag-missing-metadata` — PostHog only, no repo side. Included because it's what makes `ff-stale-full-rollout`'s exclusion-tag logic trustworthy, not because it fits the same repo-vs-roster shape as the other four. Treat it as a documented exception, not a model for future checks in this skill.

If the MCP server is unavailable, auth fails, or any call errors after one retry, each task resolves independently as `suggestion` with `mcp_skipped: true` — one task's MCP failure does not block the others.

{{> mcp-tool-calling}}

## Status

Emit before dispatching:

```
[STATUS] Cross-referencing flag roster against code
```

## Action — dispatch five subagents in one message

Make **five `Agent` tool calls in a single message** so they run concurrently. Wait for all five to return, then continue to `3-report.md`. Do not run any other tools between dispatch and the next step.

The bundled `cleaning-up-stale-flags.md` and `cutting-costs.md` references hold PostHog's authoritative flag-lifecycle and cost guidance. They're typically at `.claude/skills/flag-health/references/cleaning-up-stale-flags.md` and `.claude/skills/flag-health/references/cutting-costs.md`; if a path doesn't exist, discover it with `Glob` `**/skills/flag-health/references/<name>.md`. Each subagent reads the one it's told to, once, before judging.

### Task A — `ff-active-but-unreferenced`

`description`: `Audit ff-active-but-unreferenced`

`prompt`:
```
You are an audit subagent. Resolve exactly one rule and return: ff-active-but-unreferenced.

If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not list active flags"}`. Do not block the audit.

Read this skill's bundled `cutting-costs.md` reference once (typically `.claude/skills/flag-health/references/cutting-costs.md`; otherwise discover with `Glob` `**/skills/flag-health/references/cutting-costs.md`). Focus on the "unused flags still incur charges" callout — active flags continue to evaluate (and bill) even with zero code references, because survey targeting and the `/flags` endpoint evaluate all active flags. The only way to stop charges is to disable, delete, or archive the flag in PostHog (removing it from code is not enough).

Step 1 — list active flags from PostHog. Prefer `feature-flag-get-all` or the equivalent listing tool. If only `execute-sql` is available, fall back to:

```sql
SELECT key
FROM feature_flags
WHERE active = true AND deleted = false
```

Step 2 — for each active flag key, grep the codebase for the literal key (case-sensitive). Count any reference in any source-tree file (a flag is referenced even if it appears only in a config file, a test fixture, or a comment).

Rule:
- pass: every active flag has at least one reference in the codebase.
- suggestion: 1+ active flags have zero codebase references — they are still being evaluated (and billed) on every `/flags` request, especially via survey targeting. Recommend disabling, archiving, or deleting them in PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-active-but-unreferenced`, with `file` left blank (this finding is project-wide, not tied to a single code site), and `details` as compact JSON:

```
{
  "active_flag_count": <N>,
  "unreferenced_active_flag_count": <N>,
  "unreferenced_keys": ["<key>", ...],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
```

### Task B — `ff-ghost-flag-key`

`description`: `Audit ff-ghost-flag-key`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: ff-ghost-flag-key.

If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not list the flag roster"}`. Do not block the audit.

Background: a "ghost flag" is code calling a flag key that has no flag behind it in the PostHog project — soft-deleted, never created, or renamed without updating the call site. The SDK doesn't error on an unknown key; it silently returns `false` (booleans) or `undefined` (multivariate), so the branch that was meant to run never does, with no exception and no log line. This is a term PostHog's own built-in flag monitor also uses, in the same direction (code references a key that doesn't exist) — don't confuse it with `ff-active-but-unreferenced`, which is the opposite case (a flag active in PostHog with no code reference at all).

Run **one** Grep: `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(|posthog\.feature_enabled\(|feature_enabled\(|is_feature_enabled\(|get_feature_flag\(|get_feature_flag_payload\(` — every flag-eval call site, JS and snake_case SDKs (Python, Ruby) alike.

Read each file that contains a hit, once. For each call site, extract the flag key argument and classify it:
- **String literal**, or a `const`/enum that resolves to one at the call site — a resolvable key.
- **One hop from a local static registry** — the call site passes a variable or property access (e.g. `flag.key`, `FLAGS.HINT`) that traces back to a literal string inside a `const`/static array or object literal defined in the same file (or a file it directly imports). This is a common pattern — one array of `{ key, ... }` objects iterated to register several flags — so resolve it: read the registry definition once, substitute the literal, and treat it as resolvable. Do not let this fall through to "dynamic" by default.
- **Genuinely dynamically constructed** — built from a template string, network response, function parameter, or any value that isn't traceable to a literal within one hop as above. A grep-based cross-reference cannot resolve these. Do not treat a dynamic key as a ghost candidate under any circumstance; record it separately as `dynamic_key_sites` and move on.

Step 1 — list the full flag roster from PostHog, **not filtered to active-only** (a ghost key may be soft-deleted, not just inactive). Prefer `feature-flag-get-all` or the equivalent listing tool. If only `execute-sql` is available, fall back to:

```sql
SELECT key FROM feature_flags
```

Step 2 — for each resolvable literal key found in code, check whether it appears in the roster. A key that doesn't appear is a ghost candidate.

Step 3 — before concluding a ghost, apply these guards:
- If the flag key looks like a placeholder, example, or lives only in a test fixture / comment / commented-out line — skip it, not a real call site.
- If nothing else in the roster is a near-match (a prefix or template match to the candidate key), the missing-key conclusion is safe. If something close exists (e.g. code calls `checkout-v2` and the roster has `checkout-v3`), note the near-match in `details` as a possible rename rather than asserting deletion.

Rule:
- pass: every resolvable literal key in code appears in the roster. (Dynamic-key sites and near-match renames don't block a pass — they're reported as informational context, not findings.)
- warning: one or more resolvable literal keys in code do not appear anywhere in the roster — the SDK is silently returning the default for that call site on every evaluation. Recommend either creating the missing flag in PostHog (if the key was meant to exist) or removing the dead call site (if the flag was intentionally retired).

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-ghost-flag-key`, with `file` (path:line of the first ghost call site, if any), and `details` as compact JSON:

```
{
  "resolvable_call_site_count": <N>,
  "dynamic_key_site_count": <N>,
  "ghost_keys": ["<key>", ...],
  "examples": [
    {"file": "<path:line>", "key": "<key>", "near_match": "<key or null>"}
  ],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
````

### Task C — `ff-stale-full-rollout`

`description`: `Audit ff-stale-full-rollout`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: ff-stale-full-rollout.

If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not read flag rollout state"}`. Do not block the audit.

Read this skill's bundled `cleaning-up-stale-flags.md` reference once. Background: a flag pinned at 100% or 0% rollout, with no active release conditions and no edits for 30+ days, has had its decision made — the flag itself did its job. If code still branches on it, that's a dead branch nobody can reason about: it always takes the same path, but it still adds cognitive load, review overhead, and a small but real risk of a stale flag being reused for something new (PostHog's own docs cite the 2012 Knight Capital incident as the canonical example of what a reused dead flag can cost).

Step 1 — list flags from PostHog with their rollout percentage, release conditions, last-modified date, tags, and (where available) linked-experiment status. Prefer `feature-flag-get-all` or the equivalent listing tool; fall back to `execute-sql` against `feature_flags` if needed. Note: PostHog's flag API has no separate description field — the `name` field doubles as the description and is populated at creation for essentially every flag, so it isn't a usable "documented vs. not" signal on its own. Tags are the only reliable signal here.

Step 2 — filter to candidates: rollout is 100% or 0%, there are no partial/percentage release conditions in between, and the flag has not been modified in 30+ days.

Step 3 — apply disqualifiers before treating a candidate as a finding. Exclude and record the reason for each:
- **Experiment-linked** (non-empty linked-experiment / `experiment_set`) — deleting or flipping this breaks the experiment's results. Never a candidate.
- **Remote-config type** — these are long-lived config values by design, not release toggles; being "at 100%" is normal for them.
- **Referenced by another flag's release conditions** — a flag dependency exists; changing the parent changes what the dependent serves.
- **Exclusion-tagged** — the flag's tags contain `keep`, `ops`, or `kill-switch` (case-insensitive). Kill switches and ops toggles are meant to sit at a fixed rollout indefinitely; do not infer this from a flag's `name` text — only an explicit tag counts. If a candidate has no such tag, don't guess intent either way; pass it through as a candidate needing owner input (and note that `ff-flag-missing-metadata` is the check that surfaces the "nobody tagged this" gap on its own).
- **Newer than 7 days** — too young to be stale under any definition; exclude even if it happens to be at 100%/0%.

Step 4 — for each surviving candidate, grep the codebase for the literal flag key (reuse the pattern: `getFeatureFlag\(|isFeatureEnabled\(|useFeatureFlag\(|getFeatureFlagPayload\(|posthog\.feature_enabled\(|feature_enabled\(|is_feature_enabled\(|get_feature_flag\(|get_feature_flag_payload\(`). Read each hit once and classify:
- **Branching usage** — the result feeds an `if`/ternary/switch that takes different code paths. This is the dead-branch case worth reporting.
- **Payload-only usage** — the call is `getFeatureFlagPayload(...)` and the surrounding code only reads a payload value, never branches on the boolean/variant itself. A flag can sit at 100% and still serve a payload every request — that's a legitimate ongoing use, not debt. Do not report these as branching findings; note them separately.
- **No code reference at all** — already covered by `ff-active-but-unreferenced`; don't duplicate that finding here, just note the overlap in `details` (e.g. `"note": "also flagged by ff-active-but-unreferenced"`).

Rule:
- pass: no surviving candidates after disqualification, OR every surviving candidate is payload-only or has no branching code reference.
- suggestion: a surviving candidate has no exclusion tag and unclear code impact — needs an owner's judgment before it's actionable, not a confirmed problem.
- warning: a surviving candidate has a branching code reference — a dead conditional shipping in every build. Recommend the staged sequence, never a one-step delete: (1) remove the call site's branching and deploy, (2) confirm `$feature_flag_called` evaluations for that key stop, (3) only then disable or delete the flag in PostHog.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-stale-full-rollout`, with `file` left blank unless there's one clearly representative branching site, and `details` as compact JSON:

```
{
  "candidate_count": <N>,
  "disqualified_count": <N>,
  "branching_findings": ["<key>", ...],
  "payload_only": ["<key>", ...],
  "needs_owner_input": ["<key>", ...],
  "overlaps_with_unreferenced": ["<key>", ...],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
````

### Task D — `ff-multivariate-as-boolean`

`description`: `Audit ff-multivariate-as-boolean`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: ff-multivariate-as-boolean.

If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not read flag variant definitions"}`. Do not block the audit.

Background: a multivariate flag (2+ named variants, e.g. `control` / `treatment-a` / `treatment-b`) has meaningful information in *which* variant a user got, not just whether it's "on." Reading it with a boolean-style call (`isFeatureEnabled`, or a language equivalent like `is_feature_enabled` / `featureEnabled`) collapses every non-control variant into `true` — the code can no longer tell `treatment-a` from `treatment-b`, and any variant-specific logic silently defaults to whichever branch the boolean check happens to gate. This is a correctness bug, not a lifecycle one — it's grouped with this skill's other checks only because confirming it needs PostHog's flag definition, not because it's a roster-drift finding like the other three.

Step 1 — list flags from PostHog with their type and variant keys. Prefer `feature-flag-get-all` or the equivalent listing tool; fall back to `execute-sql` against `feature_flags` if needed. Build a set of multivariate flag keys (2+ variants defined).

Step 2 — run **two** Greps in parallel:
- Boolean-style reads: `isFeatureEnabled\(|is_feature_enabled\(|featureEnabled\(|posthog\.feature_enabled\(|feature_enabled\(` — capture the flag key argument at each site.
- Variant-aware reads: `getFeatureFlag\(|useFeatureFlag\(|getFeatureFlagPayload\(|get_feature_flag\(|get_feature_flag_payload\(` — capture the flag key argument at each site.

Step 3 — for each multivariate flag key from Step 1, check its call sites from Step 2:
- If **every** call site for that key uses only the boolean-style read — flag it. The variant information is fully discarded.
- If the key has **at least one** variant-aware read anywhere in the codebase, but also has boolean-style reads elsewhere — note it as a suggestion (mixed usage is common when a flag started boolean and grew a variant later) rather than a warning; the variant information isn't lost, just inconsistently read.
- If a multivariate key has no code reference at all, that's `ff-active-but-unreferenced`'s job, not this check's — skip it here.

Rule:
- pass: no multivariate flag is read exclusively via a boolean-style method.
- suggestion: a multivariate flag has mixed boolean- and variant-aware reads across the codebase — inconsistent, but not silently broken anywhere.
- warning: a multivariate flag is read exclusively via boolean-style methods — every call site collapses its variants into on/off, and any variant-specific behavior the flag was created to drive doesn't exist in the code.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-multivariate-as-boolean`, including `file` (path:line of a representative boolean-style read) and `details` as compact JSON:

```
{
  "multivariate_flag_count": <N>,
  "exclusively_boolean_read": ["<key>", ...],
  "mixed_read": ["<key>", ...],
  "examples": [
    {"file": "<path:line>", "key": "<key>", "variant_count": <N>}
  ],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
````

### Task E — `ff-flag-missing-metadata`

`description`: `Audit ff-flag-missing-metadata`

`prompt`:
````
You are an audit subagent. Resolve exactly one rule and return: ff-flag-missing-metadata.

If the MCP server is unavailable, auth fails, or any call errors after one retry: resolve with `suggestion`, with `details` set to compact JSON `{"mcp_skipped": true, "reason": "PostHog MCP unavailable — could not read flag metadata"}`. Do not block the audit.

This check has no code side — it reads PostHog's flag roster only. It exists to support `ff-stale-full-rollout`: that check is supposed to skip a flag tagged `keep` / `ops` / `kill-switch`, but that exclusion only works if someone actually tagged it. This check surfaces exactly the flags where nobody did, so a human can decide intent before anyone (this skill included) treats "looks abandoned" as "is abandoned."

Read this skill's bundled `cleaning-up-stale-flags.md` reference once for PostHog's flag-lifecycle guidance on ownership and documentation.

Step 1 — list flags from PostHog with their rollout percentage, release conditions, last-modified date, tags, and linked-experiment status. Reuse the same candidate filter as `ff-stale-full-rollout`: rollout is 100% or 0%, no partial release conditions, not modified in 30+ days, older than 7 days, not experiment-linked, not remote-config typed, not referenced by another flag's release conditions. Scope this check to that same candidate set — a freshly created or actively-rolling-out flag doesn't need an owner yet, so don't flag it here.

Step 2 — for each candidate, check whether it has at least one tag. PostHog's flag API has no separate description field — the `name` field doubles as the description and is populated for essentially every flag at creation, so its presence isn't a meaningful "documented" signal; only a tag reliably indicates someone made a deliberate decision about this flag's lifecycle.

Rule:
- pass: no surviving candidates, OR every surviving candidate has at least one tag.
- suggestion: one or more long-lived, fully-decided flags have no tags at all — recommend the team add an explicit tag (`keep`, `ops`, `kill-switch`, or similar) so future audits can tell intentional permanence from forgotten cleanup.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-flag-missing-metadata`, with `file` left blank (this finding is project-wide, not tied to a code site), and `details` as compact JSON:

```
{
  "candidate_count": <N>,
  "undocumented_keys": ["<key>", ...],
  "mcp_skipped": false
}
```

Return when the call completes. Do not write the audit report.
````

## After all five checks are resolved

Continue to **`3-report.md`**.
