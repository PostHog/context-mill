# cross-sell-3000 — build notes

Status as of **2026-06-08**. The growth-side sibling of `audit-3000` / `remediate-3000`. Share freely; update in-place as the skill evolves.

## What this is

`cross-sell-3000` grows a project's PostHog footprint **from the code outward**. It scans the repository to decide which PostHog products fit (unused products, competitors PostHog could replace, coverage gaps), then runs three connected jobs — **propose → plan → scaffold** — and writes working, build-verified code for the viable opportunities. It reads the code, not a CRM: every proposal cites `file:line` evidence. Modeled on `remediate-3000` (same plan-JSON ledger, baseline/verify discipline, parallel edit-group subagents, one-report output, no git mutations), but it *discovers* opportunities itself rather than consuming an audit report.

| Step | File | Job |
|---|---|---|
| 1 | `1-detect.md` | Scan the codebase via 8 product detectors — all dispatched in one message as read-only `Explore`/`haiku` subagents, hard-capped at 4 Greps / 6 tool calls each (reuses audit-3000's detection map) → `/tmp/posthog-cross-sell-opportunities.json`. `[ABORT] No PostHog SDK found` when absent. |
| 2 | `2-baseline.md` | Detect package manager + verify command, record pre-scaffold baseline → `/tmp/posthog-cross-sell-env.json`. |
| 3 | `3-propose.md` | Drop healthy products; score fit/value/effort; classify `scaffold` vs `propose-only` → `/tmp/posthog-cross-sell-plan.json`. |
| 4 | `4-plan.md` | Write a `plan` block (files/approach/snippet) for each scaffold item — **a single illustrative example, one file** (not full coverage). One subagent per item, all in one message, on `model: "sonnet"`. Orchestrator passes the evidence `file:line` list from the plan and **never pre-reads the files itself** (subagents read). |
| 5 | `5-scaffold.md` | Apply the one-example-per-product scaffolds via parallel `sonnet` subagents (one per edit group); install added PostHog packages once. Subagents apply exactly the one-file plan, never extend to other sites. |
| 6 | `6-verify.md` | Spot-check each scaffold + re-run baseline command; one repair pass; revert on unfixable regression. |
| 7 | `7-report.md` | Render a **short** `posthog-cross-sell-report.md` (overview table + one line per item; no code blocks); delete `/tmp/` intermediates. Per-item sub-sections fan out to one `Explore`/`haiku` subagent each (formatting, not judgment), then the orchestrator writes the aggregate sections and collapses them in. Terminal. |

## Design decisions worth knowing

1. **Code-grounded, not sales-data-driven.** By explicit product direction, the skill never consults a CRM or external enrichment — fit is judged purely from repository evidence (`file:line`). This is the key difference from audit-3000's Step 7/8 enrichment + playbook machinery, which this skill deliberately omits.
2. **Detection map reused from audit-3000.** Step 1's per-product grep patterns, competitor packages, and env-var names are lifted from `audit-3000/references/9-use-case-expansion.md` so the two skills classify products identically. If that map changes, mirror it here.
   - **Detectors are cheap, wide, and capped.** All eight run in a single message (no serial batches) as `subagent_type: "Explore"` / `model: "haiku"`, each hard-capped at one Grep per detector (4 total) and 6 tool calls. Detection is grep-and-classify, so a heavier model is wasted there and the cap stops detectors from wandering (an early run saw 7–18 tool calls each across two serial batches). The judgment-heavy steps (plan/scaffold) pin `model: "sonnet"` — never opus. Step 6's read-only spot-checks fan out the same way when there are several items.
3. **Three jobs, three steps.** propose (Step 3: which + why + scaffold/propose-only), plan (Step 4: the implementation detail per scaffold item), scaffold (Step 5: apply). Kept separate because the user asked for all three as distinct deliverables and each is independently verifiable.
4. **Scaffold vs propose-only is conservative.** Only code-driven integrations with a concrete surface and (at most) an official-PostHog-package dependency get scaffolded. Surveys (UI-configured), Logs (backend choice), and any greenfield product with no surface stay proposal+plan. The report still hands the operator a full plan for those.
5. **Scaffolds are minimal and reversible.** Feature-gated, single-provider, comment-marked (`// PostHog <product> — scaffolded by cross-sell`), defaulting to current behavior. No demo routes, no placeholder flags wired to nothing.
6. **PostHog-only dependencies.** Subagents may add an official PostHog package to the manifest (orchestrator installs once); they may never add a non-PostHog dependency or `npm install` themselves.
7. **Baseline before, verify after, one repair pass, then revert** — identical safety contract to remediate-3000, so a scaffold that breaks the build is backed out rather than left half-applied.
8. **Operator commits.** Git state is recorded, never mutated. Each scaffolded product carries a **Finish in PostHog** step (create the flag, build the survey) because code alone doesn't activate most products.
9. **Task pane + wizard summary.** description.md uses `TaskCreate`/`TaskUpdate` (so the wizard task pane populates) and Step 7 permits the wizard-owned `posthog-cross-sell-3000-report.md` summary — same conventions as the current remediate-3000.
10. **Read-only work fans out; map-reduce the report.** Every read-only phase is parallelized — Step 1 detect, Step 4 plan, Step 6 spot-checks, and Step 7's per-item report sub-sections all dispatch one subagent per unit of work in a single message. Cheap (`Explore`/`haiku`) for the formatting/grep-and-classify work (detect, verify, report sections); `sonnet` for the judgment work (plan, scaffold). **Never opus — nothing in this skill runs above sonnet.** Step 5 scaffold stays grouped-by-shared-file because it *writes* (conflict avoidance), not because it can't parallelize. The aggregate report sections (Summary, Opportunity overview, Next steps) are written by the orchestrator after the fan-out collapses, since each needs the whole result set. Step 4's orchestrator must NOT pre-read evidence files — an early run wasted ~1m35s doing ~22 serial `Read`/`Grep` before dispatching planners that re-read the same files; it now passes the evidence paths straight to the subagents.
11. **One example per product, short report (demo cap).** Step 4 plans and Step 5 applies a *single illustrative example* per viable product — one file, one minimal change — not full coverage; the report tells the operator to replicate at the other sites. The report is deliberately terse (table + one line per item, no code blocks). This keeps a demo run fast and the diff small. To restore full-coverage scaffolding, drop the "single representative example / exactly one entry in `files`" wording in `4-plan.md` and the one-line-per-item constraint in `7-report.md`.

## Running it

### Build the skill

From `context-mill/` — set `SKILLS_BASE_URL` so `--local-mcp` downloads resolve to the dev server (a bare `node scripts/build.js` points downloadUrls at GitHub releases and unpublished skills 404):

```bash
SKILLS_BASE_URL=http://localhost:8765/skills node scripts/build.js   # one-shot
node scripts/dev-server.js                                           # watch mode on :8765 (sets the env var itself)
```

### Run via the wizard

```bash
cd <project-with-posthog-installed>
wizard --local-mcp --skill="cross-sell-3000"
```

The wizard's generic `agent-skill` program runs any context-mill skill by id — no wizard code changes needed. No prior audit-3000 run is required; the skill detects opportunities itself.

### Smoke test without the wizard

```bash
cd <project>
mkdir -p .claude/skills/cross-sell-3000
unzip -o <context-mill>/dist/skills/cross-sell-3000.zip -d .claude/skills/cross-sell-3000
# Then in Claude Code: "Run the cross-sell-3000 skill from
# .claude/skills/cross-sell-3000/SKILL.md. Walk every step in order."
```

## Open issues / known TODOs

1. **Interactive selection.** Step 3 auto-classifies scaffold vs propose-only. A future wizard version could surface the proposal in the TUI and let the operator pick which products to scaffold before Step 5 runs.
2. **Flag/survey creation via MCP.** When the session has a PostHog MCP with write scopes, the **Finish in PostHog** steps (create the flag, build the survey) could become opt-in actions instead of manual instructions.
3. **Pairing with audit-3000.** A natural three-skill story: audit-3000 (find problems) → remediate-3000 (fix them) → cross-sell-3000 (grow adoption). Worth cross-linking in each skill's report Next steps.
