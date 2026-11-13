---
title: Move every site that can move
next_step: 8-verify.md
---

# Step 7, move every site that can move

Rewrite each site whose `moves` is `yes` in the plan to send with PostHog's SDK for the site's language. The provider's `mapping.md` has the rewrite of each field, call, and content form under "Rewrite". The SDK's rewrite file has the PostHog side: the install, the client, the send, the answer, and the check to run.

| Language of the site | PostHog SDK | Rewrite file |
|---|---|---|
| JavaScript or TypeScript on a server: Node.js, or an edge runtime such as Cloudflare Workers or Vercel Edge Functions | `posthog-node` | `rewrite-node.md` |
| Python | `posthog` | `rewrite-python.md` |
| Go | `github.com/posthog/posthog-go` | `rewrite-go.md` |
| Ruby | `posthog-ruby` | `rewrite-ruby.md` |
| PHP | `posthog/posthog-php` | `rewrite-php.md` |
| C# or F# on .NET | `PostHog` | `rewrite-dotnet.md` |
| Rust | `posthog-rs` | `rewrite-rust.md` |
| Elixir | `posthog` | `rewrite-elixir.md` |

Read the rewrite file of each language that has a site that moves, and only those.

## What every SDK's send takes and answers

- Each call sends one email to one `to` address, in one of two forms. The code form takes a template key, a subject, and HTML, text, or both, with an optional from address, reply-to addresses, sensitive flag, and tracking. The template form takes a template ID with optional template data, for a template made in PostHog, and none of the code form's fields.
- The code form's sensitive flag and tracking decide what PostHog tracks and keeps for the email, as "Sensitive emails and tracking" below says. The template form takes neither.
- Both forms take a distinct ID and an idempotency key.
- No SDK takes `cc`, `bcc`, attachments, headers, tags, a send time, or several `to` addresses yet. The provider's `mapping.md` keeps a site that sets one.
- The message ID in the answer is PostHog's, not the provider's. It is a UUID, as a string of 36 characters such as `0b9f6d2e-3c1a-4f8e-9a7b-5d2c1e0f4a6b`, so a column or field that holds a UUID takes it.
- An error's name is a coarse category with Resend's error names: `validation_error`, `missing_api_key`, `invalid_permission`, `not_found`, `concurrent_idempotent_requests`, `invalid_idempotent_request`, `rate_limit_exceeded`, `monthly_quota_exceeded`, `service_unavailable`, or `application_error`. Its code is PostHog's own, such as `recipient_suppressed`, `sender_not_verified`, or `quota_limited`: branch on the code. A send to a suppressed address fails with the code `recipient_suppressed` and the name `validation_error`.
- Every SDK retries network errors and rate limits by itself, with the same idempotency key. A network error that is left after the retries comes back as the same error type as an API error, with the code `network_error`.
- A bad argument fails before any request: as the language's argument error, or as the email error with a code that starts with `invalid_`. The rewrite file says which.

## Sensitive emails and tracking

A code send can be marked sensitive, for an email that carries login links, reset tokens, or codes. A sensitive email keeps its links unchanged unless tracking turns clicks on, leaves its subject off engagement events, and keeps its content out of PostHog's logs. The flag takes true or false. Left out, the send takes the setting of the template in PostHog with the same key, and is sensitive when no template has that key.

A code send takes tracking as on, off, or a set of switches named `opens`, `clicks`, and `engagement`, under the names the rewrite file gives:

| Tracking | Opens | Clicks | Engagement events |
| --- | --- | --- | --- |
| Left out | On | Off when sensitive, on when not | On |
| On | On | On | On |
| Off | Off | Off | Off |
| Switches | `opens`, on by default | `clicks`, by default as left out | `engagement`, on by default |

- Opens adds PostHog's open pixel to the email. Clicks rewrites the email's links to go through a tracking redirect. Engagement captures the email's engagement events on the recipient's person. When the project's **Capture email engagement events** setting is off, PostHog captures none, whatever the send sets.
- Clicks follow the sensitive flag when tracking doesn't set them, because PostHog can't tell a newsletter from an email with a sign-in or password reset link. A tracked link goes through a redirect, so a token in the link would go through it too. A `clicks` switch that the send sets wins over the sensitive flag.
- The sensitive flag doesn't change opens or engagement events.
- Off means PostHog can't count the email's opens and clicks, and captures no engagement events for it.
- PostHog refuses the `clicks` switch on with `opens` off, because click tracking needs open tracking. With `opens` off and `clicks` left out, PostHog tracks no clicks, whatever the sensitive flag says. It refuses an unknown switch too.
- The SDK's engagement capture field, such as `capture_engagement`, is deprecated in favor of the `engagement` switch. A send that sets both is refused. Never write the old field.

