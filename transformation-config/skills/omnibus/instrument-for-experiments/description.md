# Instrument PostHog for a specific experiment

Use this skill when the user wants to run an A/B test but has not yet captured the events needed to measure it. The goal is not blanket coverage — it is the minimum instrumentation that lets one experiment answer one question.

This skill is intentionally opinionated:

- **One hypothesis at a time.** Refuse to instrument "in general" — anchor every event to the experiment being scoped.
- **Exactly one primary metric.** Picking two is the most common mistake. If the user names two, force a choice.
- **Few secondary metrics.** 1–3 supporting signals that explain *why* the primary moved. They are not conclusions on their own.
- **Capture what you'll measure, nothing else.** Do not propose the standard 10–15-event sweep from `instrument-product-analytics`. Stay scoped.

If the user wants generic product analytics coverage, route them to `instrument-product-analytics` instead. If they already have events and just want to create the experiment, route them to the experiment creation flow in the PostHog MCP.

## Instructions

Follow these steps IN ORDER. The order is the entire point — do not skip ahead.

STEP 1: Detect platform and existing PostHog setup.
  - Inspect dependency files (package.json, requirements.txt, pyproject.toml, Gemfile, composer.json, go.mod, etc.) to identify framework and language.
  - Check for existing PostHog SDK installation and initialization.
  - If multiple platforms are present (e.g. a Python backend AND a JS frontend), **ask the user which side to instrument first** rather than guessing. The experiment will usually be measured primarily on one side.

STEP 2: State the hypothesis. (BLOCKING — do not proceed without it.)
  - Before any code or any event is named, get the user to write the hypothesis in a single testable sentence. A good hypothesis has three parts:
    > "If we **[change]**, then **[primary metric]** will **[direction + rough size]**, because **[why]**."
  - Examples:
    - "If we replace the empty-state CTA with a guided template picker, then `workflow_created` within 7 days of signup will increase by ~10%, because templates remove the cold-start problem."
    - "If we add a 'duplicate node' shortcut, then `workflow_published` per active user will increase, because faster iteration produces more shippable workflows."
  - If the user gives you something vaguer ("we want to test the new onboarding"), push back once: ask what specific user behavior should change and how you would know. Then proceed with their refined answer.
  - Capture the hypothesis verbatim. It is the load-bearing artifact for everything below.

STEP 3: Pick exactly ONE primary metric.
  - The primary metric is the single number the user will let decide ship / don't ship. Most teams pick two and end up with neither having enough statistical power.
  - Rules:
    - **One event, or one ratio.** Either "% of exposed users who do X", "X count per user", or "X / Y per user". Not all of them.
    - **Measurable in a reasonable window.** If the natural answer needs 30+ days, the experiment is not viable as-scoped. Push for an earlier proxy.
    - **Actually moveable by the change.** If the change touches signup but the metric is 90-day retention, the loop is too long for one experiment.
  - Map the picked metric to one of the four PostHog experiment metric types (this matters for STEP 5 verification and STEP 9 handoff):

    | Natural-language phrasing                                    | Metric type | Notes                                                      |
    | ------------------------------------------------------------ | ----------- | ---------------------------------------------------------- |
    | "% of exposed users who did X"                               | `funnel`    | Exposure → X. Most common shape for activation-style tests.|
    | "X count per user" / "revenue per user" / "minutes per user" | `mean`      | Average of an event count or numeric property per user.    |
    | "X per Y" (e.g. revenue per pageview)                        | `ratio`     | Two events, both needed.                                   |
    | "Do users come back and do Y after exposure?"                | `retention` | Use sparingly — needs a long enough window.                |

  - Write the chosen metric as `[metric_type]: [event] [+ property if mean/ratio]`. This becomes the spec for STEPs 5 and 7.

STEP 4: Pick 1–3 secondary metrics.
  - Secondary metrics explain the primary's movement. They are NOT used to declare victory on their own.
  - Two flavors to look for:
    1. **Counterbalancing / guardrail metrics.** Things that should NOT regress (e.g. "time-to-first-workflow", "support tickets opened"). If the primary goes up but a guardrail tanks, the change did not actually win.
    2. **Mechanism metrics.** The step between exposure and primary that explains *how* the change worked. If the primary is `workflow_published`, a mechanism might be `template_selected` — it tells the user whether the change worked the way they expected.
  - Cap at 3. More than 3 secondary metrics is a sign the user is hedging on the primary — push them back to STEP 3 instead.

