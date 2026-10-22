---
title: Check the moved sites
next_step: 9-report.md
---

# Step 8, check the moved sites

Check that the app still builds, its tests still pass, and one moved email reaches one person in PostHog. When no site moved in Step 7, tick the phase with `nothing to check` and go to the next step.

## Status

```
[STATUS] Checking the moved sites
[STATUS] Sending a test email
```

## Build and tests

- Run the project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck. Fix each error in a line you changed. An error in a file you didn't change was there before: note it, and leave it.
- Run the tests that cover the files you changed. A test that mocks the provider's client or intercepts its HTTP requests for a moved site now mocks `posthog.emails.send` and asserts on the fields it gets, with the same expected values. Never turn a PostHog send back into the provider's request shape to keep an old assertion. Never delete or skip a test.
- Search the changed files for the provider's calls: a moved site has none left, and each moved site has one `posthog.emails.send`.

## One email on one person

The chain to prove: PostHog sends the email, records its engagement on the person, and that person's product events show next to it.

Skip this part and record `not checked` with the reason when the API is not confirmed on, no sender is verified, or `POSTHOG_PROJECT_SECRET_API_KEY` is not set.

1. Ask the person whether to send one test email. Say that it sends a real email, and that the first send of a local template uploads it to the PostHog project. When they say no, record `not checked: declined`.
2. Ask them to trigger one moved email in their local app while they are signed in as themselves, such as a signup or a password reset, so the email goes to an address they own. Ask them to tell you when it is sent and to open the email.
3. When the send fails, find its code in `transactional-email-api.md`, tell the person the fix, and record it. Never retry a send yourself.
4. Find the person's distinct ID: the value the moved site passed as `distinctId`. Run a SQL query through the PostHog MCP `execute-sql` tool for that distinct ID over the last hour:

   ```sql
   SELECT event, timestamp FROM events
   WHERE distinct_id = '<distinct id>' AND timestamp > now() - INTERVAL 1 HOUR
   ORDER BY timestamp
   ```

5. The chain holds when the result has `$workflows_email_sent`, an engagement event such as `$workflows_email_delivered` or `$workflows_email_opened`, and at least one product event of the app. Delivery events arrive after the provider reports back: when only the send shows, wait a minute and run the query once more.

When the MCP has no SQL tool, ask the person to open their person in PostHog and tell you which of the three they see.

Never write the address or the distinct ID into a file.

## Write down

Tick the phase in the plan: `- [x] verify — typecheck: <passed|failed|none>, tests: <passed|failed|none>, chain: <proven|partly: what showed|not checked: why>`.