## Status

```
[STATUS] Setting up the PostHog SDK for email
[STATUS] Moving the send call sites
```

## Before you change code

- Change only the sites whose `moves` is `yes`. Never change a site that stays, and never change a line that a site that stays still needs.
- When no site moves, delete each temporary copy of template content that Step 3 wrote, tick the phase in the plan with `none moved`, and go to the next step.
- Run the check that the rewrite file names under "Check", on the whole project, and write each error's and warning's file, code, and message, with how many times it shows, under the rewrite phase in the plan: Step 8 compares with them. Leave out the line: the rewrite moves it. For a site in JavaScript or TypeScript, that is the project's typecheck.

## Set up the SDK

Install the SDK as the rewrite file says under "Install" when the app doesn't have it. Early releases of an SDK may not send email, or may send only a template made in PostHog. Check the installed version for what the moving sites need, and upgrade it to its latest release, as the rewrite file says, only when it lacks one of these:

- a site with `html`, `text`, or a component, and a `template` site that moves into the code: the send takes a template key with a subject and an HTML or text body;
- each other field a site sets, such as a reply-to address: the send takes it;
- a site that moves to a code send with `opens off` in its plan note: the send takes tracking;
- a site that moves to a code send: the send takes the sensitive flag;
- the client: the client options take the provider name, under the name the rewrite file gives.

When the app already used the SDK and the upgrade crosses a major version, read the installed package's changelog when it ships one, such as `CHANGELOG.md`, and search the whole repository for the app's other calls into the SDK, such as `capture` and `identify`. Fix each call the new major version changed, and note it for the report. A check that reads only syntax doesn't find these.

When the latest release lacks one of these, change no site that needs it. Mark each such row `moves: no — <SDK> has no <capability> yet`, tell the person, and go on with the rest. When the client options lack the provider name, leave it out of the client. When no site is left in a language, undo that SDK's install or upgrade. When no site is left at all, delete each temporary copy of template content, tick the phase with `none moved`, and go to the next step.

## Set up the client

Configure a server-side client of its own for email in each language that has a site that moves, as the rewrite file says under "The client", also when the app already has a PostHog client in that language. When a language's sites mix synchronous and asynchronous code, and its SDK has a separate client for each that one app can use side by side, such as Python, configure one of each, and have each site use the client that matches its call:

