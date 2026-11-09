# Postmark to PostHog mapping

This file decides, field by field, whether PostHog can send a Postmark call site. A site moves only when every field it sets moves. Otherwise it stays on Postmark, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

Postmark fields are written in their HTTP names here, such as `HtmlBody`. Python and Ruby code uses snake case, such as `html_body`, and `postmark-python` names `From` as `sender`. PostHog fields are written in their Node.js names, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python.

## Fields

| Postmark | PostHog | A site stays on Postmark when |
|---|---|---|
| `From` | `from` | Never. `Name <address>` moves as it is. It needs a verified sender (Step 4) |
| `To` | `to` | It holds more than one address: a comma in the string, a list with more than one entry in Ruby, PHP, or `postmarker`, or a value the code builds at run time that you cannot tell holds one address. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `Subject` | `subject` | Never |
| `HtmlBody`, `TextBody` | `html`, `text` | Never |
| `TemplateId` or `TemplateAlias`, with `TemplateModel` | the template's email, with its layout, brought into the code and rendered with `TemplateModel`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `InlineCss` | none | Never on its own. It shapes how Postmark rendered the template's CSS: the email brought into the code carries that CSS, as "Templates" says |
| `Cc`, `Bcc` | none | Always. PostHog's send doesn't take it yet |
| `ReplyTo` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `Attachments` | none | Always. PostHog's send doesn't take it yet |
| `Headers` | none | Always: no PostHog SDK takes headers yet |
| `Metadata` | none | Always: no PostHog SDK takes tags yet |
| `Tag` | none | Always: no PostHog SDK takes tags yet |
| Open and link tracking: `TrackOpens`, `TrackLinks`, or neither | none: PostHog adds its open pixel and counts no clicks | Postmark sent it with opens untracked, or its open tracking isn't checked. See "Tracking" below |
| `MessageStream: 'outbound'` | none | Never. `outbound` is the default transactional stream |
| `MessageStream` naming any other stream | none | Always: the stream has its own settings, suppressions, and webhooks at Postmark |

Count only the fields the code sets.

**Tracking.** PostHog adds its open pixel to every email it sends, to count opens. It never rewrites a code send's links, so it counts no clicks. No field changes this: `captureEngagement` decides only whether the email's events land on the recipient's person, so tracking never maps to it. Postmark tracks opens when the send's `TrackOpens` is `true`, or, when the send leaves it out or sets it to `null`, when its server's open tracking is on. It tracks links when the send's `TrackLinks` is anything but `None`, or, when the send leaves it out, when its server's link tracking is on. A new server tracks neither, until the person turns them on in its settings. `postmarker` sends `TrackLinks: "None"` when the code doesn't pass it, from `emails.send`, `emails.send_with_template`, and a message built with `client.emails.Email(...)` or `client.emails.EmailTemplate(...)`: links of those sends were not tracked. So does the .NET SDK: the constructor of `PostmarkMessage` and `TemplatedPostmarkMessage` sets `TrackLinks` to `LinkTrackingOptions.None`, so a .NET SDK message whose code never sets `TrackLinks` sends `None`, and its links were not tracked. That includes the positional `SendMessageAsync(from, to, subject, textBody, htmlBody)`, which builds a `PostmarkMessage` and never sets it. A .NET message that sets `TrackLinks = null` sends no value and follows the server, and so does a .NET send through a plain HTTP client that leaves the field out. Work out, for opens and for links, whether Postmark tracked them:

- Opens tracked: the site moves. When Postmark tracked its links too, note in the plan row that PostHog counts no clicks for it.
- Opens untracked: the site stays, and the reason is `open tracking off`: PostHog would add an open pixel the email never had.

Link tracking alone never keeps a site, and never adds a field. A template site follows these bullets too, whether it moves into the code or to a template made in PostHog.

Opens follow the server's setting whenever a site leaves out `TrackOpens` or sets it to `null`, in every SDK, `postmarker` and .NET included, except PHP's `sendEmailModel` with a `PostmarkMessage`: the model sets `TrackOpens` to `false` unless the code sets it, and sends that, so its opens were not tracked. Links follow it when a site leaves out `TrackLinks` or sets it to `null`, except in a `postmarker` send and a .NET SDK message that never sets it, whose links were not tracked. When either one follows the server, ask the person once for each server the moved sites send from whether its open tracking and link tracking are on, or read them as `account.md` says under "Tracking settings". When a site's opens follow the server and the answer for open tracking is not given, the site stays, and the reason is `server tracking not checked`. An unanswered link tracking setting keeps no site.

