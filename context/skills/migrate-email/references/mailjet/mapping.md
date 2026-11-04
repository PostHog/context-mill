# Mailjet to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailjet call site. A site moves only when every field it sets moves. Otherwise it stays on Mailjet, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python. Mailjet fields are written in their v3.1 names, which every SDK sends as they are. The .NET builder sets them with `With...` methods, and the v3 Send API has the older names in the last column.

## Fields

A Mailjet send is a list of messages. A site with more than one entry in `Messages` stays (see "Calls"). The table is for the fields of its one message, after the fields of `Globals` are merged into it.

| Mailjet | PostHog | A site stays on Mailjet when | v3 name |
|---|---|---|---|
| `From` | `from` | Never. `{ Email, Name }` becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) | `FromEmail`, `FromName` |
| `Sender` | none | Always | `Sender` |
| `To` | `to` | It holds more than one address. A list with one entry moves as that entry. `{ Email, Name }` moves as the bare address: note in the plan row that the To line loses the name | `To`, or `Recipients` |
| `Subject` | `subject` | Never | `Subject` |
| `TextPart`, `HTMLPart` | `text`, `html` | Never | `Text-part`, `Html-part` |
| `TemplateID` with `Variables` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" | `Mj-TemplateID`, `Vars` |
| `TemplateLanguage` | none | It is `true` without `TemplateID`: Mailjet fills the template language in `TextPart` and `HTMLPart`, and PostHog's code form sends the content as it is. With `TemplateID`, see "Templates" | `Mj-TemplateLanguage` |
| `Variables` | `templateData` | It is set without `TemplateID` | `Vars`, or `Recipients[].Vars` |
| `TemplateErrorReporting`, `TemplateErrorDeliver` | none | Always | `Mj-TemplateErrorReporting`, `Mj-TemplateErrorDeliver` |
| `Cc`, `Bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `{ Email, Name }` moves as the bare address, as for `To` | `Cc`, `Bcc`, one string |
| `ReplyTo` | `replyTo` | It carries a `Name`, or the code builds the value at run time and you cannot tell that it holds a bare address only | none: v3 sets it in `Headers`, which keeps the site |
| `Attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, counting `InlinedAttachments`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all | `Attachments` |
| `InlinedAttachments` | `attachments`, each with a `contentId` | The same as `Attachments`, counted together with them | `Inline_attachments` |
| `Headers` | none | Always: no PostHog SDK takes headers yet | `Headers` |
| `CustomID` | none | Always: no PostHog SDK takes tags yet. A webhook handler or the message API may also read it back (see "Webhooks") | `Mj-CustomID` |
| `EventPayload` | none | Always: no PostHog SDK takes tags yet | `Mj-EventPayload` |
| `CustomCampaign` | none | Always: no PostHog SDK takes tags yet | `Mj-campaign` |
| `DeduplicateCampaign` | none | Always | `Mj-deduplicatecampaign` |
| `MonitoringCategory` | none | Always | none |
| `Priority` | none | Always | `Mj-prio` |
| `TrackOpens` or `TrackClicks` set to `disabled` | `captureEngagement: false` | The installed SDK has no `captureEngagement`, or the other one is `enabled` or `anon`. `false` turns off both open and click capture: note it in the plan row when the site turned off only one | `Mj-trackopen`, `Mj-trackclick` set to `0` |
| `TrackOpens`, `TrackClicks` set to `enabled` or `account_default` | none | Never: PostHog captures opens and clicks unless the send sets `captureEngagement: false`, so the moved site sends nothing for them | `Mj-trackopen`, `Mj-trackclick` set to `1` |
| `TrackOpens`, `TrackClicks` set to `anon` | none | Always | none |
| `URLTags` | none | Always | none |

The fields next to `Messages`:

| Mailjet | A site stays on Mailjet when |
|---|---|
| `Globals` | A field in it keeps the site, as in the table above |
| `SandboxMode` | It is `true`, or the code sets it at run time: a sandbox call is a check, not a send |
| `AdvanceErrorHandling` | Never: it changes only how Mailjet reports an error. The moved site sends nothing for it |

