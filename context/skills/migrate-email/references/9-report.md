---
title: Write the migration report
next_step: null
---

# Step 9, write the migration report

The report comes from the plan file. Invent nothing.

## Status

```
[STATUS] Writing the migration report
```

## Write the report

Read `.posthog-email-migration-plan.md`. Write `posthog-migrate-email-<provider>-report.md` at the project root, where `<provider>` is the name of the provider folder under `references/`. Use the structure below. Then delete the plan file. Never write a recipient's email address into the report.

```markdown
# Email migration report: <provider name> to PostHog

<One or two sentences: how many sites were found, how many moved, how many stay, and whether the sender and the suppression list are ready.>

## Send call sites

| File | Line | Content | Key | Status |
|------|------|---------|-----|--------|

<One row per site. Key is the `templateKey` of a moved site, or its `templateId` for a template made in PostHog. A site whose provider template moved into the code names its email's files. Status is "Moved", "Moved without distinctId: <why>", or "Stays on <provider name>: <reason>".>

<Each note under the plan's sites table: each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, and each idempotency key a retry across the deploy could send twice.>

## Other <provider name> calls

<Each call that is not a send, with its file, line, and what it does. These stay on <provider name>.>

## Webhook handlers

<Leave this section out when the plan lists no handler. For each handler: its file and line, the <provider name> events it handles, and the PostHog events that take their place for the moved sends, from `mapping.md` under "Webhooks". Say that the handler keeps getting events for the sites that stay, that moved sends no longer reach it, that PostHog records their events on the person only when engagement events are on for the project, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post those events to an endpoint, in PostHog's shape, not the provider's.>

## Sender and DNS

<Each sending domain: verified, or what the person still has to do, with the records or the Domain Connect link.>

## Suppression list

<How many addresses were imported, or why none were, and each fact the plan notes from the provider's `account.md` under the phase.>

## PostHog secret key

<Where POSTHOG_PROJECT_SECRET_API_KEY is set, and each other place the provider key lives that needs the PostHog key too.>

## Checks

<The check each rewrite file names, such as the typecheck, the tests, and the test email: what passed, what failed, and what was not checked and why. Each file Step 8 fixed outside the moved sites. Say which of the send, the engagement event, and the product event showed on one person.>

## Sending tier

<What the person found, or that it was not checked.>

## Before cutover

The moved sites send through PostHog as soon as this code is deployed. Everything in this list has to be done before that deploy.

<A numbered list of everything the person still has to do. Include each unverified domain, a missing or partial suppression import, `POSTHOG_PROJECT_SECRET_API_KEY` in the env file when the plan says it is not set, each place that needs the PostHog key and each new env variable, a tier that is too low or not checked, an API that is not confirmed, sends with content from the code (`html`, `text`, or `react`) when a site that moves has them (confirm with PostHog that the project can send them), a failed check, a dependency upgraded across a major version whose changelog the person should read, each idempotency key a retry across the deploy could send twice, each email brought into the code with its files (compare one send with the provider's, and change the email in the code from now on, not at the provider), each image the provider hosts that such an email shows (host it yourself before you close the provider account), each value such an email now escapes that the provider inserted as it was (check that the email still reads as intended), each template made in PostHog with its ID (send a test of it from PostHog, and check that it is transactional, sends from a verified sender, fills each variable the site sends, and is marked sensitive when the email carries a code or a reset link), each webhook handler that the moved sends no longer reach, each provider key written in the source rather than read from the environment (the person rotates it at the provider), and each site that stays with what would let it move. Each item is something the person does. Leave out notes that ask for no action. After an import, always end with: import the entries the provider added to its suppression list since the export, right before cutover. When nothing is left, write "Nothing left before cutover.">

## After cutover

<What the person removes once the moved emails arrive from PostHog: when no site stays and no other provider call is left, the provider's package and its key in every place listed above. Otherwise, write that the provider stays for the sites and calls listed above, and name each part of the app with its own dependency manifest, such as a worker in another language, where no site or call is left, no code imports or re-exports the provider's package or client for another part, and `mapping.md` doesn't keep the package for other uses: its provider package can go. When the plan says the run created a full-access provider key and the person has not deleted it yet, the person deletes that key at the provider and removes its variable from the env file.>

## Summary
```

End the report with the summary block, as the last thing in the file. The Wizard parses it, so keep the keys, their order, and bare values: a whole number, `true`, `false`, or the provider folder name. Never add a comment or a reason to a value. The reasons are in the tables above. For example:

```yaml
from: resend
sites_found: 3
sites_rewritten: 2
sites_left: 1
dns_ready: false
suppressions_ready: true
```

- `from`: the provider folder name.
- `sites_found`: every row of the sites table.
- `sites_rewritten`: the sites this run moved to send with PostHog.
- `sites_left`: the sites that stay on the provider.
- `dns_ready`: `true` when every sending domain has a verified sender.
- `suppressions_ready`: `true` when every entry of the suppression list was imported, or the list was empty.

After the report is written, print its path:

```
Created migration report: <absolute path of the report>
```
