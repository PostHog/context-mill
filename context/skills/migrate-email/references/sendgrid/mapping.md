# SendGrid to PostHog mapping

This file decides, field by field, whether PostHog can send a SendGrid call site. A site moves only when every field it sets moves. Otherwise it stays on SendGrid, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

## Fields

| SendGrid | PostHog | A site stays on SendGrid when |
|---|---|---|
| `from` | `from` | Never. `{ email, name }` becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `to` | `to` | It holds more than one address. A list with one entry moves as that entry. `{ email, name }` moves as the bare address: note in the plan row that the To line loses the name |
| `subject` | `subject` | Never |
| `text`, `html` | `text`, `html` | Never |
| `content` | `text` for `text/plain`, `html` for `text/html` | It holds another type, or two entries of one type |
| `templateId` with `dynamicTemplateData` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates". A legacy template, whose id has no `d-` prefix, always stays |
| `substitutions` | none | Always. PostHog's send doesn't take it yet |
| `cc`, `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `{ email, name }` moves as the bare address, as for `to` |
| `replyTo`, `replyToList` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, a `disposition` is `inline` without a `contentId`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `headers` | none | Always: no PostHog SDK takes headers yet |
| `customArgs` | none | Always: no PostHog SDK takes tags yet |
| `categories` | none | Always: no PostHog SDK takes tags yet |
| No `trackingSettings` | `captureEngagement: false` when open or click tracking is off in the account, as `account.md` says under "Tracking" | The installed SDK has no `captureEngagement` and tracking is off in the account |
| `trackingSettings` that turns `openTracking` or `clickTracking` off | `captureEngagement: false` | The installed SDK has no `captureEngagement`, or the settings do anything else, such as `subscriptionTracking` or `ganalytics`. `false` turns off both open and click capture: note it in the plan row |
| `sendAt` / `send_at` | none | Always. PostHog's send doesn't take it yet |
| `batchId` / `batch_id` | none | Always. PostHog's send doesn't take it yet |
| `asm` | none | Always: PostHog has no unsubscribe groups on a transactional send |
| `ipPoolName` / `ip_pool_name` | none | Always. PostHog's send doesn't take it yet |
| `mailSettings` / `mail_settings` | none | Always. Sandbox mode is not a send |
| `personalizations` | the fields of its one entry | It holds more than one entry. One entry moves when each field in it moves |

A SendGrid send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| SendGrid call | A site stays on SendGrid when |
|---|---|
| `sgMail.send(msg)`, `SendGridAPIClient.send`, `sg.client.mail._('send').post`, `$sendgrid->send`, `client.Send`, `SendEmailAsync`, `POST /v3/mail/send` | A field above keeps it |
| `sgMail.send(msg, true)`, `sgMail.sendMultiple`, `sgMail.send([...])`, `Mail(..., is_multiple=True)`, `CreateSingleEmailToMultipleRecipients`, `CreateMultipleEmailsToMultipleRecipients` | Always: each sends several emails in one call |
| SMTP through `smtp.sendgrid.net` | Always. PostHog has no SMTP relay |
| A framework mailer (Django, Rails, Laravel, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

SendGrid's SDKs report an error in two ways. The Node.js and Python SDKs throw. The Ruby, PHP, Go, and .NET SDKs answer a response, and the code reads its status code. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on SendGrid when |
|---|---|
| A `catch` or `except` that reads `err.code`, `err.response.body.errors`, `e.status_code`, or `e.body` | It branches on a SendGrid error text or `field` value. A branch on the HTTP status moves: read PostHog's status code |
| A check of `response.statusCode`, `status_code`, `statusCode()`, or `StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| The `X-Message-Id` header stored for a webhook or a status read | Always, when the Event Webhook or the Email Activity API uses it |
| The `X-Message-Id` header logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A dynamic template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the SendGrid template, makes it transactional, and gives you its template ID. Until then the site stays on SendGrid. The check needs the content of the template's active version, because the code has only its id. `account.md` says how to get it.

SendGrid's Handlebars becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| SendGrid | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{user.first_name}}` | `{{ variables.user.first_name }}` |
| `{{#if paid}}…{{else}}…{{/if}}`, when `paid` is a boolean | `{% if variables.paid %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{this.name}}{{/each}}` or `{{#each items}}{{name}}{{/each}}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{this}}` inside `{{#each items}}` | `{{ item }}` |
| `{{insert name "default=there"}}` | `{{ variables.name \| default: 'there' }}` |
| The version's `subject` | The PostHog template's subject, with the same conversions |

Write the `\|` above as a plain `|`. The table escapes it.