A Mailjet send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Mailjet call | A site stays on Mailjet when |
|---|---|
| `mailjet.post('send', { version: 'v3.1' }).request(...)`, `send.create(data=...)`, `Mailjet::Send.create`, `$mj->post(Resources::$Email, ...)`, `SendMailV31`, `SendTransactionalEmailAsync`, `PostAsync` with `SendV31.Resource`, `POST /v3.1/send` | A field above keeps it |
| The v3 Send API: `.post('send')` without `v3.1`, a client without `version='v3.1'`, Go `SendMail`, `POST /v3/send` | A field above keeps it, by its v3 name. `Recipients` with more than one entry, and `Messages`, keep it |
| `Messages` with more than one entry, `SendTransactionalEmailsAsync`, Java `SendEmailsRequest` with several messages | Always: each sends several emails in one call |
| SMTP through `in-v3.mailjet.com` or `in.mailjet.com`, and Go `SendMailSMTP` | Always. PostHog has no SMTP relay |
| A framework mailer (Django, Rails, Laravel, Symfony, Swoosh) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Mailjet's SDKs report an error in three ways. The Node.js and Ruby SDKs throw. The Python, PHP, and .NET `PostAsync` SDKs answer a response, and the code reads its status. The Go SDK answers an error value. Any SDK can also answer a success whose message entry has `Status: 'error'`, and code may read that. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailjet when |
|---|---|
| A `catch` or `rescue` that reads `err.statusCode`, `err.ErrorMessage`, `err.ErrorCode`, `err.response`, or `e.code` | It branches on a Mailjet `ErrorCode`, `ErrorIdentifier`, or error text. A branch on the HTTP status moves: a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code |
| A check of `result.status_code`, `$response->success()`, `getStatus()`, `IsSuccessStatusCode`, or `StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| A check of `Messages[0].Status`, or a read of `Messages[0].Errors` | It branches on a Mailjet `ErrorCode` or error text. A check of `Status` alone moves: Mailjet sets `error` on a message it refused as invalid, so it becomes a branch on PostHog's error name `validation_error` |
| Go: a type switch or `errors.As` on `*mailjet.APIFeedbackErrorsV31` or `*mailjet.ErrorInfoV31` | It branches on a Mailjet `ErrorCode` or error text. A branch on the type or on `StatusCode` moves, as the Rewrite section says |
| `MessageID` or `MessageUUID` stored for a webhook handler or a status read | Always, when a handler or the message API uses it |
| `MessageID` or `MessageUUID` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A site that sends `TemplateID` moves only to a template made in PostHog. This skill never makes one: the person makes it from the Mailjet template, makes it transactional, and gives you its template ID. Until then the site stays on Mailjet. The check needs the template's content, because the code has only its number. `account.md` says how to get it.

A site that sends `TemplateID` without `TemplateLanguage: true` gets no values filled in: its template moves as it is, and the site sends no `templateData`.

With `TemplateLanguage: true`, Mailjet's template language becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| Mailjet | PostHog |
|---|---|
| `{{var:name}}`, `[[var:name]]` | `{{ variables.name }}` |
| `{{var:user.first_name}}` | `{{ variables.user.first_name }}` |
| `{{var:name:"there"}}`, `{{var:name:there}}` | `{{ variables.name \| default: 'there' }}` |
| `{% if var:paid %}…{% elseif var:due %}…{% else %}…{% endif %}`, when `paid` and `due` are booleans | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{% for item in var:items %}{{ item.name }}{% endfor %}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{ item }}` inside `{% for item in var:items %}` | `{{ item }}` |
| `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or` in a condition | The same |
| The template's `Subject` header, or the site's `Subject` | The PostHog template's subject, with the same conversions |

Write the `\|` above as a plain `|`. The table escapes it.

