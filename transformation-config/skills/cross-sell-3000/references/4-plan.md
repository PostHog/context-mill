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

### b. Plan each item in parallel

Each item's plan is independent — it reads only that item's evidence and one product doc — so dispatch **one `Agent` subagent per `proposed` item, all in a single message**, and let them plan concurrently. Planning adapts real code to the project's style, which is judgment work, so run each subagent on `model: "sonnet"` — not a cheap model, but never anything heavier than sonnet. Wait for all to return, then aggregate in (c). Run no other tool between dispatch and collection.

**Do not read the evidence files yourself.** Each item's evidence `file:line` list is already in the plan — pass it straight into the subagent's prompt; the subagent does the reading. Pre-reading here is the orchestrator doing the subagents' work sequentially, which defeats the fan-out and reads every file twice.

Each subagent's `description`: `Plan <id>`. Each subagent's `prompt`, with `<>` filled from the item's `proposed` entry and the canonical doc for its product (from the **Doc map** below):

```
You are a cross-sell planning subagent. Plan ONE illustrative example of a single PostHog integration and return it as JSON. Read-only — do not edit any file.

Item: <id> — PostHog <PRODUCT_NAME>
Evidence: <the item's evidence file:line list>
Canonical PostHog API doc: <DOC_URL>

Read the evidence files so the plan anchors on the project's actual structure, imports, and style. Stay within the evidence files and the one doc — do not explore the wider tree.

Scope: a **single representative example** — one file, one minimal change at the clearest call site from the evidence — that shows how the integration looks in this codebase. This is a starting point for the operator to replicate, NOT full coverage. Exactly one entry in `files`. Say so in `approach` ("example — replicate at the other sites").

Keep the example minimal and self-evidently safe: feature-gated where relevant, single provider, clearly commented, defaulting to current behavior. Right altitude per product:
- Feature Flags — replace one hardcoded toggle from the evidence with `posthog.isFeatureEnabled('<slug>')` (client) or `await posthog.isFeatureEnabled('<slug>', distinctId)` (server), defaulting to current behavior when the flag is undefined; note the flag must be created in PostHog.
- Error Tracking — add `posthog.captureException(error)` (client) / posthog-node capture (server) inside the specific catch blocks from the evidence, leaving existing logging intact.
- Product / Web Analytics gap — add a single static-named `posthog.capture('<event>')` on the named surface, or enable `capture_pageview`/`capture_pageleave` in the existing init.
- LLM Observability — wrap the existing AI client with the `@posthog/ai` wrapper, preserving the current call signature; note the package install.
- Session Replay — add/adjust the `session_recording` block in the existing `posthog.init`.

Return exactly this JSON (no prose):
{
  "id": "<id>",
  "plan": {
    "files": [{ "path": "<path for new files, path:line for edits>", "note": "<one phrase: what changes there>" }],
    "approach": "<2–4 sentences: where the integration hooks in, how it stays minimal and reversible, and any PostHog package that must be installed (PostHog packages only)>",
    "snippet": "<the concrete code to add, in the project's style, ready for Step 5 to adapt>"
  }
}
```

**Doc map** — fill `<DOC_URL>` per product:

- Feature Flags — `https://posthog.com/docs/feature-flags/installation`
- Error Tracking — `https://posthog.com/docs/error-tracking/installation`
- Product / Web Analytics — `https://posthog.com/docs/product-analytics/capture-events` (and the bundled `references/best-practices.md`)
- LLM Observability — `https://posthog.com/docs/llm-analytics/installation`
- Session Replay — `https://posthog.com/docs/session-replay/installation`
- Surveys — `https://posthog.com/docs/surveys/installation`
- Logs — `https://posthog.com/docs/logs/installation`

### c. Update the plan

Collect the returned JSON. Read the plan, set each item's `plan` block from its subagent's result and flip its `status` to `planned`, and write the file back in full. `propose-only` items are unchanged.

## Output

Every `proposed` item is now `planned` with a non-null `plan` block; `propose-only` items are unchanged.
