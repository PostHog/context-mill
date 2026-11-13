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
| `templateId` with `dynamicTemplateData` (Node.js code may also write the HTTP names `template_id` and `dynamic_template_data`: read the installed `@sendgrid/mail` for whether it sends them, as `sdk-reference.md` says under "The installed client") | the template's email, brought into the code and rendered with `dynamicTemplateData`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates". A legacy template, whose id has no `d-` prefix, always stays |
| `substitutions` on a send with its own `subject` and `content` | none: the code puts the values into the subject, the content, and the reply-to address before the send | The message also sets `sections`, or it sends a template, or the SDK changes a key from a value the code builds at run time, or the installed client doesn't settle the tag it sends for a key. Otherwise SendGrid replaced every occurrence of each tag, as it is written, in the subject, the reply-to address, and the content, as the [Mail Send reference](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) says, and inserted the value as it is. The tag is the key the request carries, such as `-name-`. SendGrid's docs don't say whether an SDK changes a key or a value before the request: read the installed client for the tag it sends for each key and for what it does to each value, as `sdk-reference.md` says under "The installed client", and name the file in the plan row. The code does the same with a plain string replace of each tag, under the escaping rule of `template-to-code.md`, and sends the result |
| `cc`, `bcc` | none | Always. PostHog's send doesn't take it yet |
| `replyTo`, `replyToList` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `attachments` | `attachments` | Step 3 says so under "Files", or "Attachments" below keeps a file there. See "Attachments" |
| `headers` | none | Always: no PostHog SDK takes headers yet |
| `customArgs` | none | Always: no PostHog SDK takes tags yet |
| `categories` | none | Always: no PostHog SDK takes tags yet |
| No `trackingSettings` | none, as "Open and click tracking" says | Opens and clicks follow the account, as "Open and click tracking" below and `account.md` under "Tracking" say |
| `trackingSettings` with `openTracking` or `clickTracking` | none, as "Open and click tracking" says | Opens and clicks follow "Open and click tracking" below. It stays when the settings do anything else, such as `subscriptionTracking`, `ganalytics`, or an `openTracking` `substitutionTag`: PostHog places its own pixel, so the tag would stay in the email as text |
| `sendAt` / `send_at` | none | Always. PostHog's send doesn't take it yet |
| `batchId` / `batch_id` | none | Always. PostHog's send doesn't take it yet |
| `asm` | none | Always: PostHog has no unsubscribe groups on a transactional send |
| `ipPoolName` / `ip_pool_name` | none | Always. PostHog's send doesn't take it yet |
| `mailSettings` / `mail_settings` | none | Always. Sandbox mode is not a send |
| `personalizations` | the fields of its one entry | It holds more than one entry. One entry moves when each field in it moves |

**Open and click tracking.** PostHog adds its open pixel to every email it sends, and a send in the code form counts no clicks, as Step 7 says. No field changes this: `captureEngagement` decides only whether the email's events land on the recipient's person, so tracking never maps to it. SendGrid decides opens and clicks one at a time. When the send's `trackingSettings` sets `openTracking` or `clickTracking`, that setting's `enable` decides for it. Otherwise the account's setting decides, as `account.md` says under "Tracking".

- Opens: `account.md` says under "Tracking" which sites' emails had no open pixel, and for which nobody can tell. Those sites follow Step 3 under "Opens the provider didn't track".
- Clicks: when SendGrid tracked a moved site's clicks, or nobody knows whether it did, note in the plan row that PostHog counts no clicks for it, unless it moves to a template made in PostHog that is not marked sensitive. When SendGrid didn't track them, or nobody knows, as `account.md` says under "Tracking", a site that moves to a template made in PostHog follows Step 3 under "A template in PostHog".

**Account mail settings.** SendGrid's subscription tracking, Google Analytics, Legacy Email Template, and Footer settings change a send that sets no field for them. `account.md` says under "Mail settings" which sites they keep on SendGrid, and how a moved site keeps the footer.

