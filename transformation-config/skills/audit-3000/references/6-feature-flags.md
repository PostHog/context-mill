---
next_step: 6b-session-replay.md
---

# Step 6 — Stale feature flags

This step **reports** flags PostHog has already classified as stale and flags that no longer appear to be referenced in the project source. **Read-only** — this step never disables or deletes flags. The final report (Step 8) renders a copy-paste prompt the operator can run themselves if they decide to clean up. The rationale matches PostHog's cleanup guide order: identify stale flags → remove references from **code** → deploy → then disable in PostHog. Disabling while application code still evaluates a flag can turn off a live code path for everyone — that's why this audit refuses to do it automatically. See [Cleaning up stale feature flags](https://posthog.com/docs/feature-flags/cleaning-up-stale-flags).

## Status

Emit:

```
[STATUS] Listing stale feature flags
[STATUS] Cross-referencing code
```

## Action

### a. Check whether the ledger seeds this step

`Read` `.posthog-audit-checks.json` once. If no entry with `id` **`stale-feature-flags-reviewed`** exists, the wizard you are running against does not seed this check. **Do not** call `mcp__wizard-tools__audit_resolve_checks` for that id and stop after writing the findings into the report (Step 6 reads the file you produce here as its source). If the entry exists, continue.

### b. List stale flags via PostHog MCP

1. Call **`posthog:feature-flag-get-all`** with **`active: "STALE"`**. The `active` parameter is a string enum on this tool — `"STALE"` is the documented filter value PostHog returns flags it considers stale for (unused evaluations and/or long-running 100% rollouts with no useful targeting — see the [staleness criteria](https://posthog.com/docs/feature-flags/cleaning-up-stale-flags#what-makes-a-flag-stale)).
2. If the response is paginated (`limit` / `offset`), page until empty — do not stop after the first page.
3. If the MCP server is missing, auth fails, or the call errors after one retry: skip sections c–d, jump to **Resolve** with `suggestion` and `details: "PostHog MCP unavailable — could not enumerate stale flags"`.

### c. Cross-reference each stale flag against project source

For **each** stale flag returned in (b):

1. Run a single **`Grep`** for the flag key as a string literal across the project source tree. Cover common SDK call sites: `isFeatureEnabled`, `getFeatureFlag`, `useFeatureFlag`, `evaluateFlags`, constants files, configs, and tests. Use whichever `Glob` patterns you need to widen coverage (see the [doc's search guidance](https://posthog.com/docs/feature-flags/cleaning-up-stale-flags#what-to-search-for)).
2. Call **`posthog:feature-flag-get-definition`** (or the MCP tool that returns the full flag definition) and inspect **`experiment_set`** (or equivalent). Flag whether the flag is tied to an active experiment.
3. Classify the flag into one of:
   - **`safe-to-disable`** — zero code references AND no active experiment AND rollout is 0% or 100% (not partial).
   - **`needs-review`** — code references exist, OR an active experiment is attached, OR rollout is partial (any one of these blocks safe disablement).
   - **`unknown`** — grep was inconclusive (e.g. flag key is also a common English word producing false-positive hits).

### d. Record findings in the ledger

Build a compact JSON object summarizing all findings and store it as the check's `details` field. Use this shape exactly:

```json
{
  "stale_count": <N>,
  "safe_to_disable": ["<flag_key>", ...],
  "needs_review": [
    {"key": "<flag_key>", "reason": "code-references | active-experiment | partial-rollout", "file": "<path:line or null>"}
  ],
  "unknown": ["<flag_key>", ...]
}
```

Keep arrays short (one element per flag, no nested prose). Step 6 reads this from the ledger and renders the human-readable report plus the copy-paste cleanup prompt.

## Resolve

Call **`mcp__wizard-tools__audit_resolve_checks`** once with a single update for **`stale-feature-flags-reviewed`** only (do not include any other ids — those were resolved in earlier steps):

```
{
  "updates": [
    {
      "id": "stale-feature-flags-reviewed",
      "status": "pass|warning|suggestion",
      "details": "<compact JSON from section d, OR a one-line skip reason>"
    }
  ]
}
```

**Resolution rules:**

- **`pass`** — `stale_count: 0`, or every stale flag classified into `safe_to_disable` or `unknown` with no `needs_review` blockers.
- **`warning`** — one or more flags landed in `needs_review` (code references, active experiment, or partial rollout require human follow-up before any cleanup).
- **`suggestion`** — PostHog MCP unavailable, auth failed, or the call errored. The rest of the audit continues unaffected.

Continue to **`6b-session-replay.md`**.
