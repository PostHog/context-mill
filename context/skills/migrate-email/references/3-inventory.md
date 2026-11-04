---
title: List and classify every send
next_step: 4-sender.md
---

# Step 3, list and classify every send

List every place the code sends email through the provider, and decide for each one whether PostHog can send it. Change no source file. The only files you write are the plan file and the template files below.

## Status

```
[STATUS] Listing every send
[STATUS] Writing the migration plan
```

## Find the sends

Read the provider's `sdk-reference.md` for the call shapes, and its `mapping.md` for the fields.

A **site** is one place in the code that decides what a send contains: its content and its fields. Usually that is the `emails.send(...)` call or the HTTP request itself.

- When a helper builds the send from a few parameters, such as a subject and a template name, the helper is one site, however many places call it. Read its callers anyway: they decide values such as how many recipients a send has.
- When a helper only forwards a payload that its callers build, each caller is a site, and the helper is not.

For each site, read the surrounding code and record:

- The file and the line of the call.
- The language it is written in, such as `ts`, `py`, `rb`, `php`, `go`, `cs`, `ex`, or `rs`.
- How it sends: `sdk`, `http`, or `smtp`.
- The content: `template` for a template stored at the provider, `react` for a component the provider renders, `html`, or `text`. A site that sets both `html` and `text` is `html`.
- Every field the site sets, including fields set on the payload object after it is created and fields set through options, such as an idempotency key.
- Where `from` comes from: the literal address, or the name of the environment variable or config value that holds it.

Also list every other call to the provider that is not a send, such as reading an email's status, contacts, or domains. These calls stay on the provider. Note what each one does, because a site whose code reads the status back stays on the provider too.

When `sdk-reference.md` has a "Webhooks" section, also list each webhook handler: a route of the app that receives the provider's delivery events. Note the events it handles, what it does with them, and how it finds the send an event belongs to, such as by the provider's message id, by a value the send set, or by the recipient's address. `mapping.md` says under "Webhooks" which sites a handler keeps on the provider.

When you find no site, stop before you write the plan file:

```
[ABORT] no email provider sends found
```

## Classify each site

Go through `mapping.md` field by field. A site **moves** when PostHog can send every field it sets. A site **stays** on the provider when any one field or feature keeps it there: record that field or feature as the reason. Never plan to drop a field, unless `mapping.md` says the site moves without it: then note it in the plan.

When the code passes a value you can't read, such as a list of recipients built at run time, follow it to its callers. When you still can't tell, the site stays, and the reason says what you could not check.

A `template` site moves only to a template made in PostHog, and the person makes that template. Check the site's other fields first: a site that another field keeps on the provider stays with that reason, and needs no question about its template. Ask the person once, for every other template the sites send, whether to move it to PostHog or keep it on the provider for now. A template they keep stays, and the reason is `kept on <provider name> for now`.

A template they move needs its content to be classified. Read the provider's `account.md`, and ask the person once for every template they move: copies from the dashboard that they save in files outside the repository and tell you where, or a read through the API. Read the person's copies where they saved them. Write an API answer to a file in the system's temporary folder, never in the repository or the plan, and delete that file as soon as its site is classified. When the person can't give the content, the site stays, and the reason is `template content not checked`.

A template whose content passes the checks moves only once the person has made it in PostHog. Ask them once, for every such template, to make it in PostHog from the provider's template, make it transactional, and give you its template ID and the address it sends from, usually the provider template's sender. Tell them how its placeholders change, as `mapping.md` says in its part on templates. Record each template ID with its site under the sites table, and write the address in the site's `from` column, so Step 4 sets up a sender for its domain. A template without an ID stays, and the reason is `PostHog template not made yet`.

## Write the plan file

Write `.posthog-email-migration-plan.md` at the project root with three sections. Never write an email address of a recipient into it. A `from` address is fine.

A phase checklist, in this order. Tick `preflight` with what Step 2 recorded, and `inventory` once the file is written. Later steps tick the rest.

```
- [x] preflight — api: <on|not confirmed> — tier: <fits|too low|not checked>
- [x] inventory — <sites found> sites, <sites that stay> stay on the provider
- [ ] sender
- [ ] suppressions
- [ ] key
- [ ] rewrite
- [ ] verify
```

A sites table, one row per site, in source tree order:

```
| site | file | line | lang | sends | content | from | moves | reason |
```

`moves` is `yes` or `no`. `reason` is empty when the site moves.

A list of the other provider calls, each with its file, line, and what it does, and a list of the webhook handlers, each with its file, line, the events it handles, and how it finds the send.
