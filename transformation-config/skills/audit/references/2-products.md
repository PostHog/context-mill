# Step 2 — Product surfaces (discovery + parallel resolve)

The audit's basics are done. This step extends the audit to cover whichever PostHog products the project actually uses — feature flags, error tracking, session replay, experiments, and product-analytics rules beyond the basics — by reading the matching `posthog-best-practices` reference files and adding per-rule checks at runtime.

If the project uses none of these surfaces, this step is a no-op.

## Status

```
[STATUS] Discovering PostHog product surfaces
```

## Action

### a. Install the best-practices skill

Call `mcp__wizard-tools__install_skill({ skillId: "posthog-best-practices" })` once. This puts `feature-flags.md`, `error-tracking.md`, `session-replay.md`, `experiments.md`, and `product-analytics.md` at `.claude/skills/posthog-best-practices/references/`. **Do not read these files yet.** Read each only if its detector grep below has hits.

### b. Detect product surfaces (one message, parallel greps)

Issue all five `Grep` calls **in a single message** so they run concurrently:

| Product | Detector regex |
|---|---|
| Feature flags | `getFeatureFlag\(|isFeatureEnabled\(|onFeatureFlags|feature_flags\b|<FeatureFlag\b|posthog\.featureFlags\b` |
| Error tracking | `captureException\(|posthog\.captureException|capture_exceptions\b|capture_unhandled_(errors\|rejections)|capture_console_errors` |
| Session replay | `disable_session_recording|session_recording\b|recorder\.js|posthog-recorder|<PostHogRecorderProvider` |
| Experiments | `getFeatureFlagPayload\(|useFeatureFlagVariantKey\(|posthog\.experiments\b|getFeatureFlagVariant\b` |
| Product-analytics extras | `posthog\.group\(|groupidentify|setPersonProperties\(|\$set_once|process_person_profile` |

The set of products with any hits = the **detected products**. If detected is empty, emit `[STATUS] No product surfaces detected` and continue to step 3.

### c. Plan checks for each detected product

For each detected product, read its best-practices reference file **once**. Map each rule line to a check entry:

- `id` — `<file-stem>:<line-number>` (e.g. `feature-flags:9`, `error-tracking:11`). The file stem is the basename without extension; the line number is the line of the rule's bullet inside the reference file.
- `area` — file stem in Title Case: `Feature Flags`, `Error Tracking`, `Session Replay`, `Experiments`, `Product Analytics`.
- `label` — short paraphrase of the rule (≤ 60 chars).
- `status` — `pending`.

Skip rules that are clearly irrelevant to this project (e.g. `experiments:14` "Svelte SSR" rule on a Next.js app). Pick rules where the project's evidence makes a verdict possible.

Do not re-add ids that already exist in the ledger from step 1's basics.

### d. Add the planned checks to the ledger

Single call to `mcp__wizard-tools__audit_add_checks` with the full list. The tool atomically rejects duplicate ids — if the call returns an error about duplicates, prune and retry once.

### e. Resolve in parallel — one subagent per detected product

Dispatch one `Task` call per detected product **in a single message** so they run concurrently. Each subagent has its own product, its own reference file, its own check ids, and its own evidence. Wait for all of them, then continue to step 3.

For each detected product P, dispatch:

`description`: `2.<n> · <Area>` (e.g. `2.1 · Feature Flags`)

`prompt`:
```
You are an audit subagent for the <Area> product surface. Resolve the checks listed below and return — do not write the report.

Reference: `.claude/skills/posthog-best-practices/references/<file-stem>.md`. Read it once.

Project evidence (from the discovery grep — these are the call sites where this product is used):
<list of path:line entries from step b's grep results>

Check ids you own:
<list of `<file-stem>:<line>` ids the parent added for this product>

For each check id, look up its rule in the reference file (the line number in the id is the rule's line) and evaluate against the project evidence. Make whatever additional Grep / Read calls you need to confirm the verdict; cap yourself at five extra reads beyond the reference file. When the rule is genuinely not applicable to this project's setup, resolve as `pass` with `details: "not applicable: <reason>"`.

Resolution map:
- The rule's prefix (`error:`, `warning:`, `suggestion:`) is the **maximum** severity. If the rule passes, status is `pass`. If it fails, status matches the prefix.

Resolve all of your check ids with **one** call to `mcp__wizard-tools__audit_resolve_checks`. Each update should include `file` (path:line of the strongest evidence) and `details` (one-line explanation). Return when the resolve call completes.
```
