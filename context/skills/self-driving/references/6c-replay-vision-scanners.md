---
next_step: 7-report.md
---

# Step 6c — Replay Vision scanners

Scouts pull; scanners push. A **scanner** is the sensor layer of Replay Vision: an LLM that watches **one session recording at a time** on a schedule, writes an observation, and — when `emits_signals` is on — pushes what it found straight into the Self-driving inbox. It sees what no event can: a blank screen, a broken layout, a button that visibly does nothing, a form that swallowed the submit. That is the whole reason this step exists.

This step creates a small, fixed set of **skeletons** below. Each locks the trust-critical bits — `scanner_type`, `emits_signals`, and the base prompt — and leaves you exactly two blanks to fill from the product code: the **`query`** (which flows matter *here*) and a **one-line product-context sentence**. Curated perspective, tailored targeting. Don't reword the locked parts, don't invent extra scanners, don't drop one because it feels redundant.

**This step never aborts.** No recordings yet, an org near its Replay Vision quota, a deploy without the scanner API, a single scanner that fails to create — all of them are a recorded follow-up and a move to step 7.

## Where the inbox findings actually come from

Worth understanding before you write a prompt, because it changes what the prompt is for.

Turning `emits_signals` on appends a **fixed extra turn** to every scan — the same one for every scanner, not something your prompt controls. That turn hunts for a genuine product defect the recording caught (a bug, a crash, a design flaw that clearly broke or blocked the user) at a deliberately high bar: the model must be able to point at the thing on screen, it must have materially hurt the user, and an engineer opening the recording would have to unambiguously agree. Its default answer is "nothing", and for most recordings that is correct.

So:

- **The `query` is your real lever.** It decides which sessions get looked at, and that — not prompt wording — is what makes one scanner different from another. Spend your effort here.
- **The scanner's own prompt is the core observation task**: it produces the observation a human reads in the Replay Vision UI, and it is the context the model carries into the defect turn. It shapes attention. It does not set the signal bar.
- **Findings arrive at half weight**, and a report is promoted at a full one. So a single finding can't reach the inbox alone — it needs corroboration.

### Why the queries must not overlap

That last point is the reason for the hardest rule in this step.

Two scanners whose queries both match the same session each produce their own observation, and each runs the **same** fixed defect turn over the **same** recording. They describe the same on-screen defect in near-identical words. Signals are grouped by meaning, not by which scanner sent them — so those two land in one report, half weight plus half weight reaches a full one, and the report promotes on nothing but itself.

Corroboration is only worth anything when it's **independent**. Two scanners watching the same sessions manufacture their own.

**So: give each scanner a query the other one can't match.** The two below are built that way — one filters on **where** the user is (URL), the other on **what they did** (`$rageclick`) — and they stay that way only if you keep them that way. If you widen one, narrow the other. Never let both cover the same flow.

## Status

Emit:

```
[STATUS] Setting up Replay Vision scanners
```

## Tools

Reach these through the PostHog `exec` tool — `info` then `call` for `vision-scanners-list`, `vision-scanners-create`, `vision-scanners-update`, and `vision-scanners-estimate-create`. `vision-quota-retrieve` is needed only in the narrow case in "Do" step 2.

**If `info vision-scanners-create` says the tool is unknown**, run one `search vision` to confirm, then stop: this deploy doesn't expose the scanner API. Record a follow-up ("set up Replay Vision scanners in PostHog once available") and continue to step 7. Don't hunt for other names.

**If a call returns 404 on every scanner endpoint**, Replay Vision isn't available for this project. Same treatment — follow-up, continue. **If it returns 403**, the token wasn't granted the scanner scope; record that as the follow-up instead, and continue.

## Do

1. **Check for recordings and existing scanners.** You already know from step 2 whether this project has session recordings, and step 3b turned Session Replay on. Call `vision-scanners-list`.

   - **No recordings at all** (a fresh project that has never recorded a session): still create the scanners. They cost nothing while there's nothing to watch, and they start working the day recordings begin, with no second setup. Note it in the report.
   - **Scanners already exist**: read them. Names are **unique per team**, so a skeleton whose name is already taken is an **update, not a create** — `vision-scanners-update` on the existing row (see step 4). And if the team already runs its own scanners covering the same flows, don't pile on: create only the skeletons that add something, and say in the report which you skipped and why.

