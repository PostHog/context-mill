---
title: List and classify every send
next_step: 4-sender.md
---

# Step 3, list and classify every send

List every place the code sends email through the provider, and decide for each one whether PostHog can send it. Change no source file. The only file you write is the plan file.

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
- How it sends: `sdk`, `http`, or `smtp`.
- The content: `template` for a template stored at the provider, `react` for a component the provider renders, `html`, or `text`. A site that sets both `html` and `text` is `html`.
- Every field the site sets, including fields set on the payload object after it is created and fields set through options, such as an idempotency key.
- Where `from` comes from: the literal address, or the name of the environment variable or config value that holds it.

Also list every other call to the provider that is not a send, such as reading an email's status, contacts, or domains. These calls stay on the provider. Note what each one does, because a site whose code reads the status back stays on the provider too.

## Classify each site

Go through `mapping.md` field by field. A site **moves** when PostHog can send every field it sets. A site **stays** on the provider when any one field or feature keeps it there: record that field or feature as the reason. Never plan to drop a field.

When the code passes a value you can't read, such as a list of recipients built at run time, follow it to its callers. When you still can't tell, the site stays, and the reason says what you could not check.

A `template` site needs the template's content to be classified. Read the provider's `account.md`, and ask the person once for every template the sites send: copy from the dashboard, or read through the API. Keep the content for Step 7, and never write it into the plan. When the person can't give the content, the site stays.

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
| site | file | line | sends | content | from | moves | reason |
```

`moves` is `yes` or `no`. `reason` is empty when the site moves.

A list of the other provider calls, each with its file, line, and what it does.
