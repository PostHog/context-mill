# Brevo to PostHog mapping

This file decides, field by field, whether PostHog can send a Brevo call site. A site moves only when every field it sets moves. Otherwise it stays on Brevo, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python. Brevo fields are written in their HTTP names, such as `htmlContent`: `sdk-reference.md` gives them in each SDK.

## Fields

| Brevo | PostHog | A site stays on Brevo when |
|---|---|---|
| `sender` `{ email, name }` | `from` | Never. It becomes `'Name <email>'`. It needs a verified sender (Step 4) |
| `sender` `{ id }` | none | Always: the code names a sender saved in Brevo, not an address |
| `to` | `to` | It holds more than one entry. A list with one entry moves as that entry's address: note in the plan row when the entry carries a name, because the To line loses it |
| `subject` | `subject` | Never |
| `htmlContent`, `textContent` | `html`, `text` | Never, unless `params` is set too (see below) |
| `params` without `templateId` | none | Always: Brevo fills `{{ params.NAME }}` into the send's own content, and PostHog sends the content as it is |
| `templateId` with `params` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" |
| `cc`, `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. An entry's name is lost, as for `to` |
| `replyTo` | `replyTo` | It carries a `name` |
| `attachment` with `content` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `attachment` with `url` | none | Always. PostHog takes file content only, and a file behind a URL can't be checked for size here |
| `headers` with `idempotencyKey` (or `IdempotencyKey`) only | `idempotencyKey` | Never |
| `headers`, any other header | `headers` | The installed SDK has no `headers`, there are more than 10, or a webhook handler reads `X-Mailin-custom` back (see "Webhooks") |
| `tags` | `tags`, `{ name: 'tag', value: <tag> }` | The installed SDK has no `tags`, the site sets more than one tag, or a webhook handler reads `tags` back. PostHog tags are name and value pairs, not a list of labels |
| `scheduledAt` | none | Always |
| `batchId` | none | Always |
| `messageVersions` | none | Always: it sends several emails in one call |

A Brevo send without an idempotency key moves without one. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Brevo call | A site stays on Brevo when |
|---|---|
| `transactionalEmails.sendTransacEmail`, `TransactionalEmailsApi.sendTransacEmail`, `send_transac_email`, `SendTransacEmail`, `SendTransacEmailAsync`, `POST /v3/smtp/email` | A field above keeps it |
| A send with `messageVersions`, or with more than one entry in `to` | Always |
| A loop that sends one email per address | Never for the call itself: each call is one send. Keep the loop |
| SMTP through `smtp-relay.brevo.com` | Always. PostHog has no SMTP relay |
| A framework mailer (Django Anymail, Symfony Mailer, Swoosh) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Every Brevo SDK reports an API error by throwing, except Go, which answers an error value. `sdk-reference.md` names each SDK's error and its fields. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Brevo when |
|---|---|
| A `catch`, `except`, or `rescue` that reads the error's status, such as `err.statusCode`, `e.status_code`, `e.status`, `getCode()`, `code`, or `ErrorCode` | Never. Read PostHog's status code |
| A branch on a Brevo error class, such as `Brevo.TooManyRequestsError` or `Brevo.BadRequestError` | Never. It becomes a branch on PostHog's status code: `BadRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `UnprocessableEntityError` 422, `TooManyRequestsError` 429 |
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
| `{% if params.paid %}…{% elif params.due %}…{% else %}…{% endif %}` | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{% if not params.paid %}…{% endif %}` | `{% unless variables.paid %}…{% endunless %}` |
| `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or` in a condition | the same |
| `{% for item in params.items %}{{ item.name }}{% endfor %}` | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{% for item in params.items reversed %}` | `{% for item in variables.items reversed %}` |
| `{{ forloop.Counter }}`, `{{ forloop.Counter0 }}` | `{{ forloop.index }}`, `{{ forloop.index0 }}` |
| `{% if forloop.First %}`, `{% if forloop.Last %}` | `{% if forloop.first %}`, `{% if forloop.last %}` |
| `{{ params.name\|default:"there" }}` | `{{ variables.name \| default: 'there' }}` |
| `{{ params.name\|upper }}`, `{{ params.name\|lower }}` | `{{ variables.name \| upcase }}`, `{{ variables.name \| downcase }}` |
| The template's subject | The PostHog template's subject, with the same conversions |
| The template's sender and reply-to address | The PostHog template's sender and reply-to address |