- Handlebars `{{name}}` escapes HTML, and so does PostHog's Liquid, so plain values render the same.
- Handlebars treats `0`, an empty string, and an empty list as false, and Liquid treats them as true. Read what the site sends for each `if` and `unless` value. A value that is not always a boolean, `null`, or missing keeps the template on SendGrid.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on SendGrid.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`.
- `{{{name}}}` inserts HTML as it is. PostHog's Liquid escapes it, so a template that uses triple braces stays on SendGrid.
- Any other helper, such as `{{#equals}}`, `{{formatDate}}`, `{{#greaterThan}}`, `{{length}}`, or `{{#and}}`, keeps the template on SendGrid. So does `{{@index}}`, a partial, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- Liquid's `default` also replaces an empty string. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo`, or `subject` next to `templateId` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc`, `bcc`, `attachments`, or `trackingSettings` next to `templateId` stays: a template made in PostHog sends with its own settings, and the template form takes none of them.

## Webhooks

The Event Webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| SendGrid event | PostHog event |
|---|---|
| `processed` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `bounce` | `$workflows_email_bounced` |
| `spamreport` | `$workflows_email_blocked` |
| `open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked` |
| `dropped` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `deferred`, `unsubscribe`, `group_unsubscribe`, `group_resubscribe` | none |

PostHog's events carry no SendGrid `sg_message_id` and no `custom_args`. A site whose events a handler matches by message id or by a custom arg stays on SendGrid. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'sendgrid'` on the client that Step 7 configures, when its client options take it.

**The call.** The SendGrid send becomes one PostHog send. Build its fields from the message the site built:

- `sgMail.send(msg)`: the fields of `msg`.
- Python `Mail(from_email=, to_emails=, subject=, html_content=, plain_text_content=)` and its setters: `from`, `to`, `subject`, `html`, `text`, and each field a setter sets.
- Ruby `SendGrid::Mail.new(from, subject, to, content)` and its personalization: the same fields.
- PHP `setFrom`, `addTo`, `setSubject`, `addContent`, and the other setters: the same fields.
- Go `mail.NewSingleEmail(from, subject, to, plainText, html)`, or `NewV3Mail` with one personalization: the same fields.
- .NET `MailHelper.CreateSingleEmail(from, to, subject, plainText, html)`, or a `SendGridMessage`: the same fields.
- A raw HTTP body or `@sendgrid/client` request: the fields of its one personalization, `from`, `subject`, and `content`.

**The fields.**

- `{ email: 'hello@mail.example.com', name: 'Example' }` in `from` becomes `'Example <hello@mail.example.com>'`. A `from` without a name becomes the bare address.
- `to`, `cc`, and `bcc` become bare addresses. A list with one entry in `to` becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `content` entries become `text` and `html`.
- An attachment `{ content, filename, type, contentId }` becomes `{ content, filename, contentType: type, contentId }`. Drop `disposition`: `contentId` makes a file inline. In Node.js and Python, `content` stays the same base64 string. In Go and Elixir, the SDK takes the raw file: decode the base64 string first, as `posthog-sdks.md` says, or the recipient gets the file encoded twice.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `dynamicTemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sgMail.send` threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { code: error.statusCode, name: error.name })`. `err.code` keeps holding the HTTP status, and a check of `err.code === 400` becomes a check of `err.name === 'validation_error'`. A read of `err.response.body` becomes a read of `err.message`.
- **Python.** PostHog's SDK raises too. Replace `except HTTPError` with the PostHog exception `posthog-sdks.md` names, and `e.status_code` with its status code. `HTTPError` caught only SendGrid's answers: a network failure raised `URLError` past it. PostHog's exception covers both, so raise it again first when its code is `network_error`. A catch of one subclass becomes a catch of the PostHog exception that checks for the same kind of error, and raises every other error again: `TooManyRequestsError` checks the status code `429`, and `BadRequestsError` checks the name `validation_error`, as Step 7 says.
- **Ruby, PHP, Go, and .NET.** The code read SendGrid's status code. Read PostHog's error the way `posthog-sdks.md` says for the language, and keep each branch: a status of 400 or more becomes "there is an error", a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status, such as 429, reads PostHog's status code. Their SendGrid clients don't raise on a refused send: a site that never read the status went on after one, and only a network failure raised (Ruby, PHP, .NET) or set `err` (Go). Such a site logs PostHog's error and goes on, and raises or returns it when its code is `network_error`, as Step 7 says.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where SendGrid took it and dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `X-Message-Id`, or stored it for the app's own use, takes PostHog's message id instead.

**The SendGrid client.** Keep the SendGrid client, its import, and `setApiKey` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
