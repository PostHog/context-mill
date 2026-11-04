# Brevo to PostHog mapping

This file decides, field by field, whether PostHog can send a Brevo call site. A site moves only when every field it sets moves. Otherwise it stays on Brevo, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python. Brevo fields are written in their HTTP names, such as `htmlContent`: `sdk-reference.md` gives them in each SDK.

## Fields

| Brevo | PostHog | A site stays on Brevo when |
|---|---|---|
| `sender` `{ email, name }` | `from` | Never. It becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `sender` `{ id }` | none | Always: the code names a sender saved in Brevo, not an address |
| `sender` with a `name` and no `email` or `id` | none | Always: the address comes from Brevo, not the code |
| `to` | `to` | It holds more than one entry. A list with one entry moves as that entry's address: note in the plan row when the entry carries a name, because the To line loses it |
| `subject` | `subject` | Never |
| `htmlContent`, `textContent` | `html`, `text` | Never, unless `params` is set too (see below) |
| `params` without `templateId` | none | Always: Brevo fills `{{ params.NAME }}` into the send's own content, and PostHog sends the content as it is |
| `templateId` with `params` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" |
| `cc`, `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. An entry's name is lost, as for `to` |
| `replyTo` | `replyTo` | It carries a `name` |
| `contactPixelTrackingConsent`, set to `true` or `false`, or `removeTrackingPixel: true`, on a `to`, `cc`, or `bcc` entry | none | Always, `false` included: with per-contact tracking consent on, `false` makes Brevo count the recipient's opens and clicks without tying them to the recipient. PostHog's send doesn't take a tracking setting per recipient yet |
| Open and click tracking, which the send leaves to the account | `captureEngagement: false`, or no field | See "Tracking" below |
| `attachment` with `content` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `attachment` with `url` | none | Always. PostHog takes file content only, and a file behind a URL can't be checked for size here |
| `headers` with `idempotencyKey` (or `IdempotencyKey`) only | `idempotencyKey` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. A key built from a value whose length or characters the code doesn't bound, such as a URL or text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site. Brevo keeps a key for 15 minutes, and PostHog keeps it for 24 hours. A key the code can send again for another email within 24 hours, such as one built only from a user id and the email's kind, keeps the site too: PostHog would send no new email for it, or refuse it with `idempotency_key_reused` |
| `headers`, any other header | none | Always: no PostHog SDK takes headers yet |
| `tags` | none | Always: no PostHog SDK takes tags yet |
| `scheduledAt` | none | Always. PostHog's send doesn't take it yet |
| `batchId` | none | Always. PostHog's send doesn't take it yet |
| `messageVersions` | none | Always: it sends several emails in one call |

A Brevo send without an idempotency key moves without one.

**Tracking.** PostHog captures opens and clicks on the person the send names, unless the send sets `captureEngagement: false`, which turns off both. Brevo tracks a transactional send's opens and clicks per recipient, unless an account setting changes that. Ask the person for those settings once, as `account.md` says under "Tracking settings", and work out what Brevo did for a send that sets no `contactPixelTrackingConsent`:

- Anonymous tracking and per-contact tracking consent both off, and Brevo tracked opens and clicks: the site moves with no `captureEngagement` field.
- Anonymous tracking on: the site stays, and the reason is `account tracking anonymized`. Brevo counted opens and clicks without tying them to a recipient, and PostHog's send either ties them to the person or captures none.
- Per-contact tracking consent on: the site stays, and the reason is `per-contact tracking consent on`. Brevo tracked a recipient only as their consent said, and PostHog's send doesn't take a consent per recipient yet.
- Brevo turned off both open and click tracking for the account: the site moves with `captureEngagement: false`. A template site stays, and so does a site whose installed SDK has no `captureEngagement`: the reason is `account tracking off`.
- Brevo turned off one of them and not the other: the site stays, because `captureEngagement: false` turns off both.
- The person can't say: the site stays, and the reason is `account tracking not checked`.

## Calls

| Brevo call | A site stays on Brevo when |
|---|---|
| `transactionalEmails.sendTransacEmail`, `TransactionalEmailsApi.sendTransacEmail`, `send_transac_email`, `SendTransacEmail`, `SendTransacEmailAsync`, `POST /v3/smtp/email` | A field above keeps it |
| A send with `messageVersions`, or with more than one entry in `to` | Always |
| A loop that sends one email per address | Never for the call itself: each call is one send. Keep the loop |
| SMTP through `smtp-relay.brevo.com` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A framework mailer (Django Anymail, Symfony Mailer, Swoosh), or a delivery method the app registers with Rails ActionMailer that sends through Brevo | Always. PostHog has no mailer driver |
| .NET `SendTransacEmail`, the sync send | As `posthog-sdks.md` says for a synchronous .NET send |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Every Brevo SDK reports an API error by throwing, except Go, which answers an error value. `sdk-reference.md` names each SDK's error and its fields. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Brevo when |
|---|---|
| A `catch`, `except`, or `rescue` that reads the error's status, such as `err.statusCode`, `e.status_code`, `e.status`, `getCode()`, `code`, or `ErrorCode` | Never. A check of `400` or `422` reads PostHog's error name `validation_error`, and a check of any other status reads PostHog's status code |
| A branch on a Brevo error class, such as `Brevo.TooManyRequestsError` or `Brevo.BadRequestError` | Never. `BadRequestError` (400) and `UnprocessableEntityError` (422) become a branch on PostHog's error name `validation_error`. The others become a branch on PostHog's status code: `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `TooManyRequestsError` 429 |
| A retry or a wait on `429` or `TooManyRequestsError` | Never. Keep it. It now runs when PostHog's error has the status code `429` and a code other than `quota_limited`: PostHog answers a used-up quota with `429` and `quota_limited`, and no retry clears it. PostHog's SDK already retries a rate limit twice inside each send: note that in the plan row |
| A branch on Brevo's error `code` or `message` text, such as `invalid_parameter` | Always |
| A check of an HTTP status, such as `res.ok`, `res.status`, or Go's `resp.StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| The `messageId` stored for a webhook or a status read | Always, when a webhook handler or a status read uses it |
| The `messageId` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Brevo template, makes it transactional, and gives you its template ID. Until then the site stays on Brevo. The check needs the template's content, because the code has only its id. `account.md` says how to get it.