- Liquid treats `0`, an empty string, and an empty list as true. Read what the site sends for each value an `if` or `elseif` tests alone. A value that is not always a boolean, `null`, or missing keeps the template on Mailjet. A comparison, such as `var:count > 0`, converts as it is.
- Inside a loop, the loop's own name reads the current item: `{{ item.name }}` stays `{{ item.name }}`, never `{{ variables.name }}`, and `{{ item }}` stays `{{ item }}`. Mailjet has no bare name that reads the item: a `{{var:name}}` inside the loop still reads the send's value, and becomes `{{ variables.name }}`.
- Mailjet's `for` also walks the values of an object, and Liquid's `for` doesn't. A loop over a value that is not always a list keeps the template on Mailjet.
- PostHog's Liquid escapes HTML in every value. When the code passes a value that holds HTML, such as a rendered block or a link tag, the template stays on Mailjet.
- `{{data:...}}`, `{{mj:...}}`, and `{{segment:...}}` read data stored at Mailjet, so a template that uses them stays on Mailjet.
- Any function, such as `Upper`, `Lower`, `Capitalize`, `Round`, `Int`, `FormatNumber`, `FormatNumberLocale`, `UrlEncode`, `Escape`, `HasOpenedSince`, or `HasClickedSince`, keeps the template on Mailjet. So do `{% set %}`, the operators `=`, `===`, `<>`, `xor`, `not`, `div`, `mod`, and arithmetic.
- Liquid's `default` also replaces an empty string. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `From`, `ReplyTo`, or `Subject` next to `TemplateID` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `Cc`, `Bcc`, `Attachments`, `InlinedAttachments`, or `TrackOpens` or `TrackClicks` set to `disabled` next to `TemplateID` stays: a template made in PostHog sends with its own settings, and the template form takes none of them.

## Webhooks

Mailjet's Event API stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Mailjet event | PostHog event |
|---|---|
| `sent` | `$workflows_email_delivered`: Mailjet's `sent` means the receiving server took the email |
| `bounce` | `$workflows_email_bounced` |
| `spam` | `$workflows_email_blocked` |
| `open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked` |
| `blocked` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `unsub` | none |

PostHog also records `$workflows_email_sent` when it sends, which has no Mailjet event.

PostHog's events carry no Mailjet `MessageID`, `Message_GUID`, `CustomID`, or `Payload`. A site whose events a handler matches by message id, by `CustomID`, or by `Payload` stays on Mailjet. For every other handler, such as one that matches by `email`, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'mailjet'` on the client that Step 7 configures, when its client options take it.

**The call.** The Mailjet send becomes one PostHog send. Build its fields from the one message the site built, with `Globals` merged in:

- Node.js `mailjet.post('send', ...).request({ Messages: [msg] })`, Python `send.create(data={'Messages': [msg]})`, Ruby `Mailjet::Send.create(messages: [msg])`, PHP `$mj->post(Resources::$Email, ['body' => ['Messages' => [$msg]]])`, and a raw HTTP body: the fields of `msg`.
- Go `SendMailV31(&mailjet.MessagesV31{Info: []mailjet.InfoMessagesV31{msg}})`: the fields of `msg`. A `*mailjet.RecipientV31` becomes its `Email`, with its `Name` as for `From`.
- .NET `TransactionalEmailBuilder`: each `With...` call sets the field of its name. A `MailjetRequest` with `SendV31.Resource`: the fields of its one message.
- The v3 Send API: `FromEmail` and `FromName`, `To` or the one `Recipients` entry, `Subject`, `Text-part`, `Html-part`, and the other fields by their v3 names.

**The fields.**

