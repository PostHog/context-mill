# PostHog Audit — Flag Roster Alignment

This skill finds places where a project's code and its actual PostHog flag configuration have drifted apart. **Read-only** — the only file you create is the final audit report. The audit never mutates PostHog state and never edits project source.

Every check here needs **both sides at once** — the repository and PostHog's live flag roster — which is the point of this skill existing as a packaged tool rather than a one-off agent prompt: an agent pointed only at the repo can reason about code quality, but it cannot see whether a flag key it finds still exists in PostHog, what a flag's real rollout percentage is, or whether a flag is multivariate. These findings only exist because both sides were checked together:

- **`ff-active-but-unreferenced`** — a flag is active in PostHog with zero references anywhere in the codebase. Still evaluated (and billed) on every request.
- **`ff-ghost-flag-key`** — code calls a flag key that doesn't exist in PostHog's roster. The SDK silently returns a default; the branch behind it never runs, with no error.
- **`ff-stale-full-rollout`** — a flag has been pinned at 100% or 0% for 30+ days, and the code still has a live branch on it. The decision is made; the branch is dead weight nobody can reason about.
- **`ff-multivariate-as-boolean`** — PostHog says a flag has variants; every code call site reads it as a plain on/off. The variant information the flag was built to carry is being silently discarded.

One check is the deliberate exception — it has no code side at all:

- **`ff-flag-missing-metadata`** — a long-lived, fully-decided flag (the same candidate set `ff-stale-full-rollout` looks at) has no tags. (PostHog's flag API has no separate description field — `name` doubles as the description and is populated for nearly every flag at creation, so it isn't a usable "documented vs. not" signal on its own; tags are.) It's included because it's what makes `ff-stale-full-rollout`'s own exclusion logic trustworthy: that check is supposed to skip a flag tagged `keep`/`ops`/`kill-switch`, but that only works if someone tagged it. This check surfaces the flags where nobody did, so the team can decide intent before this skill (or anyone else) treats "looks abandoned" as "is abandoned."

## Workflow

The audit runs as a step chain. **The exact step list lives in the reference files themselves, not in this overview.** Step 1 lives at `references/1-presence.md`; each step file ends with a `next_step:` frontmatter pointer to the next, and the final step has `next_step: null`. Follow them in the order they point.

The audit ledger is seeded with one pending check per rule above. **Each step gracefully handles a missing check id**: if a step's expected id is not in the ledger, it skips its `audit_resolve_checks` call for that id and continues. Use `mcp__wizard-tools__audit_resolve_checks` to patch each check as you finish it.

**Start by reading the path relative to this file at `references/1-presence.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Write`, `Bash`, the named `mcp__wizard-tools__audit_*` tools) is already named in this skill. PostHog access goes through its single `exec` tool, described in the check-dispatch reference.

**Do not call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Cross-referencing flag roster against code
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Agent` subagents when a step says so.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — this skill seeds one area: `Flag Roster Alignment`.
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location. Project-wide findings (most of these are) leave it blank.
- `details` — optional one-line explanation.

After the final step writes the report, delete `.posthog-audit-checks.json`.

## Severity levels

- `warning`: A confirmed drift between code and PostHog — the SDK is silently doing the wrong thing, or a dead code path ships in every build.
- `suggestion`: A candidate that needs a human's judgment before it's actionable (unclear code impact, no owner to confirm intent), or a best-practice gap (missing metadata).

This skill doesn't use `error` — nothing it finds is a crash or data-loss risk; the worst case is a silent behavior gap, which is a `warning`, not an `error`.

## Key principles

- **Read-only**: Do not edit project source files or PostHog flag configuration. The only file you create is the audit report.
- **Evidence-based**: Every finding names the flag key and cites the PostHog state it's based on (rollout %, last-modified date, variant list) in `details`.
- **Never recommend a one-step delete.** A flag that looks fully decided or ghosted still needs its code path removed and its removal confirmed before the flag itself is disabled or deleted in PostHog — deleting a flag while a live client still evaluates it flips that client to the off path, a production behavior change, not a no-op. Findings that suggest removal always recommend the staged sequence: remove the call site → deploy → confirm calls stop → then disable/delete in PostHog.
- **A disqualified finding is not a failed check.** A flag that looks stale or ghosted but is experiment-linked, remote-config typed, referenced by another flag's release conditions, read only for its payload, or carries an exclusion tag (`keep`, `ops`, `kill-switch`) is load-bearing. Recording *why* a candidate was disqualified is as much the check's job as flagging one that wasn't.
- **Graceful MCP fallback**: Every check here needs PostHog MCP access. When it's unavailable, auth fails, or a call errors after one retry: resolve as `suggestion` with `details: "PostHog MCP unavailable — could not read <what>"` and `mcp_skipped: true`. Do not block the audit — resolve the other checks normally.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.

- No PostHog feature flag usage found (no SDK call sites matching the flag-eval API surface)

## Framework guidelines

{commandments}
