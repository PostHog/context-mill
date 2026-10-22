---
title: Check that the project can send
next_step: 3-inventory.md
---

# Step 2, check that the project can send

Do not change any file.

## Status

```
[STATUS] Checking the PostHog project
```

## The transactional email API

Check which PostHog MCP tools exist.

- When there are no PostHog tools at all, the PostHog MCP is not connected or not signed in. Ask the person to connect it, and wait.
- When other PostHog tools exist but `workflows-upload-email-template` and `workflows-send-email` don't, the transactional email API is not enabled for this project. Stop and tell the person: the API is in beta, and they can ask PostHog in-app to enable it for their project. Then emit:

```
[ABORT] transactional email api not enabled
```

- When both tools exist, the API is on. Record `api: on`.

Inside the Wizard, a missing tool can mean that the login lacks its scope, so missing tools do not stop the run. Record `api: not confirmed` and continue. The report asks the person to confirm it.

## The sending tier

PostHog gives each project a sending allowance: how many emails it sends per hour and per day. A new project starts on a low tier, and the tier grows with low bounce and complaint rates. Emails above the allowance are not dropped, they are sent later. So a cutover with more mail than the tier allows delays email, such as password resets.

- Ask the person how many emails the app sends in its busiest hour and on its busiest day.
- Ask them to compare these numbers with the "Sending allowance" in PostHog: Workflows, then Messaging, then Reputation.
- Record the answer as `tier: fits`, `tier: too low`, or `tier: not checked` when they don't know. Do not stop on `too low`: the report tells the person to move the sends in parts, or to ask PostHog about a higher tier, before cutover.

## Write down

Keep `api` and `tier` for Step 3, which writes them into the plan file.
