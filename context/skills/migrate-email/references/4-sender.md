---
title: Set up the senders and their DNS records
next_step: 5-suppressions.md
---

# Step 4, set up the senders and their DNS records

PostHog sends from a verified sender: an address on a domain whose DNS records PostHog checked. Set up a sender for each domain the app sends from, next to the provider's records, so both providers can send during the cutover. Never change DNS yourself, and never change the provider account.

## Status

```
[STATUS] Setting up the PostHog sender
```

## List the addresses

Collect every `from` in the plan's sites table. When a `from` comes from an environment variable or a config value, read it from the example env file or the config, or ask the person for the address. A `from` can carry a name, such as `Example <hello@mail.example.com>`: the sender is the address in it.

Group the addresses by domain. Each domain needs one verified sender.

## Check for verified senders

Call `integrations-list` with `kind=email`, and read every page. A sender with `config.verified: true` can send. When the list shows senders without `config`, call `integrations-email-verify-create` once on the sender for the address: `success` means it is verified, and `pending` or `failed` means you continue from its records below. When the sender tools are missing, or the verify answers 403, ask the person whether a sender is verified for each domain.

The first sender that verifies becomes the project's default sender. A send without `from` uses it.

## Set up each domain without a verified sender

Read the provider's `account.md` first. It lists the records the provider keeps on the domain and the label PostHog must not take. Keep every one of the provider's records: removing one stops the provider's sends before the cutover is done.

Send from the domain of the existing `from` address, so the emails keep their sender. Ask for another domain only when the person wants one.

- First check that the PostHog MCP has the sender tools: `integrations-email-create`, `integrations-email-verify-create`, `integrations-domain-connect-check-retrieve`, and `integrations-domain-connect-apply-url-create`. When they are missing, go to the last bullet.
- When the `setting-up-an-email-domain` skill is available, read it for the details of the records. Where it differs from this step, this step wins.
- Never create a sender for an address that already has one: creating it again marks it unverified. For an existing unverified sender, skip to its records.
- Create the sender with `integrations-email-create`, then get its DNS records with `integrations-email-verify-create`.
- PostHog never writes DNS. Call `integrations-domain-connect-check-retrieve` with the domain. When `supported` is true, give the person the URL from `integrations-domain-connect-apply-url-create`: they approve the records at their DNS host. Otherwise, give them the records that are not `success` as a table with type, name, value, and priority.
- Always include both SPF records, merged into an existing `v=spf1` record when there is one. Never add a second `_dmarc` record when the domain already has one.
- Call `integrations-email-verify-create` again after the records are published, at least a minute apart. `success` means verified. `failed` means fix the records, then verify again. After about 15 minutes of `pending` with every record published, tell the person that DNS is still propagating and that they can ask you to check again later, record the domain as not verified, and continue.
- When the person can't publish the records during this run, such as when another team owns DNS, record the domain as not verified with its records or its Domain Connect link, and continue.
- A 403 that says the person lacks permissions in the project means a project admin must verify the sender. Do not retry: record the domain as not verified, and continue.
- When the sender tools are missing or refused, do not try other integration tools. Ask the person to add a sender on the domain in PostHog: Workflows, then Channels, then add an email sender, and follow the DNS steps (https://posthog.com/docs/workflows/configure-channels). Record the domain as not verified unless they confirm it shows as verified, and continue.

## Write down

Tick the `sender` phase in the plan file: `- [x] sender — <verified domains>/<domains> verified — dns_ready: <true|false>`. `dns_ready` is `true` only when every domain has a verified sender. List each domain that is not verified, with what the person still has to do.
