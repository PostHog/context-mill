---
title: Move every site that can move
next_step: 8-verify.md
---

# Step 7, move every site that can move

Rewrite each site whose `moves` is `yes` in the plan to send with `posthog-node`. The provider's `mapping.md` has the rewrite of each field, call, and content form under "Rewrite".

## Status

```
[STATUS] Setting up posthog-node for email
[STATUS] Moving the send call sites
```

## Before you change code

- Change only the sites whose `moves` is `yes`. Never change a site that stays, and never change a line that a site that stays still needs.
- When no site moves, tick the phase in the plan with `none moved` and go to the next step.
- Run the project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck, and write each error's file, code, and message, such as `TS2345` and its text, under the rewrite phase in the plan: Step 8 compares with them. Leave out the line: the rewrite moves it.

## Set up the client

Install `posthog-node` with the project's package manager when the app doesn't have it. `posthog.emails` alone is not enough: early releases send only a template made in PostHog, by `templateId`. Check the installed package's types for what the moving sites need, and upgrade it to its latest release only when they lack one of these:

- a site with `html`, `text`, or a component: `posthog.emails.send` takes `templateKey` with `subject` and `html` or `text`;
- a site that sets `replyTo`: the send takes `replyTo`;
- the client: the client options take `migratedFrom`.

When the latest release lacks one of these, change no site that needs it. Mark each such row `moves: no — posthog-node has no <capability> yet`, tell the person, and go on with the rest. When the client options lack `migratedFrom`, leave it out of the client. When no site is left, undo the install or upgrade of `posthog-node`, tick the phase with `none moved`, and go to the next step.

Configure a server-side client of its own for email, also when the app already has a `posthog-node` client:

```js
import { PostHog } from 'posthog-node'

export const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
    host: process.env.POSTHOG_HOST,
    secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
    enableLocalEvaluation: false,
    migratedFrom: '<provider>', // only when the client options take it
})
```

- When the client options take `migratedFrom`, set it to the value that the provider's `mapping.md` names under "The PostHog client". posthog-node sends it with every email request, so PostHog knows that the sends moved from that provider.
- Never change the app's own `posthog-node` client for email. posthog-node also uses `secretKey` for its flags and remote config, so the email key, or `enableLocalEvaluation: false`, would change how the app's flags evaluate, and a client the app disables answers every send with `client_disabled`.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When `host` is a reverse proxy or a self-hosted instance, also set `appHost` to the PostHog app URL, such as `https://us.posthog.com`. posthog-node never sends the secret key to a proxy, and without `appHost` the send fails with `missing_app_host`.
- Put the client in its own server-only module, next to the provider's client, and import it where the sites send.
- A site whose request had its own deadline keeps it: the provider's `mapping.md` says how, under "HTTP". Each distinct deadline gets its own client like the one above, with that timeout, in the same module.
- Use the env variable names the app already uses for the PostHog token and host. Add each new name, without a value, to the env example file.

## Link emails to your users

PostHog records each send, and its sent, opened and clicked events when engagement capture is on, against the person the send names with `distinctId`. Pass the ID the app already passes to `identify()`:

- Find the app's identify call, such as `posthog.identify(user.id)` in posthog-js, or the `distinctId` of its `posthog-node` captures.
- At each site, pass the same ID for the recipient, such as `distinctId: user.id`. `distinctId` takes a string, and posthog-js turns a number into its string, so a numeric ID becomes `distinctId: String(user.id)`. Follow the recipient back through the callers when the site only has the address.
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
- `posthog.emails.send` never throws on an API error: it returns `{ data, error }`. When the old call threw on an error, or the code checked an HTTP status, check `error` so the site fails the same way.
- Never add a field that the old call didn't set, apart from `templateKey`, `templateId`, `distinctId`, and a field the provider's `mapping.md` says to add, such as `maxRetries: 0` on a request that kept its own deadline. `templateData` takes the place of the provider's template variables.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, and go on.

## Write down

Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's `templateKey`, or its `templateId` for a template made in PostHog. Under the table, note each site without a `distinctId`, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each idempotency key a retry across the deploy could send twice, each new dependency, each upgraded one with its old and new version, and each new env variable name.