Brevo's template language becomes Liquid in the PostHog template. Values move from `params` to `variables`, and each name keeps its case:

| Brevo | PostHog |
|---|---|
| `{{ params.name }}` | `{{ variables.name }}` |
| `{{ params.user.first_name }}` | `{{ variables.user.first_name }}` |
| `{{ params.items.0.name }}` | `{{ variables.items[0].name }}` |
| `{% if params.paid %}…{% elif params.due %}…{% else %}…{% endif %}`, when `paid` and `due` are booleans | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{% if not params.paid %}…{% endif %}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{% if params.plan == "pro" %}`, and `!=` the same way | `{% if variables.plan == 'pro' %}`, with the string in single quotes |
| `>`, `<`, `>=`, `<=` in a condition, when both sides are always numbers | the same |
| `and` or `or` in a condition, when it uses only one of the two, and each side is a comparison or a value that is always a boolean, `null`, or missing | the same |
| `{% for item in params.items %}{{ item.name }}{% endfor %}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{% for item in params.items reversed %}`, when `items` is a list | `{% for item in variables.items reversed %}` |
| `{{ forloop.Counter }}`, `{{ forloop.Counter0 }}` | `{{ forloop.index }}`, `{{ forloop.index0 }}` |
| `{% if forloop.First %}`, `{% if forloop.Last %}` | `{% if forloop.first %}`, `{% if forloop.last %}` |
| `{{ params.name\|default:"there" }}`, when `name` is always a string, `null`, or missing | `{{ variables.name \| default: 'there' }}` |
| `{{ params.name\|upper }}`, `{{ params.name\|lower }}` | `{{ variables.name \| upcase }}`, `{{ variables.name \| downcase }}` |
| The template's subject | The PostHog template's subject, with the same conversions |
| The template's sender and reply-to address | The PostHog template's sender and reply-to address |

Write the `\|` above as a plain `|`. The table escapes it.

- Brevo's `if` treats `0`, an empty string, an empty list, and an empty object as false, and Liquid treats them as true. Read what the site sends for each value that a condition tests on its own: after `if`, `elif`, or `if not`, or on one side of `and` or `or`, such as `count` in `{% if params.count and params.paid %}`. A value that is not always a boolean, `null`, or missing keeps the template on Brevo.
- Brevo's `for` also walks the keys of an object. A `for` over a value that is not always a list keeps the template on Brevo.
- Brevo compares with `>`, `<`, `>=`, and `<=` as numbers, and turns a string such as `"10"` into a number first. Liquid compares two strings by their characters. A comparison whose sides are not always numbers keeps the template on Brevo.
- Brevo takes parentheses in a condition. Liquid takes none, and checks `and` and `or` from right to left, so a condition that mixes them can group differently. A condition that mixes `and` and `or`, or uses parentheses, keeps the template on Brevo. So does `not` anywhere but at the start of `{% if not … %}`, such as `{% elif not … %}` or `not` next to `and` or `or`.
- Any other tag, such as `{% empty %}`, `{% set %}`, `{% with %}`, or `{% include %}`, keeps the template on Brevo.
- `{{ contact.ATTRIBUTE }}` reads a contact saved in Brevo. A PostHog send has no contact to read, so a template that uses it stays on Brevo. So does a template with `{{ feed.… }}`, `{{ time_now }}`, `{{ mirror }}`, `{{ unsubscribe }}`, `{{ update_profile }}`, `{{ revoke_open_pixel_tracking }}`, or `{{ doubleoptin }}`, and a template whose `toField` reads a contact attribute.
- Any other filter, such as `|safe`, `|date`, `|floatformat`, `|capfirst`, `|title`, `|truncatechars`, `|lang_format`, `|time_parse`, `|base64_encode`, or `|aes_256`, keeps the template on Brevo. So does a condition with `in`, and `forloop.Revcounter`.
- PostHog's Liquid escapes HTML in a value. When the code passes a value that holds HTML markup, such as a block of rendered rows, the template stays on Brevo.
- A template in Brevo's old template language reads no `params`. When its placeholders are not `{{ … }}` and `{% … %}`, it stays.
- Brevo's `default` replaces every value its `if` treats as false, such as `0`. Liquid's `default` doesn't replace `0`. A `default` on a value that is not always a string, `null`, or missing keeps the template on Brevo.
- A Brevo template has no plain text part. The PostHog template takes its HTML, and no text the person didn't write.
- A template's `tag` is not carried over. When the template has a tag and a webhook handler reads `tags` back, the site stays. When it has a tag and no handler reads it, note in the plan row that the tag is lost.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `sender`, `replyTo`, or `subject` next to `templateId` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc`, `bcc`, `attachment`, or a recipient's tracking setting next to `templateId` stays: a template made in PostHog sends with its own settings, and the template form takes none of them. A template site moves only when Brevo tracked its opens and clicks per recipient, as "Tracking" says: the template form takes no `captureEngagement`.
- A Brevo template can carry its own attachment, added in its advanced options. The send doesn't name it, and `account.md` says how to find it. A template with an attachment keeps the site on Brevo.

