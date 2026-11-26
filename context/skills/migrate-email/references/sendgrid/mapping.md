# SendGrid to PostHog mapping

This file decides, field by field, whether PostHog can send a SendGrid call site. A site moves only when every field it sets moves. Otherwise it stays on SendGrid, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python.

## Fields

| SendGrid | PostHog | A site stays on SendGrid when |
|---|---|---|
| `from` | `from` | Never. `{ email, name }` becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character, and each `\` and `"` inside those quotes escaped with a `\`, such as `"Jane \"JJ\" Doe" <email>`. It needs a verified sender (Step 4) |
| `to` | `to` | It holds more than one address. A list with one entry moves as that entry. `{ email, name }` moves as the bare address: note in the plan row that the To line loses the name, unless the name is the address itself |
| `subject` | `subject` | Never |
| `text`, `html` | `text`, `html` | Never |
| `content` | `text` for `text/plain`, `html` for `text/html` | It holds another type, or two entries of one type |
| `templateId` with `dynamicTemplateData` | the template's email, brought into the code and rendered with `dynamicTemplateData`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates". A legacy template, whose id has no `d-` prefix, always stays |
| `cc`, `bcc` | none | Always. PostHog's send doesn't take it yet |
| `replyTo`, `replyToList` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A site that sets `replyToList` also stays when the installed client doesn't show that it sends it as `reply_to_list`, as `sdk-reference.md` says under "Send fields" |
| `attachments` | `attachments` | Step 3 says so under "Files", or "Attachments" below keeps a file there. See "Attachments" |
| `headers` | none | Always: no PostHog SDK takes headers yet |
| `customArgs` | none | Always: no PostHog SDK takes tags yet |
| `categories` | none | Always: no PostHog SDK takes tags yet |
| No `trackingSettings` | none, as "Open and click tracking" says | Opens and clicks follow the account, as "Open and click tracking" below and `account.md` under "Tracking" say |
| `trackingSettings` with `openTracking` or `clickTracking` | none, as "Open and click tracking" says | Opens and clicks follow "Open and click tracking" below. It stays when the settings do anything else, such as `subscriptionTracking`, `ganalytics`, or an `openTracking` `substitutionTag`: PostHog never fills the tag, so it would stay in the email as text |
| `sendAt` / `send_at` | none | Always. PostHog's send doesn't take it yet |
| `batchId` / `batch_id` | none | Always. PostHog's send doesn't take it yet |
| `asm` | none | Always: PostHog has no unsubscribe groups on a transactional send |
| `ipPoolName` / `ip_pool_name` | none | Always. PostHog's send doesn't take it yet |
| `mailSettings` / `mail_settings` | none | Always. Sandbox mode is not a send |
| `personalizations` | the fields of its one entry. An entry's own `from` or `subject` takes the place of the send's, as the [Mail Send reference](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) says such values override the message's | It holds more than one entry. One entry moves when each field in it moves |

**Open and click tracking.** No SendGrid field maps directly in the call to PostHog's tracking: Step 7 sets `tracking` from the plan, as it says under "Sensitive emails and tracking", and never writes the deprecated `captureEngagement` field. SendGrid decides opens and clicks one at a time. Each of `openTracking` and `clickTracking` that the send's `trackingSettings` sets with a fixed `enable` decides for itself, whatever the account's setting is: a fixed `openTracking` with `enable: false` means no pixel. Each of the two that the send doesn't set follows the account's setting, even when the send sets the other, as `account.md` says under "Tracking". When an `enable` changes from send to send, Step 3 decides, as it says under "Opens the provider didn't track".

- Opens: `account.md` says under "Tracking" which sites' emails had no open pixel, and for which nobody can tell. Those sites move with opens off, as Step 3 says under "Opens the provider didn't track". Never ask the person whether PostHog may add its pixel.
- Clicks: Step 7 marks every code send sensitive and never turns `clicks` on, so PostHog counts no clicks for a code send. When SendGrid tracked a moved site's clicks, or nobody knows whether it did, note in the plan row that PostHog counts no clicks for it, unless it moves to a template made in PostHog that is not marked sensitive. When SendGrid didn't track them, or nobody knows, as `account.md` says under "Tracking", a site that moves to a template made in PostHog follows Step 3 under "A template in PostHog".

**Account mail settings.** SendGrid's subscription tracking, Google Analytics, Legacy Email Template, and Footer settings change a send that sets no field for them. `account.md` says under "Mail settings" which sites they keep on SendGrid, and how a moved site keeps the footer.

## Attachments

What SendGrid's docs say about files:

- The [Mail Send reference](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) takes a send's files in `attachments`, a list of `{ content, type, filename, disposition, content_id }`. `content`, the file's bytes as a Base64 string, and `filename` are required. `disposition` is `attachment` or `inline`, and `attachment` when the file sets none. `content_id` is used when the disposition is `inline` and the file is an image, so that the body of the email shows it. The request carries each file's bytes and takes no URL for a file, so SendGrid fetches no file.
- The same page's samples set a file in every SDK, each with `content` as a Base64 string: Node.js `attachments: [{ content, filename, type, disposition }]`, Python `message.attachment = [Attachment(file_content=FileContent(...), file_name=FileName(...), file_type=FileType(...), disposition=Disposition(...))]`, Ruby `Attachment.new` with `content`, `filename`, `type`, and `disposition`, then `mail.add_attachment(...)`, PHP `new Attachment()` with `setContent`, `setFilename`, `setType`, and `setDisposition`, then `$mail->addAttachment(...)`, Go `mail.NewAttachment()` with `SetContent`, `SetFilename`, `SetType`, and `SetDisposition`, then `m.AddAttachment(...)`, and .NET `message.Attachments` with `new Attachment() { Content, Filename, Type, Disposition }`.
- The [Mail Send overview](https://www.twilio.com/docs/sendgrid/api-reference/mail-send) takes an email of less than 30 MB with its files, and sets no limit on how many.
- A [dynamic template version](https://www.twilio.com/docs/sendgrid/api-reference/transactional-templates-versions/create-a-new-transactional-template-version) holds a subject, HTML, and plain text, and no files, so a template site's files come only from its send.

They don't say what an SDK sends for a file the code gives it in another form than a Base64 string, such as raw bytes, a stream, or a path, or which content type SendGrid gives a file that sets none. For those, read the installed client, as `sdk-reference.md` says under "The installed client", and name the file you read in the site's plan row. A site that sends files moves as one entry of PostHog's `attachments` per file, under the PostHog SDK's names, as its rewrite file gives them, after Step 3's checks under "Files":

| SendGrid | PostHog |
|---|---|
| `filename` | The filename. SendGrid requires one, so every file has one. Step 3 says under "Files" which filenames PostHog refuses |
| `content`, a Base64 string | The content, as the string's decoded bytes, in the form of bytes the rewrite file gives: every PostHog SDK takes bytes. Decode it so that line breaks are skipped, since the string can hold them, as Python's `base64.encodebytes` and Ruby's `Base64.encode64` write: in Elixir with `Base.decode64!(s, ignore: :whitespace)`, and in Rust after removing each `\r` and `\n`. Where the code builds the string by encoding bytes it holds, such as `fs.readFileSync(path).toString('base64')`, it may pass those bytes, in the same form of bytes the rewrite file gives, such as `text.b` for a text `String` in Ruby, in place of the decoded string only when nothing changes or reuses them between the encoding and the send |
| `content` in another form, such as raw bytes, a stream, or a path that an SDK's helper takes | The bytes the installed client sends for it: read it for whether it encodes the value, reads the stream or the local file, fetches a URL, or sends the value as it is. A helper that reads a stream or a local file reads it in the app, so SendGrid fetches nothing and Step 3's rule on a fetched file doesn't apply: read the same stream or file at the same point the helper read it, to its end. A helper that fetches a URL keeps the site, with Step 3's reason `the provider fetches <file>`. When it sends the value as it is, the value is the Base64 string of the row above. When the installed client doesn't settle it, the site stays, and the reason is `attachment content not checked` |
| `type` | The content type, as it is: a type with parameters, such as `text/calendar; method=REQUEST`, follows Step 3 under "Files". When the site sets none, read the installed client for a type it fills in, and pass that. When the request carries none, the reference doesn't say what SendGrid sent: set the type the filename's extension names, such as `application/pdf` for `.pdf`, and note `content type set from the filename` in the plan row. When the extension names none, the site stays, and the reason is `a file without a content type` |
| `content_id` on a file whose `disposition` is `inline` | The content ID: the bare ID that the HTML shows with `<img src="cid:...">`, such as `logo` for `cid:logo`. PostHog sends a file with a content ID inline, so the file stays inline. Leave the HTML as it is |
| `disposition` `attachment`, or none | No content ID: PostHog sends a file without one as an attachment, as SendGrid did. A `content_id` on such a file is dropped, since the reference says SendGrid uses it only for an inline file, unless the site's HTML names it with `cid:`. Then the site stays, and the reason is `a content ID on a file sent as an attachment`: the docs don't say whether the email showed it |
| `disposition` `inline` without `content_id` | none. PostHog sends a file without a content ID as an attachment, where SendGrid showed it in the email. The site stays, and the reason is `an inline file without a content ID` |

- **Size and count.** SendGrid takes an email of less than 30 MB with its files, and its docs don't say whether that counts the Base64 encoding, so Step 3's check of PostHog's 40 MB decides each site. Its docs set no count, so Step 3's limit of 10 files still applies.
- **Refused files.** SendGrid's reference lists no file type it refuses. PostHog refuses some, as Step 3 says under "Files".
- **Templates.** A dynamic template site sends its files from the send, and they move with it as above. A template made in PostHog takes no files, as Step 7 says: a site with files that the person wants on such a template stays, and the reason is `a template in PostHog takes no files`.

## Calls

| SendGrid call | A site stays on SendGrid when |
|---|---|
| The sends of SendGrid's quickstarts and Mail Send reference samples: `sgMail.send(msg)`, `send(message)` on a `SendGridAPIClient`, `sg.client.mail.send.post` or `sg.client.mail._('send').post`, `$sendgrid->send`, `client.Send`, `sendgrid.API(request)` with a request to `/v3/mail/send`, `SendEmailAsync`, and `POST /v3/mail/send` | A field above keeps it |
| Any other call of a SendGrid SDK that sends, such as one that takes a list of messages, a flag, or several recipients to send one email to each | When the installed client shows that it sends more than one email, or doesn't settle what it sends: one PostHog send is one email. Otherwise read it for the fields it sends, and follow the table above |
| SMTP through `smtp.sendgrid.net` | Always. PostHog has no SMTP relay |
| A framework mailer (Django, Rails, Laravel, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |
| A send through a SendGrid client the code configures with a setting for every send that can refuse a send or change its fields or content, such as rules on the content | When the installed client shows that the setting refuses or changes a send before any request, such as one whose content matches a rule: PostHog's send has no such check. SendGrid's docs don't describe such settings, so the site also stays when the installed client doesn't settle what one does. The API key, which follows "Subusers" in `account.md`, the host or a data residency, which follow "EU subusers" in `sdk-reference.md`, and a timeout, which follows "HTTP" under "Rewrite", are not such settings |

## Code around the send

SendGrid's docs don't say how each SDK reports an error. Its quickstarts catch an error around the send in [Node.js](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-nodejs) and [PHP](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-php), check `err` in [Go](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-go), and read the status code of the answer in [Python](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-python) and [Ruby](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-ruby), without saying when the send throws. Before the rewrite, read the installed client for what its send does on an API error and on a network error, whether it throws or answers a response with the status, as `sdk-reference.md` says under "The installed client", and the code's own checks, which show what it expected. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on SendGrid when |
|---|---|
| A `catch` or `except` that reads the error's status or body | It branches on a SendGrid error text or `field` value, which the API answers in `{ "errors": [{ "message", "field", "help" }] }`. A branch on the HTTP status moves: read PostHog's status code |
| A check of `response.statusCode`, `status_code`, `statusCode()`, or `StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| The `X-Message-Id` header stored for a webhook or a status read | Always, when the Event Webhook or the Email Activity API uses it |
| The `X-Message-Id` header logged or stored for the app's own use | Never. Use PostHog's message id. When the code after the send can't go on without an id, such as a column that must hold one, the `recipient_suppressed` branch below has none to give: the site stays, and the reason is `needs a message id for a suppressed send`, unless that branch can skip the code that needs it |
| A send the code can cancel: a request with a `signal` a caller passes in or an `AbortController` it aborts, or a Go context or a .NET `CancellationToken` a caller can cancel, given to the send | Unless the PostHog send in that language takes the same cancellation, as Go's `Send(ctx, ...)` and .NET's `SendAsync(..., cancellationToken)` do: pass it there. Otherwise always, as in Node.js, whose send takes no signal: an email the old code cancelled would go out. A fixed deadline moves, as "HTTP" under "Rewrite" says |

