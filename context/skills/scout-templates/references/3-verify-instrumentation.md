---
next_step: 4-instrument.md
---

# Step 3 — Check what this scout actually needs

This is the step the whole skill exists for. Decide, with evidence, whether the chosen scout would
find anything in this project — and where it wouldn't, decide whether that is something you can fix.
**Read-only step**: you gather verdicts here and act on them in step 4.

## Status

Emit:

```
[STATUS] Checking what this scout needs
```

## Tools

Load the local tools via `ToolSearch select:Read,Glob,Grep`. Reach the PostHog tools through the
`exec` tool — `info` then `call` — for `query-run` if you need step 3's tie-breaker query.

## Classify every prerequisite before you check it

The template's `requires` entries are `{label, level}`. The **level** is structured and you can
trust it. The **label** is prose written for a human, so your first job on each one is to decide
what kind of thing it is asking for — because each kind has a different check, and only one kind is
something this skill can fix.

| Class | Labels look like | Check it with | If unmet |
|---|---|---|---|
| **Event-shaped** | "A core action with a start and finish event", "Checkout events", "A signup funnel" | Event definitions + `top_events` from step 1, then the repo | **Fixable.** Step 4 offers to instrument it. |
| **Product in use** | "Feature flags in use", "Session replay", "Error tracking", "Surveys" | `products_in_use` in the project profile | Not fixable here — point the user at that product's setup. |
| **Integration** | "GitHub connected", "Linear connected", "Slack connected" | `integrations[].kind` in the project profile | Not fixable here — hand the user the connect link. |
| **Warehouse source** | "Stripe connected", "A Postgres source" | `warehouse_sources` in the project profile | Not fixable here — point at the new-source page. |

**Only the event-shaped class is fixable from inside this repository.** That is not a limitation to
apologize for, it is the point: writing a `posthog.capture()` call is something you can do here and
a web button cannot. Turning on session replay or connecting GitHub happens in PostHog, and for
those your value is catching the gap *before* a dud scout gets created, not closing it.

When a label genuinely doesn't fit any row, treat it as **product in use** and check it against
`products_in_use` by its plainest reading. Guessing "event-shaped" and instrumenting something the
template never meant is worse than reporting an honest "couldn't verify".

## Working out which events the scout reads

For an event-shaped prerequisite the label alone won't name an event — templates are written for
every project, so they say "your core action", not `upload_completed`. Turning that into real event
names is the inference this step is for. Three sources, in order of authority:

1. **`./posthog-setup-report.md`**, if step 1 found one. It names events *and* the files they fire
   from. Nothing you can derive beats it.
2. **The project's live events** from step 1 — names carry meaning, and volume tells you which ones
   are the core path rather than a corner of it.
3. **The repo**, for the events the first two don't settle. Grep for the SDK's capture call
   (`posthog.capture`, `capture(`, `posthog_client.capture`, …) and read the call sites you hit.
   Targeted lookups only — you are confirming a handful of names, not building an inventory.

Also read the template's own `watches` list. It says which evidence the scout consumes ("the
attempt/completion pair for your core action"), which is usually a sharper description of what you
need to find than the `requires` label is.

Judge each candidate event on **both** existence and life:

- **Live** — defined, and present in `top_events` with recent activity. Good.
- **Dead** — defined, but absent from `top_events` or last seen a long time ago. The name exists and
  nothing sends it. For a scout this is no better than missing, and it is *worse* for a human,
  because the event looks present in the PostHog UI. Say "defined but not firing", never "present".
- **Missing** — no definition at all.
- **Ambiguous** — a plausible name exists but you can't tell whether it's live, usually because
  `top_events` only carries the busiest events and a real low-volume event can fall off it. Settle
  it with **one** HogQL count over the last 30 days rather than guessing:

  ```sql
  SELECT event, count() AS c, max(timestamp) AS last_seen
  FROM events
  WHERE event IN ('candidate_one', 'candidate_two') AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY event
  ```

  If the query fails, record "unknown" and treat it as ambiguous in the report. Don't retry more
  than once.

**If the mapping is genuinely ambiguous — two or more plausible candidate pairs, and no evidence
picking between them — ask.** One `wizard_ask`, `kind: "single"`, decline first, options in the
project's own vocabulary ("Checkout: `checkout_started` → `order_placed`"). Getting the funnel wrong
produces a scout that reports confidently on the wrong thing, which is worse than one that reports
nothing. But **only ask when it is actually ambiguous.** When one candidate pair is clearly right,
take it and say so in the report.

## Reach a verdict on every prerequisite

Record one of these per entry, and carry the whole list to step 6 — the report states each one:

- **Met** — with the evidence (the event name and its volume, the integration kind, the product).
- **Unmet, fixable** — event-shaped, and you know what would need capturing and roughly where.
- **Unmet, not fixable here** — with the specific thing the user has to do in PostHog.
- **Unknown** — you could not check it. Say why. Never round "unknown" up to "met".

Then:

- **Any `level: required` entry that is unmet and not fixable here** ends the run. Say plainly which
  prerequisite it was and what the user needs to do, then emit exactly:

  ```
  [ABORT] prerequisites not met
  ```

  Stop there. Creating the scout anyway is the exact failure this skill was built to prevent, and a
  scout that finds nothing is harder to notice than one that was never created.

- **Any `required` entry that is unmet and fixable** goes to step 4 as work to offer.

- **`recommended` and `optional` entries never block**, whatever their verdict. A missing
  `recommended` prerequisite makes the scout weaker, not useless — carry it to the report as a
  follow-up and continue.

- **Everything met** — nothing for step 4 to do. Go there anyway; it will see an empty list and pass
  straight through.