## Webhooks

A Brevo webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Brevo event | PostHog event |
|---|---|
| `request` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `hard_bounce` | `$workflows_email_bounced` |
| `spam` | `$workflows_email_blocked` |
| `opened`, `unique_opened` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked` |
| `blocked`, `invalid_email` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `soft_bounce`, `deferred`, `unsubscribed`, `proxy_open`, `unique_proxy_open` | none |

PostHog's events carry no Brevo `message-id`, no `tags`, and no `X-Mailin-custom`. A site whose events a handler matches by message id, by a tag, or by `X-Mailin-custom` stays on Brevo. For every other handler, such as one that matches by the recipient's address, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'brevo'` on the client that Step 7 configures, when its client options take it.

**The call.** The Brevo send becomes one PostHog send. Build its fields from the message the site built:

- Node.js `sendTransacEmail({...})`, or a `SendSmtpEmail` whose properties the code sets: its fields.
- Python `send_transac_email(...)` keyword arguments, or `SendSmtpEmail(...)`: the same fields.
- PHP `new SendTransacEmailRequest([...])`, or a `SendSmtpEmail` and its setters: the same fields.
- Ruby `Brevo::SendSmtpEmail.new(...)`, Go `brevo.SendSmtpEmail{...}`, and .NET `new SendSmtpEmail(...)`: the same fields.
- A raw HTTP body: the same fields.

**The fields.**

