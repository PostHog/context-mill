# Cull stale PostHog feature flags in a {display_name} project

This skill removes feature flags that have outlived their purpose: rolled out to everyone, never enabled, archived or deleted in PostHog but still checked in code, or defined in PostHog and never evaluated anywhere. The wizard already did the detection before you started: it scanned the source tree for flag calls, fetched the project's flags, classified every flag with plain rules, and wrote one row per flag into `.posthog-audit-checks.json` at the project root. That ledger is the ground truth. You never grep for flags, never re-classify a row, and never promote a healthy flag into a removal.

Your job is three steps: verify each proposed row at its call site, ask the user once which rows to apply, apply the approved ones (code first, PostHog second), then write the report.

**Start by reading `references/1-verify-call-sites.md`.** Do not Glob, ls, or find the skill directory. Do not read `2-apply.md` or `3-report.md` until the current step tells you to.

## State

- `.posthog-audit-checks.json` (project root): the ledger. `Read` it once at the start of each step. Each row is `{ id, area, label, status, file?, details? }` where `id` is the flag key, `area` is the bucket the wizard assigned, `label` names the proposed action, `file` is the first call site as `path:line`, and `details` carries the rollout summary and every call site.
- Rows change only through `mcp__wizard-tools__audit_resolve_checks`. Never `Edit` or `Write` the ledger file. Never delete it.
- Row statuses this skill uses: `pending` (seeded, not yet verified), `warning` (verified, proposed to the user), `pass` (kept, declined, or applied), `error` (apply failed, reason in `details`).

The wizard prompt tells you whether the repo uses bulk evaluation (`getAllFlags`) or dynamic flag keys. When it does, every `unreferenced` or `unreferenced-comment-only` row needs a real check at the bulk or dynamic call site before it can be proposed.

## Status

Report progress with `[STATUS] <message>` lines. Each step lists the exact strings to emit. They are cheap; use them at every sub-step.

## Abort

Report unrecoverable preconditions with exactly one `[ABORT] <reason>` line and stop. The wizard terminates the run; do not halt yourself.

- `[ABORT] No flag cull ledger found` when `.posthog-audit-checks.json` does not exist (this skill needs `wizard cull-feature-flags` to seed it).
- `[ABORT] No PostHog feature flag usage found` when the ledger has zero rows.

## Rules

1. **Disable, never delete.** The only PostHog mutation this skill makes is disabling a flag. Archiving and deleting are for the user to do in the app.
2. **Code before PostHog.** For a row that needs both a code edit and a disable, the edit lands first and the disable only after the edit succeeded, so a failed edit never leaves a disabled flag behind live code.
3. **One consent call.** Exactly one `wizard_ask` for the whole run, listing every proposed row, decline option first. Nothing is applied without it.
4. **Winning branch only.** Removing a flag check means keeping the branch the flag would resolve to and deleting the other one, plus the now-unused import or hook. Do not restructure beyond that.
5. **Downgrade freely, never upgrade.** During verification a row may be resolved to `pass` (keep) with a reason. A `pass` row seeded as healthy is never touched.

## Available tools

{{> mcp-tool-calling}}

**Verify:** `Read` on each call-site file.

**Confirm:** `mcp__wizard-tools__wizard_ask`, called once (see `2-apply.md`).

**Apply:** `Edit` for code; through `exec`, the flag disable tool (discover it with `search feature-flag`, run `info` on it, then `call`).

**Ledger:** `mcp__wizard-tools__audit_resolve_checks` for every status change.

## Reference files

{references}

## Framework guidelines

{commandments}
