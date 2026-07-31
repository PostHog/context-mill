---
title: Publish the migration report
next_step: null
---

# Step 7, publish the migration report

The report comes directly from `.posthog-migration-plan.md`. That file is the source of truth for everything that happened. Nothing is invented.

## Status

```
[STATUS] Publishing migration report
```

## Read the plan

Read `.posthog-migration-plan.md`. Pull the outcome on each phase line, and every row from the sites table.

## Publish the report

Compose the report with the structure below and publish it with a single `publish_handoff` call, passing the complete markdown as `content`:

```
publish_handoff({ "content": "<the full report markdown>" })
```

Group the replaced call sites by file, in source tree order. Identification rows in the plan are the ones whose `to` calls `posthog.identify()`.

That call is how the report reaches the user — the tool creates a PostHog notebook from it and the wizard surfaces the link. Do not write the report to a file, and do not create a notebook yourself. After it is published, delete `.posthog-migration-plan.md`.

<wizard-report>
# PostHog migration report — {display_name}

The wizard has migrated this project from `{display_name}` to PostHog. [1–2 sentence summary covering call sites replaced, package removal, and verify outcome.]

## Migrated target

`{display_name}` — variant `{variant_id}`

## Replaced call sites

| File | Before → After | Status |
|------|----------------|--------|

If there were zero call sites, write `_No source-SDK call sites were present in source code; only the package was removed._` instead.

## Removed packages

Bulleted list of the source SDK packages uninstalled in Step 5. If none were uninstalled, write the reason recorded in the `cleanup` phase line.

## Identification added

| File | Trigger | User id source |
|------|---------|----------------|

Only list `posthog.identify()` calls Step 4 added at login or signup sites where the source SDK already identified users. If none were added, write `_No identification calls were added (the source SDK did not identify users in this project)._`.

## Manual follow-ups

Numbered list of every item the operator should look at next. Include every row whose status is `warning` or `error` with its file, line, and notes. Include the `verify` failure if there was one, with the command and a short excerpt. Include any instrumentation gaps the agent noticed but deliberately did not add.

If there are no follow ups, write `_Nothing to follow up on._`.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

After the report is published, emit a final line recording it.

```
Published migration report to the wizard session
```
