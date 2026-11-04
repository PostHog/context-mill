# Amazon SES to PostHog mapping

This file decides, field by field, whether PostHog can send an Amazon SES call site. A site moves only when every field it sets moves. Otherwise it stays on Amazon SES, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python. Amazon SES fields are written in their v2 names, with the v1 name after a slash where it differs. `sdk-reference.md` has both.

## Fields

| Amazon SES | PostHog | A site stays on Amazon SES when |
|---|---|---|
| `FromEmailAddress` / `Source` | `from` | Never. `Name <address>` stays as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `Destination.ToAddresses` | `to` | It holds more than one address, or none. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `Destination.CcAddresses`, `BccAddresses` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `Name <address>` moves as the bare address, as for `to` |
| `ReplyToAddresses` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A value read from an environment variable or a config file counts as read when `.env.example`, the config file, or the person shows a bare address for it |
| `Subject.Data` | `subject` | Never |
| `Body.Html.Data`, `Body.Text.Data` | `html`, `text` | Never |
| `Charset` on the subject or a body part | none | It is set to anything other than UTF-8. Ignore case, `-`, and `_` when you compare: `utf-8`, `utf8`, and `UTF_8` are UTF-8 and move. Any other charset, such as `ISO-8859-1`, keeps the site |
| `Content.Template` with `TemplateName` or `TemplateArn` / `SendTemplatedEmail` | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" |
| `Content.Template.TemplateContent` | a template made in PostHog | See "Templates". The content is in the code |
| `Content.Raw` / `SendRawEmail` | none | Always: the code builds the MIME message itself |
| `Attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, a `ContentDisposition` is `INLINE` without a `ContentId`, an attachment sets `ContentDescription` or a `ContentTransferEncoding` other than `BASE64`, the HTML references the `cid:` of an attachment whose `ContentDisposition` isn't `INLINE`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `Headers` | none | Always: no PostHog SDK takes headers yet |
| `EmailTags` / `Tags` | none | Always: no PostHog SDK takes tags yet |
| `ConfigurationSetName`, or the sending identity's default configuration set when the send names none | none | A webhook handler matches the set's events by message id or by a tag (see "Webhooks"). Otherwise it moves: note the set's name in the plan row, because its event destinations stop getting events for this site. `account.md` says how to read an identity's default set |
| Open and click tracking: `ConfigurationOverrides.Tracking`, the configuration set's event destinations and VDM options, or the account's VDM settings | `captureEngagement: false`, or no field | See "Open and click tracking" below. `OpenTrackingEnabled` or `ClickTrackingEnabled` set to `DISABLED` counts as set: it turns that tracking off for the send, whatever the set or the account does |
| `ListManagementOptions` | none | Always: no PostHog SDK takes it |
| `FeedbackForwardingEmailAddress` / `ReturnPath` | none | Always: no PostHog SDK takes it |
| `FromEmailAddressIdentityArn`, `FeedbackForwardingEmailAddressIdentityArn` / `SourceArn`, `ReturnPathArn`, `FromArn` | none | Always: the site sends for an identity another AWS account owns |
| `EndpointId` | none | Always. PostHog's send doesn't take it yet |
| `TenantName` | none | Always. PostHog's send doesn't take it yet |

**Open and click tracking.** PostHog captures opens and clicks unless the send sets `captureEngagement: false`, which turns off both. Amazon SES decides opens and clicks one at a time. When the send's `ConfigurationOverrides.Tracking` sets `OpenTrackingEnabled` or `ClickTrackingEnabled`, that value decides, with one limit: `DISABLED` doesn't track it, and `ENABLED` tracks it only when one of the two below is on for the send, because an override has no effect without an event destination or VDM engagement metrics. Otherwise Amazon SES tracks it when either of these is on for the send:

- VDM engagement tracking, which tracks both opens and clicks. The send's configuration set decides it when the set's `VdmOptions.DashboardOptions.EngagementMetrics` is set. Otherwise the account's `VdmAttributes.DashboardAttributes.EngagementMetrics` decides, for a send with no set too. Either is on only when it is `ENABLED` and the account's `VdmAttributes.VdmEnabled` is `ENABLED`.
- An enabled event destination of the send's configuration set, the one it names or its identity's default one, whose `MatchingEventTypes` lists `OPEN` for opens or `CLICK` for clicks.

A send with neither gets no tracking pixel, and its links stay as written. Read the account's VDM settings and each set the sites use, as `account.md` says under "Configuration sets", and work out, for opens and for clicks, whether Amazon SES tracked them:

- Both tracked: the site moves with no `captureEngagement` field.
- Neither tracked: the site moves with `captureEngagement: false`. A template site stays, and the reason is `open and click tracking off`: the template form takes no `captureEngagement`. So does a site whose installed SDK has no `captureEngagement`.
- One tracked and one not: the site stays, because `captureEngagement: false` turns off both.

When a site's tracking depends on a setting the person can't give and the read-only key can't read, the site stays, and the reason is `account tracking not checked` for the account's VDM settings, or `configuration set <name> tracking not checked` for a set's.

An Amazon SES send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Amazon SES call | A site stays on Amazon SES when |
|---|---|
| `SendEmail` in any SDK: `SendEmailCommand`, `AWS.SES().sendEmail`, `AWS.SESV2().sendEmail`, `send_email`, `sendEmail`, `SendEmail`, `SendEmailAsync`, `send_email()`, `ExAws.SES.send_email`, `ExAws.SES.send_email_v2`, `POST /v2/email/outbound-emails`, `Action=SendEmail` | A field above keeps it |
| `SendTemplatedEmail` / `send_templated_email` | A field above keeps it, or "Templates" does |
| `SendRawEmail` / `send_raw_email`, and `SendEmail` with `Content.Raw` | Always: the code builds the MIME message itself |
| `SendBulkEmail`, `SendBulkTemplatedEmail`, and their names in each SDK | Always: each sends several emails in one call |
| Nodemailer's `SES` transport | Always: `posthog-sdks.md` has no Nodemailer transport |
| SMTP through `email-smtp.<region>.amazonaws.com` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A framework mailer (Django, Rails, Laravel, Symfony, Swoosh, Bamboo) | Always: `posthog-sdks.md` has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Most AWS SDKs throw on an error: Node.js, Python, Ruby, PHP, .NET, and Java. The Go, Rust, and Elixir SDKs return an error value. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Amazon SES when |
|---|---|
| A `catch`, `except`, `rescue`, or error check that only logs the error, returns, or throws it again | Never. Log PostHog's error instead |
| A branch on an Amazon SES error name, such as `err.name === 'MessageRejected'`, `e.response['Error']['Code']`, `e.code`, `getAwsErrorCode()`, `ErrorCode`, `errors.As(err, &mr)` with `*types.MessageRejected`, or a `SendEmailError` variant | The name is anything but `TooManyRequestsException`, the v1 API's `Throttling`, or `BadRequestException`, or the site is in Rust. In another language, a branch on `TooManyRequestsException` or `Throttling` moves as a check of PostHog's status code for `429`, and a branch on `BadRequestException` moves as a check of PostHog's error name `validation_error` |
| A branch on the HTTP status, such as `err.$metadata.httpStatusCode`, `e.response['ResponseMetadata']['HTTPStatusCode']`, `getStatusCode()`, `StatusCode`, `HTTPStatusCode()`, or `raw_response()` in Rust | The site is in Rust: `posthog-sdks.md` gives PostHog's Rust error no status code. In another language, a branch on `400` reads PostHog's error name `validation_error`, and also its status code for `429` when the site sends with the v1 API (see "Errors"). A branch on another status, such as `429`, reads PostHog's status code |
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
| `{{#if paid}}…{{else}}…{{/if}}`, when `paid` is a boolean | `{% if variables.paid %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{name}}{{/each}}`, or `{{this.name}}` in the loop, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{#each tags}}{{this}}{{/each}}`, when `tags` is a list | `{% for tag in variables.tags %}{{ tag }}{% endfor %}` |
| `{{this}}` inside `{{#each items}}` | `{{ item }}` |
| The template's subject (`Subject` or `SubjectPart`) | The PostHog template's subject, with the same conversions |

- Amazon SES does not escape HTML in values, and PostHog's Liquid does. A value with plain text shows the same text. A value that holds HTML, such as a link or a list the code builds as markup, shows as escaped text in PostHog, so its template stays on Amazon SES. So does a template that uses triple braces, `{{{name}}}`.
- Handlebars treats `0`, an empty string, and an empty list as false, and Liquid treats them as true. Read what the site sends for each `if` and `unless` value. A value that is not always a boolean, `null`, or missing keeps the template on Amazon SES.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on Amazon SES.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`. `{{this}}` is the item itself and becomes `{{ item }}`.
- Any other helper, such as `{{#with}}`, `{{lookup}}`, or `{{log}}`, keeps the template on Amazon SES. So does an inline partial (`{{#* inline}}` and `{{> name}}`), `{{@index}}`, `{{@key}}`, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- `TemplateData` is a JSON string. `templateData` takes the object it was built from, before `JSON.stringify` or `json.dumps`. When the code only has the string, parse it.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `FromEmailAddress` / `Source` or `ReplyToAddresses` next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `CcAddresses`, `BccAddresses`, `Attachments`, or `ConfigurationOverrides.Tracking` next to the template stays: a template made in PostHog sends with its own settings, and the template form takes none of them.
- A template site that Amazon SES sent with opens or clicks untracked, or whose tracking isn't checked, stays, as "Open and click tracking" says: the template form takes no `captureEngagement`.

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

PostHog's events carry no Amazon SES `mail.messageId` and no `mail.tags`. A site whose events a handler matches by message id or by a tag stays on Amazon SES. A handler fed by an identity's default configuration set gets the events of every send from that identity that names no set: a send that names a set uses that set instead. A handler fed by the identity's SNS notifications (`SetIdentityNotificationTopic`) gets the events of every send from that identity, whatever its set. When either matches by message id or by a tag, every site whose sends it gets stays. A handler that finds the user by the recipient's address, such as `bouncedRecipients[].emailAddress`, keeps no site. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

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
- An attachment `{ FileName, RawContent, ContentType }` becomes `{ filename: FileName, content: RawContent, contentType: ContentType }`. Its `ContentId` becomes `contentId` only when its `ContentDisposition` is `INLINE`, because `contentId` makes a file inline. Drop the `ContentId` of every other attachment, and drop `ContentDisposition`. `contentId` is a bare name: drop `cid:` and angle brackets when the code has them. In the AWS SDKs `RawContent` holds the raw file: pass it as it is, as `posthog-sdks.md` takes bytes in each language. Where the code holds the file as a base64 string, Node.js and Python keep the base64 string, and Go and Elixir decode it first, as `posthog-sdks.md` says, or the recipient gets the file encoded twice. The body of a raw HTTP request holds base64, and so does Elixir's `ex_aws_ses`, which sends `Content` as JSON as it is: decode its `RawContent` with `Base.decode64!` first.
- `ConfigurationOverrides.Tracking` is dropped. The send gets `captureEngagement: false` when Amazon SES tracked neither opens nor clicks, as "Open and click tracking" says, whether the override, the configuration set, or the account's VDM settings did. Note in the plan row each site that got it from a set or the account.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the object of the site's `TemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Amazon SES send threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { code: error.code, name: error.name, statusCode: error.statusCode })`. In that `catch`, a read of `err.name` for logging becomes `err.code`, and a read of `err.$metadata.httpStatusCode` becomes `err.statusCode`. A check of `err.name === 'BadRequestException'` or of the status `400` becomes a check of `err.name === 'validation_error'`.
- **Python.** PostHog's SDK raises too. Replace `except ClientError` with the PostHog exception `posthog-sdks.md` names, `e.response['Error']['Code']` with its code, `e.response['Error']['Message']` with its message, and `e.response['ResponseMetadata']['HTTPStatusCode']` with its status code. A check of the code `BadRequestException` or the status `400` becomes a check of its name `validation_error`. `ClientError` covered only Amazon SES's answers: a network failure raised `EndpointConnectionError` or another `BotoCoreError` past it. PostHog's exception covers both, so raise it again first when its code is `network_error`. When the same `try` also guards other AWS calls, keep their `except` as well.
- **Ruby, PHP, and .NET.** PostHog's SDK throws too. Replace the rescued or caught Amazon SES exception (`Aws::SESV2::Errors::ServiceError`, `Aws\SesV2\Exception\SesV2Exception`, `AmazonSimpleEmailServiceV2Exception`, and their v1 names) with the PostHog exception `posthog-sdks.md` names, and the error code and status code reads with its own. A check of the code `BadRequestException` or the status `400` becomes a check of PostHog's error name `validation_error`. In Ruby and .NET the service exception covered only Amazon SES's answers, and a network failure (`Seahorse::Client::NetworkingError`, `HttpRequestException`) passed it: raise PostHog's exception again first when its code is `network_error`. When the handler catches the AWS SDK's base exception (`Aws::Errors::ServiceError`, `Aws\Exception\AwsException`, `Amazon.Runtime.AmazonServiceException`), or its `try` also guards other AWS calls, keep that handler for those calls and add PostHog's next to it.
- **A raw HTTP request.** It failed the way its client does. `axios` (unless its `validateStatus` accepts a failed status), `got` and `ky` (unless `throwHttpErrors: false`), Guzzle (unless `'http_errors' => false`), Faraday with `raise_error`, `raise_for_status()`, and `EnsureSuccessStatusCode()` threw on a refused send: the moved site raises PostHog's error the same way, as the language's bullet says, and a read of the client's status in the `catch` reads PostHog's status code. `fetch`, `aws4fetch`'s `AwsClient.fetch`, `requests`, `httpx`, Ruby's `Net::HTTP`, Go's `net/http`, and .NET `HttpClient` without `EnsureSuccessStatusCode()` answered it as a response: a check of that answer's status becomes a check of PostHog's error, and when the code never read the answer, Step 7's rule for an answer the code never read applies.
- **Go, Rust, and Elixir.** The site checked an error value. Check PostHog's error value the way `posthog-sdks.md` says for the language. A plain `if err != nil`, `?`, or `{:error, _}` branch stays as it is. In Go and Elixir, a branch on the status, such as `{:error, {:http_error, 429, _}}` or `HTTPStatusCode()`, reads PostHog's status code, except a branch on `400`, or Go's `*types.BadRequestException`, which reads PostHog's error name `validation_error`. In Rust, a branch on the status or on an error variant keeps the site on Amazon SES, as below.
- A branch on `TooManyRequestsException` becomes a check of PostHog's status code for `429`. So does a branch on the v1 API's `Throttling`: the v1 API answers a send over the sending rate or the daily quota with the code `Throttling` and status `400`, where v2 answers too many requests with `TooManyRequestsException` and `429`.
- PostHog answers a used-up quota with status `429` and the code `quota_limited`, which no retry clears. When a `429` branch tries the send again or waits before it, it also checks for a code other than `quota_limited`, and `quota_limited` takes the path of every other error. Note it in the plan row.
- In a site that sends with the v1 API, a branch on the status `400` also took throttling. It becomes a branch on PostHog's error name `validation_error` or its status code `429`, so a throttled send still takes it.
- A branch on Amazon SES's answer to an invalid send, `BadRequestException` or the status `400`, becomes a branch on PostHog's error name `validation_error`, never on a status code: PostHog's statuses for invalid sends differ from Amazon SES's, and `recipient_suppressed` is a `validation_error` with status `422`, handled first, as below.
- Never widen a catch. When the old code caught only `TooManyRequestsException`, catch PostHog's error, check its status code for `429`, and raise or return every other error as before. When it caught only `BadRequestException`, check PostHog's error name for `validation_error` in the same way, with `e.name`, `#name`, `getErrorName()`, `Name`, or `:name` (`:validation_error` in Elixir):
  - **Node.js:** a `catch` that tested `err.name === 'TooManyRequestsException'` tests `err.statusCode === 429` on the error thrown above, and throws every other error again.
  - **Python:** `except client.exceptions.TooManyRequestsException` becomes `except EmailError as e:` with `if e.status_code != 429: raise` first.
  - **Ruby:** `rescue Aws::SESV2::Errors::TooManyRequestsException` becomes `rescue PostHog::EmailError => e` with `raise unless e.status_code == 429` first.
  - **PHP:** a catch that tested `getAwsErrorCode() === 'TooManyRequestsException'` catches `PostHog\EmailError`, tests `getStatusCode() === 429`, and throws every other error again.
  - **.NET:** `catch (TooManyRequestsException)` becomes `catch (EmailException e) when (e.StatusCode == 429)`.
  - **Go:** `errors.As(err, &throttled)` with `*types.TooManyRequestsException` becomes `errors.As(err, &emailErr) && emailErr.StatusCode == 429`. Every other error goes on to the site's next check as before.
  - **Rust:** `posthog-sdks.md` gives PostHog's Rust error no status code and no name, so a match on `SendEmailError::TooManyRequestsException` or `SendEmailError::BadRequestException` keeps the site on Amazon SES.
  - **Elixir:** `{:error, {:http_error, 429, _}}` becomes `{:error, %PostHog.Emails.Error{status_code: 429}}`. Every other `{:error, _}` goes on as before.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Amazon SES took it and didn't send it. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `MessageId`, or stored it for the app's own use, takes PostHog's message id instead.

**The Amazon SES client.** Keep the Amazon SES client and its import while any site or other call still uses them. When nothing uses them, remove the import and the client. Keep the package and the AWS credentials for other uses: the AWS SDK package, such as `@aws-sdk/client-sesv2`, `aws-sdk`, `boto3`, `aws-sdk-go-v2`, or `ex_aws`, and the credentials often serve other AWS services in the same app, and `boto3` and `aws-sdk` cover every AWS service in one package. Remove the package only when no code uses it for anything else. The person removes the Amazon SES permissions after the cutover.
