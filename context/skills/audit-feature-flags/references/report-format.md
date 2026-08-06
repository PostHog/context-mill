# Feature Flags Doctor — Report Format

Write the report to `posthog-feature-flags-report.md` at the project root.

## Required structure

```markdown
# PostHog Feature Flags Doctor

_Run: <ISO timestamp>_
_Project: <project name, no project ID>_

## Summary

- **Errors:** N
- **Warnings:** N
- **Suggestions:** N
- **Fixes applied:** N
- **Checks passed:** N
- **Checks skipped:** N

## Delivery snapshot

| Flag | In PostHog | Delivered | Evaluates to | Reason |
| --- | --- | --- | --- | --- |
| `checkout-v2` | active, 50% rollout | yes | `false` | out_of_rollout_bound |
| `new-nav` | active, 100% | yes | `true` | condition_match |
| `beta-search` | **not found** | — | `undefined` forever | ghost key |

(One row per flag referenced in code or active in PostHog. This table is the heart of the report — it answers "why isn't my flag working?" per flag, in one line each.)

## Findings

### <Finding title>

- **Severity:** error | warning | suggestion
- **Check:** <e.g. Flag keys exist in PostHog>
- **Affected:** <flag key(s) or file(s)>
- **Evidence:**
  - <key fact, e.g. "`beta-search` referenced at src/nav.tsx:41; no similar key in the project's 12 flags">
  - <probe fact, e.g. "/flags 200 via /ingest; 11 of 12 active flags delivered">
- **Why it matters:** <one sentence — the user-facing consequence, not just the rule>
- **Outcome:** <"Fixed — <exact change>"> | <"Manual — <what to do, ending with the doc link>"> | <"Withheld — cleanup gated until evaluation events are verified (see below)">

(Order: errors, then warnings, then suggestions.)

## Fixes applied

- ✓ <Finding title> — <what changed: file for code fixes, flag key + state change for settings fixes> (code | settings)

(If none: "No fixes were applied.")

## Manual follow-up

- <Finding title> — <what the user should do, ending with the doc link>

## Cleanup gated by the interlock

(Include ONLY when `ff-evaluated-not-reported` was a finding.)

Flag staleness in PostHog is measured by `$feature_flag_called` events, and this project is not reliably sending them — so "unused" and "heavily used but unreported" are currently indistinguishable. The following cleanup candidates were found but their PostHog-side fixes were withheld:

- <flag key> — <observation>

Fix evaluation reporting first (see Findings), let a few days of data accumulate, then re-run the doctor.

## Notes on expected behavior

(Always include when relevant; these are teaching notes, not findings.)

- **Automated browsers receive zero flags by design.** PostHog filters clients that look automated (headless browsers, crawlers, test runners) at the `/flags` endpoint — they get `{"errorsWhileComputingFlags": false, "flags": {}}` with HTTP 200. If you verify flags with Playwright/Cypress/Puppeteer, that's the one client guaranteed to see nothing. Test with a real browser profile or override the user agent + `navigator.webdriver` signals.
- <other applicable notes: client vs server billing semantics, undefined-vs-false during the loading window — one line each, with doc links>

## Checks passed

- ✓ <Check name> — <one-line summary>

## Checks skipped

- ✗ <Check name> — <reason, e.g. "local evaluation not detected" / "PostHog MCP unavailable">

## Next steps

<2–3 sentences pointing at the most impactful remaining item — or, on a clean bill, a note that delivery is verified end-to-end and a pointer to the flags best-practices doc.>
```

## Doc links per check

- `ff-bootstrap-when-known-set`, `ff-bootstrap-distinct-id-mismatch` → https://posthog.com/docs/feature-flags/bootstrapping
- `ff-await-readiness`, `ff-default-values`, `ff-identified-only-pre-auth-targeting`, `ff-eval-before-identify` → https://posthog.com/docs/feature-flags/best-practices
- `ff-key-authenticates`, `ff-flags-endpoint`, `delivered-*`, `ghost-*` → https://posthog.com/docs/feature-flags/troubleshooting
- `ff-evaluated-not-reported` → https://posthog.com/docs/experiments/exposures
- `stale-*`, `ff-active-but-unreferenced` → https://posthog.com/docs/feature-flags/cleaning-up-stale-flags
- `ff-local-eval-polling-interval`, `ff-local-eval-in-edge-handlers` → https://posthog.com/docs/feature-flags/local-evaluation
- `ff-test-ci-gating` → https://posthog.com/docs/feature-flags/cutting-costs

## Tone & content rules

- **Be specific.** Flag keys, counts, status codes, `reason` codes. "`checkout-v2`: defined at 50% rollout, delivered, evaluates false (out_of_rollout_bound)" beats "some flags may not be delivered."
- **Teach in one line.** Every finding's "Why it matters" states the user-visible consequence (wrong variant, broken experiment exposure, silent default, wasted credits) — not the rule that fired.
- **No secrets, no PII.** Flag keys, hosts, paths, counts only. Never token values, distinct IDs, emails, or session IDs.
- **Round counts** above 1,000 (12,403 → 12.4k).
- **No emojis** beyond `✓` / `✗` list markers.

## When there are zero findings

Replace `Findings` with:

```markdown
## Findings

No issues found. Feature flag delivery is verified end-to-end and the integration looks healthy across all checks.
```

Keep the Delivery snapshot and `Checks passed` — on a clean bill they ARE the value: proof, per flag, that delivery works.