2. **Quota — a sanity check, not a gate.** Enabled scanners sweep on a schedule and draw from the org's monthly Replay Vision quota. For a fresh project (no scanners, full quota) this is a non-issue — **just create them.** What you're guarding against is a single too-broad scanner burning a month in its first sweeps, and the skeletons' scoped queries plus `sampling_rate` already handle that.

   So: call `vision-scanners-estimate-create` with the `query`, `sampling_rate`, `sampling_mode`, and `model` you're about to use, and read it as a check on **your query**, not as a fits-in-quota test. If `estimated_observations_per_month` comes back implausibly large for the flow you targeted, your query is too broad — tighten it (narrower URL scope, lower `sampling_rate`) and re-estimate. Record the estimates for the report.

   **Only** when step 1 found the team already running enabled scanners: call `vision-quota-retrieve` too, and if the new scanners plus `other_enabled_scanners_monthly_credits` would clearly overrun what's left, ask the user in ONE `wizard_ask` whether to create them anyway or skip — decline option first, as always. Never ask on a fresh project.

3. **Fill the two blanks in each skeleton.**

   **The `query`** is a `RecordingsQuery`, and scanner 1's is the one real judgment call in this step: **find this product's key completion flow in the repo** — checkout, signup, booking, publish, subscribe, whatever this product's "done" is — and scope to it and its immediate predecessors. That is where a defect costs the business the most, so that is where the scan budget goes. Concretely:

   - Prefer `$current_url` `icontains` filters on the real path segments this product uses. Read them out of the code (router files, page/route directories); never guess at `/checkout` if this app calls it `/booking`.
   - **No identifiable completion flow?** Don't invent one — a vague query buys noise at real cost. Fall back to the handful of highest-traffic paths from step 2's evidence, and say in the report that you couldn't identify a completion flow.
   - **Not a web app** (backend-only, or mobile with no web surface): there is nothing for a URL-scoped scanner to watch. Skip scanner 1, keep scanner 2 if the product has any recorded web sessions at all, and record the reason. Skipping both on a pure backend project is a correct outcome.
   - **Then check scanner 2 against it.** `$rageclick` sessions inside the flow you just scoped would be matched by both scanners. That's the overlap you were warned about above — it's small, because rage-click sessions are a narrow slice, and it's acceptable at these defaults. What is *not* acceptable is widening scanner 2 to URLs that scanner 1 already owns.

   > **Never gate the bug scanners on `$exception`.** That narrows them to sessions that already threw a JS error — exactly what error tracking already catches — and blinds them to the thing vision is uniquely good at: silent breakage with no exception at all (blank screen, wrong data, dead button, broken layout). Scope by *where* it matters plus `sampling_rate`. Never by an outcome event. `$rageclick` in scanner 2 is the one exception, and only because there the friction **is** the signal, not a proxy for it.

   **`{{PRODUCT_CONTEXT}}`** is one sentence — what this product is and what a user is normally trying to do in the flow being watched, in the product's own vocabulary. It exists so the model can tell "broken" from "unusual but intended". Example: `This is a B2B invoicing app; users in this flow are creating an invoice and sending it to a client.` One line. No repo internals, no file paths, no secrets, no customer data.

4. **Create each scanner.** `vision-scanners-create` with the skeleton's locked fields plus your two blanks. `enabled` defaults to true and `emits_signals` must be `true` — that flag is the entire point of this step.

   - A **400 on the unique name** means it already exists: fetch it from your step-1 list and `vision-scanners-update` it with the same body instead. Note that `scanner_type` is **immutable after creation** — if an existing scanner of that name has a different type, leave it alone entirely and record it rather than fighting the API.
   - Any other failure on one scanner: record it as a follow-up and go on to the next. One failure never stops the step.
   - Record each scanner's name, what it watches, its query scope, and its estimate — step 7's report lists them.

## The skeletons

Two scanners — deliberately two, not more. All `monitor` type (we want "there's a problem" findings), all Gemini — the only provider available today.

