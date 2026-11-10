---
title: List and classify every send
next_step: 4-sender.md
---

# Step 3, list and classify every send

List every place the code sends email through the provider, and decide for each one whether PostHog can send it. Change no source file. The only files you write are the plan file and the temporary copies of template content below.

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
- The language of the call, such as `node`, `python`, `go`, `ruby`, `php`, `dotnet`, `rust`, or `elixir`, by the name of its rewrite file in Step 7. A call in any other language, such as Java, is recorded under its own name: `mapping.md` keeps it on the provider.
- How it sends: `sdk`, `http`, or `smtp`.
- The content: `template` for a template stored at the provider, `react` for a component the provider renders, `html`, or `text`. A site that sets both `html` and `text` is `html`.
- The category: blank for no category, or the key of the category its email is filed under in PostHog, as "The category of each site" says.
- Every field the site sets, including fields set on the payload object after it is created and fields set through options, such as an idempotency key.
- Where `from` comes from: the literal address, or the name of the environment variable or config value that holds it.

Also list every other call to the provider that is not a send, such as reading an email's status, contacts, or domains. These calls stay on the provider. Note what each one does, because a site whose code reads the status back stays on the provider too.

When you find no site, stop before you write the plan file:

```
[ABORT] no email provider sends found
```

## Classify each site

Go through `mapping.md` field by field. A site **moves** when PostHog can send every field it sets. A site **stays** on the provider when any one field or feature keeps it there: record that field or feature as the reason. Never plan to drop a field.

When the code passes a value you can't read, such as a list of recipients built at run time, follow it to its callers. When you still can't tell, the site stays, and the reason says what you could not check.

A `template` site moves by bringing its email into the code: the code renders the provider template's content and sends it in the code form. Read `template-to-code.md` up to "Where the email goes" now, and Step 7 reads the rest. Check the site's other fields first: a site that another field keeps on the provider stays with that reason, and needs no question about its template.

Ask the person once, listing every other template the sites send, with the plan for each: it moves into the code, in a file next to its send, and from then on they change the email there. For each one, they can also say to keep it on the provider for now, or to make it a template in PostHog instead, such as when people who don't change code edit that email. Only a transactional email can become a template in PostHog: decide each site's kind from the code first, as "The category of each site" below says, and for a marketing site, offer only the code form or keeping it, since the code form keeps its category and its unsubscribe link. A template they keep stays, and the reason is `kept on <provider name> for now`.

Each template that moves needs its content to be checked. Read the provider's `account.md`, and ask the person once for every such template: copies from the dashboard that they save in files outside the repository and tell you where, or a read through the API, where `account.md` says the API returns the content. Check each one as `template-to-code.md` says under "Check", with the provider's `mapping.md` under "Templates". When the person can't give the content, the site stays, and the reason is `template content not checked`. A template whose check fails stays, and the reason names the part that keeps it. Write the template's sender in the site's `from` column, so Step 4 sets up a sender for its domain, and classify that address as any other `from`.

### A template in PostHog, when the person asks for one

A template the person asks to make in PostHog moves in the template form, by its template ID, and the person makes that template: never make one yourself. Its content needs the same check, against the part of `mapping.md` on templates made in PostHog. Ask them once, for every such template, to make it in PostHog from the provider's template, make it transactional, and give you its template ID and the address it sends from, usually the provider template's sender. Tell them how its placeholders change, as that part of `mapping.md` says. Record each template ID with its site under the sites table, and write the address in the site's `from` column. A template without an ID stays, and the reason is `PostHog template not made yet`.

## The category of each site

PostHog sends a transactional email to every recipient who isn't suppressed, and a marketing email only to those who also haven't opted out of its message category. A site keeps the kind of email it sent. It is marketing when the provider sent it as marketing, such as with an unsubscribe link the provider fills, or a send that names something the recipient can unsubscribe from that the provider's `mapping.md` moves. Every other site is transactional, with no category.

A category has a key, a type, `marketing` or `transactional`, a name, and an optional description. Copy an existing category's key, type, name, and description exactly: a key spelled another way makes a new category that no recipient opted out of.

When the person asks to move an email that a PostHog workflow sends into the code, the site is the code they name to send it. Ask them for the workflow, or find it with `workflows-list`. The site keeps the category of the workflow's email step: read the step's `message_category_id` with `workflows-get`, and the category's key, type, name, and description with `message-categories-get`. A step without a category leaves the site's category blank.

For each other marketing site that moves, list the project's message categories with the PostHog MCP `message-categories-list` tool. Ask the person once which category of type `marketing` each one's email belongs to, and offer each by its name and key. When none fits, they name a new one: its key, its name, and a description if they want one. A new key must not be in that list, whatever its category's type: when it is, ask them for another. The first send creates a new category, so make none yourself. A marketing site they name no category for stays, and the reason is `no category named`. When the category tools are missing, every marketing site stays, and the reason is `no message category tools`.

A marketing email needs an unsubscribe link, which becomes `{{ unsubscribe_url }}` as `template-to-code.md` says: PostHog refuses to send one without it. A marketing site whose content has none stays, and the reason is `no unsubscribe link`. PostHog also refuses a marketing email with copies: a marketing site that sets `cc` or `bcc` stays, and the reason is `copies_not_allowed`.

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
| site | file | line | language | sends | content | category | from | moves | reason |
```

`moves` is `yes` or `no`. `reason` is empty when the site moves.

Under the table, for each category key, note its type, name, and description, and mark it new when it is not in PostHog yet. For each `template` site that moves, note its provider template's ID or name, whether it moves into the code or to a template made in PostHog, and where its content is: the person's copy, or the temporary file of the API answer.

A list of the other provider calls, each with its file, line, and what it does.
