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

- When a helper builds the send from a few parameters, such as a subject and a template name, the helper is one site, however many places call it. Read its callers anyway: they decide values such as how many recipients a send has. When some callers pass one address and others several, the helper stays, and the plan row names the callers that pass one address, so the person can give them a send of their own.
- When a helper only forwards a payload that its callers build, each caller is a site, and the helper is not. The same holds for a queue job or a transport that posts a message built elsewhere, such as a JSON string: each place that builds the message is a site.
- Find a helper's callers by searching the repository. When you can't find or read every caller, each send through the helper stays, and the reason names the caller or the value you could not read.
- A forwarding helper that nothing in the repository calls is not a site, unless the repository is a library that exports it: no code builds a message for it. List it with the other provider calls, and leave it as it is. A function that builds its own send stays a site, even when nothing in the repository calls it.
- When one function chooses between this provider and others, by a setting or as a fallback when a send fails, the branch that sends through this provider is the site. Move only that branch, and leave the other branches as they are.

For each site, read the surrounding code and record:

- The file and the line of the call.
- The language it is written in, such as `ts`, `py`, `rb`, `php`, `go`, `cs`, `ex`, or `rs`.
- How it sends: `sdk`, `http`, or `smtp`.
- The content: `template` for a template stored at the provider, `react` for a component the provider renders, `html`, or `text`. A site that sets both `html` and `text` is `html`.
- Every field the site sets, including fields set on the payload object after it is created and fields set through options, such as an idempotency key.
- Where `from` comes from: the literal address, or the name of the environment variable or config value that holds it.
- For a `template` site, where its template ID comes from: the literal, or the environment variable or config value that holds it, read the same way as `from`.

Also list every other call to the provider that is not a send, such as reading an email's status, contacts, or domains. These calls stay on the provider. Note what each one does, because a site whose code reads the status back stays on the provider too. Also note where each provider client takes its key from: the environment variable or config value, or a key written in the source, which the report asks the person to rotate.

When `sdk-reference.md` has a "Webhooks" section, also list each webhook handler: a route of the app that receives the provider's delivery events. Note the events it handles, what it does with them, and how it finds the send an event belongs to, such as by the provider's message id, by a value the send set, or by the recipient's address. `mapping.md` says under "Webhooks" which sites a handler keeps on the provider.

When you find no site, stop before you write the plan file:

```
[ABORT] no email provider sends found
```

## Classify each site

Go through `mapping.md` field by field. A site **moves** when PostHog can send every field it sets, in a language that `mapping.md` moves. A site **stays** on the provider when any one field or feature keeps it there: record that field or feature as the reason. Never plan to drop a field, unless `mapping.md` says the site moves without it: then note it in the plan.

A field set to an empty value, such as `""`, `[]`, `{}`, or `null`, or to its off value, such as `false` for a flag that is off unless set, counts as not set, even where `mapping.md` keeps every site that sets the field, unless its row names that empty or off value. A field that the code sets on some sends only, such as under a condition or from a caller's argument, counts as set.

When the code passes a value you can't read, such as a list of recipients built at run time, follow it to its callers. When it comes from an environment variable or a config value, read it from the config, or ask the person once what it holds in production. An example env file names the variable, but its value is often a placeholder: trust it only when it is clearly the deployed value. When you still can't tell, the site stays, and the reason says what you could not check.

A value that a provider template tests or loops over, which `mapping.md` needs to be a boolean or a list, must have that type at run time: the code builds it, such as a literal or a value it computes, or checks it, such as with a schema or a parse. A type the code only declares, such as a TypeScript type or a cast, checks nothing at run time. When the value comes from request input, a file, or another service without such a check, such as `req.body`, the site stays, and the reason is `<value> is not checked to be a <boolean|list>`: the provider's template and Liquid can render a value such as `0` or `""` differently.

A site stays when no sender can be verified for its `from`: an address on a free mail domain, such as `gmail.com` or `outlook.com`, on the provider's shared or sandbox domain, on a domain whose DNS records the person can't publish, such as a school's or another company's, or taken from a user, a customer, or a tenant at run time. The reason names the address or where it comes from. When a site that is not a `template` site sets no `from`, the provider sent from the account's default sender: ask the person for that address once, and the site stays when they can't name it.

A `template` site moves only to a template made in PostHog, and the person makes that template. Check the site's other fields first: a site that another field keeps on the provider stays with that reason, and needs no question about its template. Ask the person once, for every other template the sites send, whether to move it to PostHog or keep it on the provider for now. A template they keep stays, and the reason is `kept on <provider name> for now`.

A template they move needs its content to be classified. Read the provider's `account.md`, and ask the person once for every template they move: copies from the dashboard that they save in files outside the repository and tell you where, or a read through the API. Read the person's copies where they saved them. Write an API answer to a file in the system's temporary folder, never in the repository or the plan, and delete that file as soon as its site is classified. When the person can't give the content, the site stays, and the reason is `template content not checked`.

A template whose content passes the checks moves only once the person has made it in PostHog. Ask them once, for every such template, to make it in PostHog from the provider's template, make it transactional, and give you its template ID and the address it sends from, usually the provider template's sender. Tell them how its placeholders change, as `mapping.md` says in its part on templates. Quote every Liquid string with single quotes, such as `default: 'there'`: PostHog's email builder saves the template as JSON, which escapes double quotes, and the template then fails with a `TokenizationError`. A fallback or a compared value that holds a `'` keeps the template on the provider. Record each template ID with its site under the sites table, and write the address in the site's `from` column, so Step 4 sets up a sender for its domain. A template without an ID stays, and the reason is `PostHog template not made yet`.

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