Write the `\|` above as a plain `|`. The table escapes it.

- `{{ contact.ATTRIBUTE }}` reads a contact saved in Brevo. A PostHog send has no contact to read, so a template that uses it stays on Brevo. So does a template with `{{ feed.… }}`, `{{ time_now }}`, `{{ mirror }}`, `{{ unsubscribe }}`, `{{ update_profile }}`, or `{{ doubleoptin }}`, and a template whose `toField` reads a contact attribute.
- Any other filter, such as `|safe`, `|date`, `|floatformat`, `|capfirst`, `|title`, `|truncatechars`, `|lang_format`, `|time_parse`, `|base64_encode`, or `|aes_256`, keeps the template on Brevo. So does a condition with `in`, and `forloop.Revcounter`.
- PostHog's Liquid escapes HTML in a value. When the code passes a value that holds HTML markup, such as a block of rendered rows, the template stays on Brevo.
- A template in Brevo's old template language reads no `params`. When its placeholders are not `{{ … }}` and `{% … %}`, it stays.
- Liquid's `default` also replaces an empty string. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- A Brevo template has no plain text part, so the PostHog template has HTML only.
- The template's `tag` is not carried over. When a webhook handler reads `tags` back, the site stays. Otherwise note in the plan row that the tag is lost.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `sender`, `replyTo`, or `subject` next to `templateId` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc`, `bcc`, `attachment`, `headers`, or `tags` next to `templateId` stays: a template made in PostHog sends with its own settings.

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

- `sender: { email: 'hello@mail.example.com', name: 'Example' }` becomes `from: 'Example <hello@mail.example.com>'`. A `sender` without a name becomes the bare address.
- `to: [{ email, name }]` becomes `to: email`. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `cc` and `bcc` become lists of bare addresses.
- `replyTo: { email }` becomes `replyTo: email`.
- `htmlContent` becomes `html`, and `textContent` becomes `text`.
- An attachment `{ content, name }` becomes `{ content, filename: name }`. `content` stays the same base64 string in Node.js and Python. In Go, decode it into `[]byte` first, as `posthog-sdks.md` says. A Brevo attachment carries no type: set `contentType` from the file name's extension, such as `application/pdf` for `.pdf`.
- `headers: { idempotencyKey: key }` becomes `idempotencyKey: key`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `params`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them. Brevo's `templateId` is a number and PostHog's is a UUID string: never reuse the Brevo number.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Brevo send threw into a `catch`, throw from the error so the same `catch` runs, and keep the property the `catch` reads: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode })` for `@getbrevo/brevo`, or `{ status: error.statusCode }` for `sib-api-v3-sdk`. A read of `err.body` or `err.response.body` becomes a read of `err.message`. An `instanceof` branch on a Brevo error class becomes a check of that status code, from the table under "Code around the send". A raw HTTP site that threw on `!res.ok` throws on `error` the same way.
- **Python.** PostHog's SDK raises too. Replace `except ApiError` (or `ApiException`) with the PostHog exception `posthog-sdks.md` names, and `e.status_code` (or `e.status`) with its status code. A read of `e.body` becomes a read of its message.
- **PHP, Ruby, and .NET.** PostHog's SDK throws too. Replace the Brevo exception in the `catch` or `rescue` with PostHog's, and the status read (`getCode()`, `code`, `ErrorCode`) with its status code.
- **Go.** `err` stays the error to check. A check of `resp.StatusCode` becomes a check of `err`: a status of 400 or more becomes "there is an error", and a branch on one status, such as 429, reads `StatusCode` from the `*posthog.EmailError` with `errors.As`.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged Brevo's `messageId`, or stored it for the app's own use, takes PostHog's message id instead.

**The Brevo client.** Keep the Brevo client, its import, and the line that sets its key while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
