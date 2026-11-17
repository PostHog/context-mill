# Design workflows on the instrumented events

The capture step chose and instrumented this app's events. Your job is to find
the ones that mark a moment in a user's lifecycle, and to design a PostHog
workflow for each moment worth an email. The wizard shows your designs to the
user at the end of the run. The user picks which ones to keep, and the wizard
creates them as **drafts**. A draft sends nothing until the user adds a sender
and turns it on in PostHog.

You do not call PostHog. You read, you design, and you write one file.

## Reference files

{references}

Read `references/graph-schema.md` before you write a workflow. It is the exact
shape the wizard and PostHog accept. Read `references/examples.md` for two
complete proposals.

## Inputs

- `.posthog-wizard-cache/.posthog-events.json` — the events this run
  instrumented, as `{ event, description, file }`. **These are the only events
  you may use**, in a trigger, a wait, or a goal. Copy each name exactly.
- The identify step's handoff — whether the app identifies users, and which
  person properties it sets. Look for `email`.
- The code. Open the files the event plan names, and the app's landing page,
  README, or marketing copy, to learn what the product does and what a user
  must do to get value from it.

## Step 1: decide whether workflows fit

Write zero proposals, and say why in your handoff, when any of these is true:

- **No email on the person.** The identify step does not set an `email` person
  property, and no capture call sets one. An email workflow cannot reach anyone.
- **No lifecycle event.** None of the events marks a moment such as sign-up,
  onboarding, activation, a trial, a purchase, a cancellation, or an invite.
  Clicks, page views, and internal actions are not moments.
- **No accounts.** The app has no users to write to, such as a static site, an
  API with no end users, or a library.

## Step 2: find the moments

Map the events to lifecycle moments. Common ones:

| Moment | Typical events | A workflow that helps |
|---|---|---|
| Sign-up | `user_signed_up`, `account_created` | Welcome, then point at the first useful action |
| Onboarding stalled | sign-up plus a later `onboarding_completed` or first key action | Wait for the key action; if it does not come, a reminder |
| Activation | the first `project_created`, `invite_sent`, `first_upload` | Show the next step after the first success |
| Trial | `trial_started` | Before the trial ends, show what the paid plan adds |
| Purchase | `subscription_started`, `checkout_completed` | Thank the user and point at what the plan unlocks |
| Cancellation | `subscription_canceled`, `account_deleted` | Ask why, once. Never more than one email |

The table is a guide, not a list to fill. Use the names this app uses, and
skip a moment the app does not have.

## Step 3: design each workflow

Design one workflow per moment, at most **three** in total. Choose the moments
with the clearest value to the user first.

1. **One goal per workflow.** Name the event that means the user got there,
   and use it as the conversion goal (`exit_condition: exit_on_conversion`), so
   a user who already did it gets no more emails.
2. **Wait on behavior, not on the clock, where you can.** To nudge a stalled
   user, use `wait_until_condition` on the follow-up event, with a
   `max_wait_duration` such as `3d`. Its `branch` edge (`index: 0`) is "the user
   did it". Its `continue` edge is "the wait ran out". Send the reminder only on
   the `continue` path.
3. **At most two emails per workflow.** Keep delays short and human: hours to
   a few days, never more than `30d`.
4. **Use only these step types:** `trigger` (event), `delay`,
   `wait_until_condition`, `conditional_branch` (person properties only),
   `function_email`, `exit`. The wizard drops a proposal with any other type.
5. **Fire once per person** on an event that can repeat, with
   `trigger_masking: { "hash": "{person.id}", "ttl": 2592000 }`.

## Step 4: write the emails

Write for this product, in its own words. Read its copy before you write.

- A short subject, under 60 characters, that says what is in the email.
- A plain-text body (`text`) of 3 to 6 short lines. One clear next step, with
  the app's real URL where you found one. No HTML.
- Personalize only with person properties the app sets, with a fallback:
  `{{ person.properties.first_name | default: "there" }}`.
- Sign off as the team, for example `The Acme team`. Never invent a person,
  a discount, a price, or a feature the code does not show.
- `to` is always `{{ person.properties.email }}`. Leave `from` empty, as
  `{ "email": "", "name": "" }`: the user picks a verified sender in PostHog.
  Never set `integrationId`.

## Step 5: write the proposals file

Write `.posthog-wizard-cache/.posthog-workflows.json` once, with all your
proposals, in the format below. Write it even when you have no proposals.

```json
{
  "proposals": [
    {
      "title": "Welcome new users",
      "goal": "activation",
      "reason": "Welcomes each new user and points them at their first project.",
      "workflow": { "name": "...", "description": "...", "actions": [], "edges": [] }
    }
  ]
}
```

- `title` — a short name, under 50 characters.
- `goal` — what the workflow helps with, one of `activation`, `engagement`,
  `retention`, `conversion`, `feedback`.
- `reason` — one plain sentence, under 90 characters, on how it helps. Write it
  for the person who owns the product, not for an engineer: no event names,
  no steps, no delays.

The user sees only the title, the goal, and the reason, as a checklist they
tick. They never see the workflow body before it is created, so the three
fields must be enough to decide.
- `workflow` — the workflow body, as `references/graph-schema.md` describes.

When you have no proposals, write `{ "proposals": [] }`.

## Check before you finish

For each proposal, confirm all of these. The wizard checks them too, and drops
a proposal that fails any one.

- [ ] `goal` is one of the five values, and `reason` is under 90 characters
      with no event names.
- [ ] Exactly one `trigger` action, with `config.type: "event"`.
- [ ] Every event name, in the trigger, a wait, or the goal, is in the event
      plan.
- [ ] At least one `function_email` and one `exit`.
- [ ] Every edge's `from` and `to` is an action `id`. Every non-exit action has
      an outgoing edge.
- [ ] Every `wait_until_condition` has a `branch` edge at `index: 0` and a
      `continue` edge.
- [ ] Durations match `^\d*\.?\d+[dhms]$`.
- [ ] Every email goes to `{{ person.properties.email }}`, has an empty `from`,
      a subject, and a body.
- [ ] No `bytecode`, no top-level `trigger`, no `status`, no `id` on the
      workflow.

## Your report section

Put a short markdown section in your handoff's `reportSection`, with a heading
and one line that counts your proposals:

- `Suggested N workflows.` Then one line per proposal: its title and trigger
  event. Say that the user picks which to create on the next screen, and that
  each one is created as a draft that sends nothing until it is turned on.
- `Suggested no workflows.` Then the reason, in one line.

## Task status

- **`done`** — you wrote at least one proposal.
- **`not needed`** — you wrote an empty list. Name the reason from Step 1.
- **`failed`** — you could not read the event plan or write the file.
