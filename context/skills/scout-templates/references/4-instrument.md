---
next_step: 5-create-scout.md
---

# Step 4 — Add the events that are missing

Close the gaps step 3 marked **unmet, fixable** — with the user's approval, in their working tree.
This step edits project files and nothing else: it does not create the scout (step 5) and does not
touch PostHog at all.

## Status

Emit:

```
[STATUS] Instrumenting missing events
```

Skip straight to the next step if step 3 left nothing fixable. Say "nothing to instrument" in your
notes for the report and move on — do not invent work to do here.

## Tools

Load the local tools via `ToolSearch select:Read,Glob,Grep,Edit,Write` and the ask tool via
`ToolSearch select:mcp__wizard-tools__wizard_ask`.

## Do

1. **Work out the concrete change first, then ask.** For each gap, find the place in the code where
   the action actually happens — the click or submit handler, the server route, the job's success
   and failure branches — and read it. An "attempt" event belongs where the user commits to the
   action; a "completion" event belongs where it genuinely succeeded, not where the request was
   sent.

   Follow the project's existing conventions rather than importing your own. Step 1's setup report,
   and the capture calls step 3 already read, show you the SDK in use, the event-name casing, and
   the property style. Match them. A `checkout_completed` in a codebase where everything else is
   `Checkout Completed` is a second convention, and event names are an analytics contract.

   **A dead event is a different repair from a missing one.** If step 3 found the event defined but
   not firing, the capture call usually still exists — it is behind a branch that stopped running,
   or after an early return, or in code no longer reached. Find the existing call and say what
   became of it. Adding a second capture for a name that is already defined creates duplicates.

2. **Propose everything in one `wizard_ask`**, `kind: "multi"`, one option per event, decline first:

   - **`label`** — plain language: "Capture when someone starts a checkout".
   - **`description`** — the event name you'd use and the file you'd add it to, plus one line on why
     the scout needs it. This is where the real explanation goes; never leave it empty.
   - **First option**:
     `{ "label": "Don't change any code", "value": "none", "description": "Set up the scout against the events that already exist." }`

   Say once in the `prompt` that these are local edits to the working tree — nothing is committed
   and no pull request is opened.

3. **Make only the edits the user approved.** Read each file before you edit it. Keep the diff to
   the capture calls and their imports — no refactors, no formatting sweeps, no unrelated fixes,
   however tempting. Someone has to review this by hand.

   Do not add an event nobody performs. If working out where a capture belongs shows the action
   doesn't really exist in this codebase, drop it and record why; an event that never fires is the
   same dud the scout would have been.

4. **If the user declines** — or the ask is cancelled — change nothing and continue to step 5. This
   is not an abort. Whether the scout is still worth creating depends on what is left:

   - A `required` prerequisite still unmet → say so plainly, then emit
     `[ABORT] prerequisites not met` and stop. The user turned down the only fix, and a scout that
     watches nothing is not a consolation prize.
   - Only `recommended` or `optional` gaps left → continue to step 5, and record in the report that
     the scout is running with less evidence than the template assumes.

5. **Record for the report**: every file you touched, every event you added, and the events you
   proposed that the user declined. Note again that the changes are uncommitted.

6. **New events take time to arrive.** Anything you instrumented here has never fired: the code
   ships when the user ships it, and the scout will find nothing until it does. Say that in the
   report, and don't let step 5 describe the scout as ready when it's waiting on a deploy.
