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

- Run the check that each moved site's rewrite file names under "Check", on the whole project, as Step 7 did. Fix each error or warning that is not in the list Step 7 kept, in any file: the rewrite or the PostHog SDK's install or upgrade caused it. Note each file you fix outside the moved sites for the report. An error in that list was there before: note it, and leave it.
- Run the tests that cover the files you changed. A test that mocks the provider's client or intercepts its HTTP requests for a moved site now mocks the PostHog SDK's send and asserts on the fields it gets, with the same expected values. Never turn a PostHog send back into the provider's request shape to keep an old assertion. Never delete or skip a test.
- Search the changed files for the provider's calls: a moved site has none left, and each moved site has one PostHog send.
- Check that every site with a category passes the key, type, name, and description the plan notes. List the project's categories with `message-categories-list`: each key the plan doesn't mark as new must be in it, spelled the same, with the same type, name, and description, and each key it marks new must not be. Otherwise the send makes a new category that no recipient opted out of, renames the existing one, or fails with `category_mismatch` for the other type. Check that the content each marketing site sends holds `{{ unsubscribe_url }}`: in the HTML, or in the text when it sends no HTML. Render the email to check content the code builds. A site with a blank category passes none. Fix each site that fails.

## One email on one person

The chain to prove: PostHog sends the email, records its engagement on the person, and that person's product events show next to it.

Skip this part and record `not checked` with the reason when the API is not confirmed on, no sender is verified, or `POSTHOG_PROJECT_SECRET_API_KEY` is not set.

1. Check that the app sends to the MCP's project: compare the project token the app reads with `api_token` from the PostHog MCP `projects-get` tool. Read only the token's line of the env file, by searching for the token variable's name: the file also holds secret keys, so never open all of it. When they differ, record `not checked: the app uses another project`, tell the person which project the app uses, and skip the rest of this part.
2. Ask the person whether to send one test email. Say that it sends a real email. When they say no, record `not checked: declined`, and skip the rest of this part.
3. Run `SELECT toUnixTimestamp(now()), '<a new random string>'` through the PostHog MCP `execute-sql` tool, so the answer can't come from a cached run, and keep the number as the start of the test; skip this when the MCP has no SQL tool. Ask them to trigger one moved email in their local app that sends it to an address they own, from a site whose plan row shows it passes `distinctId`, such as a password reset or a welcome email after signup. When no moved site passes `distinctId`, record `not checked: no moved site names a person`, and skip the rest of this part. Ask them to open the email, then to sign in as the user it went to and use the app for a moment, so that the app's product events show on the same distinct ID. Ask them to tell you when they are done.
4. When the send fails, find its code in `transactional-emails.md` or `api.md`, tell the person the fix, and record it. Never retry a send yourself.
5. Find the person's distinct ID: the value the moved site passed as `distinctId`. Run a SQL query through the PostHog MCP `execute-sql` tool for that distinct ID since the start of the test, with a new random string each time you run it:

   ```sql
   SELECT event, timestamp, properties.$workflow_id AS workflow, '<a new random string>' AS run FROM events
   WHERE distinct_id = '<distinct id>' AND toUnixTimestamp(timestamp) >= <start of the test>
   ORDER BY timestamp
   ```

6. The chain holds when the result has a `$workflows_email_sent`, an engagement event such as `$workflows_email_delivered` or `$workflows_email_opened` with the same `workflow`, and at least one product event of the app. An event from before the start of the test belongs to another email. Delivery events arrive after the provider reports back: when only the send shows, wait a minute and run the query once more.

When the MCP has no SQL tool, ask the person to open their person in PostHog and tell you which of the three they see since they triggered the test email.

Never write the address or the distinct ID into a file.

## Write down

Tick the phase in the plan: `- [x] verify — check: <passed|failed|none>, tests: <passed|failed|none>, category: <kept>/<sites with a category> kept, chain: <proven|partly: what showed|not checked: why>`.
