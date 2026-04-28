# PostHog Audit

This skill audits an existing PostHog integration for correctness, identification logic, and event tracking best practices. This is a **read-only** review — do not modify any project files **except** the final audit report.

## Workflow

The audit runs as a chain of small steps. Each step's file ends with a pointer to the next — that pointer is the only way you discover what file to read.

**Start by reading `references/1-seed.md`.** Do not Glob, ls, or find the skill directory; you don't need to enumerate the chain ahead of time. Do not re-read a step file once you've moved past it. Do not preload future steps.

## Task list

The four high-level `content` items the audit tracks (don't TodoWrite these yet — Step 1 will):

1. `Audit installation & setup`
2. `Audit identification logic`
3. `Audit capture calls, feature flags, and error tracking`
4. `Generate audit report`

### Live activity

The wizard surfaces the in-progress task's `activeForm` as a live "Working on …" banner. **At the start of every step**, call `TodoWrite` with the full four-item list and replace the in-progress task's `activeForm` with a phrase that names the *current sub-step*, not the phase. The phase task `content` stays the same; only `activeForm` rotates.

Each step's reference file gives you the exact `activeForm` string to use. The point is that the banner reads "Scanning dependency manifests" while you're in step 2 and "Locating PostHog initialization" while you're in step 3 — never the static phase label for the whole phase. Step 1 is responsible for the **first** TodoWrite of the run; do not call TodoWrite before reading `references/1-seed.md`.

## Audit checks ledger

The wizard renders `.posthog-audit-checks.json` at the project root as a live "Audit checks" tab. This file is the single source of truth — the final markdown report is generated from it.

The ledger is owned by your `Write`s. After every `Write`, the file equals exactly what you wrote: your in-memory shape **is** the canonical state, so the next ledger update is built from memory and emitted as a fresh `Write` of the whole array. There's no need to `Read` the ledger between writes.

Each phase reference file tells you which entries to seed and when to resolve them.

Each entry must have:

- `id` — for installation entries (Step 1), stable kebab-case slug (`sdk-installed`, `sdk-up-to-date`, `init-correct`). For identification and capture/flags/errors/replay/experiments entries, derived from the rule's source: `<best-practices-file-stem>:<line-number>` (e.g. `product-analytics:14`, `feature-flags:9`). This makes every entry traceable back to the rule that justified it.
- `area` — short Title-Case label naming the PostHog product or topic the entry covers. `Installation` and `Identification` are fixed by Steps 1 and 6; for Step 8 entries, derive the `area` from the best-practices reference file's title (one `area` per file).
- `label` — short human-readable name (≤ 60 chars).
- `status` — exactly one of `pending`, `pass`, `error`, `warning`, `suggestion`. Start every entry as `pending` in the seed; resolve to one of the other four when you actually run the check.
- `file` — optional `path:line` in the audited project for findings tied to a location.
- `details` — optional one-line explanation.

Example planned entry (before the check runs):

```json
{
  "id": "init-location",
  "area": "Installation",
  "label": "Initialization location",
  "status": "pending"
}
```

Example resolved entry (after the check runs):

```json
{
  "id": "init-location",
  "area": "Installation",
  "label": "Initialization location",
  "status": "pass",
  "file": "src/instrumentation-client.ts:1",
  "details": "Top-level init in instrumentation-client.ts (Next.js 15.3+ pattern)"
}
```

**Cleanup**: After the markdown report is written, delete `.posthog-audit-checks.json`.

## Severity levels

Use these severity levels consistently across all findings:

- `error`: Must fix. Broken functionality, security issues, or data corruption.
- `warning`: Should fix. Incorrect patterns that may cause subtle bugs or data quality issues.
- `suggestion`: Nice to have. Improvements that follow best practices.

## Key principles

- **Read-only**: Do not edit project source files. The only file you create is the audit report.
- **Evidence-based**: Reference specific files and line numbers for every finding.
- **Actionable**: Every finding should include what to fix and how.
- **Framework-aware**: Consult the PostHog docs for the project's specific framework before flagging issues.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages:
- No PostHog SDK found

## Framework guidelines

{commandments}