A Postmark send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Postmark call | A site stays on Postmark when |
|---|---|
| `sendEmail`, `outbound.send`, `emails.send` (`postmarker`), `deliver`, `deliver_message`, PHP `sendEmail` and `sendEmailModel`, `SendMessageAsync`, Go `SendEmail`, `POST /email` | A field above keeps it |
| `sendEmailWithTemplate`, `outbound.send_with_template`, `emails.send_with_template`, `deliver_with_template`, `deliver_message_with_template`, PHP `sendEmailWithTemplate`, `SendEmailWithTemplateAsync`, `POST /email/withTemplate` | See "Templates" |
| `sendEmailBatch`, `sendEmailBatchWithTemplates`, `sendBulkEmail`, `send_batch`, `send_batch_with_template`, `send_bulk`, `deliver_in_batches`, `deliver_in_batches_with_templates`, `deliver_messages`, PHP `sendEmailBatch` and `sendEmailBatchWithTemplate`, `SendMessagesAsync`, Go `SendEmailBatch`, `POST /email/batch`, `/email/batchWithTemplates`, `/email/bulk` | Always: each sends several emails in one call. The one exception is a batch call whose argument is a list of exactly one message, written in the code, such as PHP `sendEmailBatch([$message])`: that is one send. Classify it by that message's fields, and a template message by "Templates" |
| SMTP through `smtp.postmarkapp.com` or `smtp-broadcasts.postmarkapp.com` | Always. PostHog has no SMTP relay |
| A framework mailer (`postmark-rails`, a Django backend, Laravel or Symfony `postmark`, Swoosh, Bamboo, `nodemailer-postmark-transport`) | Always. PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Servers

Each Postmark server has its own tokens, templates, tracking settings, and suppression lists. A site sends from the server its token belongs to. When the app reads more than one Postmark token, ask the person once which server each one belongs to, and record each site's server under the sites table.

PostHog keeps one suppression list per project. When the sites that move send from more than one server, Step 5 imports the `outbound` list of each of them into that one list. PostHog then refuses a moved send to an address that any of those servers suppressed, even when the site's own server never suppressed it or reactivated it. Tell the person so, and ask once whether the moved sites may share one suppression list. When they say no, ask which one server's sites move. The sites of every other server stay, and the reason is `server <name> keeps its own suppression list`.

## Code around the send

Postmark's SDKs throw on an API error: Node.js, both Python SDKs, Ruby, PHP, and .NET. The Go community packages return an error. A raw HTTP call reads the status code or the `ErrorCode` in the answer. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Postmark when |
|---|---|
| A `catch`, `except`, or `rescue` that only logs or rethrows the error | Never |
| A branch on the HTTP status: `err.statusCode`, `e.http_status`, `e.status_code`, `getHttpStatusCode()` | Never. Read PostHog's status code, or PostHog's error name for a `422`, as the Rewrite section says |
| A branch on an inactive recipient: `InactiveRecipientsError`, `InactiveRecipientException`, `Postmark::InactiveRecipientError`, or `ErrorCode` `406` | Never. PostHog refuses a suppressed address with the code `recipient_suppressed` |
| A branch on another Postmark `ErrorCode`, or on the error's message text | Always. A catch of `InvalidEmailRequestError` or Python's `ValidationException` is not such a branch: the Rewrite section maps it |
| A read of the inactive addresses from the error (`recipients`, `inactive_recipients`) | Always |
| A check of `ErrorCode`, `Message`, or .NET's `Status` in a send's answer | Never. Read PostHog's error instead, as the Rewrite section says |
| `MessageID` stored for a webhook handler or a status read | Always, when a webhook handler or the Messages or Bounces API uses it |
| `MessageID` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A template site moves by bringing the template into the code, as `template-to-code.md` says. The check needs the template's subject, HTML body, and text body, because the code has only its id or alias. `account.md` says how to get them. The code renders them with the site's `TemplateModel`, and the send sets the rendered `subject`, `html`, and `text`.

