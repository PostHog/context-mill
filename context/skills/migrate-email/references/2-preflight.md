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
- When `workflows-make-email-template-transactional-prepare` and `workflows-make-email-template-transactional-execute` exist, the API is on. Record `api: on`.
- When other PostHog tools exist but that pair doesn't, either the login lacks the `transactional_email:write` scope (a login with `hog_flow:write` works too), or transactional email is not on for the project yet. A missing tool cannot tell these apart. Tell the person both causes, record `api: not confirmed`, and continue. The report asks them to confirm it before cutover.

Do not call a tool that changes anything to find out.

## The sending tier

PostHog gives each project a sending allowance: how many emails it sends per hour and per day. A new project starts on a low tier, and the tier grows with low bounce and complaint rates. Emails above the allowance are not dropped, they are sent later. So a cutover with more mail than the tier allows delays email, such as password resets.

- Ask the person how many emails the app sends in its busiest hour and on its busiest day.
- Ask them to compare these numbers with the "Sending allowance" in PostHog: Workflows, then Messaging, then Reputation.
- Record the answer as `tier: fits`, `tier: too low`, or `tier: not checked` when they don't know. Do not stop on `too low`: the report tells the person to move the sends in parts, or to ask PostHog about a higher tier, before cutover.

## Write down

Keep `api` and `tier` for Step 3, which writes them into the plan file.