## Templates

A dynamic template site moves by bringing the template into the code, as `template-to-code.md` says. The check needs the content of the template's active version, because the code has only its id. `account.md` says how to get it. The code renders the version's HTML, plain text, and subject with the site's `dynamicTemplateData`, and the send sets the rendered `subject`, `html`, and `text`.

SendGrid templates are Handlebars. In the code:

| SendGrid | In the code |
|---|---|
| `{{name}}`, `{{ name }}` | The value, escaped. A missing value renders as nothing |
| `{{user.first_name}}` | The nested value, escaped. A missing step of the path renders as nothing |
| `{{{name}}}` | The value as it is, unescaped, under the rule of `template-to-code.md`. In the subject and the plain text, it is the plain value |
| `{{insert name "default=there"}}`, `{{insert name "there"}}` | The value, escaped, or `there` when the value is missing. When the code can pass `null` or `""` for it, use the fallback for those too, and note it in the plan row: SendGrid's docs don't say what `insert` does with them |
| `{{#if a}}…{{else if b}}…{{else}}…{{/if}}` | A branch that tests each value for Handlebars truth, in order |
| `{{#unless a}}…{{else}}…{{/unless}}` | The same branch, with the test turned around |
| `{{#each items}}…{{else}}…{{/each}}` | A loop over the list, or over the values of an object in key order. The `{{else}}` part shows when there is nothing to walk |
| Inside `{{#each}}`: `{{this}}`, `{{this.name}}`, or a bare `{{name}}` | The current item, or its field. A bare name reads the current item only: when the item has no such field, it renders as nothing, even when a value outside the loop has that name. Only `../name` and `@root.name` read outside the loop |
| Inside `{{#each}}`: `{{@index}}`, `{{@key}}`, `{{@first}}`, `{{@last}}`, `../name`, `@root.name` | The item's position from 0, its key in an object, whether it is the first or the last, and the value one level out or at the top |
| The version's `subject` | The send's `subject`, rendered with the same conversions. SendGrid escapes HTML in a subject too, and a mail client shows the entities as they are, so the subject needs Handlebars' own escape, which the [Handlebars utilities reference](https://handlebarsjs.com/api-reference/utilities.html) says replaces `&`, `<`, `>`, `"`, `'`, `` ` ``, and `=` with their HTML entities, `&` as `&amp;`, as its [expressions guide](https://handlebarsjs.com/guide/expressions.html) shows. The docs don't give the other six entities: write `<` as `&lt;`, `>` as `&gt;`, `"` as `&quot;`, `'` as `&#x27;`, `` ` `` as `&#x60;`, and `=` as `&#x3D;`, and note in the plan row each value that can hold one of those six, since SendGrid may have written its entity differently. Write it as a small function next to the email, never the HTML escape of `template-to-code.md`, which leaves out some of these characters or writes them differently. So `{{name}}` with `A&B` stays `A&amp;B` as SendGrid sent it, and only `{{{name}}}` is the plain value. This is SendGrid's rule, so it takes the place of `template-to-code.md`'s rule never to escape a subject. Note each such value in the plan row. When the version has no subject, the send takes the site's own `subject` as it is. A site whose version has no subject and that sets none stays: PostHog's send needs a subject |
| The version's plain text | The send's `text`, rendered with the same conversions. SendGrid escapes HTML in the plain text too, so the text takes the subject's escape, from the same function: `{{name}}` with `A&B` stays `A&amp;B` as SendGrid sent it, and only `{{{name}}}` is the plain value. This takes the place of `template-to-code.md`'s rule never to escape the text part. Note each such value in the plan row. A version without plain text sends `html` only |

- Handlebars truth: `false`, a missing value, `null`, `""`, `0`, and an empty list are false. Everything else is true, including `"0"`, `"false"`, and an empty object. Write that test out in the code, as `template-to-code.md` says.
- Any other helper, a partial (`{{> name}}`), or an `{{unsubscribe}}`, `{{{unsubscribe}}}`, `{{weblink}}`, or `{{{unsubscribe_preferences}}}` tag that SendGrid fills from the account keeps the template on SendGrid. Such tags come from unsubscribe groups, which a transactional send through PostHog doesn't have.
- A SendGrid template holds no sender, so the send takes the site's own `from` and `replyTo`. A `from` or `replyTo` that holds a `{{` keeps the site on SendGrid, with the reason `placeholder in from or reply-to`: these files don't say whether SendGrid fills it from `dynamicTemplateData`. A site that sets `subject` next to `templateId` moves only when the version has no subject, or when the site's subject is the same in every send as the version's: which one SendGrid sent can't be told from the code. Otherwise it stays.
- Images that the template's editor uploaded to SendGrid have URLs on `marketing-image-production.s3.amazonaws.com` or `mc.sendgrid.com`. Keep them, and list them, as `template-to-code.md` says.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the SendGrid template and gives you its template ID, and makes it transactional once a verified sender covers its address, as Step 3 says. Until they give the ID, the site stays on SendGrid.

An email that carries a login code, a reset link, or another secret needs its PostHog template marked sensitive: PostHog then keeps no copy of each sent email's body or filled-in subject, and sends its links as they are, without its click redirect. Templates are not sensitive by default.

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

- Handlebars `{{name}}` escapes HTML, and so does PostHog's Liquid in the HTML part, so plain values render the same there. The subject and the plain text differ: SendGrid escaped their values too, as the subject and plain text rows of the table for the code say, and PostHog inserts their values as they are. A template whose subject or plain text has a `{{name}}` or `{{insert}}` value that can hold `&`, `<`, `>`, `"`, `'`, `` ` ``, or `=` stays on SendGrid, and the reason is `escaped value in subject or plain text`. Read what the site sends for each.
- Handlebars treats `0`, an empty string, and an empty list as false, and Liquid treats them as true. Read what the site sends for each `if` and `unless` value. A value that is not always a boolean, `null`, or missing keeps the template on SendGrid.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on SendGrid.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`.
- `{{{name}}}` inserts HTML as it is. PostHog's Liquid escapes it, so a template that uses triple braces stays on SendGrid.
- Any other helper, such as `{{#equals}}`, `{{formatDate}}`, `{{#greaterThan}}`, `{{length}}`, or `{{#and}}`, keeps the template on SendGrid. So does `{{@index}}`, a partial, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- Liquid's `default` also replaces an empty string. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo`, or `subject` next to `templateId` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.

## Webhooks

The Event Webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| SendGrid event | PostHog event |
|---|---|
| `processed` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `bounce` | `$workflows_email_bounced` |
| `spamreport` | `$workflows_email_blocked` |
| `open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked`, only when PostHog tracks the email's clicks: for a template made in PostHog that is not marked sensitive and with tracking on, or a code send whose tracking leaves clicks on, as the table in Step 7 under "Sensitive emails and tracking" says. Step 7 marks every code send sensitive and never turns `clicks` on, so its links go out as they are, and PostHog counts no clicks |
| `dropped` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `deferred`, `unsubscribe`, `group_unsubscribe`, `group_resubscribe` | none |

PostHog's events carry no SendGrid `sg_message_id` and no `custom_args`. A site whose events a handler matches by message id or by a custom arg stays on SendGrid. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, such as `dropped` or `deferred`, stays, and the reason is `its <event> events feed a webhook handler`. SendGrid sends `unsubscribe`, `group_unsubscribe`, and `group_resubscribe` only for emails with subscription tracking or `asm`, which keep their sites on SendGrid already, so a handler on those events keeps no other site. A site whose emails a `click` handler acts on stays, and the reason is `its clicks feed a webhook handler`, as Step 3 says under "Opens the provider didn't track".

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'sendgrid'` on the client that Step 7 configures, when its client options take it.

**The call.** The SendGrid send becomes one PostHog send. Build its fields from the message the site built, `attachments` included. A personalization's own `from` or `subject` takes the place of the message's, as the `personalizations` row under "Fields" says.

**The fields.**

- `to` becomes a bare address. A list with one entry becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `attachments` keeps its list, each file rewritten as "Attachments" says.

**HTTP.** A request to `POST /v3/mail/send`, through `fetch`, axios, `requests`, the SendGrid client's own request call, or another HTTP client, becomes the SDK's send in that language, with the fields "The call" names. A site's own deadline is a timeout the code sets on that request, such as `signal: AbortSignal.timeout(5000)` or `requests.post(..., timeout=5)`, or on the SendGrid client it sends through: a timeout option or setting of the client, or of the HTTP library or the HTTP client the code gives it, or a context with a deadline or a token that times out given to the send in Go or .NET. The site keeps that deadline, as Step 7 says under "Set up the client". A timeout the code doesn't set, such as a SendGrid client's own default, is none. SendGrid's docs don't describe a client's timeout options: read the installed client for the HTTP library it hands each one to, as `sdk-reference.md` says under "The installed client", and follow Step 7 for the kind of limit that library sets, naming the file in the plan row. When the installed client doesn't settle which kind of limit an option sets, the site stays, and the reason is `the client's timeout not checked`.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `dynamicTemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sgMail.send` threw into a `catch`, as the installed client and the `catch` around the send show, throw from the error so the same `catch` runs, keeping each read of the `catch`. Where it reads the HTTP status as `err.code`: `if (error) throw Object.assign(new Error(error.message), { code: error.statusCode ?? error.code, name: error.name, posthogCode: error.code })`. `err.code` keeps holding the HTTP status, and holds `network_error` when the request never reached PostHog, `err.posthogCode` holds PostHog's own code, and a check of `err.code === 400` becomes a check of `err.name === 'validation_error'`. A read of the error's response body becomes a read of `err.message`. PostHog's `data` is an object, not the list SendGrid's Node.js send answers, whose first entry the quickstart reads as `response[0].statusCode`: never destructure it as a list, and rewrite each read of the answer, such as `const [response] = await sgMail.send(msg)` or `result[0]`, as "The answer" below says.
- **Python.** PostHog's SDK raises too. When the same `try` also holds a SendGrid call that stays, such as a suppression call, keep each `except` of SendGrid's error for that call's errors, and add the PostHog exception's handling next to it.
- **Ruby, PHP, Go, and .NET.** The code read SendGrid's status code. Read PostHog's error the way the rewrite file says under "The answer", and keep each branch but one on `429`, which Step 7 removes: a status of 400 or more becomes "there is an error", a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code. Read the installed client for what its send does on a refused send and on a network failure, with the options the code sets. Where it answered a refused send without raising, a site that never read the status went on after one: such a site logs PostHog's error and goes on, and raises or returns it when its code is `network_error` where the installed client raised or returned an error on a network failure, as Step 7 says. Where it raised on a refused send, such as with a client option that turns HTTP errors into exceptions, the site throws PostHog's exception the way it threw before. Where the installed client doesn't settle it, the site stays, and the reason is `SendGrid error handling not checked`. A .NET site whose SendGrid client retries moves too: remove the retry setup that only that client used, `ReliabilitySettings` in its options or a retry handler on its `HttpClient`, and never touch `ConfigureHttpClientDefaults` or a handler that other clients share. A handler that does more than retry the request, such as a fallback that answers for a send its retries failed, keeps the site on SendGrid, and the reason names the handler. Before moving any .NET site, trace every handler on that client's `HttpClient`, from its `AddHttpClient` registration, `ConfigureHttpClientDefaults`, and any factory that builds the client, and keep the site on SendGrid unless the solution shows the whole chain and what each handler does. A factory or handler from a referenced assembly, other than SendGrid's own `RetryDelegatingHandler`, which the next sentences describe, or one whose behaviour you can't read, keeps it: `moves: no — a handler on its HttpClient whose behaviour can't be read`, followed by the handler's name or the registration where tracing stopped. A client that `ReliabilitySettings` set up, with `MaximumNumberOfRetries` above `0` and no `HttpClient` passed in, as `services.AddSendGrid` passes one, threw once its last retry failed: SendGrid's `RetryDelegatingHandler` throws `HttpRequestException` for a status in its `RetriableServerErrorStatusCodes` that is left, `500`, `502`, `503`, and `504` unless the options set others, so its site throws PostHog's error for those statuses. Its `catch (TimeoutException)` caught a send that ran out of time. When the site keeps a deadline over the whole send, as Step 7 says under "Set up the client", and the solution shows that deadline ends before the `HttpClient`'s own `Timeout`, the one the code set, or .NET's 100 seconds on an `HttpClient` the code builds without one, the token is the only timeout that catch could see: it becomes `catch (OperationCanceledException)`, as Step 7 says for .NET. Otherwise it could have caught the client's own timeout, which PostHog reports as `network_error` like any other network failure, so the site stays: `moves: no — catches one kind of network failure`. A `RetryDelegatingHandler` that the code added by hand to an injected `HttpClient`, with `MaximumNumberOfRetries` above `0`, threw the same way once its last retry failed, so its site throws PostHog's error for the same statuses, and its `catch (TimeoutException)` follows the same rule. One set to `0` retries, or to a count you can't read, keeps the site on SendGrid: `moves: no — a handler on its HttpClient whose behaviour can't be read`, followed by the handler's registration.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where SendGrid took it and dropped it later. When the site throws or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `X-Message-Id`, or stored it for the app's own use, takes PostHog's message id instead.

**Calls that change the suppression list.** Step 3 and Step 5 say what to do with each of these calls. They are not sends, and they stay on SendGrid: a request, through a SendGrid client or a raw HTTP call, to `/v3/suppression/bounces`, `/v3/suppression/invalid_emails`, `/v3/suppression/spam_reports`, `/v3/suppression/blocks`, or `/v3/asm/suppressions/global`, or to an unsubscribe group's suppressions under `/v3/asm/groups/{group_id}/suppressions`, such as a `DELETE` request to `/v3/suppression/bounces/{email}`.

**The SendGrid client.** Keep the SendGrid client, its import, and `setApiKey` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
