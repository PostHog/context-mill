# Roast my funnel

A structured roast of an already-identified conversion funnel. Use this after you have located the funnel under scrutiny (a saved insight, a dashboard tile, or a freshly-built query) and you know which step is bleeding users.

## Inputs you need before starting

Confirm you have all of these. Do not proceed without them — your roast will be generic.

- **Funnel insight id or HogQL** for the funnel you're roasting
- **Worst step**: the step with the largest drop-off rate
- **Conversion window** the funnel uses (e.g. 24h, 7d) and whether the trend is recent or gradual
- **Cohort signals** already collected — at minimum: browser/device, traffic source, plan tier — and whether any of these are over-represented in the drop-off

If any are missing, go back to the parent investigation and surface them before continuing.

## The roast

Walk through these four lenses **in order** and emit a specific finding for each. If a lens has nothing to say, write "no signal" rather than fabricating one.

### 1. Step intent vs. step copy

Pull the actual button/page copy at the worst step (via session replay sampling or a direct query if the event includes the `$current_url`/`text`).

- Does the CTA copy match the user's intent at this point in the funnel?
- Is there ambiguity — e.g. two CTAs of similar weight, or a primary action competing with a secondary action?
- Is the value proposition repeated, missing, or buried below the fold?

Output **one** of: "Copy is on-target — no roast needed.", or a specific change to test (e.g. "Replace 'Continue' with 'Start free trial — no card required' on the pricing step CTA").

### 2. Technical reliability of the step

Use error tracking + the `$exception` event over the same window as the funnel.

- Is there a spike in errors on the page that maps to the worst step?
- Are there blocking 4xx/5xx requests at the moment of CTA click?
- Are users abandoning *before* the click event fires? (Visit-without-click ratio on the step.)

Output: the error/event signature with its rate, or "no technical reliability issue detected."

### 3. Cohort fit

Use the cohort signals already collected.

- Is one segment disproportionately dropping (>20pp worse than the cohort average)? Name it.
- Is the funnel implicitly assuming a desktop/web flow but mobile users are >50% of traffic on this step?
- Is traffic source X (paid, referral, organic) over-represented among drop-offs, suggesting an intent mismatch from acquisition?

Output: the segment + the gap, or "cohorts are evenly distributed across drop-offs."

### 4. Funnel design

Look at the funnel itself, not the step.

- Is the funnel too long for the conversion window? (e.g. 7-day window with a 5-step funnel where step 5 has a multi-day delay built in.)
- Are the steps in the wrong order — i.e. a soft commitment after a hard one?
- Is there a step that adds no information vs. its predecessor and is just adding friction?

Output: a specific structural change, or "the funnel structure is appropriate."

## Closing the roast

End the roast with **2–3 concrete action items**, each one sentence, each tied to a finding above. Prefer items the team can execute this week:

- An A/B experiment to run on a specific step ("Test pricing-step CTA copy: control vs. 'Start free trial — no card required'.")
- A handful of session replays to watch ("Watch 5 replays filtered to `browser = Mobile Safari` who dropped at step 3 before Friday.")
- An instrumentation gap to close ("Add `pricing_cta_clicked` event on the `/pricing` page — current data can't distinguish stall-pre-click from stall-post-click.")

Avoid vague suggestions like "improve UX", "reduce friction", or "look into it more." Every action item must name the step, the change, and the expected signal you'd watch to know if it worked.

## What this skill does NOT do

- It does not build the funnel for you. Identify the funnel first; this is a roast, not a setup.
- It does not run experiments. It produces *experiment proposals*.
- It does not replace qualitative work. After the roast, layer in session replays and surveys for context.
