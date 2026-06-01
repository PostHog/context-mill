---
title: Perform the migration
next_step: 5-cleanup.md
---

# Step 4, rewrite the call sites

Work through the sites table in `.posthog-migration-plan.md`, one row at a time. Replace each source SDK call with the PostHog equivalent the plan records. Do not spawn subagents.

The mapping doc under `references/<variant-id>/` is canonical. Match its replacements as closely as the surrounding code allows. Use environment variables for PostHog keys, never hardcode them.

If a file has integration code for other tools you are not migrating, leave that code alone. Replace only the calls that belong to the source SDK. Make your edits minimal and targeted, do not reformat surrounding lines and do not rearrange the file. The dependency source in `node_modules` is available when you need to confirm a property name or call signature.

Do not add net new instrumentation. No new captures, no new flag evaluations, no new identify calls beyond what the plan already records. A faithful port is the whole job. Net new instrumentation belongs to a separate run of the basic integration flow.

For identification rows in the plan, add `posthog.identify()` calls on both client and server when both exist, so behavior across the two domains correlates. Fire on login after credentials validate, and on signup after the account is created.

## Status

Emit these as you work.

```
[STATUS] Reading migration plan
[STATUS] Planning edits to <file>: <short summary>
[STATUS] Rewriting <file>
[STATUS] Inserting PostHog identification code
```

## Load the plan

Read `.posthog-migration-plan.md` and iterate the sites table.

## Rewrite each pending row

For each row whose status is `pending`:

1. Read around the row's `line` to confirm the original snippet still matches `from`.
2. Edit the file to replace the source SDK call with `to`. If the file's source SDK import becomes unused, remove the import in the same edit. Do not touch unrelated imports.
3. Record the outcome on the row. Pass if the edit applied cleanly. Error if it could not be applied because the file moved, the snippet drifted, or a conflicting edit got in the way. Warning if it applied but you noticed something the operator should review.

Rows already marked `warning` from Step 3 stand as warnings. Leave the source unchanged and add a one line `notes` entry explaining what made the mapping ambiguous.

## Update the plan file

Edit `.posthog-migration-plan.md`. Update each row's status and notes. Then tick the `replace` phase line with the worst outcome across the rows: error if any row errored, warning if any warned (and none errored), pass otherwise.

```
- [x] replace — <pass|warning|error> — <one line summary>
```

Continue to `5-cleanup.md`.