STEP 5: Inventory what is already captured.
  - Use the PostHog MCP `read-data-schema` tool with `kind: events` to list events already in the project. For each metric named in STEPs 3 and 4, check:
    - Does the exact event already exist?
    - Does an event with the same intent exist under a different name?
    - Are the required properties already on that event (for `mean` and `ratio` metrics)?
  - Report back to the user, per metric:
    - ✅ Already captured — no instrumentation needed.
    - 🟡 Similar event exists — confirm whether to reuse or add a new one.
    - ❌ Missing — instrument it in STEP 7.
  - If everything is already captured, skip to STEP 8.

STEP 6: Install and initialize PostHog. (Skip if PostHog is already set up.)
  - Follow the framework-specific install and init pattern from `instrument-product-analytics`. The setup itself is the same; only the choice of *what* to capture is different in this skill.
  - For server-side experiments, the server SDK must also be installed — the exposure event (`$feature_flag_called`) needs to be capturable wherever the variant is evaluated.

STEP 7: Capture only the planned events.
  - For each missing event from STEP 5:
    - Locate the single code path where the event would fire. (For a `workflow_published` event, find the publish handler, not every place that touches workflows.)
    - Add one `posthog.capture()` call with the event name and the properties required by the metric (e.g. `amount` for revenue, `template_id` for breakdowns).
    - Pass through `distinct_id` from whatever identity mechanism the project uses. If users are logged in, identify them on login (see `identify-users.md` in the reference list).
  - Do **not** add capture calls for events outside the planned metric list. If a tempting "while we're here" event surfaces, log it as a follow-up — not in this change.
  - You must read a file immediately before attempting to write it. Do not alter the fundamental architecture of existing files. Make additions minimal and targeted.

STEP 8: Build the verification insight per metric.
  - Before the user creates the experiment, they need to see events arriving. Use the PostHog MCP to create one insight per metric so they can watch the live data:
    - **Funnel metric** → `query-funnel` with the exposure event followed by the conversion step.
    - **Mean metric** → `query-trends` of the event count or summed property, per user.
    - **Ratio metric** → `query-trends` with a formula for numerator / denominator.
    - **Retention metric** → `query-retention` with the start and return events.
  - Save the insights. Optionally roll them into a small dashboard named after the hypothesis (e.g. "Template picker experiment — readiness").
  - Tell the user: "Once you see real numbers on these tiles for at least a day or two, you're ready to create the experiment."

STEP 9: Hand off to experiment creation.
  - Once events flow, the user is ready. Point them at the PostHog MCP's experiment creation flow with the following pre-filled context to pass forward:
    - Hypothesis (from STEP 2 — copy verbatim into the experiment `description`)
    - Primary metric (event + metric_type from STEP 3)
    - Secondary metrics (from STEP 4)
    - Feature flag key (kebab-case, derived from the hypothesis)
  - Do NOT call `experiment-create` directly from this skill — the dedicated experiment creation flow covers rollout, variant split, and the draft-first pattern, and is the right surface for it.

STEP 10: Verify and clean up.
  - Run the project's type-check / build / lint scripts (look in package.json or framework equivalents).
  - Confirm that the capture calls you added are reachable from the code paths you expect to instrument the experiment on.

## What this skill explicitly does NOT do

- Blanket-instrument 10–15 files of "business value" — that's `instrument-product-analytics`.
- Decide rollout percentages or variant splits — that's part of the experiment creation flow.
- Create the experiment object itself — that's the experiment creation flow.
- Configure exposure criteria or `allow_unknown_events` — that's the analytics-side experiment configuration.

If the user's actual question is one of those, route them.

## Reference files

{references}

## Key principles

- **Anchor every event to a metric.** If you cannot say which metric an event powers, do not add it.
- **One primary, always.** Two primaries means no decision rule.
- **Verify before you experiment.** A day of live data on the insight beats a week of debugging an empty experiment.
- **Stay scoped.** The customer asked for an experiment, not for a product-analytics audit.
- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
