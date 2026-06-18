---
next_step: null
---

# Step 8 — Write the report and hand off

Everything is configured; leave the user a record of exactly what changed and what (if anything) still needs a human.

## Status

Emit:

```
[STATUS] Writing the report
```

## Do

1. Write `./posthog-product-autonomy-report.md` (read any existing file first, then overwrite). Sections, in order:

   - **Summary** — two or three sentences: what was turned on, and that findings will start appearing in the Signals inbox within ~30 minutes (include the inbox URL from the run prompt).
   - **AI data processing** — approved. (The wizard's AI opt-in gate enforces organization approval before the run starts, so by the time you reach the report it is always granted — just record it as approved.)
   - **GitHub** — connected (and whether it was already connected or connected during this run).
   - **Signal sources** — a table of every source you touched or deliberately skipped: `source_product` / `source_type`, action taken (enabled / already enabled / skipped + why / failed).
   - **Connected tools** — what the user picked, and per tool the step-6 class: "connected by this setup (source id …, first sync started)", "already connected" / "verified connected", "responder enabled but warehouse source not detected (dormant)", or "not used" (only for tools the user didn't pick). Never report a tool as connected unless this run created its source or saw it in `external-data-sources-list`. For sources this run created, note that only the Signals-consumed table (issues / tickets) is syncing and more can be enabled in the UI. Any tool the user picked but didn't connect — whether they said "done" or skipped — is "selected but no source detected (dormant)" with a follow-up, never "user confirmed connecting" and never "not used".
   - **Scout fleet** — kept-on scouts, disabled scouts with the one-line reason each, or the not-yet-materialized note from step 7.
   - **Custom scouts** — from step 7b: each created scout (name, what it watches, its discriminator, and why no canonical scout covers it) or one line on why none was warranted; surfaces considered and ruled out, with the filter that killed each; declined proposals; and the noise escape hatch (set `emit: false` on a scout's config in PostHog to switch it to dry-run). Omit only if step 7b was skipped entirely.
   - **Follow-ups** — every follow-up recorded along the way, as a checklist. Omit the section if there are none.
   - **What happens next** — the scout coordinator picks up fresh configs within ~30 minutes; findings cluster into reports in the inbox; immediately-actionable ones can start autonomy coding tasks.

2. Keep it factual and scannable — tables over prose, no marketing language. Cite ids only where useful (source config ids help support).

3. Finish with a short plain-text summary to the user (the wizard renders its own outro with the inbox link — don't duplicate the whole report in chat).
