---
next_step: 2-pick-template.md
---

# Step 1 — Read the catalog and the project

Gather everything the later steps decide on, in one pass: the templates on offer, and enough of
this project's state to tell which of them would actually work here. **Read-only step** — ask
nothing, decide nothing, write nothing.

## Status

Emit:

```
[STATUS] Reading the template catalog
```

## Tools

{{> mcp-tool-calling}}

Load the local tools via `ToolSearch select:Read`. Reach the PostHog tools through the `exec` tool —
run `info <tool>` before the first `call` for `scout-project-profile-get`, `read-data-schema`, and
`scout-config-list`.

## Do

1. **Read `references/self-driving-catalog.md`** — the whole file, once. It opens with a summary
   table (slug, title, schedule, count of required prerequisites), then one `## <slug>` section per
   template with its frontmatter in a `yaml` fence.

   If the file is missing or holds no templates, emit exactly:

   ```
   [ABORT] no self-driving templates available
   ```

   and stop. Do not go looking for the catalog anywhere else — you have no network access to
   posthog.com, and the file shipping inside this skill is the only copy.

2. **Call `scout-project-profile-get`.** One call returns products in use, connected integrations,
   warehouse sources, and — the part that matters most here — `top_events`: the project's busiest
   events with per-event `count`, `distinct_users`, and `last_seen_in_window`. That is your
   evidence for whether an event is not just *defined* but *alive*.

   **Tolerate failure**: it can 404 on a team without a profile yet. Retry at most once, then record
   "profile unavailable" in your notes and continue. Every later judgment that would have rested on
   the profile becomes "unknown", never a confident negative.

3. **Call `read-data-schema` with `{"query": {"kind": "events"}}`** to list the project's event
   definitions. Page with `limit: 500` and `offset` until you have them all or you have seen 2000 —
   past that, note the list is truncated and rely on `top_events` for the rest.

   Definitions and `top_events` answer different questions, and you need both. A definition proves
   an event name was *ever* sent. `top_events` proves it is *still being sent*. An event that exists
   in the definitions but is absent from a healthy `top_events` list is a dead event — for this
   skill's purposes that is no better than one that never existed.

4. **Call `scout-config-list`** to see which scouts this project already has, and how many are
   enabled. Note two things for step 2: the set of existing scout names (so you don't offer to
   create a duplicate), and the enabled count (the troop's useful ceiling is about ten enabled
   scouts — past that, findings per run measurably drop).

   **Tolerate failure**: if it errors or returns nothing, note "existing scouts unknown" and
   continue.

5. **Read `./posthog-setup-report.md` if it is there.** It is written only by a recent base-wizard
   integration run, so it is often absent — treat its absence as **no signal**, never as "nothing is
   instrumented". When present it is ground truth for what that run instrumented in this repo, and
   it usually names events with the file they are captured in. That mapping is worth more than
   anything you could grep for.

6. **Write down your working note** (in your own notes, not a file). Step 2 and step 3 consume it:

   - Every template: slug, title, its `requires` list with levels, its `watches` sources, and its
     `scout.name`.
   - The project's live events — name, rough volume, last seen — and any file paths the setup report
     attributed them to.
   - `products_in_use` and the `kind` of each connected integration.
   - Existing scout names, and the enabled count.
   - Anything you could not read, marked "unknown".

Do **not** scan the source tree in this step. Step 3 knows which template was chosen and greps for
what that one actually needs; a broad scan now would be work thrown away for every template the
user doesn't pick.
