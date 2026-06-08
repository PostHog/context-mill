# remediate-3000 — build notes

Status as of **2026-06-05**. The write-side companion to `audit-3000`. Share freely; update in-place as the skill evolves.

## What this is

`remediate-3000` consumes the single artifact `audit-3000` produces — `posthog-audit-report.md` at the project root — and applies the safe fixes to the project source. It inverts audit-3000's read-only contract (it edits source; that's the job) while keeping every other guardrail: it never mutates PostHog state, never runs git mutations, and creates exactly one new project-root file (`posthog-remediation-report.md`).

| Step | File | Job |
|---|---|---|
| 1 | `1-intake.md` | Parse the audit report → classified plan at `/tmp/posthog-remediation-plan.json`. `[ABORT] No audit report found` when missing. |
| 2 | `2-baseline.md` | Detect package manager + verify command, record pre-edit baseline → `/tmp/posthog-remediation-env.json`. |
| 3 | `3-dependencies.md` | Manifest version bumps (SDK up-to-date findings) + install. Re-verifies latest versions against the registry. |
| 4 | `4-code-fixes.md` | All remaining `auto-fix` items via parallel subagents, one per **edit group** (connected components over shared files — no two subagents touch the same file). |
| 5 | `5-verify.md` | Mechanical spot-checks per fix + re-run of the baseline command; one repair pass max; revert on unfixable regressions. |
| 6 | `6-report.md` | Render `posthog-remediation-report.md`; delete `/tmp/` intermediates. Terminal. |

## Design decisions worth knowing

1. **Classification is decided at intake, deterministically.** Every finding becomes exactly one of:
   - `auto-fix` — errors/warnings with a concrete file-level recommendation, plus mechanical suggestions (init-config additions, additive instrumentation on named surfaces).
   - `posthog-side` — fixes that mutate PostHog state (insight edits, flag disabling). **Never executed.** Rendered as copy-paste prompts in the final report, each with re-verification built in — same pattern as audit-3000's stale-flag playbook.
   - `skip` — greenfield product adoption (feature work, not remediation) and stylistic renames that would orphan existing insights (e.g. tense migrations).
2. **The plan file is the ledger.** audit-3000 has the wizard-seeded `audit_resolve_checks` MCP ledger; remediate-3000 runs through the wizard's generic `agent-skill` program where no ledger is seeded, so it owns its own plan JSON in `/tmp/` instead. Same role: every step patches statuses; the final report renders from it.
3. **Edit groups prevent subagent conflicts.** Findings often share files (PII removal and duplicate removal both touch the login page). Step 4 unions items into connected components over their file lists and dispatches one subagent per component — concurrency without write races.
4. **Anchor on code, not line numbers.** The audit's snippets were written against a possibly-stale read. Subagents must read the target file and adapt; if the code moved or conflicts, they fail the item with a reason rather than guessing.
5. **Baseline before, verify after, one repair pass, then revert.** Step 2 records whether typecheck/lint/build passed pre-edit so step 5 can tell regressions from pre-existing failures. A regression gets one repair pass; if still broken, the offending item's edits are reverted and the item is reported as failed.
6. **The operator commits, not the skill.** Git state is recorded (repo? dirty?) but never mutated. The report's Next steps section tells the operator to review the diff, commit, run the PostHog-side prompts, and re-run audit-3000 to confirm.

## Running it

### Build the skill

From `context-mill/`:

```bash
node scripts/build.js          # one-shot build → dist/skills/remediate-3000.zip
node scripts/dev-server.js     # watch mode on :8765 (phrocs does this for you)
```

### Run via the wizard

```bash
cd <project-with-a-posthog-audit-report>
wizard --local-mcp --skill="remediate-3000"
```

The wizard's generic `agent-skill` program (`wizard/src/lib/programs/agent-skill/`) runs any context-mill skill by id, so no wizard code changes are needed. `--local-mcp` makes the wizard read local context-mill output instead of hosted skills.

### Skill-content smoke test without the wizard

```bash
cd <project-with-a-posthog-audit-report>
mkdir -p .claude/skills/remediate-3000
unzip -o <context-mill>/dist/skills/remediate-3000.zip -d .claude/skills/remediate-3000
# Then in Claude Code: "Run the remediate-3000 skill from
# .claude/skills/remediate-3000/SKILL.md. Walk every step in order."
```

## Validated end-to-end (2026-06-05)

First full wizard run against `hot-or-not-demo/hot-or-not-ai-demo-main` (16 findings from a prior audit-3000 run): 8 verified, 2 failed-with-reason, 6 skipped, `tsc --noEmit` green. Two notable behaviors, both by design:

- **The verify step caught a wrong audit recommendation.** The audit suggested `session_recording.minimumDurationMilliseconds` in client init config, but in posthog-js `^1.381.0` that property only exists on `SessionRecordingRemoteConfig` (project-settings controlled) — TypeScript rejected it (TS2353). The skill removed the field to keep the typecheck green and routed the item to "Needs manual attention" with the correct project-settings fix. Consider feeding this back to audit-3000's `6b-session-replay.md`.
- **A code-fix subagent refused an inapplicable fix.** `app/page.tsx` is a server component that only calls `redirect('/rate')`; the suggested landing-page capture would be dead code. The subagent failed the item with the correct alternative placement rather than guessing.

**Wizard wrapper report:** the wizard's prompt assembler (`wizard/src/lib/agent/agent-prompt.ts` `skillPrompt()`) instructs every skill run to write `./posthog-<skillId>-report.md` after the workflow — the outro screen points at it. Step 6's file-creation contract explicitly allows this wizard-owned summary (short, linking to the full report). Do not re-add it to the forbidden list; the same conflict exists in audit-3000 (its runs leave `posthog-audit-3000-report.md` despite its contract forbidding it).

## Open issues / known TODOs

1. **Interactive confirmation.** The skill currently auto-applies everything classified `auto-fix`. A future wizard version could surface the step-1 plan in the TUI and let the operator toggle items before step 3 runs.
2. **PostHog-side execution.** When the wizard session has a PostHog MCP with write scopes, the `posthog-side` prompts could become an opt-in step (with explicit operator confirmation) instead of copy-paste prompts.
3. **Pairing nicety.** audit-3000's step 10 could mention remediate-3000 by name in its Next steps section so the two skills cross-link.