- Set the secret key from `POSTHOG_PROJECT_SECRET_API_KEY`, which Step 6 set up. Read it, and the token and host, without raising when a variable is missing, as the rewrite file shows: Step 6 can leave the key unset, and an app that can't start takes down the sends that stay on the provider too. A send without the key fails with its own error.
- Set the provider name to the value the provider's `mapping.md` names under "The PostHog client", when the client options take it. The SDK sends it with every email request, so PostHog knows that the sends moved from that provider.
- Never change the app's own PostHog client for email. The SDKs also use the secret key for local flag evaluation and remote config, so the email key would change how the app's flags evaluate, and a client the app disables, such as outside production, refuses every send.
- The rewrite file says what to set on a client that only sends email, so that it loads no feature flag definitions with the secret key. Set it.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `project-get` tool, called without an ID (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When the app's host is a reverse proxy, set the email client's host to PostHog's own host, such as `https://us.i.posthog.com`. A client with the secret key loads flag definitions from its host with it, when it starts or when it evaluates a flag, which would hand the key to the proxy.
- On a self-hosted instance, also set the app host, under the name the rewrite file gives, to the instance's app URL. The email send goes only to the app host, and without it the send fails with `missing_app_host`.
- Put the email client in its own server-only module, next to the provider's client, and use it where the sites send.
- A site whose request had its own deadline keeps it, as the provider's `mapping.md` says under "HTTP": the send gets that deadline, and no retries, since the request never retried. Every SDK otherwise waits up to 15 seconds for each request and retries twice, which can run past the site's deadline. The rewrite file names the timeout and retry options under "A deadline". Where the send takes the deadline itself, as Go's context and .NET's cancellation token do, pass it there; the SDK still ends each request at its own timeout, so a deadline longer than that also needs a client of its own with the timeout set to it. Otherwise each distinct deadline gets an email client of its own with that timeout, in the same module, and its sites send through it. Sites without a deadline keep the first client. Never give a site a deadline it didn't have, or change one it had. Only a limit the code sets is the site's own deadline: a library's default, such as `httpx`'s 5 seconds or `ky`'s 10, is not one, like a provider SDK's default, and such a site sends with the PostHog SDK's own timeout and retries. The SDK keeps a deadline only of the kind its timeout is. Every SDK's timeout limits the whole request, except Python's and Ruby's, which limit each wait on the network, as their rewrite files say. A limit of another kind is one the SDK can't keep: axios's `timeout` in Node.js ends a request only after that long without data, and `ky`'s `timeout` ends once the answer's headers arrive. Every SDK has one timeout for connecting and reading alike, so a request that limits only connecting, or limits connecting and reading apart, such as Faraday's `open_timeout`, Guzzle's `connect_timeout`, `requests`' `timeout=(1, 10)`, or an `httpx.Timeout` with its own `connect`, has a deadline the SDK can't keep, unless the rewrite file says under "A deadline" how its client keeps such a limit, as Go's does. When the SDK can't hold the deadline, as there or with a deadline that is not whole seconds in Rust, the site stays: `moves: no — the PostHog SDK can't keep the request's deadline`.
- Use the env variable names the app already uses for the PostHog token and host. Add each new name, without a value, to the env example file.

## Link emails to your users

PostHog records each send, and its engagement events, such as sent, delivered and opened, when the project's **Capture email engagement events** setting is on and the send's tracking doesn't turn engagement off, against the person the send names with its distinct ID. Pass the ID the app already passes to `identify()`:

- Find the app's identify call, such as `posthog.identify(user.id)` in posthog-js, or the distinct ID of its server-side PostHog captures.
- At each site, pass the same ID for the recipient, such as `user.id`. The SDKs take the distinct ID as a string, so a numeric ID is passed as its string, such as `String(user.id)` in Node.js and `str(user.id)` in Python, the same string the app's identify call sends. Follow the recipient back through the callers when the site only has the address.
- Without a distinct ID, PostHog records the email against a person whose distinct ID is the recipient's address. Unless the app identifies people by their address, that is a separate person from the user.
- When the recipient isn't a user yet, such as an invite or an address check before the account exists, isn't a user at all, such as a team inbox, or the site has no way to know the user, leave the distinct ID out and note it in the plan row.
- When the app identifies no one in PostHog, use the app's own user ID, and note it for the report.

## Rewrite each site

For each site that moves, in plan order:

- Rewrite the call as the provider's `mapping.md` says, for the site's language and content form: `html` and `text` content, a component the app renders, a provider template brought into the code, or a template made in PostHog. Write the PostHog send as the rewrite file says under "The send".
- For a provider template that moves into the code, read the rest of `template-to-code.md` first. Write its email from the content Step 3 checked, render it at the site, and send the result in the code form, with the subject, `from`, and reply-to address the provider template set. Then delete the temporary copy of its content.
- Give each send with rendered content a template key that names the kind of email, such as `welcome` or `password-reset`, with letters, digits, `-`, and `_` only. Two sites that send the same email share a key, in any language.
- A site that moves to a template made in PostHog sends the template ID the person gave in Step 3, never one you guess.
- Keep the site's idempotency key, error branches, logging, and return value working as before. Keep the code around the send unchanged where you can.
- Keep the site failing the same way it did. The rewrite file says under "The answer" how its SDK reports an error: Node.js answers `{ data, error }` and never throws on an API error, and the other languages raise or return an error value. When the old call threw on an error, or the code checked a status, check PostHog's error so the site fails the same way, as the provider's `mapping.md` says under "Rewrite".
- When the old call answered a refused send without raising, and the code never read that answer, such as a raw HTTP call whose status the code never checked, the site went on as if the send worked, and only a network failure raised or returned an error. Keep that: catch PostHog's error, log it and go on. Raise or return it when its code is `network_error` only where the old call raised on a network failure: Resend's Node.js send answers a network failure in `{ data, error }` too, so such a site goes on for `network_error` as well. The argument error that the rewrite file names, such as Python's `ValueError` for an empty subject, was a refused send before too: catch it the same way, around the send only. Note the site in the plan.
- When the old code caught only some errors, such as one error class or one status, catch PostHog's error and branch on its `code` or status code for those, and raise or return every other error as before. Several handlers of the provider's error classes on one `try` become one catch of PostHog's error that branches in their order: the first of several catches of the same error type would take every error. Never widen a catch. PostHog reports a network error with the same error type as an API error, with the code `network_error`. When the old catch took only the provider's answers, such as an HTTP error class, and a network failure passed it, raise or return `network_error` the way the old code let a network failure through. When a later handler of the same `try`, such as a broader `rescue` or `except` after it, took that network failure, run that handler's code for `network_error`: a raise inside one handler skips the handlers after it. A catch of every error around the send, such as a bare `except:`, `except Exception`, `rescue => e`, or `catch (\Throwable $e)`, caught network failures before too: it stays as it is, and lets no `network_error` through, here and in the bullet above.
- When the old code told one kind of network failure from another, the site stays: `moves: no — catches one kind of network failure`. That is a branch on the transport's error code or class, such as `err.code === 'ECONNRESET'` or `'ETIMEDOUT'` in Node.js, `requests.Timeout`, `requests.ConnectionError`, or `e.errno` in Python, `Faraday::ConnectionFailed`, `Net::ReadTimeout`, or `Errno::ECONNRESET` in Ruby, or curl's error number in PHP. Every SDK retries network failures and reports what is left as one `network_error`, which doesn't say which kind it was, so the branch would never run. A catch that takes every network failure alike, such as a `catch` around `fetch`, which throws only when no answer arrived, is not such a branch: it becomes a branch on `network_error`, as above. The one exception is the timeout of a deadline the site keeps, where the send takes the deadline itself:
  - Go: `Send` ends at the context's deadline with a `*posthog.EmailError` that unwraps to the request's error, so `errors.Is(err, context.DeadlineExceeded)`, and a `net.Error` read with `errors.As` whose `Timeout()` is true, still match.
  - .NET: the deadline's token cancels `SendAsync` with an `OperationCanceledException`, a `TaskCanceledException` from `HttpClient`, never an `EmailException`, so a `catch` of either keeps working. A check for an inner `TimeoutException`, which only `HttpClient.Timeout` sets, becomes a check that the deadline's token is cancelled.
  - In every other SDK the deadline is the client's timeout, and its timeout is a `network_error` like any other network failure: a branch on it stays.
- A branch on the provider's answer to an invalid send, such as a `400` or a `422`, becomes a branch on PostHog's error name `validation_error`, never on a status code: PostHog's statuses for invalid sends differ from the provider's, and `recipient_suppressed` is a `validation_error` with status `422`. Handle `recipient_suppressed` before that branch, as the provider's `mapping.md` says.
- A branch on the provider's rate limit, such as a retry, a wait, or a re-queue on status `429`, becomes a branch on PostHog's status code `429` with a code other than `quota_limited`. PostHog answers a used-up sending quota with status `429` and the code `quota_limited`, which no retry fixes: it takes the path of every other error.
- When the old code handled the provider's answer to a bad value that the app passes at run time, such as an empty recipient, also catch the argument error that the rewrite file names, or check the value before the send.
- When the site's plan note says `opens off`, because its emails had no open pixel or nobody could tell whether they had one, as Step 3 says under "Opens the provider didn't track", and the site moves to a code send, turn off the `opens` switch only, as the rewrite file shows. Never ask the person about it. PostHog then tracks no clicks either, and engagement events stay on. Never send tracking off, because off turns off engagement events too. Leave tracking out of every other code send. A site that moves to a template made in PostHog sends no tracking, because the template uses its own setting: when its plan note says `opens off`, note it for the report, so the person checks that the template doesn't count opens.
- Mark every code send sensitive, as the rewrite file shows. A send that leaves the flag out takes the setting of a template in PostHog with the same key, and you can't see the project's templates or tell whether a link carries a token. The flag keeps the email sensitive whatever key it shares. It also carries over an old send that turned off link or click tracking for that one email, or that marked it as sensitive, better than turning off the `clicks` switch would: it also keeps the subject off engagement events and the content out of PostHog's logs. A site that moves to a template made in PostHog sends no sensitive flag, because the template uses its own setting: note it for the report, so the person checks that the template has **Protect sensitive data** on when the email carries a secret.
- Never turn on the `clicks` switch, and never mark a send as not sensitive, even when the provider tracked clicks: you can't tell whether a link carries a token. Note each such site for the report, so the person can mark an email without secrets as not sensitive, or turn clicks on for an email whose links are safe to rewrite.
- Never add a field that the old call didn't set, apart from the template key, the template ID, and the distinct ID, tracking with `opens` off and the sensitive flag set to true, as above, the subject, body, `from`, and reply-to address that a provider template brought into the code held, and a field that the provider's `mapping.md` or this step says to add because the old send behaved that way without setting it, such as no retries for a request that kept its own deadline. For a template made in PostHog, the template data takes the place of the provider's template variables. For a template brought into the code, the code renders them, and the send has no template data.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, delete the temporary copy of its template content when no other moving site sends that template, and go on.

## Write down

Delete each temporary copy of template content that is still there. Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's template key, or its template ID for a template made in PostHog. Write down each email brought into the code, as `template-to-code.md` says under "Write down". Under the table, note each site without a distinct ID, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each site that sends with `opens` off and why, each template site whose plan note says `opens off` or whose old send marked the email sensitive, each site whose provider tracked clicks that PostHog now doesn't count, each idempotency key a retry across the deploy could send twice, each value the move changed, such as a recipient name the To line loses, each new dependency, each upgraded one with its old and new version, and each new env variable name. Say that every code send is marked sensitive, so the person can mark an email without secrets as not sensitive.