A template with a layout (its `LayoutTemplate` names one) renders inside that layout at `{{{ @content }}}`, so the layout and the template come into the code as one email: the layout's HTML with the template's HTML in place of `{{{ @content }}}`, and the same for the text body, all rendered with the same `TemplateModel`. The check needs the layout's content too. When several emails share a layout, write it once as a piece they share. When only one of the layout and the template has a text body, the docs don't say what Postmark sent as text, so the template stays on Postmark.

Postmark templates are Mustachio. In the code:

| Postmark | In the code |
|---|---|
| `{{name}}`, `{{ name }}` | The value, escaped. A missing or `null` value renders as nothing, and so does a list or an object. A number renders as its digits. A boolean renders as `True` or `False`, as Mustachio's source does: the docs don't say, so note it in the plan row |
| `{{person.first_name}}` | The nested value, escaped. A missing step of the path renders as nothing |
| `{{{name}}}`, `{{& name}}` | The value as it is, unescaped, under the rule of `template-to-code.md`. In the subject and the text, it is the plain value |
| `{{#paid}}…{{/paid}}`, on a value that is never a list | The part, rendered once when the value passes Mustachio's truth test below. Inside it, names are read from that value: `{{#person}}{{first_name}}{{/person}}` reads `person.first_name`, and `{{.}}` is the value itself |
| `{{^paid}}…{{/paid}}` | The part, rendered when the value fails the truth test |
| `{{name}}{{^name}}there{{/name}}`, Mustachio's only fallback | The value, or `there` when it fails the truth test: `""` gets the fallback too |
| `{{#each items}}…{{/each}}` | A loop over the list, in order. Nothing when the list is missing, `null`, or empty |
| Inside `{{#each items}}`: `{{.}}`, `{{name}}`, `{{#each .}}` | The current item, its field, or a loop over the item when it is a list itself. Mustachio has no index, first, or last |
| `{{../name}}`, `{{../../name}}` | The value one level out for each `../`. Out of a section, one level is the scope the section is in. Out of an `each` item, one level is the list, so `../../name` reads the scope the list is in. A `../` past the top stays at the top, in Mustachio's source |
| `{{! note }}` | Nothing |
| The layout's `{{{ @content }}}` | The template's HTML, or its text, in its place |
| The template's `Subject` | The send's `subject`, rendered with the same conversions and no escaping. A layout has no subject |
| The template's `TextBody`, inside the layout's | The send's `text`, with no escaping. Mustachio keeps every line break around its tags, so keep the lines as they are. A template without a text body sends `html` only |

- Mustachio's truth test: a missing value, `null`, `false`, `""`, and an empty list fail it. Every other string, including `"0"` and `"false"`, `true`, a number other than `0`, and an object with keys pass it. Write that test out in the code, as `template-to-code.md` says. The docs don't say what `0` or an empty object does: a section or an inverted section whose value can be either keeps the template on Postmark, because which part Postmark sent can't be told.
- Inside a section or an `each`, a bare name reads only the section's value or the current item. Postmark's docs reach an outer value with `../` only, and don't say whether a bare name looks outside: a bare name that the value or the item doesn't always carry keeps the template on Postmark. So does a bare name inside an inverted section, which has no value to read it from: only `../` reads there.
- A section `{{#items}}` on a value that can be a list, an `{{#each}}` on a value that can be an object or a scalar, a path into a list by position, such as `{{items.0.name}}`, a partial (`{{> name}}`), and any other tag keep the template on Postmark. The docs show a list only with `each`, and Mustachio's source renders such a section once with the whole list as its value and fails such an `each`.
- `{{{ pm:unsubscribe }}}`, also inside a link as `href="{{{ pm:unsubscribe }}}"`, keeps the template on Postmark: Postmark fills it from its account with the stream's unsubscribe link.
- With `InlineCss` on, its default, write each `<style>` rule into the `style` attribute of the tags it matches, as Postmark did when it sent the email, and keep the `<style>` block for the rules a tag can't hold, such as `@media`. Do it once, while you write the email: the code adds no inliner. Postmark's docs don't say whether it kept the `<style>` block, so note in the plan row that the CSS was inlined in the code, for the person to compare a test send. A site that sends `InlineCss: false`, or `false` for PHP's `$inlineCss`, keeps the HTML as it is.
- Postmark hosts no images for templates: its editor has no upload, and its docs name no image host. A template's images are on the person's own hosts, so none needs listing.
- A Postmark template holds no sender or reply-to address, and a template send always sets `From`. The send takes the site's own `From` and `ReplyTo`. Its subject comes only from the template: the template routes take no `Subject`.
- A template site follows "Tracking" like any other site: it stays when Postmark sent it with opens untracked.
- No single send fills Postmark's template language into its own content: `POST /email` and the batch route send `Subject`, `HtmlBody`, and `TextBody` as they are, so a `{{name}}` in them was mailed as written, and nothing about it changes. Only the Bulk API fills its own content with each message's `TemplateModel`, and a bulk call stays, as "Calls" says.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. This skill never makes one: the person makes it from the Postmark template, makes it transactional, and gives you its template ID. Until then the site stays on Postmark.