Two is not a budget compromise; it's what the disjoint-query rule allows. A third scanner would have to filter on some *third* axis that neither of these touches, and on a typical product there isn't one — a "blocked conversion" scanner, for instance, would just be scanner 1 pointed at the same flow under a different name, and the two would corroborate each other into promoted reports. That's why scanner 1 targets the completion flow directly instead.

### 1. Broken experiences

The product visibly breaking, on the flow where breaking costs the most. This is the one that earns vision its keep, because it catches breakage that never throws — and it's pointed at the completion flow because that's where a silent defect turns into lost revenue rather than a shrug.

```jsonc
{
  "name": "Broken experiences",
  "scanner_type": "monitor",
  "emits_signals": true,
  "scanner_config": {
    "prompt": "Watch this session for moments where the product visibly broke for the user: an error message or toast, a blank/white screen, content that failed to load, obviously broken layout, a spinner that never resolves, or a button/form/action that clearly did nothing or failed. Only flag issues that are unambiguous on screen and would actually matter to the user – ignore cosmetic nits and anything you're unsure about. For each: what the user was trying to do, what broke, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    // AGENT FILLS: this product's key completion flow + its immediate
    // predecessors, read out of the repo. Not a generic "key pages" list.
    "kind": "RecordingsQuery",
    "properties": [
      {
        "key": "$current_url",
        "value": "/checkout",
        "operator": "icontains",
        "type": "event"
      }
    ]
  },
  "sampling_rate": 0.5,
  "model": "gemini-3.6-flash"
}
```

### 2. User frustration

The user getting stuck. Gated on `$rageclick` — cheap, high-precision, and here the gating event genuinely *is* the friction rather than a proxy for it. It will miss quiet frustration; that's the trade for the low cost, and `sampling_rate: 1.0` is affordable precisely because the gate is narrow. **Leave the gate as the only filter.** Adding a URL scope here is the one change most likely to collide with scanner 1 — and a scanner that overlaps scanner 1 doesn't add coverage, it adds self-corroboration.

```jsonc
{
  "name": "User frustration",
  "scanner_type": "monitor",
  "emits_signals": true,
  "scanner_config": {
    "prompt": "Watch this session for clear signs the user got stuck or frustrated: repeatedly clicking the same element, hammering a button that isn't responding, retrying the same action over and over, visibly hunting for something they can't find, or abandoning a flow partway through. Only flag genuine struggle you can see – not normal browsing or a single mis-click. For each: what they were trying to do, where they got stuck, and the URL.\n\n{{PRODUCT_CONTEXT}}"
  },
  "query": {
    "kind": "RecordingsQuery",
    "events": [{ "id": "$rageclick", "type": "events" }]
  },
  "sampling_rate": 1.0,
  "model": "gemini-3.6-flash"
}
```

## Locked vs. agent-filled

| Locked in the skeleton                       | You fill from the code                              |
| -------------------------------------------- | --------------------------------------------------- |
| `name`, `scanner_type`, `emits_signals`      | `query` — the URLs / events for **this** product     |
| the base prompt and its "unambiguous only" bar | `{{PRODUCT_CONTEXT}}` — one plain sentence          |
| `model`, and `sampling_rate` unless a re-estimate says tighten | (tightening `sampling_rate` down is always allowed) |

## Don't trip on these

- **Never let the two queries match the same sessions.** Widen one, narrow the other. Overlap doesn't buy coverage — it lets one defect corroborate itself into a promoted report.
- **`name` is unique per team.** Duplicate create → 400. Update the existing row instead.
- **`scanner_type` is immutable after creation.** It cannot be patched. Leave a mismatched existing scanner alone.
- **Gemini only** for now — don't try another provider.
- **No `SignalSourceConfig` row.** Replay Vision scanners are self-authorizing: `emits_signals` on the scanner **is** the per-source config. Do not create a `replay_vision` source in step 4 or here.
- **Don't touch the `signals-scout-replay-vision` scout.** That's the analyst layer reading *across* observations for trends; step 6 owns the troop and it stays off by default. Different layer, same inbox.

Record everything you created, updated, skipped, or deferred — the report needs it. Then continue to the next step.
