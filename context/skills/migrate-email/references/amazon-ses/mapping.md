# Amazon SES to PostHog mapping

This file decides, field by field, whether PostHog can send an Amazon SES call site. A site moves only when every field it sets moves. Otherwise it stays on Amazon SES, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python. Amazon SES fields are written in their v2 names, with the v1 name after a slash where it differs. `sdk-reference.md` has both.

## Fields

| Amazon SES | PostHog | A site stays on Amazon SES when |
|---|---|---|
| `FromEmailAddress` / `Source` | `from` | Never. `Name <address>` stays as it is. It needs a verified sender (Step 4) |
| `Destination.ToAddresses` | `to` | It holds more than one address, or none. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `Destination.CcAddresses`, `BccAddresses` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `Name <address>` moves as the bare address, as for `to` |
| `ReplyToAddresses` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `Subject.Data` | `subject` | Never |
| `Body.Html.Data`, `Body.Text.Data` | `html`, `text` | Never |
| `Charset` on the subject or a body part | none | It is set to anything other than `UTF-8`, in any case |
| `Content.Template` with `TemplateName` or `TemplateArn` / `SendTemplatedEmail` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" |
| `Content.Template.TemplateContent` | a template made in PostHog | See "Templates". The content is in the code |
| `Content.Raw` / `SendRawEmail` | none | Always: the code builds the MIME message itself |
| `Attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, a `ContentDisposition` is `INLINE` without a `ContentId`, an attachment sets `ContentDescription` or a `ContentTransferEncoding` other than `BASE64`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `Headers` | `headers` | The installed SDK has no `headers`, or there are more than 10 |
| `EmailTags` / `Tags` | `tags` | The installed SDK has no `tags`, there are more than 10, or a webhook handler reads them back (see "Webhooks") |
| `ConfigurationSetName` | none: PostHog records the send's events itself | A webhook handler matches the set's events by message id or by a tag (see "Webhooks"). Otherwise it moves: note the set's name in the plan row, because its event destinations stop getting events for this site |
| `ConfigurationOverrides.Tracking` that sets `OpenTrackingEnabled` or `ClickTrackingEnabled` to `DISABLED` | `captureEngagement: false` | The installed SDK has no `captureEngagement`, or it sets either one to `ENABLED`. `false` turns off both open and click capture: note it in the plan row |
| `ListManagementOptions` | none | Always: PostHog has no contact lists or topics on a transactional send |
| `FeedbackForwardingEmailAddress` / `ReturnPath` | none | Always: PostHog forwards no bounce or complaint mail to an address |
| `FromEmailAddressIdentityArn`, `FeedbackForwardingEmailAddressIdentityArn` / `SourceArn`, `ReturnPathArn`, `FromArn` | none | Always: the site sends for an identity another AWS account owns |
| `EndpointId` | none | Always |
| `TenantName` | none | Always |

An Amazon SES send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Amazon SES call | A site stays on Amazon SES when |
|---|---|
| `SendEmail` in any SDK: `SendEmailCommand`, `AWS.SES().sendEmail`, `AWS.SESV2().sendEmail`, `send_email`, `sendEmail`, `SendEmail`, `SendEmailAsync`, `send_email()`, `ExAws.SES.send_email`, `ExAws.SES.send_email_v2`, `POST /v2/email/outbound-emails`, `Action=SendEmail` | A field above keeps it |
| `SendTemplatedEmail` / `send_templated_email` | A field above keeps it, or "Templates" does |
| `SendRawEmail` / `send_raw_email`, and `SendEmail` with `Content.Raw` | Always: the code builds the MIME message itself |
| `SendBulkEmail`, `SendBulkTemplatedEmail`, and their names in each SDK | Always: each sends several emails in one call |
| Nodemailer's `SES` transport | Always. PostHog has no Nodemailer transport |
| SMTP through `email-smtp.<region>.amazonaws.com` | Always. PostHog has no SMTP relay |
| A framework mailer (Django, Rails, Laravel, Symfony, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Most AWS SDKs throw on an error: Node.js, Python, Ruby, PHP, .NET, and Java. The Go, Rust, and Elixir SDKs return an error value. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Amazon SES when |
|---|---|
| A `catch`, `except`, `rescue`, or error check that only logs the error, returns, or throws it again | Never. Log PostHog's error instead |
| A branch on an Amazon SES error name, such as `err.name === 'MessageRejected'`, `e.response['Error']['Code']`, `e.code`, `getAwsErrorCode()`, `ErrorCode`, `errors.As(err, &mr)` with `*types.MessageRejected`, or a `SendEmailError` variant | The name is anything but `TooManyRequestsException`. A branch on `TooManyRequestsException` moves: it becomes a check of PostHog's status code for `429` |
| A branch on the HTTP status, such as `err.$metadata.httpStatusCode`, `e.response['ResponseMetadata']['HTTPStatusCode']`, `getStatusCode()`, `StatusCode`, or `HTTPStatusCode()` | Never. Read PostHog's status code |
| The `MessageId` stored for a webhook handler or a `GetMessageInsights` read | Always, when a handler or the read uses it |
| The `MessageId` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A site that sends a stored template moves only to a template made in PostHog. This skill never makes one: the person makes it from the Amazon SES template, makes it transactional, and gives you its template ID. Until then the site stays on Amazon SES. The check needs the template's content, because the code has only its name. `account.md` says how to get it.

A site that sends an inline template, `Content.Template.TemplateContent`, has its content in the code. It follows the same path: read the content from the code, check it, and ask the person to make the PostHog template from it.

Amazon SES's Handlebars becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| Amazon SES | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{contact.firstName}}` | `{{ variables.contact.firstName }}` |
| `{{#if paid}}…{{else}}…{{/if}}` | `{% if variables.paid %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}` | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{name}}{{/each}}`, or `{{this.name}}` in the loop | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{#each tags}}{{this}}{{/each}}` | `{% for tag in variables.tags %}{{ tag }}{% endfor %}` |
| The template's subject (`Subject` or `SubjectPart`) | The PostHog template's subject, with the same conversions |

