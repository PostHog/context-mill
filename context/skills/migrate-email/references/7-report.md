---
title: Write the migration report
next_step: null
---

# Step 7, write the migration report

The report comes from the plan file. Invent nothing.

## Status

```
[STATUS] Writing the migration report
```

## Write the report

Read `.posthog-email-migration-plan.md`. Write `posthog-migrate-email-<provider>-report.md` at the project root, where `<provider>` is the name of the provider folder under `references/`. Use the structure below, then delete the plan file. Never write a recipient's email address into the report.

```markdown
# Email migration report: <provider name> to PostHog

<One or two sentences: how many sites were found, how many can move, how many stay, and whether the sender and the suppression list are ready.>

## Send call sites

| File | Line | Content | Status |
|------|------|---------|--------|

<One row per site. Status is "Ready to move" or "Stays on <provider name>: <reason>".>

## Other <provider name> calls

<Each call that is not a send, with its file, line, and what it does. These stay on <provider name>.>

## Sender and DNS

<Each sending domain: verified, or what the person still has to do, with the records or the Domain Connect link.>

## Suppression list

<How many addresses were imported, or why none were.>

## PostHog secret key

<Where POSTHOG_PROJECT_SECRET_API_KEY is set, and each other place the provider key lives that needs the PostHog key too.>

## Sending tier

<What the person found, or that it was not checked.>

## Before cutover

<A numbered list of everything the person still has to do. Include each unverified domain, a missing suppression import, each place that needs the PostHog key, a tier that is too low or not checked, an API that is not confirmed, and each site that stays with what would let it move. When nothing is left, write "Nothing left before cutover.">

## Summary
```

End the report with the summary block, as the last thing in the file. The Wizard reads it, so keep the keys and their order:

```yaml
from: <provider folder name>
sites_found: <every send site in the table>
sites_rewritten: <sites this run changed to send with PostHog>
sites_left: <sites that stay on the provider, each with a reason>
dns_ready: <true when every sending domain has a verified sender, else false>
suppressions_ready: <true when the list was imported or was empty, else false>
```

This version changes no site, so `sites_rewritten` is `0`. Sites that are ready to move count in `sites_found` only.

After the report is written, print its path:

```
Created migration report: <absolute path of the report>
```
