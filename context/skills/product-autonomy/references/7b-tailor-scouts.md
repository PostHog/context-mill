---
next_step: 8-report.md
---

# Step 7b — Custom scouts for this product

The canonical fleet covers generic surfaces (errors, anomalies, observability gaps, health). You are the only actor in this pipeline that has read the repo — you know what the events *mean*, which ones form a funnel, and which domain surfaces matter. This step turns that into coverage: custom scouts for the watchable surfaces no canonical scout owns.

**Canonical scout bodies are never edited** — not here, not anywhere in this setup. Tuning happens in step 7 (`enabled` flags only); new coverage happens here as new, separately-named scouts. This step is **propose-first and fully skippable**: nothing is created until the user approves, and a decline (or any tool failure) means you record the decision and continue to step 8. **Not an abort.**

## Status

Emit:

```
[STATUS] Designing custom scouts for this product
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__llma-skill-get,mcp__posthog-wizard__llma-skill-file-get,mcp__posthog-wizard__llma-skill-create,mcp__posthog-wizard__signals-scout-config-list`. (`signals-scout-config-sync` is already loaded from step 7 if you need it again.)

## Do

1. **Read the authoring guide.** `llma-skill-get {"skill_name": "authoring-signals-scouts"}` — step 7's sync seeded it into this team's skills store alongside the fleet. It defines the scout anatomy (quick close-out → orient → discriminator → explore patterns → save-memory → decide → disqualifiers → close-out), the emit contract, and the quality bar. Follow it for every scout you write; pull its bundled references via `llma-skill-file-get` only for the sections you need.

   **Soft-degrade if it 404s** (older PostHog deploy that doesn't seed companions): read a canonical scout body via `llma-skill-get` (e.g. `signals-scout-general`) and use it as your only template. If neither is readable, record a follow-up ("add custom scouts once the authoring guide is available") and continue to step 8.

2. **Do the gap analysis — this is the thinking step, take it seriously.** Lay the project evidence (the setup report's event taxonomy above all, plus the step-2 checklist: funnel structure, payment/LLM/survey surfaces, warehouse sources, integrations) against what the canonical fleet already watches. For each candidate surface ask, in order:
   - **Is it watchable?** Concrete events with names you can list, a funnel with ordered steps, a domain loop with a success/failure pair. "It's a web app" is not a surface.
   - **Is it uncovered?** A canonical scout that step 7 kept enabled may already own it — error bursts belong to `signals-scout-error-tracking`, generic anomalies to `signals-scout-anomaly-detection`. A custom scout that duplicates an enabled canonical adds noise, not coverage.
   - **Would its scout pass the quality bar?** You must be able to name its signal-vs-noise discriminator and 2–4 concrete explore patterns *before* proposing it. If you can't, the surface isn't ready for a scout — record it as a report note instead.

   Typical shapes that survive all three filters: the product's core funnel (creation → completion → conversion), a domain job pipeline with success/failure events, a critical third-party dependency the events expose (e.g. an external API search that can silently degrade). Expect **one or two** survivors on most projects; zero is a legitimate outcome, and more than three almost always means the filters were too loose — every scout is a recurring hourly LLM spend, so each must earn its schedule.

3. **Propose all of them in ONE `wizard_ask`** (multi-select, one option per proposed scout): name (`signals-scout-<scope>`, prefix mandatory — anything else never runs), what it watches (the events/funnel), and its discriminator in one line each. The user approves any subset; anything not approved is recorded as "proposed, declined" and never created.

4. **Create the approved scouts.** For each: `llma-skill-create` with the name, a trigger-rich description, and a body that meets the guide's quality bar — named discriminator near the top, quick close-out so quiet runs are cheap, 2–4 explore patterns with the actual queries, disqualifiers for this project's foreseeable noise, a Decide section calibrated to the emit contract, save-memory guidance, lean body.

   Then `signals-scout-config-list` and confirm each new scout's config exists (the sync mechanism auto-creates one for any new `signals-scout-*` skill; if one hasn't appeared, re-run `signals-scout-config-sync` once). Leave the configs alone: the defaults — enabled, emitting, hourly — are the intended posture, and this skill still never touches `emit` or `run_interval_minutes`. Any failed write → follow-up, not an abort.

5. **Show the result** — one status line with the outcome, short names:

```
[STATUS] Custom scouts: created run-pipeline; declined: none
```

(adjust to the actual decisions; if nothing was warranted or the user declined everything, say "Custom scouts: none — canonical fleet covers this project".)

Record for the report: each created scout's design rationale (surface, discriminator, why no canonical covers it), surfaces you considered and ruled out (with the filter that killed them), declined proposals, and the noise escape hatch — if a scout turns out noisy, setting `emit: false` on its config in PostHog switches it to dry-run.
