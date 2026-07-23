---
next_step: null
---

# Step 7 — Write the report and hand off

Everything is configured; leave the user a record of exactly what changed and what (if anything) still needs a human.

## Status

Emit:

```
[STATUS] Writing the report
```

## Do

1. Write `./posthog-self-driving-report.md` (read any existing file first, then overwrite). Sections, in order:

   - **Summary** — two or three sentences: what products and sources were turned on, and that findings will start appearing in the Self-driving inbox within ~30 minutes (include the inbox URL from the run prompt).
   - **AI data processing** — approved. (The wizard's AI opt-in gate enforces organization approval before the run starts, so by the time you reach the report it is always granted — just record it as approved.)
   - **GitHub** — connected (and whether it was already connected or connected during this run).
   - **Products enabled** — from step 3b: a short table of Session Replay / Error Tracking / Support, each as **enabled** / **already enabled** / **enabled but inert** (backend or mobile — the server flip is on, but it needs SDK code on this platform before it captures anything) / **not enabled** (a non-admin couldn't turn it on — the project-admin follow-up). The server flip happens regardless of platform, so a backend/mobile product is *enabled, just inert* — never "skipped". For a web app, note whether the `posthog.init` override check was clean or edited. This is the *product* toggle, distinct from the signal sources below. **Support row:** when Conversations is on, tickets only arrive once an inbound channel is connected — spell out that the user must connect a channel (email / inbox / Slack) in PostHog, and add a matching follow-up.
   - **Signal sources** — a table of every source you touched or deliberately skipped: `source_product` / `source_type`, action taken (enabled / already enabled / skipped + why / failed).
   - **Connected tools** — what the user picked, and per tool the step-5 class: "connected by this setup (source id …, first sync started)", "already connected" / "verified connected", "responder enabled but warehouse source not detected (dormant)", or "not used" (only for tools the user didn't pick). Never report a tool as connected unless this run created its source or saw it in `external-data-sources-list`. For sources this run created, note that only the responder-consumed table (issues / tickets) is syncing and more can be enabled in the UI. Any tool the user picked but didn't connect — whether they said "done" or skipped — is "selected but no source detected (dormant)" with a follow-up, never "user confirmed connecting" and never "not used".
   - **Scout troop** — kept-on scouts, disabled scouts with the one-line reason each, or the not-yet-materialized note from step 6. Include the run budget from step 6's `scout-metadata-get` read — max runs per day, runs used today — plus the announcement banner text if one was returned (it says how to request more runs); if the metadata read soft-degraded or never ran, state the early-access default of 24 runs a day instead.
   - **Custom scouts** — from step 6b: each created scout (name, what it watches, its discriminator, and why no built-in scout covers it) or one line on why none was warranted; surfaces considered and ruled out, with the filter that killed each; declined proposals; and the noise escape hatch (set `emit: false` on a scout's config in PostHog to switch it to dry-run). Omit only if step 6b was skipped entirely.
   - **Follow-ups** — every follow-up recorded along the way, as a checklist. Omit the section if there are none.
   - **What happens next** — the scout coordinator picks up fresh configs within ~30 minutes; scout runs draw from the project's daily budget (24 runs a day by default during early access); findings cluster into reports in the inbox; immediately-actionable ones can start coding tasks.

2. Keep it factual and scannable — tables over prose, no marketing language. Cite ids only where useful (source config ids help support). Name the product **PostHog Self-driving** (or just Self-driving after first mention) throughout — never "Signals" in prose. (The domain noun "signal source" and the `signals-scout-*` / `signals_scout` identifiers are technical names, not the product name — leave those exactly as they are.)

3. Finish with a short plain-text summary to the user (the wizard renders its own outro with the inbox link — don't duplicate the whole report in chat).
