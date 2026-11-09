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

- Each call sends one email to one `to` address, in one of two forms. The code form takes a template key, a subject, and HTML, text, or both, with an optional from address, reply-to addresses, and engagement capture, which is on unless the send turns it off. The template form takes a template ID with optional template data, for a template made in PostHog, and none of the code form's fields.
- The code form also takes open and click tracking, which is on unless the send turns it off. Off sends the email without open and click tracking, so PostHog can't count its opens and clicks. It is independent of engagement capture: a provider's open or click tracking that is off maps to open and click tracking off, never to engagement capture off. The template form doesn't take it.
- Both forms take a distinct ID and an idempotency key.
- No SDK takes `cc`, `bcc`, attachments, headers, tags, a send time, or several `to` addresses yet. The provider's `mapping.md` keeps a site that sets one.
- The message ID in the answer is PostHog's, not the provider's.
- An error's name is a coarse category with Resend's error names: `validation_error`, `missing_api_key`, `invalid_permission`, `not_found`, `concurrent_idempotent_requests`, `invalid_idempotent_request`, `rate_limit_exceeded`, `monthly_quota_exceeded`, `service_unavailable`, or `application_error`. Its code is PostHog's own, such as `recipient_suppressed`, `sender_not_verified`, or `quota_limited`: branch on the code. A send to a suppressed address fails with the code `recipient_suppressed` and the name `validation_error`.
- Every SDK retries network errors and rate limits by itself, with the same idempotency key. A network error that is left after the retries comes back as the same error type as an API error, with the code `network_error`.
- A bad argument fails before any request: as the language's argument error, or as the email error with a code that starts with `invalid_`. The rewrite file says which.

## Status

```
[STATUS] Setting up the PostHog SDK for email
[STATUS] Moving the send call sites
```

## Before you change code

- Change only the sites whose `moves` is `yes`. Never change a site that stays, and never change a line that a site that stays still needs.
- When no site moves, tick the phase in the plan with `none moved` and go to the next step.
- Run the check that the rewrite file names under "Check", on the whole project, and keep its errors and warnings: Step 8 compares with them. For a site in JavaScript or TypeScript, that is the project's typecheck.

## Set up the SDK

Install or upgrade the SDK to its latest release, as the rewrite file says under "Install". Early releases of an SDK may not send email, or may send only a template made in PostHog. Check the installed version for what the moving sites need:

- a site with `html`, `text`, or a component, and a `template` site that moves into the code: the send takes a template key with a subject and an HTML or text body;
- a site that sets a reply-to address: the send takes one;
- a site whose old send went out with open or click tracking off: the send takes open and click tracking;
- the client: the client options take the provider name, under the name the rewrite file gives.

When the app already used the SDK and the upgrade crosses a major version, read the installed package's changelog when it ships one, such as `CHANGELOG.md`, and search the whole repository for the app's other calls into the SDK, such as `capture` and `identify`. Fix each call the new major version changed, and note it for the report. A check that reads only syntax doesn't find these.

When the latest release lacks one of these, change no site that needs it. Mark each such row `moves: no — <SDK> has no <capability> yet`, tell the person, and go on with the rest. When the client options lack the provider name, leave it out of the client. When no site is left in a language, undo that SDK's install or upgrade. When no site is left at all, tick the phase with `none moved`, and go to the next step.

## Set up the client

Configure one server-side client for email in each language that has a site that moves, as the rewrite file says under "The client". When a language's sites mix synchronous and asynchronous code, and its SDK has a separate client for each that one app can use side by side, such as Python, configure one of each, and have each site use the client that matches its call:

- Set the secret key from `POSTHOG_PROJECT_SECRET_API_KEY`, which Step 6 set up. Read it, and the token and host, without raising when a variable is missing, as the rewrite file shows: Step 6 can leave the key unset, and an app that can't start takes down the sends that stay on the provider too. A send without the key fails with its own error.
- Set the provider name to the value the provider's `mapping.md` names under "The PostHog client", when the client options take it. The SDK sends it with every email request, so PostHog knows that the sends moved from that provider.
- Reuse the app's existing PostHog client in that language when it has one, and add the secret key and the provider name to it, unless its host is a reverse proxy or the rewrite file says to give email its own client.
- The rewrite file says whether the client loads feature flag definitions with the secret key, and what to set on a client that only sends email. Keep that setting unless the key also has `feature_flag:read` and the app uses local evaluation.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When the app's host is a reverse proxy, give email its own client with the host set to PostHog's own host, such as `https://us.i.posthog.com`, and leave the secret key off the app's existing client. A client with the secret key loads flag definitions from its host with it, when it starts or when it evaluates a flag, which would hand the key to the proxy.
- On a self-hosted instance, also set the app host, under the name the rewrite file gives, to the instance's app URL. The email send goes only to the app host, and without it the send fails with `missing_app_host`.
- Put a new client in its own server-only module, next to the provider's client, and use it where the sites send.
- Use the env variable names the app already uses for the PostHog token and host. Add each new name, without a value, to the env example file.

## Link emails to your users

PostHog records each send, and its sent, opened and clicked events when engagement events are on, against the person the send names with its distinct ID. Pass the ID the app already passes to `identify()`:

- Find the app's identify call, such as `posthog.identify(user.id)` in posthog-js, or the distinct ID of its server-side PostHog captures.
- At each site, pass the same ID for the recipient, such as `user.id`. Follow the recipient back through the callers when the site only has the address.
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
- Handle the answer as the rewrite file says under "The answer". Some SDKs return an error and some raise or throw one: when the old call and the new one differ, change the code around the send so the site fails the same way.
- When the old send went out with open tracking or click tracking off, set open and click tracking to off, under the name the rewrite file gives. The provider's `mapping.md` names the setting that shows it. One of the two is enough, because PostHog's field turns off both: note it in the plan row. When the provider sets tracking per domain or per account and not per send, the call can't show it: `mapping.md` says what to ask. Without an answer, leave the field out. Leave engagement capture as it is.
- Never add a field that the old call didn't set, apart from the template key, the template ID, the distinct ID, open and click tracking that is off as above, and the subject, body, `from`, and reply-to address that a provider template brought into the code held. For a template made in PostHog, the template data takes the place of the provider's template variables. For a template brought into the code, the code renders them, and the send has no template data.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, and go on.

## Write down

Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's template key, or its template ID for a template made in PostHog. Write down each email brought into the code, as `template-to-code.md` says under "Write down". Under the table, note each site without a distinct ID, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each site that sends with open and click tracking off and why, each idempotency key a retry across the deploy could send twice, each new dependency, each upgraded one with its old and new version, and each new env variable name.
