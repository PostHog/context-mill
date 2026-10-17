---
next_step: 3-verify-instrumentation.md
---

# Step 2 — Choose one template

Settle which single template this run sets up. Step 1 gathered the catalog and the project's state;
this step turns that into one choice. Do not verify prerequisites here (step 3 does that for the
chosen template only) and do not create anything.

## Status

Emit:

```
[STATUS] Choosing a template
```

## Tools

Load the ask tool via `ToolSearch select:mcp__wizard-tools__wizard_ask`.

## Do

1. **If the run prompt already names a template slug**, use it and skip the ask entirely — the user
   typed it, so asking again is noise. Match it against the catalog's slugs exactly. If it isn't
   there, emit:

   ```
   [ABORT] template not found
   ```

   and stop. Include the available slugs in the sentence before the abort line so the message is
   useful.

2. **Otherwise, rank the templates before you show them.** The order is the recommendation, so make
   it mean something. Using only the step-1 note — no new tool calls — sort by how ready this
   project is:

   - **Ready** — every `level: required` prerequisite already looks satisfied.
   - **Needs instrumentation** — the only unsatisfied required prerequisites are ones about events
     (see step 3's classification), which this skill can offer to add.
   - **Not applicable** — a required prerequisite is a product or integration this project doesn't
     have. Keep these last, and only include them if fewer than three templates rank above.

   This ranking is a judgment made from incomplete information, and it is fine for it to be
   slightly wrong — step 3 checks the chosen template properly. What it must not do is bury a
   template that would work here beneath one that can't.

3. **Ask, in one `wizard_ask` call**, `kind: "single"`, one option per template plus a leading
   decline:

   - **`label`** — the template's `question`, not its slug. "Where does your most important flow
     fail without telling anyone?" is the product; `silent-failure-core-action` is a filename.
   - **`description`** — one or two sentences from the template's `discriminator.speaksUp`,
     translated into plain English, plus its readiness. Say what would make the scout speak up and
     what this project still needs. Never leave it empty.
   - **First option is the decline**:
     `{ "label": "None for now", "value": "none", "description": "Don't set up a scout." }`

   Two more things belong in the option text where they apply:

   - **Already installed.** If a template's `scout.name` is already in this project's scouts, say so
     in its `description` ("you already have this one") and move it to the end. Do not remove it —
     the user may want to know it's there.
   - **Troop is full.** If ten or more scouts are already enabled, say so once in the question
     `prompt`: every enabled scout is a recurring LLM spend, and past roughly ten the share of runs
     that find anything drops by about half. The user can still choose one; they should just know
     they may want to disable another.

   Keep the whole thing readable in a terminal. If the catalog ever grows past about eight
   templates, show the top eight by the ranking above and say how many were left out.

4. **On `none`** — or on a cancelled/timed-out ask — emit exactly:

   ```
   [ABORT] template declined
   ```

   and stop. Nothing has been written anywhere, so there is nothing to undo.

5. **Carry the chosen template forward whole**: its slug, `requires`, `watches`, and the complete
   `scout` block including `body` **verbatim**. Step 5 creates from that text, and a body you
   paraphrased on the way through is a scout the template author didn't write.