For a template with a layout, the person makes one PostHog template from both: the layout's HTML with the template's HTML in place of `{{{ @content }}}`, and the same for the text body. Tell them so when you ask them to make it.

Postmark's Mustachio becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| Postmark | PostHog |
|---|---|
| `{{name}}`, `{{ name }}` | `{{ variables.name }}` |
| `{{person.first_name}}` | `{{ variables.person.first_name }}` |
| `{{#paid}}…{{/paid}}`, when `paid` is always a boolean, `null`, or missing | `{% if variables.paid %}…{% endif %}` |
| `{{^paid}}…{{/paid}}`, when `paid` is always a boolean, `null`, or missing | `{% unless variables.paid %}…{% endunless %}` |
| `{{#person}}{{first_name}}{{/person}}`, when `person` is always an object with keys, `null`, or missing | `{% if variables.person %}{{ variables.person.first_name }}{% endif %}` |
| `{{#each items}}{{name}}{{/each}}`, when `items` is always a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{.}}` inside `{{#each items}}` | `{{ item }}` |
| `{{../company}}` inside a top-level `{{#person}}` section, or `{{../../company}}` inside a top-level `{{#each items}}`, where `company` is a top-level key of `TemplateModel` | `{{ variables.company }}` |
| The template's `Subject` | The PostHog template's subject, with the same conversions |

- Mustachio escapes HTML in values, and so does PostHog's Liquid, so plain values render the same.
- Mustachio skips a section whose value is false, empty, or missing, and Liquid treats `0`, an empty string, and an empty list as true. Read what the site sends for each section value. A value that is not always a boolean, `null`, or missing, such as a number, a string, or a list, keeps the template on Postmark. So does an object that can be empty.
- Liquid's `for` walks only a list. An `each` over a value that is not always a list, such as an object, keeps the template on Postmark.
- Inside `{{#each items}}`, a bare `{{name}}` reads the current item. It becomes `{{ item.name }}`, never `{{ variables.name }}`. A name that the item doesn't always carry keeps the template on Postmark, because Liquid won't look for it outside the loop.
- `{{{name}}}` and `{{& name}}` insert HTML as it is. PostHog's Liquid escapes it, so a template that uses them stays on Postmark. The layout's own `{{{ @content }}}` is the one exception: the person replaces it with the template.
- `{{{ pm:unsubscribe }}}` keeps the template on Postmark: it is Postmark's unsubscribe link.
- An inverted section `{{^items}}` on a list or an object, a section `{{#items}}` on a list without `each`, a name inside `{{#person}}` that the site doesn't put on `person`, and `../` that reads anything but a top-level key all keep the template on Postmark. Inside `{{#each}}`, one `../` reaches the list, not the model: Postmark needs `../../` for a top-level key there.
- The PostHog template carries its own sender, reply-to address, and subject. A Postmark template send always sets `From`: the site moves only when `From` is the same in every send, and the person makes the PostHog template send from it. The same holds for `ReplyTo` when the site sets it. Otherwise it stays.
- A template site follows "Tracking" like any other site: it stays when Postmark sent it with opens untracked, by the site's own field, PHP's model default, or its server's setting, or when its open tracking isn't checked. When it moves, the tracking fields are dropped, and so is `MessageStream: 'outbound'`. `Cc`, `Bcc`, `Attachments`, `Headers`, `Metadata`, `Tag`, and a `MessageStream` other than `outbound` keep any site, as the Fields table says.
- With `InlineCss` on, its default, Postmark moved the template's `<style>` rules into each tag. Tell the person to check how the PostHog template looks in its test send.

## Webhooks

Postmark stops sending events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| Postmark `RecordType` | PostHog event |
|---|---|
| `Delivery` | `$workflows_email_delivered` |
| `Bounce` | `$workflows_email_bounced` |
| `SpamComplaint` | `$workflows_email_blocked` |
| `Open` | `$workflows_email_opened` |
| `Click` | none: PostHog never rewrites the links of these sends, so it counts no clicks |
| `SubscriptionChange` | none |

Postmark has no event for an accepted send. PostHog records `$workflows_email_sent` for each moved send. A send to an inactive address got a `406` error from Postmark, and Postmark posted no webhook for it. PostHog refuses it with `recipient_suppressed`.

PostHog's events carry no Postmark `MessageID`, no `Metadata`, and no `Tag`. A site whose events a handler matches by message id, by a metadata value, or by tag stays on Postmark. For every other handler, such as one that matches by the recipient's address, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'postmark'` on the client that Step 7 configures, when its client options take it.

- Python: `postmark-python` is async. A site that awaits `client.outbound.send` moves to `AsyncPosthog` and `await posthog.emails.send(...)`, with `posthog[async]` installed, as the rewrite file says. A site on `postmark.sync.ServerClient` or `postmarker` moves to `Posthog`.

**The call.** The Postmark send becomes one PostHog send. Build its fields from the message the site built:

- Node.js `client.sendEmail({ ... })`, or a `new postmark.Message(...)`: the fields of the message.
- Python `client.outbound.send({ ... })` (keys `sender`, `to`, `html_body`, or the HTTP names), and `postmarker` `client.emails.send(From=, To=, ...)`: the same fields.
- Ruby `client.deliver(from:, to:, subject:, html_body:, text_body:, ...)`: the same fields.
- PHP `sendEmail($from, $to, $subject, $htmlBody, $textBody, $tag, $trackOpens, $replyTo, $cc, $bcc, $headers, $attachments, $trackLinks, $metadata, $messageStream)`: read each argument by its position or its name. A `null` argument sets nothing.
- .NET `new PostmarkMessage { ... }`: the same fields. The positional forms `new PostmarkMessage(from, to, subject, textBody, htmlBody, headers, metadata, messageStream)` and `SendMessageAsync(from, to, subject, textBody, htmlBody, headers, metadata, messageStream)` take the text body before the HTML body, unlike PHP. Read each argument by its position, and a `null` or left-out argument sets nothing. The `SendMessage` with the same arguments is synchronous: the rewrite file says what a synchronous .NET site does.
- Go `postmark.Email{ ... }`: the same fields.
- A raw HTTP body: its fields.
- A batch of one message: the fields of that message, sent with PostHog's send for one email.
- A template send, such as `sendEmailWithTemplate`, `send_with_template`, `deliver_with_template`, .NET `TemplatedPostmarkMessage`, or `POST /email/withTemplate`: its `From`, `To`, `ReplyTo`, and tracking fields, as for any message, and the rendered email, as "Templates brought into the code" says. PHP `sendEmailWithTemplate($from, $to, $templateIdOrAlias, $templateModel, $inlineCss, ...)` takes the rest from `$tag` on in `sendEmail`'s order.

**The fields.**

- `From` moves as it is, with its name.
- `To` becomes one bare address. When a helper takes a list or a comma-separated string of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- A `ReplyTo` with several addresses becomes a list of bare addresses: split a comma-separated string.
- `HtmlBody` becomes `html`, and `TextBody` becomes `text`.
- `MessageStream: 'outbound'` is dropped, as the Fields table says.
- `TrackOpens` and `TrackLinks` are dropped, and the send gets no `captureEngagement` for them, as "Tracking" says.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates brought into the code.** The site renders the email, inside its layout, from `TemplateModel`, as "Templates" says, and sends `templateKey`, the rendered `subject`, `html`, and `text`, and the site's own `from` and `replyTo`. It sends no `templateId` and no `templateData`, and drops `TemplateId`, `TemplateAlias`, `TemplateModel`, and `InlineCss`.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `TemplateModel`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Postmark refused a send to an inactive address with error code `406`, and the site's error path ran. PostHog refuses it with `recipient_suppressed`, so the same path runs: the site needs no new branch. Keep the site failing the same way it did:

Never widen a catch. Where the code caught only one kind of Postmark error, catch PostHog's error, check its `code` or status code for that kind, and raise or return every other error as before. The kinds map like this: `ApiInputError`, `ValidationException`, `InvalidEmailRequestError`, and a status of `422` are PostHog's error name `validation_error`, never a status, because PostHog's statuses for an invalid send differ from Postmark's. `recipient_suppressed` is a `validation_error` too, with status `422`: where the site treats an inactive recipient apart, handle it first. `ApiInputError` and a status of `422` also covered inactive recipients, so their branch covers `recipient_suppressed` as well. `InvalidEmailRequestError` and Python's `ValidationException` never did: their branch is `validation_error` with any code but `recipient_suppressed`, and it raises `recipient_suppressed` again first. `InvalidAPIKeyError` and `InvalidAPIKeyException` 401, `RateLimitExceededError` and `RateLimitException` 429, `InternalServerError` and `ServerException` 500 or more, and an inactive recipient is the code `recipient_suppressed`. A network error that is left after PostHog's retries has the code `network_error`. A catch of Postmark's API errors only, such as Python's `PostmarkAPIException` or `postmarker`'s `ClientError`, Ruby's `Postmark::HttpServerError`, PHP's `PostmarkException`, or .NET's `PostmarkValidationException`, let network errors and timeouts go past it: raise the error again when its code is `network_error`.

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sendEmail` threw into a `catch`, or up to the caller, throw from the error so the same code runs: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, code: error.code, name: error.name })`. `err.statusCode` keeps holding the HTTP status, and `err.name` holds PostHog's error name. `err.code` now holds PostHog's code, a string: a branch on `err.code === 406` or on `instanceof InactiveRecipientsError` becomes `err.code === 'recipient_suppressed'`, a branch on `instanceof ApiInputError`, or on `err.statusCode === 422`, becomes `err.name === 'validation_error'`, a branch on `instanceof InvalidEmailRequestError` becomes `err.name === 'validation_error' && err.code !== 'recipient_suppressed'`, and a branch on `instanceof` another Postmark error class becomes a check of `err.statusCode` as mapped above.
- **Python.** PostHog's SDK raises too. `except PostmarkException` becomes `except EmailError`, with the PostHog exception the rewrite file names. `except PostmarkAPIException` and `postmarker`'s `except ClientError` become `except EmailError` that raises again first when the code is `network_error`. `e.http_status` becomes its status code, and `e.error_code == 406` becomes a check of its code for `recipient_suppressed`. A catch of one subclass becomes `except EmailError as e:` that checks for the same kind and raises every other error again: `InactiveRecipientException` checks `e.code == 'recipient_suppressed'`, `e.http_status == 422` checks `e.name == 'validation_error'`, `ValidationException` checks `e.name == 'validation_error' and e.code != 'recipient_suppressed'`, and `RateLimitException` checks `e.status_code == 429`. `PostmarkException` also covered the SDK's own check of the message (`InvalidEmailException`): where the old code handled a bad value, also catch `TypeError` and `ValueError`, as Step 7 says.
- **Ruby.** `rescue Postmark::Error` becomes `rescue PostHog::EmailError`, and `ArgumentError` where the old code handled a bad value. `rescue Postmark::HttpServerError` becomes `rescue PostHog::EmailError => e` with `raise if e.code == 'network_error'` first. A rescue of one class, such as `Postmark::ApiInputError` or `Postmark::InactiveRecipientError`, becomes `rescue PostHog::EmailError => e` with `raise unless` the check of that kind first: `raise unless e.name == 'validation_error'` for `ApiInputError`, `raise if e.code == 'recipient_suppressed'` and then `raise unless e.name == 'validation_error'` for `Postmark::InvalidEmailRequestError`, and `raise unless e.code == 'recipient_suppressed'` for `InactiveRecipientError`. `e.status_code` keeps its name, except that a check of it for `422` becomes `e.name == 'validation_error'`, and `e.error_code` becomes `e.code`.
- **PHP.** `catch (PostmarkException $e)` caught API errors only: Guzzle's network errors went past it. It becomes `catch (\PostHog\EmailError $e)` with `if ($e->getErrorCode() === 'network_error') throw $e;` first. `getHttpStatusCode()` becomes `getStatusCode()`, a check of it for `422` becomes `getErrorName() === 'validation_error'`, and a check of `getPostmarkApiErrorCode()` for `406` becomes `getErrorCode() === 'recipient_suppressed'`.
- **.NET.** `catch (PostmarkValidationException ex)` caught API errors only: network errors went past it, such as an `HttpRequestException`. It becomes `catch (PostHog.Emails.EmailException ex) when (ex.Code != "network_error")`. `ex.Response.Message` becomes `ex.Message`, a branch on the `422` answer becomes `ex.Name == "validation_error"`, and a check of `ex.Response.ErrorCode` for `406` becomes `ex.Code == "recipient_suppressed"`.
- **Go.** Both return an error. Keep `if err != nil`, and read PostHog's `*posthog.EmailError` with `errors.As` where the code read Postmark's. A branch on one `ErrorCode` becomes a check of the error's `Code` or `StatusCode`, a branch on a `422` reads its `Name` for `validation_error`, and every other error goes on as before.
- **HTTP.** The code read the status or `ErrorCode` of the answer. Read PostHog's error the way the rewrite file says under "The answer", and keep each branch: a status of 400 or more, or an `ErrorCode` other than 0, becomes "there is an error", a branch on `422` reads PostHog's error name `validation_error`, and a branch on another status, such as `429`, reads PostHog's status code.

**Checks of the answer.** A single send threw on any answer but `200` before the code read it: .NET's `SendMessageAsync` throws `PostmarkValidationException`, and PHP's `sendEmail` throws `PostmarkException`. A check after the call, such as `response.Status != PostmarkStatus.Success` or `getErrorCode() != 0`, only ever saw a sent email. Remove the check, keep the code it guarded on success, and let PostHog's error take the path Postmark's exception took, as the bullets above say.

**A batch of one.** The batch route answers `200` even when it refuses the message, and puts the refusal in the message's `ErrorCode` in the answer's list: a refusal of that message, such as `300` (an invalid email request) or `406` (an inactive recipient). A failure of the whole request threw, or returned an error in Go, as a single send does: a bad token (`401`), a rate limit left after the retries (`429`), a request Postmark could not read, such as invalid JSON (`422` with code `402`), a server error (`500` or more), and a network failure. Code that read the list's first entry reads PostHog's result instead: its `ErrorCode` check becomes a check for PostHog's error, and its `MessageID` becomes PostHog's message id. A site that never read the entry went on after a refused message, and failed on every other error. Keep both: catch PostHog's error, log it and go on when its name is `validation_error`, which covers `recipient_suppressed`, and raise or return every other error the way the batch call did, as "Errors" says.

**The answer.** The message id of a moved send is PostHog's. Code that logged `MessageID` (`message_id`, `getMessageID()`), or stored it for the app's own use, takes PostHog's message id instead.

**The Postmark client.** Postmark's packages serve Postmark only, but each one also calls Postmark's other APIs, such as templates, suppressions, bounces, and the account API (`sdk-reference.md` lists them under "Other APIs"), and `postmark-rails` needs the `postmark` gem. Keep the package for any such call or mailer. A call that adds addresses to the `outbound` suppressions, `POST /message-streams/outbound/suppressions` or the SDK's call for it, stops only Postmark's sends: an address it adds after the import still gets the moved sends. List it under other calls, and add to the report's "Before cutover" that the person makes that call write to both lists before the deploy: it keeps its Postmark write and also adds the address to PostHog's suppression list. A call that reactivates an address, `POST /message-streams/outbound/suppressions/delete` or the SDK's call for it, works the same way: it also removes the address from PostHog's suppression list where Step 5 allows it, or PostHog keeps refusing the moved sends to it. The Postmark write stays while any send of that server still goes through Postmark, such as a site that stays or a mailer, and goes only once the last of them moves. Keep the Postmark client, its import, and its token while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its token: the person removes them after the cutover.