- `From: { Email: 'hello@mail.example.com', Name: 'Example' }` becomes `'Example <hello@mail.example.com>'`. A name that holds a comma, a quote, or another special character goes in double quotes, such as `'"Acme, Inc." <hello@mail.example.com>'`, with each quote inside it escaped. A `From` without a `Name` becomes the bare address.
- `To`, `Cc`, and `Bcc` become bare addresses. A list with one entry in `To` becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `TextPart` becomes `text`, and `HTMLPart` becomes `html`.
- `ReplyTo: { Email }` becomes `replyTo` with the bare address.
- An attachment `{ ContentType, Filename, Base64Content }` becomes `{ filename: Filename, content: Base64Content, contentType: ContentType }`. In Node.js and Python, `content` stays the same base64 string. In Go and Elixir, the SDK takes the raw file: decode the base64 string first, or pass the bytes the code encoded, as `posthog-sdks.md` says. Otherwise the recipient gets the file encoded twice.
- An inlined attachment becomes the same, with `contentId: ContentID`, a bare name without `cid:`. Without a `ContentID`, the HTML refers to it as `cid:<Filename>`, so `contentId` takes the `Filename`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `Variables`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did, and never widen a catch: a catch of one error class or one status becomes a catch of PostHog's error that checks for the same kind of error, and raises or returns every other error as before. A branch on Mailjet's answer to an invalid send, a `400` or a message with `Status: 'error'`, becomes a branch on PostHog's error name `validation_error`, never on a status code, as Step 7 says. A branch on another status, such as `429` or `401`, reads PostHog's status code. A network error that is left after PostHog's retries comes back as PostHog's error with the code `network_error`. Where Mailjet's network error went past the old branch, let PostHog's go past the new one.

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `.request()` threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name })`. `err.statusCode` keeps holding the HTTP status, so a branch on `err.statusCode === 429` still takes only that status. A check of `err.statusCode === 400` becomes a check of `err.name === 'validation_error'`. A read of `err.ErrorMessage`, `err.originalMessage`, or `err.response` becomes a read of `err.message`.
- **Ruby.** PostHog's SDK raises too. A `rescue Mailjet::CommunicationError` becomes a `rescue` of the PostHog error `posthog-sdks.md` names, and a read of Mailjet's `e.code` becomes `e.status_code`: PostHog's `e.code` is its own error code, not the HTTP status. A `rescue` of one subclass becomes a `rescue` of the PostHog error that checks for the same kind of error, and raises every other error again: `Mailjet::BadRequest` checks the name `validation_error`, and `Mailjet::Unauthorized` checks the status code `401`. Where the site also checked the answer's `Status` for a refused address, that check becomes a `rescue` that checks the name `validation_error`.
- **Python, PHP, and .NET `PostAsync`.** The code read Mailjet's status: `result.status_code`, `$response->success()`, `getStatus()`, `IsSuccessStatusCode`, or `StatusCode`. PostHog's SDK raises or throws instead. Put the send in a `try`, and catch the PostHog error `posthog-sdks.md` names. A failed status, such as `status_code != 200` or `!$response->success()`, becomes that catch, and it takes the branch the status check took. A branch on `400` checks PostHog's error name `validation_error` in the catch, and a branch on another status, such as 429, checks PostHog's status code. The catch handles every other error the way the old code handled a status it didn't branch on. Mailjet's SDK raised its network errors past the status check, so the catch raises PostHog's error again when its code is `network_error`. A read of `result.json()`, `result.text`, `getBody()`, or `GetErrorMessage()` for the error becomes the error's message.
- **.NET `SendTransactionalEmailAsync`.** A `catch (MailjetServerException)` becomes a `catch` of PostHog's exception, and `HttpCode` its status code, with a check of `HttpCode` 400 read as the name `validation_error`. A check of `response.Messages[0].Status` moves into that `catch` too, as a check of the name `validation_error`. A network error went past both before, so the `catch` throws again when the code is `network_error`.
- **Go.** PostHog's `Send` answers an error value too, always a `*posthog.EmailError`. Keep `if err != nil`: it took Mailjet's network errors too. A type switch or `errors.As` reads `*posthog.EmailError` with `errors.As` instead, and keeps each branch. `*mailjet.APIFeedbackErrorsV31` is Mailjet's answer to an invalid send, so its branch checks the name `validation_error`. `*mailjet.ErrorInfoV31` is any status but 400 and 403, so its branch takes every PostHog error whose name is not `validation_error` and whose code is not `network_error`, and a check of its `StatusCode`, such as 429, reads PostHog's `StatusCode`. Every other error goes on as before.
- **Any language.** A check of `Messages[0].Status` for `error` becomes a check of PostHog's error name `validation_error`, in the language's form above.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailjet took it and blocked it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `MessageID` or `MessageUUID`, or stored it for the app's own use, takes PostHog's message id instead.

**The Mailjet client.** Keep the Mailjet client, its import, and its configuration while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its keys: the person removes them after the cutover.
