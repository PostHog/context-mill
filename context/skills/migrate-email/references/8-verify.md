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

- Run the check that each moved site's rewrite file names under "Check", on the whole project, as Step 7 did. Fix each error or warning whose file, code, and message are not in the list Step 7 wrote into the plan, in any file: the rewrite or the PostHog SDK's install or upgrade caused it. When one in the list now shows more times than the list says, the extra ones are new too: fix the ones in lines the rewrite changed. Note each file you fix outside the moved sites for the report. An error in that list was there before: note it, and leave it.
- Run the tests that cover the files you changed. Never delete or skip a test, and never turn a PostHog send back into the provider's request shape to keep an old assertion.
  - A test of a moved site runs the real PostHog SDK and intercepts PostHog's send request at the HTTP boundary, as `api.md` describes the request. It asserts on the request PostHog gets and on what the app does, with the same expected values the old test had. A test that intercepted the provider's HTTP requests now intercepts PostHog's. A test that mocked the provider's client, such as `jest.mock('resend')` or a `mock.patch` of `resend.Emails.send`, drops that mock and becomes such a test too. A test that mocks the app's own email module stays as it is.
  - The test sets the env variables Step 7's email client reads: any project token and secret key, and the PostHog host the app uses, such as `https://us.i.posthog.com`. Without them the send fails before it makes a request. A test that answers with an error the SDK retries, such as a 503, answers each retry too, two by default.
  - In Node.js, Python and Ruby, the test intercepts the app host the client sends to, such as `https://us.posthog.com` for that host, with the tool the suite already uses for HTTP. posthog-node sends with the global `fetch`: `msw`, `nock` 14 or later (an older `nock` doesn't see `fetch`), or undici's `MockAgent`, and with none of them, a fake that the test puts on `globalThis.fetch` and takes off after, so no dependency is added. posthog-python sends with `requests` from `Posthog`, and with `httpx` from `AsyncPosthog`: `responses` or `requests-mock`, and `respx` or `pytest-httpx`. posthog-ruby sends with `Net::HTTP`: `webmock`.
  - In Go, .NET, PHP, Rust and Elixir, a test can't swap the SDK's HTTP client, so it runs a local HTTP server and sets the email client's host and app host to its URL. Use the server the suite already uses, or Go's `httptest`, .NET's `HttpListener` or `WireMock.Net`, PHP's built-in server (`php -S`) with a router script, `wiremock`, `mockito` or `httpmock` in Rust, and `Bypass` in Elixir. The server answers the send request; the SDK's other requests to it, such as Go's flag polling, can get a 404. When Step 7's email client doesn't read its app host from the environment, have it read an optional one, such as `POSTHOG_APP_HOST`, and pass it only when it is set, and add the name to the env example file.
  - When the suite has no such tool and the language's standard library has none, as in Python, Ruby, Rust and Elixir, ask the person before adding one as a dev dependency. When they decline, a test that mocked the provider's client mocks the PostHog SDK's send instead and asserts on the fields it gets: note it in the plan row and for the report.
- Search the changed files for the provider's calls: a moved site has none left, and each moved site has one PostHog send.

## One email on one person

The chain to prove: PostHog sends the email, records its engagement on the person, and that person's product events show next to it.

Skip this part and record `not checked` with the reason when the API is not confirmed on, no sender is verified, or `POSTHOG_PROJECT_SECRET_API_KEY` is not set.

1. Check that the app sends to the MCP's project: compare the project token the app reads with `api_token` from the PostHog MCP `projects-get` tool. Read only the token's line of the env file, by searching for the token variable's name: the file also holds secret keys, so never open all of it. When they differ, record `not checked: the app uses another project`, tell the person which project the app uses, and skip the rest of this part.
2. Ask the person whether to send one test email. Say that it sends a real email. When they say no, record `not checked: declined`, and skip the rest of this part.
3. Run `SELECT toUnixTimestamp(now()), '<a new random string>'` through the PostHog MCP `execute-sql` tool, so the answer can't come from a cached run, and keep the number as the start of the test; skip this when the MCP has no SQL tool. Ask them to trigger one moved email in their local app that sends it to an address they own, from a site whose plan row shows it passes `distinctId`, such as a password reset or a welcome email after signup. When no moved site passes `distinctId`, record `not checked: no moved site names a person`, and skip the rest of this part. Ask them to open the email, then to sign in as the user it went to and use the app for a moment, so that the app's product events show on the same distinct ID. Ask them to tell you when they are done.
4. When the send fails, find its code in `transactional-emails.md` or `api.md`, tell the person the fix, and record it. Never retry a send yourself.
5. Find the person's distinct ID: the value the moved site passed as `distinctId`. Run a SQL query through the PostHog MCP `execute-sql` tool for that distinct ID since the start of the test, with a new random string each time you run it:

   ```sql
   SELECT event, timestamp, properties.$workflow_invocation_id AS send, properties.$email_template_key AS template_key, properties.$email_template_id AS template_id, '<a new random string>' AS run FROM events
   WHERE distinct_id = '<distinct id>' AND toUnixTimestamp(timestamp) >= <start of the test>
   ORDER BY timestamp
   ```

6. The chain holds when the result has a `$workflows_email_sent` whose `template_key` or `template_id` is the moved site's, an engagement event such as `$workflows_email_delivered` or `$workflows_email_opened` with the same `send`, and at least one product event of the app. A send of another email to the same person proves nothing about this one. An event from before the start of the test belongs to another email. Delivery events arrive after the provider reports back: when only the send shows, wait a minute and run the query once more.

When the MCP has no SQL tool, ask the person to open their person in PostHog and tell you which of the three they see since they triggered the test email.

Never write the address or the distinct ID into a file.

## Write down

Tick the phase in the plan: `- [x] verify — check: <passed|failed|none>, tests: <passed|failed|none>, chain: <proven|partly: what showed|not checked: why>`.
