# SparkPost to PostHog mapping

This file decides, field by field, whether PostHog can send a SparkPost call site. A site moves only when every field it sets moves. Otherwise it stays on SparkPost, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

## Fields

SparkPost fields are written in their HTTP names. `sdk-reference.md` has the SDK names, such as Python's `from_email` and `template`, and the camelCase names Node.js 1.x takes under `transmissionBody`, such as `substitutionData`.

| SparkPost | PostHog | A site stays on SparkPost when |
|---|---|---|
| `content.from`, `override.from` | `from` | It holds a template expression that "Content" keeps, or it is on SparkPost's sandbox domain `sparkpostbox.com`, which no sender can be verified for (Step 3). `{ email, name }` becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `recipients` | `to` | It holds more than one recipient without `header_to`, or it is `{ list_id }`: a stored list always stays. A list with one entry moves as that entry. `{ email, name }` moves as the bare address: note in the plan row that the To line loses the name |
| `recipients` with `header_to`, a `CC` header, or the SDK's `cc` and `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. See "Cc and bcc" |
| `content.subject` | `subject` | It holds a template expression that "Content" keeps |
| `content.text`, `content.html` | `text`, `html` | They hold template language that "Content" keeps |
| `content.amp_html` | none | Always. PostHog's send doesn't take it yet |
| `content.reply_to`, `override.reply_to` | `replyTo` | It carries a name, such as `Sales <sales@example.com>`, or a template expression that "Content" keeps |
| `content.headers` | none | Always, when it holds any header other than the `CC` header that "Cc and bcc" consumes: no PostHog SDK takes headers yet |
| `content.attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files together with `inline_images`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `content.inline_images` | `attachments` with `contentId` | The same as `content.attachments` |
| `content.template_id` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates". `use_draft_template: true` always stays: it sends a draft that can still change |
| `content.ab_test_id` | none | Always. PostHog's send doesn't take it yet |
| `content.email_rfc822` | none | Always: PostHog takes no raw MIME message |
| `substitution_data`, `recipients[].substitution_data` | `templateData` for a template, or values the code fills in for inline content | See "Content" and "Templates" |
| `metadata`, `recipients[].metadata` | none | Always: no PostHog SDK takes tags yet |
| `recipients[].tags` | none | Always: no PostHog SDK takes tags yet |
| `campaign_id` | none | Always: no PostHog SDK takes tags yet |
| `description` | none | Never. It names the transmission in SparkPost's own reports only: note in the plan row that it no longer shows there |
| Open and click tracking: `options.open_tracking`, `options.initial_open`, `options.click_tracking`, `recipients[].options`, or none of them | `captureEngagement: false`, or no field | See "Tracking" below. A field set to `false` counts as set: it turns that tracking off for the send, whatever the account's setting |
| `options.transactional` | none | It is set to `false`. Set to `true`, it moves with nothing. Not set, it moves, and SparkPost used the account's `transactional_default`, which `account.md` reads under "Tracking settings": unless that is `true`, note in the plan row that SparkPost sent it as non-transactional, with its unsubscribe handling |
| `options.start_time` | none | Always. PostHog's send doesn't take it yet |
| `options.sandbox` | none | Always. A sandbox send is not a real send |
| `options.skip_suppression` | none | Always. PostHog's send doesn't take it yet |
| `options.ip_pool`, `options.dkim_key`, `tracking_domain` | none | Always. PostHog's send doesn't take it yet |
| `options.inline_css` | none | It is `true`: no PostHog field inlines CSS |
| `options.perform_substitutions` | none | Never. `false` means the content goes as it is |
| `options.enable_minimized_event_passthrough` | none | Always. PostHog's send doesn't take it yet |
| `override.list_id` | none | Always: it sets a `List-Id` header |
| `return_path`, `recipients[].return_path` | none | The app reads bounces sent to that address, such as with VERP on an Enterprise account. Otherwise it moves: PostHog uses its own return path on the sender's domain (Step 4). Note it in the plan row |
| `Idempotency-Key` header | `idempotencyKey` | Never. SparkPost takes only keys of 1 to 255 letters, digits, `.`, `_` and `-`, so every key it took fits PostHog's 1 to 255 visible ASCII characters |

A SparkPost send without an `Idempotency-Key` header sends no `idempotencyKey` after the move either.

**Tracking.** PostHog captures opens and clicks unless the send sets `captureEngagement: false`, which turns off both. Work out, for opens and for clicks, whether SparkPost tracked them. The first of these that sets one wins: the recipient's `options`, the transmission's `options`, the template's `options` for a template site, and then the account's settings, which `account.md` reads under "Tracking settings". There, `rest_tracking_default` decides both, and it is `true` unless the person turned it off, and the account's `click_tracking: false` turns clicks off. A site that sends from a subaccount with `open_tracking_disabled: true` tracked no opens, whatever it set. `initial_open` only adds a second open pixel at the top: it decides nothing on its own.

- Both tracked: the site moves, and the tracking fields are dropped.
- Neither tracked: a code site moves with `captureEngagement: false`, and a template site stays, because the template form takes no `captureEngagement`.
- One tracked and one not, such as `open_tracking: false` with clicks left on: the site stays, because `captureEngagement: false` turns off both.
- The site stays when its recipients' `options` disagree, when it sets `initial_open: true` with open tracking off, or when it sets `click_tracking: true` on an account whose `click_tracking` is `false`: SparkPost's docs don't say whether those were tracked.
- An address with an `open_tracking` entry on the suppression list, a `Tracking Consent Revoked` entry, got no open tracking, and PostHog has no such setting per address. Ask the person once whether the list holds such entries, or read them as `account.md` says under "Suppression list". When it does, a site that tracked opens stays, and the reason is `open tracking consent revoked for some recipients`, unless the person accepts that PostHog tracks opens for those addresses: then note it in the plan row.

When a site leaves open or click tracking to the account, or sends from a subaccount, ask the person once for each account the moved sites send from, or read the settings as `account.md` says. When the answer is not given, the site stays, and the reason is `account tracking not checked`.

### Cc and bcc

SparkPost has no `cc` or `bcc` field. A cc or bcc is one more entry in `recipients` whose `address.header_to` names the main recipient. A cc is also listed in a `CC` header in `content.headers`, and a bcc is not. The Node.js, PHP, and Python SDKs build this from their own `cc` and `bcc` fields, and the .NET library from `RecipientType.CC` and `RecipientType.BCC`.

- Each recipient whose `header_to` is the main recipient and whose address is in the `CC` header becomes a `cc` address. Each other recipient with that `header_to` becomes a `bcc` address.
- The `CC` header is consumed: it does not count as a header.
- A recipient whose `header_to` names another address, or a `CC` header that names an address without its own recipient, stays.
- SparkPost renders each recipient's copy with that recipient's own `substitution_data`, `metadata`, and `tags`, and PostHog sends one email to all of them. So the site stays unless every recipient, the main one included, carries the same values, or none. The Python SDK's `cc` and `bcc` copy the main recipient's values to each copy. The Node.js SDK's don't: a main recipient with its own values keeps a Node.js site that sets `cc` or `bcc`.
- SparkPost fills `{{address.email}}`, `{{address.name}}`, and `{{email}}` with each recipient's own address and name. Inline content that uses one of them keeps a site with cc or bcc recipients: PostHog sends every copy the main recipient's values.

## Calls

| SparkPost call | A site stays on SparkPost when |
|---|---|
| `client.transmissions.send`, `client.transmissions.send({ transmissionBody }, callback)` in Node.js 1.x, `sp.transmissions.send`, `send_message`, `send_payload`, `$sparky->transmissions->post`, `client.Send`, `client.SendContext`, `client.Transmissions.Send`, `SparkPost.Transmission.send`, `SparkPost.send`, `POST /api/v1/transmissions` | A field above keeps it |
| A transmission with several `recipients` without `header_to`, or a stored `list_id` | Always: it sends several emails in one call |
| SMTP through `smtp.sparkpostmail.com` or `smtp.eu.sparkpostmail.com` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A send that the code runs after it removes the recipient from SparkPost's suppression list: `DELETE /api/v1/suppression-list/{recipient}`, or the SDK's call for it, such as `client.suppressionList.delete` in Node.js | Always. The code wants the email to reach an address SparkPost suppressed, and PostHog refuses a suppressed address with `recipient_suppressed`. The removal call stays too |
| A framework mailer or transport (Django, Rails, Laravel, Swoosh, Bamboo, `nodemailer-sparkpost-transport`) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

### Subaccounts

A site sends from the primary account, or from a subaccount when its API key belongs to that subaccount or the request sets the `X-MSYS-SUBACCOUNT` header. Each subaccount has its own suppression list, and can turn off open tracking for its mail. When the app reads more than one SparkPost key, or sets `X-MSYS-SUBACCOUNT`, ask the person once which account each key or header value sends from, and record each site's account under the sites table.

PostHog keeps one suppression list per project. When the sites that move send from more than one account, Step 5 imports the list of each of them into that one list. PostHog then refuses a moved send to an address that any of those accounts suppressed, even when the site's own account never suppressed it. Tell the person so, and ask once whether the moved sites may share one suppression list. When they say no, ask which one account's sites move. The sites of every other account stay, and the reason is `SparkPost account <name> keeps its own suppression list`.

## Code around the send

SparkPost's SDKs report an error in two ways. The Node.js, Python, Ruby, PHP, and .NET SDKs throw or reject. The Go SDK returns an error value, and the Elixir SDK returns an error struct in place of the response. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on SparkPost when |
|---|---|
| A `catch`, `except`, or `rescue` that reads `err.statusCode`, `err.errors`, `e.status`, `e.errors`, `getCode()`, `getBody()`, or `Response.StatusCode` | It branches on a SparkPost error `code`, such as `1902`, or on its text. A branch on the HTTP status moves: a branch on `400` or `422`, SparkPost's answers to an invalid send, reads PostHog's error name `validation_error`, a branch on `420`, its sending limit, reads PostHog's code `quota_limited`, a branch on `429`, such as a retry or a back-off, reads PostHog's status code `429` and a code other than `quota_limited`, and a branch on another status reads PostHog's status code, as the Rewrite section says |
| A callback `(err, data)`, or `(err, res)` in Node.js 1.x, that checks `err` | Never. Check PostHog's error instead |
| A check of `res.HTTP.StatusCode` in Go, or a match on `%SparkPost.Endpoint.Error{}` in Elixir | Never. Read PostHog's error instead, as the Rewrite section says |
| A check of `total_rejected_recipients` or `total_accepted_recipients` | Never. With one recipient, check PostHog's error instead |
| `results.id`, the transmission id, stored for a webhook, a status read, or a cancel by campaign | Always, when the webhook handler, the Events API, or the cancel uses it |
| `results.id`, or `res.body.results.id` in Node.js 1.x, logged or stored for the app's own use | Never. Use PostHog's message id |

## Content

SparkPost runs inline content through its template language too, with values from `substitution_data` and `metadata`. Read the site's `subject`, `from`, `reply_to`, `text`, and `html` for `{{`:

- No template language: the content moves as it is.
- Plain expressions only, such as `{{name}}`, `{{user.first_name}}`, `{{address.name}}`, or `{{ name or 'there' }}`, whose values the site itself passes in `substitution_data` or `metadata`, or reads from the recipient: the site moves, and the rewrite fills each value in the code. See "Rewrite".
- An expression inside a link URL, such as `href="https://acme.dev/r?t={{token}}"`, moves only when the value holds URL-safe characters only, such as an id or a token the app makes. SparkPost URL-encodes it.
- Anything else keeps the site on SparkPost, with the reason `inline content uses SparkPost's template language`: a statement (`if`, `each`), `{{{ }}}`, a macro such as `render_dynamic_content` or `empty`, `dynamic_html`, `dynamic_plain`, arithmetic, `#` for a length, an array index, and any `data-msys-*` link attribute or `[[data-msys-...]]` in `text`.

## Templates

A stored template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the SparkPost template, makes it transactional, and gives you its template ID. Until then the site stays on SparkPost. The check needs the content of the template's published version, because the code has only its id. `account.md` says how to get it.

SparkPost's template language becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| SparkPost | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{user.first_name}}`, `{{user['first_name']}}` | `{{ variables.user.first_name }}` |
| `{{ name or 'there' }}` | `{{ variables.name \| default: 'there' }}` |
| `{{if paid}}…{{elseif due}}…{{else}}…{{end}}`, when `paid` and `due` are booleans | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{{if not paid}}…{{end}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{if plan == "pro"}}`, with `!=`, `<`, `>`, `<=`, or `>=` | `{% if variables.plan == "pro" %}`, with the same operator |
| `{{if paid and active}}`, `{{if paid or trial}}`, with one `and` or one `or`, when each side is a boolean or a comparison | `{% if variables.paid and variables.active %}`, `{% if variables.paid or variables.trial %}` |
| `{{each items}}{{loop_var.name}}{{end}}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{each tags}}{{loop_var}}{{end}}`, when `tags` is a list | `{% for tag in variables.tags %}{{ tag }}{% endfor %}` |
| `{{address.name}}`, `{{address.email}}`, `{{email}}` | `{{ variables.recipient_name }}`, `{{ variables.recipient_email }}`: the site adds the recipient's name or address to `templateData` under that name. When `substitution_data` already has a key by that name, pick one it doesn't have, such as `sparkpost_recipient_email`, and use it in both places |
| The published version's `subject` | The PostHog template's subject, with the same conversions |

Write the `\|` above as a plain `|`. The table escapes it.

- SparkPost escapes HTML in values in `html`, and so does PostHog's Liquid, so plain values render the same there.
- SparkPost escapes values in `html` and `amp_html` only, not in `text` or the subject. When a value in the text part or the subject can hold `&`, `<`, `>`, or quotes, such as a name, note in the report that the person checks the text part and the subject in a test send.
- SparkPost's `if` skips its block for `false` and `null` only, and its docs don't say how `0`, an empty string, or an empty list behave. Liquid treats them as true. Read what the site sends for each value an `if` tests on its own. A value that is not always a boolean, `null`, or missing keeps the template on SparkPost.
- SparkPost's `each` walks a list. An `each` over a value that is not always a list keeps the template on SparkPost.
- `{{{name}}}` inserts HTML as it is. PostHog's Liquid escapes it, so a template that uses triple braces stays on SparkPost.
- SparkPost reads the current item of an `each` through `loop_var`, and its docs don't say what a bare `{{name}}` inside `each` reads. A bare name inside `each` keeps the template on SparkPost. `{{loop_var}}` and `{{loop_var.name}}` become `{{ item }}` and `{{ item.name }}`, never `{{ variables.name }}`.
- An expression inside a link URL converts only when the value holds URL-safe characters only, as in "Content". SparkPost URL-encodes it, and the conversion above inserts it as it is.
- Anything else keeps the template on SparkPost: `loop_index`, `loop_vars` in nested loops, `#` for a length, an array index, arithmetic, `not` inside a longer condition, more than one `and` or `or`, a macro such as `render_dynamic_content`, `render_snippet`, `empty`, or a brace macro, the reserved values `email_id`, `env_from`, and `return_path`, and any `data-msys-*` link attribute or `[[data-msys-...]]` in `text`.
- A template whose `from` or `reply_to` holds a template expression, or whose version has `headers` or an `amp_html` part, stays.
- A template keeps its own `options`: `open_tracking`, `click_tracking`, and `transactional`. A transmission option the site sets wins over the template's, and the account's setting applies when neither sets one. The template moves only when SparkPost tracked both opens and clicks, as "Tracking" says: the template form takes no `captureEngagement`. When the `transactional` that applies is `false`, the site stays, and when neither sets it, the account's `transactional_default` applies, as the Fields table says for `options.transactional`.
- Liquid's `default` also replaces an empty string, and SparkPost's `or` does not. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `override.from` or `override.reply_to` next to `template_id` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `metadata`, `campaign_id`, `recipients[].tags`, cc or bcc recipients, `options.initial_open`, or `recipients[].options` next to `template_id` stays: a template made in PostHog sends with its own settings, and the template form takes none of them. `options.open_tracking` and `options.click_tracking` next to `template_id` decide the tracking that applies, as the first bullet says: the site moves when both are on, and stays otherwise.

## Webhooks

The event webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| SparkPost event `type` | PostHog event |
|---|---|
| `injection` | `$workflows_email_sent` |
| `delivery` | `$workflows_email_delivered` |
| `bounce`, `out_of_band` | `$workflows_email_bounced` |
| `spam_complaint` | `$workflows_email_blocked` |
| `open`, `initial_open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked` |
| `policy_rejection`, `generation_failure`, `generation_rejection` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `delay`, `list_unsubscribe`, `link_unsubscribe`, `amp_open`, `amp_initial_open`, `amp_click` | none |

PostHog's events carry no SparkPost `transmission_id`, `message_id`, `rcpt_meta`, `rcpt_tags`, or `campaign_id`. A site whose events a handler matches by one of them stays on SparkPost. For every other handler, such as one that reads only `type` and `rcpt_to`, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'sparkpost'` on the client that Step 7 configures, when its client options take it.

**The call.** The SparkPost transmission becomes one PostHog send. Build its fields from the transmission the site built:

- Node.js, PHP, and HTTP: `content.from`, `content.subject`, `content.html`, `content.text`, `content.reply_to`, `content.attachments`, the one recipient, and the cc and bcc recipients. In Node.js 1.x they sit under `transmissionBody`, and the rewrite drops that wrapper. The 1.x SDK also renamed keys before the send, as `sdk-reference.md` says: classify the site and build `templateData` and the filled-in values from the names SparkPost got, so `substitutionData: { firstName }` fills `{{first_name}}` and becomes `templateData: { first_name }`.
- Python `send(recipients=, from_email=, subject=, html=, text=, reply_to=, cc=, bcc=, attachments=)`: the same fields. An attachment with `filename` (a path) is read into its content first.
- Ruby `send_message(to, from, subject, html, text_message:)`: the same fields.
- Go `sp.Transmission{Recipients, Content: sp.Content{From, Subject, HTML, Text, ReplyTo, Attachments}}`: the same fields.
- .NET `transmission.Content` and `transmission.Recipients`: the same fields.
- Elixir `%Transmission{recipients:, content: %Content.Inline{...}}` or `SparkPost.send(to:, from:, subject:, text:, html:)`: the same fields.

**The fields.**

- `{ email: 'hello@mail.example.com', name: 'Example' }` in `from` becomes `'Example <hello@mail.example.com>'`. Put the name in double quotes when it holds a comma, a quote, or another special character, such as `'"Acme, Inc." <hello@mail.example.com>'`. A string `from` stays the same string.
- The one recipient's address becomes `to`, as a bare address. Cc and bcc recipients become bare addresses in `cc` and `bcc`, as "Cc and bcc" says. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- An attachment `{ name, type, data }` becomes `{ filename: name, contentType: type, content: data }`. In Node.js and Python, `content` stays the same base64 string. In Go and Elixir, the SDK takes the raw file: decode the base64 string first, as `posthog-sdks.md` says, or pass the bytes the code encoded, or the recipient gets the file encoded twice. An inline image becomes an attachment with `contentId: name` too, the bare name without `cid:`.
- Tracking becomes `captureEngagement: false` when SparkPost tracked neither opens nor clicks, as "Tracking" says, whether the send turned them off or the account did. Drop the tracking fields. When both were tracked, drop them and set nothing. Note in the plan row each site that got `captureEngagement: false` from an account's setting.
- The `Idempotency-Key` header becomes `idempotencyKey`, with the same value.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Inline content with plain expressions.** Fill each value in the code, from the same source the site put into `substitution_data` or `metadata`, and drop those objects from the send:

- Apply the fallback of an `or` first: `{{ name or 'there' }}` becomes the value with a fallback for a missing or `null` value only, such as `name ?? 'there'` in Node.js or `'there' if name is None else name` in Python.
- Then turn each value into a string, and a missing or `null` value that has no fallback into an empty string, as SparkPost rendered it. Every escape helper below takes a string: Python's `html.escape(42)` raises.
- In `html`, escape the value for HTML, as SparkPost did: write a small escape helper in Node.js and Elixir, and use `html.escape` in Python, `html.EscapeString` in Go, `htmlspecialchars` in PHP, `CGI.escapeHTML` in Ruby, and `WebUtility.HtmlEncode` in .NET. Reuse the app's own helper when it has one.
- In `text`, `subject`, `from`, and `reply_to`, insert the value as it is. When the value is the name in `from`, quote it as "The fields" says.
- `{{address.name}}` and `{{address.email}}` become the recipient's name and address.
- Note each site that got an escape helper in the plan.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `substitution_data` and the recipient's `substitution_data` merged, the recipient's values winning. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did. SparkPost answers an invalid send with `400` or `422`. A branch on either becomes a branch on PostHog's error name `validation_error`, never on a status code, after the `recipient_suppressed` branch below: PostHog's statuses for invalid sends differ from SparkPost's. SparkPost answers a send over the account's daily, monthly, or sandbox sending limit with `420`. A branch on `420` becomes a branch on PostHog's code `quota_limited`. PostHog answers a used-up quota with status `429` too, and no retry clears it, while SparkPost's `429` was a rate limit only. So a branch on `429`, such as a retry or a back-off, reads PostHog's status code `429` and a code other than `quota_limited`, and the quota error goes where SparkPost's `420` went. A branch on another status, such as `401`, reads PostHog's status code. This holds in every language below.


- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `client.transmissions.send` rejected into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name, code: error.code })`. `err.statusCode` keeps holding the HTTP status, and a network failure, which has none, has `err.code` `network_error`, and a check of `err.statusCode === 400` or `422` becomes a check of `err.name === 'validation_error'`. A read of `err.errors` becomes a read of `err.message`. A callback `(err, data)` becomes the same code after the send, with PostHog's `error` as `err`. A branch on one status keeps that status only, and every other error goes where it went before.
- **Python.** PostHog's SDK raises too. Replace `except SparkPostAPIException` with the PostHog exception `posthog-sdks.md` names, `e.status` with its status code, and `e.errors` with its message. Where the `except` handled one kind of error only, check for the same kind and raise every other error again: `e.status == 429` checks the status code `429` and a code other than `quota_limited`, and `e.status in (400, 422)` checks the name `validation_error`.
- **Ruby.** PostHog's SDK raises too. Replace `rescue SparkPost::DeliveryException` with the PostHog exception `posthog-sdks.md` names. Where the `rescue` handled one kind of error only, check for the same kind with PostHog's `name`, `code`, or status code, and raise every other error again.
- **PHP.** PostHog's SDK throws too, and sends at once. Replace `catch (SparkPostException $e)` with the PostHog exception `posthog-sdks.md` names, `getCode()` with its status code, and `getBody()['errors']` with `getMessage()`. A `->wait()` on the SparkPost promise goes away. A `->then($ok, $fail)` becomes a `try` with the `$ok` code after the send and the `$fail` code in the `catch`. Where the `catch` handled one status only, check for the same kind and throw every other error again: `getCode()` of `400` or `422` becomes `getErrorName() === 'validation_error'`, and another status reads `getStatusCode()`.
- **Go.** SparkPost answered `(id, res, err)`, and PostHog answers `(result, err)`. `id` becomes `result.ID`. Keep each branch on `err`. A read of `res.HTTP.StatusCode` becomes PostHog's status code, read with `errors.As` on the `*posthog.EmailError`. A branch on `400` or `422` reads `emailErr.Name == "validation_error"`, and a branch on another status reads `emailErr.StatusCode`. Every other error goes on to the branch that handled it before.
- **.NET.** PostHog's SDK throws too. Replace `catch (ResponseException e)` with the PostHog exception `posthog-sdks.md` names, and `e.Response.StatusCode` with its status code. A `catch` with a `when` filter on one status keeps the filter for the same kind, so every other error goes past it as before: `400` or `422` becomes a check of PostHog's error name `validation_error`, and another status checks its status code.
- **Elixir.** SparkPost answered the response struct or an error struct, and PostHog answers `{:ok, result}` or `{:error, error}`. A match on `%SparkPost.Transmission.Response{id: id}` becomes `{:ok, %PostHog.Emails.SendResult{id: id}}`, and a match on `%SparkPost.Endpoint.Error{status_code: code}` becomes `{:error, %PostHog.Emails.Error{status_code: code}}`. A match on one status keeps the same kind in the pattern, and every other error goes to the clause that took it before: `status_code: 400` or `422` becomes `name: :validation_error`, and another status keeps `status_code:`.
- **HTTP.** A raw call to `/api/v1/transmissions` raised on a refused send only when its client did: `axios` unless its `validateStatus` lets the status through, `got` or `ky` unless `throwHttpErrors: false`, Guzzle unless `http_errors: false`, Faraday with `raise_error`, or a call to `raise_for_status()` or `EnsureSuccessStatusCode()`. Such a site raises PostHog's error the same way, and its status reads follow the rules above. `fetch`, `requests`, `httpx`, `Net::HTTP`, Go's `net/http`, and .NET's `HttpClient` answered a refused send without raising: a status check becomes a check of PostHog's error, and a site that never checked the status logs PostHog's error and goes on, and raises or returns it when its code is `network_error`, as Step 7 says.
- In Python, Ruby, and .NET, SparkPost's error class covers an error answer from the API only: a network error raised the HTTP library's own error, past the `except`, `rescue`, or `catch`. In Node.js, PHP, Go, and Elixir, SparkPost's error covered network errors too, so nothing changes there. PostHog's error also covers a network error, with the code `network_error`. Where the old catch named only SparkPost's class, raise an error whose code is `network_error` again, so it goes where it went before.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where SparkPost took it and rejected it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `results.id`, or `res.body.results.id` in Node.js 1.x, or stored it for the app's own use, takes PostHog's message id instead.

**The SparkPost client.** A call that adds addresses to SparkPost's suppression list, `PUT /api/v1/suppression-list`, `PUT /api/v1/suppression-list/{recipient}`, or the SDK's call for it, such as `client.suppressionList.upsert` in Node.js, stops only SparkPost's sends: an address it adds after the import still gets the moved sends. List it under other calls, and add to the report's "Before cutover" that the person makes that call write to both lists before the deploy: it keeps its SparkPost write and also adds the address to PostHog's suppression list, for the entries the import would take, as `account.md` says under "Map each entry": a write of type `transactional` without a `list_id`. A write of type `non_transactional` or `open_tracking`, or with a `list_id`, is a marketing preference or a tracking choice, and stays a SparkPost write only. A call that takes an address off the list, `DELETE /api/v1/suppression-list/{recipient}` or the SDK's call for it, works the same way for a `transactional` entry: it also removes the address from PostHog's suppression list where Step 5 allows it. The SparkPost write stays while any send of that account still goes through SparkPost, such as a site that stays or a mailer. Keep the SparkPost client, its import, and its setup while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover. The SparkPost SDKs serve SparkPost only. The framework mailers that can send through SparkPost, such as `django-anymail`, Swoosh, and Bamboo, also serve other providers and the app's other mail: they always stay, and Step 9 never lists them for removal.