- Amazon SES does not escape HTML in values, and PostHog's Liquid does. A value with plain text shows the same text. A value that holds HTML, such as a link or a list the code builds as markup, shows as escaped text in PostHog, so its template stays on Amazon SES. So does a template that uses triple braces, `{{{name}}}`.
- Any other helper, such as `{{#with}}`, `{{lookup}}`, or `{{log}}`, keeps the template on Amazon SES. So does an inline partial (`{{#* inline}}` and `{{> name}}`), `{{@index}}`, `{{@key}}`, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- `TemplateData` is a JSON string. `templateData` takes the object it was built from, before `JSON.stringify` or `json.dumps`. When the code only has the string, parse it.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `FromEmailAddress` / `Source` or `ReplyToAddresses` next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `CcAddresses`, `BccAddresses`, `Attachments`, `Headers`, or `EmailTags` next to the template stays: a template made in PostHog sends with its own settings.

## Webhooks

The handlers stop getting events for a site that moves: Amazon SES no longer sends it. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Amazon SES event | PostHog event |
|---|---|
| `Send` | `$workflows_email_sent` |
| `Delivery` | `$workflows_email_delivered` |
| `Bounce` | `$workflows_email_bounced` |
| `Complaint` | `$workflows_email_blocked` |
| `Open` | `$workflows_email_opened` |
| `Click` | `$workflows_email_link_clicked` |
| `Reject`, `Rendering Failure`, `DeliveryDelay`, `Subscription` | none |

A bounce to an address on the account-level suppression list comes as a `Bounce` with `bounceSubType` `OnAccountSuppressionList`. PostHog refuses that send instead, with `recipient_suppressed`.

PostHog's events carry no Amazon SES `mail.messageId` and no `mail.tags`. A site whose events a handler matches by message id or by a tag stays on Amazon SES. A handler that finds the user by the recipient's address, such as `bouncedRecipients[].emailAddress`, keeps no site. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'amazon-ses'` on the client that Step 7 configures, when its client options take it.

**The call.** The Amazon SES send becomes one PostHog send. Build its fields from the input the site built:

- v2 `SendEmail` in any SDK: `FromEmailAddress`, `Destination`, `ReplyToAddresses`, and `Content.Simple`.
- v1 `SendEmail` in any SDK: `Source`, `Destination`, `ReplyToAddresses`, and `Message`.
- Elixir `ExAws.SES.send_email_v2(destination, content, from, opts)`: the same v2 fields, with `opts[:reply_addresses]` as `ReplyToAddresses`. `ExAws.SES.send_email(dst, msg, from, opts)`: `dst.to`, `dst.cc`, `dst.bcc`, the `html`, `text`, and `subject` of `build_message`, and `opts[:reply_to]`.
- A raw HTTP request: the fields of its JSON body or its form parameters.

**The fields.**

- `FromEmailAddress` / `Source` becomes `from` as it is, with its name.
- The one entry of `ToAddresses` becomes `to`. `CcAddresses` and `BccAddresses` become `cc` and `bcc`. Each becomes a bare address. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `Subject.Data`, `Body.Html.Data`, and `Body.Text.Data` become `subject`, `html`, and `text`.
- An attachment `{ FileName, RawContent, ContentType, ContentId }` becomes `{ filename: FileName, content: RawContent, contentType: ContentType, contentId: ContentId }`. In the SDKs `RawContent` holds the bytes: pass them as they are where `posthog-sdks.md` takes bytes. Drop `ContentDisposition`: `contentId` makes a file inline.
- `ConfigurationOverrides.Tracking` with `DISABLED` becomes `captureEngagement: false`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the object of the site's `TemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Amazon SES send threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { code: error.code, statusCode: error.statusCode })`. In that `catch`, a read of `err.name` for logging becomes `err.code`, and a read of `err.$metadata.httpStatusCode` becomes `err.statusCode`.
- **Python.** PostHog's SDK raises too. Replace `except ClientError` or `except client.exceptions.<Name>` with the PostHog exception `posthog-sdks.md` names, `e.response['Error']['Code']` with its code, `e.response['Error']['Message']` with its message, and `e.response['ResponseMetadata']['HTTPStatusCode']` with its status code. When the same `try` also guards other AWS calls, keep their `except` as well.
- **Ruby, PHP, and .NET.** PostHog's SDK throws too. Replace the rescued or caught Amazon SES exception (`Aws::SESV2::Errors::ServiceError`, `Aws\SesV2\Exception\SesV2Exception`, `AwsException`, `AmazonSimpleEmailServiceV2Exception`, and their v1 names) with the PostHog exception `posthog-sdks.md` names, and the error code and status code reads with its own.
- **Go, Rust, and Elixir.** The site checked an error value. Check PostHog's error value the way `posthog-sdks.md` says for the language. A plain `if err != nil`, `?`, or `{:error, _}` branch stays as it is. A branch on the status, such as `{:error, {:http_error, 429, _}}` or `HTTPStatusCode()`, reads PostHog's status code.
- A branch on `TooManyRequestsException` becomes a check of PostHog's status code for `429`.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Amazon SES took it and didn't send it. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `MessageId`, or stored it for the app's own use, takes PostHog's message id instead.

**The Amazon SES client.** Keep the Amazon SES client and its import while any site or other call still uses them. When nothing uses them, remove the import and the client. Keep the package and the AWS credentials: they often serve other AWS services, and the person removes the Amazon SES permissions after the cutover.
