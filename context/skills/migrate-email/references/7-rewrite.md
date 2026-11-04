---
title: Move every site that can move
next_step: 8-verify.md
---

# Step 7, move every site that can move

Rewrite each site whose `moves` is `yes` in the plan to send with PostHog's SDK in the site's language. The provider's `mapping.md` has the rewrite of each field, call, and content form under "Rewrite".

## Status

```
[STATUS] Setting up the PostHog SDK for email
[STATUS] Moving the send call sites
```

## Before you change code

- Change only the sites whose `moves` is `yes`. Never change a site that stays, and never change a line that a site that stays still needs.
- When no site moves, tick the phase in the plan with `none moved` and go to the next step.
- Run the project's typecheck for each language a moving site is written in, such as its `typecheck` script, `tsc --noEmit`, `mypy`, `go vet`, or `dotnet build`, or its build when it has no typecheck, and keep its errors: Step 8 compares with them.

## Set up the client

Each site moves with the PostHog SDK of the language it is written in. Read the part of `posthog-sdks.md` for each such language. The provider's `mapping.md` decides which languages move: a site in a language it keeps on the provider stays, even when `posthog-sdks.md` lists that language. A site in a language that `posthog-sdks.md` doesn't list stays: mark its row `moves: no — PostHog has no email send in <language> yet`.

Install or upgrade the language's PostHog SDK to its latest release with the project's package manager. `emails.send` alone is not enough: early releases send only a template made in PostHog. Check the installed package's types or source for what the moving sites need, as `posthog-sdks.md` says under "Check the installed release":

- a site with `html`, `text`, or a component: the send takes `templateKey` with `subject` and `html` or `text`;
- each other field a site sets, such as `replyTo`, `cc`, `bcc`, or `attachments`: the send takes it;
- the client: the client options take `migratedFrom`.

When the latest release lacks one of these, change no site that needs it. Mark each such row `moves: no — <the SDK> has no <field> yet`, tell the person, and go on with the rest. When the client options lack `migratedFrom`, leave it out of the client. When no site in a language is left, undo the install or upgrade of that language's SDK. When no site is left at all, tick the phase with `none moved`, and go to the next step.

Configure one server-side client per language, as `posthog-sdks.md` shows:

- Set the secret key from `POSTHOG_PROJECT_SECRET_API_KEY`.
- When the client options take `migratedFrom`, set it to the value that the provider's `mapping.md` names under "The PostHog client". The SDK sends it with every email request, so PostHog knows that the sends moved from that provider.
- Reuse the app's existing PostHog client in that language when it has one, and add the secret key, and `migratedFrom` when the client options take it. Where `posthog-sdks.md` says the secret key turns on local feature flag evaluation or flag loading, turn it off as it shows, unless the key also has `feature_flag:read` and the app uses local evaluation.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When the host is a reverse proxy or a self-hosted instance, also set the app host to the PostHog app URL, such as `https://us.posthog.com`. The email send never sends the secret key to a proxy, and without the app host it fails with `missing_app_host`. Flag loading does send it to the host, which is one more reason to keep it off.
- Put a new client in its own server-only module, next to the provider's client, and import it where the sites send.
- Use the env variable names the app already uses for the PostHog token and host. Add each new name, without a value, to the env example file.

## Link emails to your users

PostHog records each send, and its sent, opened and clicked events when engagement events are on, against the person the send names with `distinctId`. Pass the ID the app already passes to `identify()`:

- Find the app's identify call, such as `posthog.identify(user.id)` in posthog-js, or the distinct ID of its server-side captures.
- At each site, pass the same ID for the recipient, such as `distinctId: user.id`. Follow the recipient back through the callers when the site only has the address.
- Without `distinctId`, PostHog records the email against a person whose distinct ID is the recipient's address. Unless the app identifies people by their address, that is a separate person from the user.
- When the recipient isn't a user yet, such as an invite or an address check before the account exists, isn't a user at all, such as a team inbox, or the site has no way to know the user, leave `distinctId` out and note it in the plan row.
- When the app identifies no one in PostHog, use the app's own user ID, and note it for the report.

## Rewrite each site

For each site that moves, in plan order:

- Rewrite the call as the provider's `mapping.md` says, for the site's content form: `html` and `text` content, a component the app renders, or a template made in PostHog.
- Give each send with rendered content a `templateKey` that names the kind of email, such as `welcome` or `password-reset`, with letters, digits, `-`, and `_` only. Two sites that send the same email share a key.
- A site that moves to a template made in PostHog sends the template ID the person gave in Step 3, never one you guess.
- Install `@react-email/render` with the project's package manager when a site renders a component and the app doesn't have it.
- Keep the site's idempotency key, error branches, logging, and return value working as before. Keep the code around the send unchanged where you can.
- Keep the site failing the same way it did. `posthog-sdks.md` says how the SDK reports an error in each language: Node.js answers `{ data, error }` and never throws on an API error, and the other languages raise or return an error value. When the old call threw on an error, or the code checked a status, check PostHog's error so the site fails the same way, as the provider's `mapping.md` says under "Rewrite".
- When the old code caught only some errors, such as one error class or one status, catch PostHog's error and branch on its `code` or status code for those, and raise or return every other error as before. Never widen a catch.
- When the old code handled the provider's answer to a bad value that the app passes at run time, such as an empty recipient, also catch the argument error that `posthog-sdks.md` names for the language, or check the value before the send.
- Never add a field that the old call didn't set, apart from `templateKey`, `templateId`, and `distinctId`. `templateData` takes the place of the provider's template variables.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, and go on.

## Write down

Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's `templateKey`, or its `templateId` for a template made in PostHog. Under the table, note each site without a `distinctId`, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each idempotency key a retry across the deploy could send twice, each value the move changed, such as a recipient name the To line loses, each new dependency, each upgraded one with its old and new version, and each new env variable name.