A SendGrid send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

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
| The sends of SendGrid's quickstarts and Mail Send reference samples: `sgMail.send(msg)`, `send(message)` on a `SendGridAPIClient`, `sg.client.mail.send.post` or `sg.client.mail._('send').post`, `$sendgrid->send`, `client.Send`, `SendEmailAsync`, and `POST /v3/mail/send` | A field above keeps it |
| Any other call of a SendGrid SDK that sends, such as one that takes a list of messages, a flag, or several recipients to send one email to each | When the installed client shows that it sends more than one email, or doesn't settle what it sends: one PostHog send is one email. Otherwise read it for the fields it sends, and follow the table above |
| SMTP through `smtp.sendgrid.net` | Always. PostHog has no SMTP relay |
| A framework mailer (Django, Rails, Laravel, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |
| A send through a SendGrid client the code configures with any other setting for every send, such as rules on the content | When the installed client shows that the setting refuses or changes a send, such as one whose content matches a rule, before any request: PostHog's send has no such check. SendGrid's docs don't describe such settings, so the site also stays when the installed client doesn't settle what one does. A timeout follows "HTTP" under "Rewrite" |

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
| `{{#equals a b}}`, `{{#notEquals a b}}` | A branch on `a == b`, or its opposite, after turning a number and a string of the same number into the same value: `3` equals `"3"` |
| `{{#greaterThan a b}}`, `{{#lessThan a b}}` | A branch on `a > b` or `a < b`, comparing numbers |
| `{{#and a b}}`, `{{#or a b}}` | A branch on both, or either, being true. `""`, `0`, and `0.0` are false, and so is a missing value |
| `(length x)` | The number of characters in a string, the number of entries in a list, and `0` for anything else |
| `{{formatDate ts "MMMM D, YYYY"}}`, with an optional offset such as `"-0800"` | The time, from epoch milliseconds or ISO 8601, in UTC or at that offset, written with the language's date formatting. The tokens are `YYYY` `YY` `MMMM` `MMM` `MM` `M` `DD` `D` `dddd` `ddd` `HH` `H` `hh` `h` `mm` `m` `ss` `s` `A` `ZZ` `Z`, in English. With no format, the full ISO 8601 time |
| The version's `subject` | The send's `subject`, rendered with the same conversions. SendGrid escapes HTML in a subject too, and a mail client shows the entities as they are, so the subject needs Handlebars' own escape, which the [Handlebars utilities reference](https://handlebarsjs.com/api-reference/utilities.html) says replaces `&`, `<`, `>`, `"`, `'`, `` ` ``, and `=` with their HTML entities, `&` as `&amp;`, as its [expressions guide](https://handlebarsjs.com/guide/expressions.html) shows. The docs don't give the other six entities: write `<` as `&lt;`, `>` as `&gt;`, `"` as `&quot;`, `'` as `&#x27;`, `` ` `` as `&#x60;`, and `=` as `&#x3D;`, and note in the plan row each value that can hold one of those six, since SendGrid may have written its entity differently. Write it as a small function next to the email, never the HTML escape of `template-to-code.md`, which leaves out some of these characters or writes them differently. So `{{name}}` with `A&B` stays `A&amp;B` as SendGrid sent it, and only `{{{name}}}` is the plain value. This is SendGrid's rule, so it takes the place of `template-to-code.md`'s rule never to escape a subject. Note each such value in the plan row. When the version has no subject, the send takes the site's own `subject` as it is. A site whose version has no subject and that sets none stays: PostHog's send needs a subject |
| The version's plain text | The send's `text`, rendered with the same conversions. SendGrid escapes HTML in the plain text too, so the text takes the subject's escape, from the same function: `{{name}}` with `A&B` stays `A&amp;B` as SendGrid sent it, and only `{{{name}}}` is the plain value. This takes the place of `template-to-code.md`'s rule never to escape the text part. Note each such value in the plan row. A version without plain text sends `html` only |

- Handlebars truth: `false`, a missing value, `null`, `""`, `0`, and an empty list are false. Everything else is true, including `"0"`, `"false"`, and an empty object. Write that test out in the code, as `template-to-code.md` says.
- Any other helper, a partial (`{{> name}}`), or an `{{unsubscribe}}`, `{{{unsubscribe}}}`, `{{weblink}}`, or `{{{unsubscribe_preferences}}}` tag that SendGrid fills from the account keeps the template on SendGrid. Such tags come from unsubscribe groups, which a transactional send through PostHog doesn't have.
- A SendGrid template holds no sender, so the send takes the site's own `from` and `replyTo`. A `from` or `replyTo` that holds a `{{` keeps the site on SendGrid, with the reason `placeholder in from or reply-to`: these files don't say whether SendGrid fills it from `dynamicTemplateData`. A site that sets `subject` next to `templateId` moves only when the version has no subject, or when the site's subject is the same in every send as the version's: which one SendGrid sent can't be told from the code. Otherwise it stays.
- Images that the template's editor uploaded to SendGrid have URLs on `marketing-image-production.s3.amazonaws.com` or `mc.sendgrid.com`. Keep them, and list them, as `template-to-code.md` says.
- A template site follows "Open and click tracking" like any other site. Its `trackingSettings` follow the "Fields" table, as for any send.

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
- A template site follows "Open and click tracking" like any other site.

## Webhooks

The Event Webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| SendGrid event | PostHog event |
|---|---|
| `processed` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `bounce` | `$workflows_email_bounced` |
| `spamreport` | `$workflows_email_blocked` |
| `open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked`, only for a template made in PostHog that is not marked sensitive. A send in the code form counts no clicks |
| `dropped` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `deferred`, `unsubscribe`, `group_unsubscribe`, `group_resubscribe` | none |

PostHog's events carry no SendGrid `sg_message_id` and no `custom_args`. A site whose events a handler matches by message id or by a custom arg stays on SendGrid. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, such as `dropped` or `deferred`, stays, and the reason is `its <event> events feed a webhook handler`. SendGrid sends `unsubscribe`, `group_unsubscribe`, and `group_resubscribe` only for emails with subscription tracking or `asm`, which keep their sites on SendGrid already, so a handler on those events keeps no other site. A site whose emails a `click` handler acts on moves only to a template made in PostHog that is not marked sensitive. Otherwise it stays, and the reason is `its clicks feed a webhook handler`.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'sendgrid'` on the client that Step 7 configures, when its client options take it.

**The call.** The SendGrid send becomes one PostHog send. Build its fields from the message the site built:

- `sgMail.send(msg)`: the fields of `msg`.
- Python `Mail(from_email, to_email, subject, content)`, as the quickstart builds it, or `Mail()` with the attributes the Mail Send reference's sample sets, such as `from_email`, `to`, `content`, and `reply_to`: `from`, `to`, `subject`, `html` or `text` from each content's type, and each field an attribute sets. A message built another way: read the installed client for the field each argument sets.
- Ruby `SendGrid::Mail.new(from, subject, to, content)` and its personalization: the same fields.
- PHP `setFrom`, `addTo`, `setSubject`, `addContent`, and the other setters: the same fields.
- Go `mail.NewSingleEmail(from, subject, to, plainText, html)`, or `NewV3Mail` with one personalization: the same fields.
- .NET `MailHelper.CreateSingleEmail(from, to, subject, plainText, html)`, or a `SendGridMessage`: the same fields.
- A raw HTTP body or `@sendgrid/client` request: the fields of its one personalization, `from`, `subject`, and `content`.

**The fields.**

- `{ email: 'hello@mail.example.com', name: 'Example' }` in `from` becomes `'Example <hello@mail.example.com>'`. A `from` without a name becomes the bare address.
- `to` becomes a bare address. A list with one entry becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `content` entries become `text` and `html`.
- `attachments` keeps its list, each file rewritten as "Attachments" says.
- `trackingSettings` is dropped, and the send gets no `captureEngagement` for it, as "Open and click tracking" says.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**HTTP.** A request to `POST /v3/mail/send`, through `fetch`, axios, `requests`, the SendGrid client's own request call, or another HTTP client, becomes the SDK's send in that language, with the fields "The call" names. A site's own deadline is a timeout the code sets on that request, such as `signal: AbortSignal.timeout(5000)` or `requests.post(..., timeout=5)`, or on the SendGrid client it sends through: a timeout option or setting of the client, or of the HTTP library or the HTTP client the code gives it, or a context with a deadline or a token that times out given to the send in Go or .NET. The site keeps that deadline, as Step 7 says under "Set up the client". A timeout the code doesn't set, such as a SendGrid client's own default, is none. SendGrid's docs don't describe a client's timeout options: read the installed client for the HTTP library it hands each one to, as `sdk-reference.md` says under "The installed client", and follow Step 7 for the kind of limit that library sets, naming the file in the plan row. Where the installed client hands it to a library whose limit the PostHog SDK can't keep, as Step 7 says, such as axios's `timeout` in Node.js, the site stays. A limit on connecting alone, or on connecting and reading apart, falls under Step 7's rule on such limits, such as `CURLOPT_CONNECTTIMEOUT` where the installed PHP client sends through `curl`. Where the installed Ruby client hands its options to Net::HTTP, they are `Net::HTTP`'s own timeouts, as `rewrite-ruby.md` says under "A deadline": `open_timeout`, `read_timeout`, and `write_timeout` all set to one number are a deadline the site keeps, and any other mix of them, such as `read_timeout: 3` alone, which leaves the other two at Net::HTTP's 60 seconds, falls under Step 7's rule on split limits, and the site stays. `keep_alive_timeout` limits no request. When the installed client doesn't settle which kind of limit an option sets, the site stays, and the reason is `the client's timeout not checked`. A retry of a rate limit that the installed client makes, as its source shows, is no deadline: PostHog's send retries rate limits by itself. A .NET client that retries server errors keeps its site, as "Errors" says. When a site with a deadline also retried, note in the plan row that its send no longer retries.

**Templates brought into the code.** The site renders the email from `dynamicTemplateData`, as "Templates" says, and sends `templateKey`, the rendered `subject`, `html`, and `text`, and the site's own `from` and `replyTo`. It sends no `templateId` and no `templateData`.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `dynamicTemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sgMail.send` threw into a `catch`, as the installed client and the `catch` around the send show, throw from the error so the same `catch` runs, keeping each read of the `catch`. Where it reads the HTTP status as `err.code`: `if (error) throw Object.assign(new Error(error.message), { code: error.statusCode ?? error.code, name: error.name, posthogCode: error.code })`. `err.code` keeps holding the HTTP status, and holds `network_error` when the request never reached PostHog, `err.posthogCode` holds PostHog's own code, so a branch on `err.code === 429` also checks `err.posthogCode !== 'quota_limited'`, as Step 7 says, and a check of `err.code === 400` becomes a check of `err.name === 'validation_error'`. A read of the error's response body becomes a read of `err.message`. A send that hands its result to a callback, where the installed client takes one, becomes the same code run after the send, with the error argument built from `error` the way the throw above builds it, or `null` when there is no `error`, and the result from `data`. Read the installed client for the arguments it passes the callback and for whether that send also threw; where it did, the `if (error) throw` above follows the callback's code. When it doesn't settle them, the site stays, and the reason is `SendGrid client not checked: the callback's arguments`. PostHog's `data` is an object, not the list SendGrid's Node.js send answers, whose first entry the quickstart reads as `response[0].statusCode`: never destructure it as a list, and rewrite each read of the answer, such as `const [response] = await sgMail.send(msg)` or `result[0]`, as "The answer" below says.
- **Python.** PostHog's SDK raises too. Replace the `except` of SendGrid's error with the PostHog exception the rewrite file names, and its status read with its status code. SendGrid's docs don't name the class the send raises: read the installed `sendgrid` package and the HTTP package it sends through for what the caught class covers: where it caught only SendGrid's answers, and a network failure raised another error past it, PostHog's exception covers both, so raise it again first when its code is `network_error`. A catch of one subclass becomes a catch of the PostHog exception that checks for the same kind of error, and raises every other error again: read the installed package for the status each subclass stands for, and check that status code, or the name `validation_error` for a 400, as Step 7 says. When the installed package doesn't settle it, the site stays, and the reason is `SendGrid error class not checked`. Several such handlers on one `try` become one `except` of the PostHog exception: it checks each kind in the order the handlers had, runs that handler's code, and raises every other error again. Separate `except` clauses of the same PostHog exception would let the first one take every error. When the same `try` also holds a SendGrid call that stays, such as a suppression call, keep each `except` of SendGrid's error for that call's errors, and add the PostHog exception's handling next to it.
- **Ruby, PHP, Go, and .NET.** The code read SendGrid's status code. Read PostHog's error the way the rewrite file says under "The answer", and keep each branch: a status of 400 or more becomes "there is an error", a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status, such as 429, reads PostHog's status code. Read the installed client for what its send does on a refused send and on a network failure, with the options the code sets. Where it answered a refused send without raising, a site that never read the status went on after one: such a site logs PostHog's error and goes on, and raises or returns it when its code is `network_error` where the installed client raised or returned an error on a network failure, as Step 7 says. Where it raised on a refused send, such as with a client option that turns HTTP errors into exceptions, the site throws PostHog's exception the way it threw before. Where the installed client doesn't settle it, the site stays, and the reason is `SendGrid error handling not checked`. A Go call that retries a rate limit and returns an error when SendGrid still answered 429 after its last retry, as the installed client shows: the site also returns PostHog's error when its status code is 429, which PostHog's send answers only once its own retries are used up. A Go call that sends in the background and returns at once, as the installed client shows, keeps its site, and the reason is `sends in the background`: PostHog's send waits for its answer. A .NET site whose SendGrid client retries server errors stays, and the reason is `its client retries server errors`: PostHog's send doesn't retry them the way the client did. Read the installed client for whether its options make it retry, and for which `HttpClient` they apply to: one the client makes itself, one the code passes to it, or one from .NET's `IHttpClientFactory`, such as a client a registration of the SendGrid package gets. A handler that retries, which the code adds to the `HttpClient` the client gets, such as a Polly policy or a resilience handler like `AddStandardResilienceHandler`, retries too. `ConfigureHttpClientDefaults` adds its handlers to every client from .NET's factory, and often sits in another project, such as an Aspire app's service defaults: search the whole solution for it before a site whose `HttpClient` comes from .NET's factory moves, one the factory gives the client through a registration or one given `CreateClient`'s client alike. When the code or the installed client can't tell what a handler does, or how many times it retries, the site stays too.
- A branch on a network failure follows Step 7's rule on network failures. SendGrid's docs don't say what an SDK raises on one: read the installed client for the HTTP library it sends through and whether it passes that library's own errors through, and name the file in the plan row. Where it does, the code's branch reads that library's error, such as an error code like `'ECONNRESET'` in Node.js, `Net::ReadTimeout` where the client sends through Net::HTTP in Ruby, or a `net.Error` in Go. When the installed client doesn't settle it, the site stays, and the reason is `SendGrid client not checked: the network error`.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where SendGrid took it and dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `X-Message-Id`, or stored it for the app's own use, takes PostHog's message id instead.

**Suppression writes.** A call to `/v3/suppression/bounces`, `/v3/suppression/invalid_emails`, or `/v3/suppression/spam_reports`, such as a `DELETE` request to `/v3/suppression/bounces/{email}`, changes a list the import takes: Step 5 says under "Calls that change the provider's list" what the report asks for it. A site that stays on SendGrid also adds its bounces, spam reports and invalid emails to these lists, which PostHog never sees: the report asks for the weekly re-import that Step 5 says under "Re-import only". A call to the global or group unsubscribes changes a list the import leaves out, and stays a SendGrid write only.

**The SendGrid client.** Keep the SendGrid client, its import, and `setApiKey` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
