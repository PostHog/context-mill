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

- When a helper builds the send from a few parameters, such as a subject and a template name, the helper is one site, however many places call it. Read its callers anyway: they decide values such as how many recipients a send has. When some callers pass one address and others several, the helper stays, and the plan row names the callers that pass one address, so the person can give them a send of their own.
- When a helper only forwards a payload that its callers build, each caller is a site, and the helper is not. The same holds for a queue job or a transport that posts a message built elsewhere, such as a JSON string: each place that builds the message is a site.
- Find a helper's callers by searching the repository. When you can't find or read every caller, each send through the helper stays, and the reason names the caller or the value you could not read.
- A forwarding helper that nothing in the repository calls is not a site, unless the repository is a library that exports it: no code builds a message for it. List it with the other provider calls, and leave it as it is. A function that builds its own send stays a site, even when nothing in the repository calls it.
- When one function chooses between this provider and others, by a setting or as a fallback when a send fails, the branch that sends through this provider is the site. Move only that branch, and leave the other branches as they are.

For each site, read the surrounding code and record:

- The file and the line of the call.
- The language of the call, such as `node`, `python`, `go`, `ruby`, `php`, `dotnet`, `rust`, or `elixir`, by the name of its rewrite file in Step 7. A call in any other language, such as Java, is recorded under its own name: `mapping.md` keeps it on the provider.
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

Check what each site sends first. PostHog's transactional send ignores marketing opt-outs, so it is only for an email that a person needs, such as a password reset, a receipt, or an invite. A site that sends marketing, such as a newsletter, a promotion, or a product announcement, stays, and the reason is `marketing email`. When neither the code nor the template's name tells you, ask the person once for every such site. A site they call marketing, or don't answer for, stays with that reason.

Then go through `mapping.md` field by field. A site **moves** when PostHog can send every field it sets, in a language that `mapping.md` moves. A site **stays** on the provider when any one field or feature keeps it there: record that field or feature as the reason. Never plan to drop a field, unless `mapping.md` says the site moves without it: then note it in the plan.

A field set to an empty value, such as `""`, `[]`, `{}`, or `null`, or to its off value, such as `false` for a flag that is off unless set, counts as not set, even where `mapping.md` keeps every site that sets the field, unless its row names that empty or off value. A field that the code sets on some sends only, such as under a condition or from a caller's argument, counts as set.

When the code passes a value you can't read, such as a list of recipients built at run time, follow it to its callers. When it comes from an environment variable or a config value, read it from the config, or ask the person once what it holds in production. An example env file names the variable, but its value is often a placeholder: trust it only when it is clearly the deployed value. When you still can't tell, the site stays, and the reason says what you could not check.

For a template the person asks to make in PostHog, a value that the provider template tests or loops over, which `mapping.md` needs to be a boolean or a list, must have that type at run time: the code builds it, such as a literal or a value it computes, or checks it, such as with a schema or a parse. A type the code only declares, such as a TypeScript type or a cast, checks nothing at run time. When the value comes from request input, a file, or another service without such a check, such as `req.body`, the site stays, and the reason is `<value> is not checked to be a <boolean|list>`: the provider's template and Liquid can render a value such as `0` or `""` differently.

A site stays when no sender can be verified for its `from`: an address on a free mail domain, such as `gmail.com` or `outlook.com`, on the provider's shared or sandbox domain, on a domain whose DNS records the person can't publish, such as a school's or another company's, or taken from a user, a customer, or a tenant at run time. The reason names the address or where it comes from. When a site that is not a `template` site sets no `from`, the provider sent from the account's default sender: ask the person for that address once, and the site stays when they can't name it.

Unless the provider's `account.md` says it keeps no suppression list, ask the person once, for the sites the checks above leave moving, which of them they rely on that list to stop mailing an address someone added to it, by hand in the provider's dashboard or with a call the app makes, such as an unsubscribe handler. PostHog blocks a moved send only to an address that hard-bounced, so a moved send reaches such an address, whenever it was added. Each site they name stays, and the reason is `relies on <provider name>'s suppression list`. When they can't tell or don't answer, every such site stays with that reason. Write `to move: the app keeps its own record of those addresses, the ones added before included, and skips them before the send` in the note of each site that stays with that reason, under the sites table, for the report.

A `template` site moves by bringing its email into the code: the code renders the provider template's content and sends it in the code form. Read `template-to-code.md` up to "Where the email goes" now, and Step 7 reads the rest. Check the site's other fields first: a site that another field keeps on the provider stays with that reason, and needs no question about its template.

