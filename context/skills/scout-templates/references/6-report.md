---
next_step: null
---

# Step 6 — Write the report

Leave the user a record of what was checked, what changed, and what still needs them. This is the
terminal step.

## Status

Emit:

```
[STATUS] Writing the report
```

## Do

1. Write `./posthog-scout-template-report.md` (read any existing file first, then overwrite).
   Sections, in order:

   - **Summary** — two or three sentences: which template, whether the scout was created, and
     whether any code changed. If the scout is live, say findings reach the Self-driving inbox
     within about 30 minutes; if it is waiting on unshipped events, say that instead.
   - **The scout** — its name, what it watches, what makes it speak up (from the template's
     `discriminator`, in plain English), and its schedule. If you tailored the body, say exactly
     what you substituted. If it was skipped or declined, say which and why.
   - **Prerequisites** — a table with every entry from the template's `requires`: the label, its
     level, the verdict from step 3 (met / unmet / unknown), and the evidence. For a met
     event-shaped prerequisite name the event and its rough volume; "met" with nothing behind it is
     the kind of claim this whole run exists to avoid making. Keep "defined but not firing" distinct
     from "present" — that difference is invisible in the PostHog UI and is exactly what a reader
     needs to know.
   - **Code changes** — every file touched and every event added, or "none". State plainly that the
     changes are **uncommitted and in the working tree**: no commit, no branch, no pull request.
     List the events you proposed and the user declined, so the decision is recoverable later.
   - **Follow-ups** — a checklist. Unmet `recommended` prerequisites, prerequisites you could not
     verify, anything the user has to do in PostHog (connect an integration, turn on a product), and
     shipping the instrumentation you added. Omit the section if there is genuinely nothing.
   - **What happens next** — the coordinator picks up new scouts within about 30 minutes; findings
     arrive as reports in the Self-driving inbox; every enabled scout is a recurring LLM spend, and
     a scout can be switched to dry-run by setting `emit: false` on its config in PostHog if it
     turns out noisy.

2. Keep it factual and scannable — tables over prose, no marketing language. Cite ids only where
   they would help support. Call the product **PostHog Self-driving** (or Self-driving after first
   mention), never "Signals" in prose; the `signals-scout-*` names are technical identifiers and
   stay exactly as they are.

3. **Never claim more than you verified.** If a prerequisite came back "unknown", the report says
   unknown. If the scout was created but its events have not shipped, the report says it is waiting
   on a deploy. A confident report over an unverified setup is the failure this skill exists to
   prevent, arriving one step later.

4. Finish with a short plain-text summary to the user. The wizard renders its own outro, so don't
   repeat the whole report in chat — the headline is which scout now exists, what it needs from them,
   and where to read the rest.