- `sender: { email: 'hello@mail.example.com', name: 'Example' }` becomes `from: 'Example <hello@mail.example.com>'`. A name with a comma, a quote, or another special character goes in double quotes, such as `'"Example, Inc." <hello@mail.example.com>'`, with a quote in the name escaped as `\"`. A `sender` without a name becomes the bare address.
- `to: [{ email, name }]` becomes `to: email`. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `cc` and `bcc` become lists of bare addresses.
- `replyTo: { email }` becomes `replyTo: email`.
- `htmlContent` becomes `html`, and `textContent` becomes `text`.
- An attachment `{ content, name }` becomes `{ content, filename: name }`. In Node.js and Python, `content` stays the same base64 string. In Go and Elixir, the SDK takes the raw file: decode the base64 string first, as `posthog-sdks.md` says, or the recipient gets the file encoded twice. A Brevo attachment carries no type: set `contentType` from the file name's extension, such as `application/pdf` for `.pdf`.
- `headers: { idempotencyKey: key }` becomes `idempotencyKey: key`.
- The send gets `captureEngagement: false` when Brevo tracked neither opens nor clicks for the account, as "Tracking" says. Note it in the plan row.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `params`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them. Brevo's `templateId` is a number and PostHog's is a UUID string: never reuse the Brevo number.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Brevo send threw into a `catch`, throw from the error so the same `catch` runs, and keep each property the `catch` reads, with PostHog's status code in it: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name, code: error.code })`. A network failure has no status: `err.code` is `network_error` then. Name the status the way the old error did: `statusCode` for `@getbrevo/brevo` and `sib-api-v3-typescript`, `response: { statusCode: error.statusCode }` where the `catch` reads `err.response.statusCode`, as with `@sendinblue/client` and the `HttpError` of `@getbrevo/brevo` 1.x to 3.x, and `status` for `sib-api-v3-sdk`. A read of `err.body` or `err.response.body` becomes a read of `err.message`. A check of `400` or `422`, or an `instanceof` branch on `Brevo.BadRequestError` or `Brevo.UnprocessableEntityError`, becomes a check of `err.name === 'validation_error'`. An `instanceof` branch on another Brevo error class becomes a check of its status code, from the table under "Code around the send". When the `catch` handled only that class or status and threw the rest again, it keeps doing so: never widen it. A raw HTTP site that threw on `!res.ok` throws on `error` the same way.
- **Python.** PostHog's SDK raises too. Replace `except ApiError` (or `ApiException`) with the PostHog exception `posthog-sdks.md` names, and `e.status_code` (or `e.status`) with its status code. A read of `e.body` becomes a read of its message. Brevo's Python errors cover only its answers: a network failure raised the HTTP library's error past them. PostHog's exception covers both, so raise it again first when its code is `network_error`. A catch of one Brevo error class, or an `except` that handles one status, becomes a catch of the PostHog exception that checks for the same kind of error, and raises every other error again: `429` (`TooManyRequestsError`) checks the status code, and `400` or `422` (`BadRequestError`, `UnprocessableEntityError`) checks the name `validation_error`, as Step 7 says.
- **PHP, Ruby, and .NET.** PostHog's SDK throws too. Replace the Brevo exception in the `catch` or `rescue` with PostHog's, and the status read (`getCode()`, `code`, `ErrorCode`) with its status code. A `catch` or `rescue` that handled one status checks for the same kind of error, and throws or raises every other error again: a branch on `400` or `422` reads PostHog's error name `validation_error` (`getErrorName()`, `name`, `Name`), and a branch on another status, such as 429, reads PostHog's status code.
- **Go.** `err` stays the error to check. A check of `resp.StatusCode` becomes a check of `err`: a status of 400 or more becomes "there is an error", a branch on `400` or `422` reads `Name` (`validation_error`) from the `*posthog.EmailError` with `errors.As`, and a branch on another status, such as 429, reads its `StatusCode`. Every other error goes back the way it did before, such as returned to the caller.
- **A raw HTTP request.** It failed the way its client does, with the options the code gives it. These threw on a refused send: `axios` unless `validateStatus` accepts a failed status, `got` and `ky` unless `throwHttpErrors: false`, Guzzle unless `'http_errors' => false`, Faraday with `raise_error`, `requests` or `httpx` followed by `raise_for_status()`, and .NET `HttpClient` followed by `EnsureSuccessStatusCode()`. Their sites fail on every PostHog error, as the bullet for the language says, and a read of the client's status, such as axios's `err.response.status`, reads PostHog's status code. `fetch`, `requests`, `httpx`, Ruby `Net::HTTP`, Go `net/http`, PHP `curl_exec`, and .NET `HttpClient` without `EnsureSuccessStatusCode()` answered a refused send as a response. A site on one of them that never read the status logs PostHog's error and goes on, and raises or returns it when its code is `network_error`, as Step 7 says. Note each such site in the report.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged Brevo's `messageId`, or stored it for the app's own use, takes PostHog's message id instead.

**The Brevo client.** Keep the Brevo client, its import, and the line that sets its key while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover. Each Brevo SDK also serves Brevo's other APIs, such as contacts, email campaigns, SMS, WhatsApp, and CRM (`sdk-reference.md`, "Other APIs"). While any code calls one of them, or imports or re-exports the Brevo client for another part of the app, the package and its key stay after the cutover too.