Ask the person once, listing every other template the sites send, with the plan for each: it moves into the code, in a file next to its send, and from then on they change the email there. For each one, they can also say to keep it on the provider for now, or to make it a template in PostHog instead, such as when people who don't change code edit that email. A template they keep stays, and the reason is `kept on <provider name> for now`.

Each template that moves needs its content to be checked. Read the provider's `account.md`, and ask the person once for every such template: copies from the dashboard that they save in files outside the repository and tell you where, or a read through the API, where `account.md` says the API returns the content. Check each one as `template-to-code.md` says under "Check", with the provider's `mapping.md` under "Templates". When the person can't give the content, the site stays, and the reason is `template content not checked`. A template whose check fails stays, and the reason names the part that keeps it. Write the site's `from` column with the address the send uses: the call's own `from` when it sets one, and the template's sender otherwise, so Step 4 sets up a sender for its domain, and classify that address as any other `from`.

### A template in PostHog, when the person asks for one

A template the person asks to make in PostHog moves in the template form, by its template ID, and the person makes that template: never make one yourself. Its content needs the same check, against the part of `mapping.md` on templates made in PostHog. Ask them once, for every such template, to make it in PostHog from the provider's template and give you its template ID and the address it sends from, usually the provider template's sender. PostHog makes a template transactional only once a verified sender covers its address: ask them to make it transactional now when the project has one, and otherwise once Step 4 verifies the sender. When the email carries a login code, a reset link, or another secret, ask them to mark the template sensitive, as `mapping.md` says. Ask them the same when the provider didn't track the site's clicks, or nobody knows whether it did, as the provider's `account.md` says: PostHog sends each link of a template that is not marked sensitive through its click redirect, which those links never went through. Tell them that a sensitive template keeps no copy of each sent email's body or filled-in subject. When they don't mark it, the site stays, and the reason is `click tracking off`, or `click tracking not checked` when nobody knows. The report lists both before cutover either way. For a template that must be marked sensitive, for a secret in the email or for its clicks, write `must be marked sensitive: <a secret in the email|click tracking off|click tracking not checked>` in its note under the sites table, so the report's "Before cutover" list checks it. Tell them how its placeholders change, as that part of `mapping.md` says. Quote every Liquid string with single quotes, such as `default: 'there'`: PostHog's email builder saves the template as JSON, which escapes double quotes, and the template then fails with a `TokenizationError`. A fallback or a compared value that holds a `'` keeps the template on the provider. Record each template ID with its site under the sites table, and write the address in the site's `from` column. A template without an ID stays, and the reason is `PostHog template not made yet`.

### Opens the provider didn't track

PostHog adds its open pixel to every email it sends, in the code form and from a template made in PostHog alike. Check this for each site that nothing else keeps on the provider, as the provider's `account.md` says: whether the provider tracked the opens of its emails, with an open pixel in each one.

- When a site's emails had no open pixel, because the provider never tracks opens, or open tracking was off or never set up, ask the person once, for all such sites together, whether PostHog may add its open pixel to emails that never had one. Yes: those sites move, and the report says that PostHog now counts their opens. No, or no answer: they stay, and the reason is `open tracking off`.
- When nobody can tell whether the provider tracked a site's opens, the site stays, and the reason is `open tracking not checked`.
- For each site that moves with the person's yes, write `open pixel added: the person agreed` in its note under the sites table, so the report names it.

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

When the run created a full-access provider key, as `account.md` says, add a line under the checklist: `full-access key — created: <variable name>`. Step 5 adds whether the person deleted it.

A sites table, one row per site, in source tree order:

```
| site | file | line | language | sends | content | from | moves | reason |
```

`moves` is `yes` or `no`. `reason` is empty when the site moves.

Under the table, for each `template` site that moves, note its provider template's ID or name, whether it moves into the code or to a template made in PostHog, and where its content is: the person's copy, or the temporary file of the API answer. For a template made in PostHog, add its template ID, and `must be marked sensitive: <reason>` when Step 3 says it must be. For any site that moves with an open pixel its emails never had, note `open pixel added: the person agreed`, as Step 3 says under "Opens the provider didn't track". For each site that stays because it relies on the provider's suppression list, note what would let it move, as Step 3 says after the sender check.

In any step, when the provider's `mapping.md` or `account.md`, or a rewrite file, says to note something for the report's "Before cutover" list, write it under the table as a note that starts with `before cutover:`, such as `before cutover: enable ext-curl where the app runs`. When a later step undoes what a note is about, such as an SDK install once no site in its language moves, it deletes the note. Step 9 lists each note left.

A list of the other provider calls, each with its file, line, and what it does, and a list of the webhook handlers, each with its file, line, the events it handles, and how it finds the send.
