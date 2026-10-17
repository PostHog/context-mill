---
next_step: 6-report.md
---

# Step 5 — Create the scout

Turn the chosen template into a real scout in this project, tailored to the events step 3 actually
found. This is the first step that writes anything to PostHog.

## Status

Emit:

```
[STATUS] Creating the scout
```

## Tools

Reach the PostHog tools through the `exec` tool — `info` then `call` — for `scout-create-prepare`
and `scout-create-execute`. Load the ask tool via
`ToolSearch select:mcp__wizard-tools__wizard_ask`.

You do not need the `authoring-scouts` guide here. It is for writing a scout from scratch; this
template's body was already written against it. Fetch it with `skill-get` only if you hit something
in the body you genuinely cannot interpret.

## Tailor the body — substitution only

The template's `scout.body` is written for every project, so it refers to "the product's core
action" where this project has `checkout_started` and `order_placed`. Step 3 worked out that
mapping. Apply it: replace the generic references with the real event names, so the scout doesn't
have to rediscover them on every scheduled run.

**Substitute specifics. Change nothing else.** The discriminator, the disqualifiers, and the explore
steps are the template author's judgment about signal versus noise, and they are the reason the
scout is worth running. Carry them through as written, even where you think you could sharpen them.
If there is nothing to substitute, create the body **verbatim**.

Never put source code, secrets, environment values, or customer data into a scout body.

## Do

1. **Check the name first.** `scout.name` is fixed by the template (e.g. `signals-scout-flag-debt`).
   If step 1 found a scout already using it, stop and ask rather than writing: one `wizard_ask`,
   `kind: "single"`, with **skip first** —
   `{ "label": "Keep the existing scout", "value": "skip", "description": "You already have this one; leave it as it is." }` —
   and a second option to create this tailored copy under a suffixed name
   (`<name>-v2`, still `signals-scout-` prefixed, lowercase and hyphens, 64 characters or fewer).

   Default to skipping. Two scouts watching the same surface is double the recurring spend for the
   same finding. On skip, record it and go to step 6 — this is a successful run, not an abort.

2. **Map the schedule.** `scout.schedule` is display text; the API takes minutes.

   | `scout.schedule` | `run_interval_minutes` |
   |---|---|
   | Daily (or absent) | `1440` |
   | Weekly | `10080` |
   | Hourly | `60` |

   Anything else: pick the nearest of those three and say which in the report. The valid range is
   30–43200.

3. **Call `scout-create-prepare`** with the template's `name`, its `description`, your tailored
   `body`, and `config` inline:

   ```json
   {
     "name": "signals-scout-<from the template>",
     "description": "<from the template>",
     "body": "<the tailored body>",
     "config": { "enabled": true, "emit": true, "run_interval_minutes": 1440 }
   }
   ```

   Passing `config` here creates the scout and its schedule in one atomic call — there is no
   follow-up configuration step. Leave `output_destinations` out; inbox delivery is the default and
   Slack routing is the user's choice to make later.

   It returns a `confirmation_hash` and a message. It has written nothing yet.

4. **Get the user's approval, then execute.** Show the returned message in one `wizard_ask`,
   `kind: "single"`, decline first:

   - `{ "label": "Don't create it", "value": "no", "description": "Leave your scouts as they are." }`
   - `{ "label": "Create this scout", "value": "yes", "description": "<what it watches and what makes it speak up, in plain English>" }`

   On **yes**, call `scout-create-execute` with the `confirmation_hash`. On **no**, or a cancelled
   ask, create nothing and go to step 6 — a successful run in which the user chose not to create,
   not an abort. Any code you instrumented in step 4 stays; it is useful regardless.

5. **If create fails**, read the error before retrying. A **conflict** means the name is taken by a
   different definition — fall back to the suffixed name from (1), once. A **validation error** on
   the name means it broke the `signals-scout-` prefix or the character rules; fix and retry once.
   Anything else: record the failure and its message for the report and go to step 6. Do not retry
   more than once, and never loop.

6. **Record for the report**: the scout's name, what you substituted into the body and what you left
   alone, its schedule in plain words, and whether it was created, skipped, or declined.

   The first run fires on the next coordinator tick, within about 30 minutes. If step 4 added events
   that haven't shipped yet, the scout will have nothing to look at until that code is deployed —
   say so rather than implying findings are on their way.
