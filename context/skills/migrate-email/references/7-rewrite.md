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

## Set up the client

Install or upgrade `posthog-node` with the project's package manager, to a version that has `posthog.emails`.

Configure one server-side client for email. Set `migratedFrom` to the provider folder name, such as `resend`, once on the client, so PostHog knows which sends a migration moved:

```js
import { PostHog } from 'posthog-node'

export const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
    host: process.env.POSTHOG_HOST,
    secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
    migratedFrom: '<provider folder name>',
    enableLocalEvaluation: false,
})
```

{{> email-node-client}}
- A reused client gets `migratedFrom` too.
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
- A template stored at the provider becomes a module that exports `subject` and `html`, and `text` when it has one, in an `emails/` folder next to the server code. The site imports it and passes `templateData`.
- Install `@react-email/render` with the project's package manager when a site renders a component and the app doesn't have it.
- Keep the site's idempotency key, error branches, logging, and return value working as before. Keep the code around the send unchanged where you can.
- `posthog.emails.send` never throws on an API error: it returns `{ data, error }`. When the old call threw on an error, or the code checked an HTTP status, check `error` so the site fails the same way.
- Never add a field that the old call didn't set, apart from `templateKey`, `distinctId`, and the template defaults `mapping.md` names.

When a site turns out to need something `mapping.md` keeps on the provider, undo its change, set `moves` to `no` with the reason, and go on.

## Write down

Tick the phase in the plan: `- [x] rewrite — <n> sites moved`. Add a `key` column to the sites table with each moved site's `templateKey`. Under the table, note each site without a `distinctId`, each fallback that an empty string now replaces, each site that got a branch for a suppressed recipient, each idempotency key a retry across the deploy could send twice, each new dependency, and each new env variable name.
