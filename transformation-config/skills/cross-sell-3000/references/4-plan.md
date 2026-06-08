---
next_step: 5-scaffold.md
---

# Step 4: Write an implementation plan for each scaffold item

The plan is at `/tmp/posthog-cross-sell-plan.json` (Step 3). This step fills the `plan` block for every `proposed` (scaffold-bound) item — the concrete files, approach, and a code snippet — so Step 5 can apply it mechanically. It does NOT edit project source and does NOT touch `propose-only` items beyond leaving them as-is.

## Status

Emit:

```
[STATUS] Planning implementations
```

## Action

### a. Select items

Read the plan. Take items with `status: "proposed"`. If there are none, emit `[STATUS] No scaffolds to plan` and continue to the next step.

### b. Plan each one against the real code

For each item, read the files named in its `evidence` so the plan anchors on the project's actual structure, imports, and style. Use the current PostHog API for the product — the canonical installation doc per product:

- Feature Flags — `https://posthog.com/docs/feature-flags/installation`
- Error Tracking — `https://posthog.com/docs/error-tracking/installation`
- Product / Web Analytics — `https://posthog.com/docs/product-analytics/capture-events` (and bundled `references/best-practices.md`)
- LLM Observability — `https://posthog.com/docs/llm-analytics/installation`
- Session Replay — `https://posthog.com/docs/session-replay/installation`
- Surveys — `https://posthog.com/docs/surveys/installation`
- Logs — `https://posthog.com/docs/logs/installation`

Then write a `plan` block:

- `files` — the exact files to create or edit (`path` for new files, `path:line` for edits), each with a one-phrase note of what changes there.
- `approach` — 2–4 sentences: where the integration hooks in, how it stays minimal and reversible (feature-gated, single provider, clearly-commented), and any PostHog package that must be installed (PostHog packages only).
- `snippet` — the concrete code to add, in the project's style, ready for Step 5 to adapt.

Keep scaffolds minimal and self-evidently safe. Examples of the right altitude:

- **Feature Flags** — replace one hardcoded toggle from the evidence with `posthog.isFeatureEnabled('<slug>')` (client) or `await posthog.isFeatureEnabled('<slug>', distinctId)` (server), defaulting to current behavior when the flag is undefined. Note in `approach` that the flag must be created in PostHog.
- **Error Tracking** — add `posthog.captureException(error)` (client) / posthog-node capture (server) inside the specific catch blocks from the evidence, leaving existing logging intact.
- **Product / Web Analytics gap** — add a single static-named `posthog.capture('<event>')` on the named surface, or enable `capture_pageview`/`capture_pageleave` in the existing init.
- **LLM Observability** — wrap the existing AI client with the `@posthog/ai` wrapper, preserving the current call signature; note the package install.
- **Session Replay** — add/adjust the `session_recording` block in the existing `posthog.init`.

### c. Update the plan

Read the plan, set each planned item's `plan` block and flip its `status` to `planned`, and write the file back in full.

## Output

Every `proposed` item is now `planned` with a non-null `plan` block; `propose-only` items are unchanged.
