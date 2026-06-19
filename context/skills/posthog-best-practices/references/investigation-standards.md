# Investigation standards for PostHog audits

Use this reference when an audit skill produces a findings report. These standards exist to make audit findings trustworthy and prevent the failure mode where a plausible-sounding finding ("PostHog is initialized twice") turns out to be wrong because the investigator inferred behavior from documentation rather than locating the actual code.

Wrong findings in customer-facing audits erode trust and cause rework. The standards below are cheap to apply during the audit and expensive to skip.

## The three standards

### 1. Provenance on every claim

Every non-`pass` finding must cite the exact file path, line number(s), and a short code snippet (or equivalent search-result evidence). This is enforced by the ledger schema — `audit_resolve_checks` requires a `file` field for non-skip findings — but the standard goes further than the schema.

**What counts as provenance:**
- File path + line number + code snippet showing the behavior.
- Grep / search results showing presence or absence of a pattern.
- Package.json / lock-file entries for version claims.
- Config-file values for configuration claims.

**What does NOT count:**
- "PostHog is likely configured with…" (inference from docs).
- "Based on the framework, it probably…" (assumption from conventions).
- "The codebase appears to…" (hedge language without evidence).

**When you cannot find the code that would prove a claim:** resolve with `pass` and `details: "skip: …"` listing what you searched for and where. An honest skip is more useful than a plausible guess. The operator can point you at the right place.

### 2. Verification evidence inline with each finding

The evidence IS the finding. Showing the search result, file path, or config value that proves the behavior is not a separate step; it's part of stating the finding. This is what the `details` JSON field is for — populate it with the actual values, counts, and examples that justify the verdict, not a paraphrase of the rule.

For **presence findings** (something exists that shouldn't), evidence is the code snippet or matched line. For **absence findings** (something is missing that should exist), evidence is the search you ran and the directories you checked. Absence findings are the most dangerous to get wrong — only resolve "missing reset() on logout" after checking every plausible logout / signout code path, not just the first one you found.

### 3. Adversarial self-review per area

After every check in an area is resolved, the report step's "Assumptions and blind spots" subsection answers four questions for that area:

1. **What code paths did I NOT check** that could change these findings? (e.g. "I checked the main auth callback but not the magic-link flow.")
2. **What runtime assumptions am I making** that the static code doesn't prove? (e.g. "I'm assuming these two components mount on the same page, but they might be route-gated.")
3. **Are there alternative explanations** for the patterns I found? (e.g. "the dual init might be intentional for different PostHog projects in dev vs prod.")
4. **What would I verify in the live PostHog project** to confirm or refute the most important findings? (e.g. "query `$feature_flag_called` events to see if both inits are actually firing.")

This subsection is not about being uncertain. It's about making the boundaries of the investigation explicit so the operator knows where to probe further. Run the self-review per area, not at the end of the whole report — five areas of context at once is too much to hold.

## Ordering: investigate, document, review

For each area:

1. **Investigate** — search the codebase, read the relevant code, form claims via the subagents the skill dispatches.
2. **Document findings** — each finding gets provenance + verification evidence inline. Resolutions go to the ledger as the subagents finish.
3. **Adversarial self-review** — after all the area's checks are resolved, the report step renders the "Assumptions and blind spots" subsection.

Do not defer the adversarial review to the end of the full report. It belongs at the bottom of each area, while that area's findings are still in working memory.

## Tests vs. evidence

**Evidence is sufficient for the audit** when the code that creates the behavior is visible. A finding of "dual `posthog.init()` on the signup page" supported by two file paths and two init() calls is actionable without a test.

**Runnable tests belong to the fix phase**, not the audit. When the operator implements the recommended fix, they should write a test confirming the fix works. The audit's job is to identify and prove the problem, not to build the test harness.

**Exception:** when a finding depends on runtime behavior that static code can't prove (async timing, race conditions, cross-component mount order), note this explicitly in the adversarial review. The recommended next step is a live verification (PostHog data, temporary logging), not a test in the audit.

## Common failure modes

- **Scope creep through decomposition.** An investigation that starts as "check if identify() is called correctly" expands into a full identity resolution architecture review, then person-processing deep-dive, then flag evaluation analysis. Each expansion feels justified, but the audit skill's seeded checks define the scope — resist drift unless the operator explicitly asks for depth.
- **Polishing findings instead of shipping.** Reorganizing report structure, adding context sections, improving formatting on findings that are already clear. The operator wants the findings, not the report. Ship rough findings; polish only if asked.
- **Comprehensive when MVP was the ask.** When the operator asked one question, deliver the minimum answer first, then offer to go deeper.
