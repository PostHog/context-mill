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

{{> email-sender-setup}}

## Write down

Tick the `sender` phase in the plan file: `- [x] sender — <verified domains>/<domains> verified — dns_ready: <true|false>`. `dns_ready` is `true` only when every domain has a verified sender. List each domain that is not verified, with what the person still has to do.
