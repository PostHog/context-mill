---
title: Write the setup report
next_step: null
---

# Step 7, write the report

The report comes directly from `.posthog-logs-plan.md`. That file is the source of truth for everything that happened. Nothing is invented.

The reader is about to open a diff they did not write. Tell them what changed, what it bought them, and what is still theirs to do.

## Status

```
[STATUS] Writing logs setup report
```

## Read the plan

Read `.posthog-logs-plan.md`. Pull the outcome on each phase line, every row from the surfaces table, and the project wide decisions recorded underneath it.

The project's correlation tier is the best tier reached by any row whose `kind` is `request`. Detached surfaces do not lower it.

## Write the report

Write `posthog-logs-report.md` at the project root with the structure below. After the report is written, delete `.posthog-logs-plan.md`.

<wizard-report>
# PostHog Logs setup report — <runtime>

The wizard has set up PostHog Logs for this project. [1–2 sentence summary covering where the export was wired, the correlation tier reached, and the verify outcome.]

## What you can do now

One short paragraph, written for the tier actually reached.

At the `session` tier: a log line in PostHog now links to the person who caused it, and opens the session replay of them causing it. Point them at the logs view and tell them to use the **View recording** button on a log entry.

At the `person` tier: logs are attributed to people and appear on person profiles, and say plainly what would unlock replay linking, usually enabling session replay on the client.

At the `none` tier: logs are searchable in PostHog but not linked to anyone, and say concretely what would change that.

## Correlation

**Tier reached: `<session|person|none>`**

| Surface | Kind | Distinct ID | Session ID | Tier |
|---------|------|-------------|------------|------|

One row per surface from the plan. In the two ID columns, name the real source, "authenticated user id from `getServerSession()`" rather than "yes".

## What changed

| File | Change |
|------|--------|

Every file created or edited, with a short description. Group by purpose in this order: log export, identity context, correlation attachment.

Name the ingestion region and the environment variables the setup reads. If you added a variable, say so explicitly, since the operator needs to set it wherever they deploy.

## Manual follow-ups

Numbered list of every item the operator should look at next. Include every surface row whose status is `warning` or `error` with its file and notes. Include uncovered call sites found in Step 5. Include the verify outcome if it was anything other than a clean pass, with the command and a short excerpt. Include anything that would raise the correlation tier.

Be specific enough to act on. "Session replay is disabled, so logs cannot link to recordings; enable it in the `posthog.init` call in `app/providers.tsx`" is useful. "Improve correlation" is not.

If there are no follow ups, write `_Nothing to follow up on._`.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user.

```
Created logs setup report: <absolute path to posthog-logs-report.md>
```
