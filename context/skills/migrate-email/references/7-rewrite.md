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
- Run the project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck, and keep its errors: Step 8 compares with them.

## Set up the client

Install or upgrade `posthog-node` to its latest release with the project's package manager. `posthog.emails` alone is not enough: early releases send only a template stored in PostHog, by `templateId`. Check the installed package's types for what the moving sites need:

- every site: `posthog.emails.send` takes `templateKey` with `subject` and `html` or `text`;
- a template stored at the provider: `templateData` takes the local template's content;
- a site that sets `cc`, `bcc`, `replyTo`, `headers`, `tags`, or `attachments`: the send takes that field.

When the latest release lacks one of these, change no site that needs it. Mark each such row `moves: no — posthog-node has no <capability> yet`, tell the person, and go on with the rest. When no site is left, tick the phase with `none moved` and go to the next step.

Configure one server-side client for email:

```js
import { PostHog } from 'posthog-node'

export const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
    host: process.env.POSTHOG_HOST,
    secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
    enableLocalEvaluation: false,
})
```

- Reuse the app's existing `posthog-node` client when it has one, and add `secretKey`. Keep `enableLocalEvaluation: false` unless the key also has `feature_flag:read` and the app uses local evaluation.
- When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
- When `host` is a reverse proxy or a self-hosted instance, also set `appHost` to the PostHog app URL, such as `https://us.posthog.com`. posthog-node never sends the secret key to a proxy, and without `appHost` the send fails with `missing_app_host`.
- Put a new client in its own server-only module, next to the provider's client, and import it where the sites send.
- Use the env variable names the app already uses for the PostHog token and host. Add each new name, without a value, to the env example file.

## Find the user ID

PostHog shows each email on the person the send names with `distinctId`. Use the ID the app already identifies people with in PostHog:

- Find the app's identify call, such as `posthog.identify(user.id)` in posthog-js, or the `distinctId` of its `posthog-node` captures.
- At each site, pass the same ID for the recipient, such as `distinctId: user.id`. Follow the recipient back through the callers when the site only has the address.
- When the recipient is not a user of the app, such as a team inbox, or the site has no way to know the user, leave `distinctId` out and note it in the plan row.
- When the app identifies no one in PostHog, use the app's own user ID, and note it for the report.

## Rewrite each site

For each site that moves, in plan order:

- Rewrite the call as the provider's `mapping.md` says, for the site's content form: `html` and `text` content, a component the app renders, or a template stored at the provider.
- Give each send a `templateKey` that names the kind of email, such as `welcome` or `password-reset`, with letters, digits, `-`, and `_` only. Two sites that send the same email share a key. A template stored at the provider keeps the key `mapping.md` gives it.
- A template stored at the provider becomes a module that exports `subject` and `html`, and `text` when it has one, in an `emails/` folder next to the server code. Write it from the file the plan lists for the site, never from memory. The site imports the module and passes `templateData`.
- Install `@react-email/render` with the project's package manager when a site renders a component and the app doesn't have it.
- Keep the site's idempotency key, error branches, logging, and return value working as before. Keep the code around the send unchanged where you can.
- `posthog.emails.send` never throws on an API error: it returns `{ data, error }`. When the old call threw on an error, or the code checked an HTTP status, check `error` so the site fails the same way.
- Never add a field that the old call didn't set, apart from `templateKey`, `distinctId`, and the template defaults `mapping.md` names.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, and go on.

## Write down

Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's `templateKey`. Under the table, note each site without a `distinctId`, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each site with `cc` or `bcc` that a suppressed copy address now stops, each idempotency key a retry across the deploy could send twice, each new dependency, and each new env variable name.
