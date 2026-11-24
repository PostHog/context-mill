# Amazon SES to PostHog mapping

This file decides, field by field, whether PostHog can send an Amazon SES call site. A site moves only when every field it sets moves. Otherwise it stays on Amazon SES, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python. Amazon SES fields are written in their v2 names, with the v1 name after a slash where it differs. `sdk-reference.md` has both.

## Fields

| Amazon SES | PostHog | A site stays on Amazon SES when |
|---|---|---|
| `FromEmailAddress` / `Source` | `from` | Never. `Name <address>` stays as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `Destination.ToAddresses` | `to` | It holds more than one address, or none. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `Destination.CcAddresses`, `BccAddresses` | none | Always. PostHog's send doesn't take it yet |
| `ReplyToAddresses` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A value read from an environment variable or a config file counts as read when `.env.example`, the config file, or the person shows a bare address for it |
| `Subject.Data` | `subject` | Never |
| `Body.Html.Data`, `Body.Text.Data` | `html`, `text` | Never |
| `Charset` on the subject or a body part | none | It is set to anything other than UTF-8. Ignore case, `-`, and `_` when you compare: `utf-8`, `utf8`, and `UTF_8` are UTF-8 and move. Any other charset, such as `ISO-8859-1`, keeps the site |
| `Content.Template` with `TemplateName` or `TemplateArn` and `TemplateData` / `SendTemplatedEmail` with `Template` or `TemplateArn` and `TemplateData` | the template's email, brought into the code and rendered with `TemplateData`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `Content.Template.TemplateContent` with `TemplateData` | none: the code renders `TemplateData` into its `Subject`, `Html`, and `Text` before the send | It uses a tag other than `{{name}}` or a path such as `{{contact.firstName}}`, as "Templates" says |
| `Content.Raw` / `SendRawEmail` | `from`, `to`, `replyTo`, `subject`, `html`, `text`, and `attachments`, from the values the code builds the MIME message from | As "Raw MIME messages" says |
| `Content.Simple.Attachments`, `Content.Template.Attachments` | `attachments` | Step 3 says so under "Files", or "Attachments" does |
| `Headers` | none | Always: no PostHog SDK takes headers yet |
| `EmailTags` / `Tags` | none | Always: no PostHog SDK takes tags yet |
| `ConfigurationSetName`, or the sending identity's default configuration set when the send names none | none | A webhook handler matches the set's events by message id or by a tag (see "Webhooks"), or the set's `DeliveryOptions.TlsPolicy` is `REQUIRE`, or its `DeliveryOptions.MaxDeliverySeconds` is below 50400, the most Amazon SES allows, or it has a `MessageSecurityOptions.SigningScheme.SmimeScheme` or an `ArchivingOptions.ArchiveArn`: Amazon SES delivered it only over TLS, gave up after that time, signed it with S/MIME, or archived it in Mail Manager, and PostHog's send has none of these. A set whose sending is off keeps the site only until the person agrees to deliver through PostHog, as "Sending turned off" says. Otherwise it moves: note the set's name in the plan row, because its event destinations stop getting events for this site. `account.md` says how to read an identity's default set |
| Open and click tracking: `ConfigurationOverrides.Tracking`, the configuration set's event destinations and VDM options, or the account's VDM settings | none, as "Open and click tracking" below says | As "Open and click tracking" below says. `OpenTrackingEnabled` or `ClickTrackingEnabled` set to `DISABLED` counts as set: it turns that tracking off for the send, whatever the set or the account does |
| `ListManagementOptions` | none | Always: no PostHog SDK takes it |
| `FeedbackForwardingEmailAddress` / `ReturnPath` | none | Always: no PostHog SDK takes it |
| `FromEmailAddressIdentityArn`, `FeedbackForwardingEmailAddressIdentityArn` / `SourceArn`, `ReturnPathArn`, `FromArn` | none | Always: the site sends for an identity another AWS account owns |
| `EndpointId` | none | Always. PostHog's send doesn't take it yet |
| `TenantName` | none | Always. PostHog's send doesn't take it yet |

**Open and click tracking.** No Amazon SES field maps directly in the call to PostHog's tracking: Step 7 sets `tracking` from the plan, as it says under "Sensitive emails and tracking", and never writes the deprecated `captureEngagement` field. Amazon SES decides opens and clicks one at a time. When the send's `ConfigurationOverrides.Tracking` sets `OpenTrackingEnabled` or `ClickTrackingEnabled`, that value decides, with one limit: `DISABLED` doesn't track it, and `ENABLED` tracks it when the send's configuration set has an event destination that publishes any event type, VDM engagement metrics are on for the send, or the other one of opens and clicks is tracked for the send. Without any of these, AWS ignores `ENABLED` and the message is sent untracked. When the send's `OpenTrackingEnabled` changes from send to send, the site stays, as Step 3 says under "Opens the provider didn't track". So does a site whose opens are tracked in one deployment and not in another, counted once per deployment as `account.md` says at its top, and the reason is `open tracking differs by deployment`. Otherwise Amazon SES tracks it when either of these is on for the send:

- VDM engagement tracking, which tracks both opens and clicks. The send's configuration set decides it when the set's `VdmOptions.DashboardOptions.EngagementMetrics` is set. Otherwise the account's `VdmAttributes.DashboardAttributes.EngagementMetrics` decides, for a send with no set too. Either is on only when it is `ENABLED` and the account's `VdmAttributes.VdmEnabled` is `ENABLED`.
- An enabled event destination of the send's configuration set, the one it names or its identity's default one, whose `MatchingEventTypes` lists `OPEN` for opens or `CLICK` for clicks.

A send with neither gets no tracking pixel, and its links stay as written. Read the account's VDM settings and each set the sites use, as `account.md` says under "Configuration sets", and work out, for opens and for clicks, whether Amazon SES tracked them:

- Opens tracked: the site moves with nothing to note.
- Opens untracked: the site's emails had no open pixel, and it moves with opens off, as Step 3 says under "Opens the provider didn't track". Never ask the person whether PostHog may add its pixel.
- Clicks: Step 7 marks every code send sensitive and never turns `clicks` on, so PostHog counts no clicks for a code send. When Amazon SES tracked a moved site's clicks, or nobody knows whether it did, note in the plan row that PostHog counts no clicks for it, unless it moves to a template made in PostHog that is not marked sensitive. When Amazon SES didn't track them, or nobody knows, a site that moves to a template made in PostHog follows Step 3 under "A template in PostHog".

When a site's open tracking depends on a setting the person can't give and the read-only key can't read, such as the account's VDM settings or a set's event destinations, nobody can tell whether its emails had an open pixel, and Step 3 says under "Opens the provider didn't track" what follows.

An Amazon SES send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Attachments

What Amazon SES's docs say about files:

- The [`Attachment`](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_Attachment.html) of a v2 send's `Content.Simple.Attachments` or `Content.Template.Attachments` has `FileName`, required, of up to 255 characters, `RawContent`, the file's data, required, and the optional `ContentType` and `ContentId`, each of up to 78 characters, `ContentDisposition` (`ATTACHMENT` or `INLINE`), `ContentDescription`, and `ContentTransferEncoding` (`BASE64`, `QUOTED_PRINTABLE`, or `SEVEN_BIT`). An AWS SDK Base64-encodes `RawContent` itself. A request to the HTTPS API, such as a raw HTTP request, carries it Base64-encoded.
- The [attachments guide](https://docs.aws.amazon.com/ses/latest/dg/attachments.html) says that `ContentDisposition` is `ATTACHMENT` when the file sets none, that Amazon SES derives a file's type from the extension of its `FileName` when it sets no `ContentType`, and that `ContentTransferEncoding` sets only how Amazon SES encodes the file inside the email. Its inline example sets `ContentId` to `logo123` and shows the file with `<img src="cid:logo123">`. The request carries each file's data and takes no URL or path, so Amazon SES fetches no file. Only the v2 `SendEmail` and `SendBulkEmail` take these fields: a v1 send, `Content.Raw`, and SMTP carry files inside a MIME message, as "Raw MIME messages" says.
- The same guide lists the file extensions Amazon SES refuses. They are the ones PostHog refuses, as Step 3 lists under "Files".
- The [quotas page](https://docs.aws.amazon.com/ses/latest/dg/quotas.html) takes an email of up to 40 MB with its files, after Base64 encoding, through the v2 API or SMTP, and of up to 10 MB through the v1 API.
- A stored template holds a subject, HTML, and text, and no files, so a template site's files come only from its send.

They don't say which bytes an AWS SDK sends for a `RawContent` the code passes as a text string. For that, read the installed client, as `sdk-reference.md` says under "The installed client", and name the file you read in the site's plan row. A site that sends files moves as one entry of PostHog's `attachments` per file, under the PostHog SDK's names, as its rewrite file gives them, after Step 3's checks under "Files":

| Amazon SES | PostHog |
|---|---|
| `FileName` | The filename. Amazon SES requires one. Step 3 says under "Files" which filenames PostHog refuses |
| `RawContent` | The content: the same bytes, in the form of bytes the rewrite file gives. In an AWS SDK call, the value is the file itself, which the SDK encodes: bytes, such as a `Buffer`, a `Uint8Array`, Python `bytes`, or a `[]byte`, pass as they are. Elixir's `ex_aws_ses` is a community package whose docs don't say whether it encodes `RawContent`: read the installed client every time. When it sends `RawContent` as it is given, the code passed Base64: decode it once, skipping line breaks, with `Base.decode64!(value, ignore: :whitespace)`. When it encodes it, pass the value as it is, as for any AWS SDK. An Elixir binary alone settles nothing. A text string passes as the bytes the installed client sends for it, never as a string to a PostHog SDK that reads a string as Base64. In a raw HTTP request's body, the value is Base64: decode it, skipping line breaks. When the installed client doesn't settle what it sent, the site stays, and the reason is `attachment content not checked` |
| `ContentType` | The content type, as it is: a type with parameters, such as `text/calendar; method=REQUEST`, follows Step 3 under "Files". When the file sets none, Amazon SES derived it from the extension of `FileName`: set the type that extension names, such as `application/pdf` for `.pdf` or `text/calendar` for `.ics`, and note `content type set from the filename` in the plan row. When the extension names none, the site stays, and the reason is `a file without a content type`: the docs don't say what Amazon SES sent |
| `ContentId` on a file whose `ContentDisposition` is `INLINE` | The content ID: the bare ID that the HTML shows with `<img src="cid:...">`, such as `logo123` for `cid:logo123`. PostHog sends a file with a content ID inline, so the file stays inline. Leave the HTML as it is |
| `ContentDisposition` `ATTACHMENT`, or none | No content ID: PostHog sends a file without one as an attachment, as Amazon SES did. A `ContentId` on such a file is dropped, unless the site's HTML names it with `cid:`. Then the site stays, and the reason is `a content ID on a file sent as an attachment`: the docs don't say whether the email showed it |
| `ContentDisposition` `INLINE` without `ContentId` | none. PostHog sends a file without a content ID as an attachment, where Amazon SES sent it inline. The site stays, and the reason is `an inline file without a content ID` |
| `ContentDescription` | none. PostHog's send takes no description of a file: drop it, and note in the plan row that the file loses its description |
| `ContentTransferEncoding` | none. It sets only how the file is encoded inside the email, and PostHog encodes it itself: the recipient gets the same bytes |

- **Size and count.** Amazon SES's limit is no more than PostHog's 40 MB, so Step 3's check decides each site. Its docs set no count of files, so Step 3's limit of 10 still applies.
- **Templates.** A template site's files move with the email brought into the code. A template made in PostHog takes no files, as Step 7 says: a site with files that the person wants on such a template stays, and the reason is `a template in PostHog takes no files`.

## Raw MIME messages

The v1 `SendRawEmail` and the v2 `SendEmail` with `Content.Raw` take a whole MIME message: its headers, its body, and its files in one document, which the code builds. PostHog takes no MIME message, but it takes what the message carries. Read the code that builds the message, such as a MIME library's call with a from address, a recipient, a subject, a body, and files, or a string with each value in place, and map each value the code puts into it. A MIME library fills in what the code leaves out, such as a content type from a filename, a filename from a path, or a part's disposition: when its docs don't say what it writes, read the installed library, as `sdk-reference.md` says under "The installed client". The site stays when the code doesn't build the message from values you can read, such as one it reads whole from a file, a queue, or a database, one a caller passes that you can't follow, or one it forwards, and when the installed library doesn't settle what the message carries. The reason is `the MIME message not checked`.

Sort the parts first. A body part is a `text/plain` or `text/html` part with no filename and no `Content-Disposition`, or with `Content-Disposition: inline` and no filename, where the structure row below places a body. A file is every other part with a filename, a `Content-Disposition`, or a `Content-ID` inside `multipart/related`. Only what is left is "any other part".

| In the message or the call | PostHog | A site stays on Amazon SES when |
|---|---|---|
| `From` | `from` | As the `FromEmailAddress` row says. Decode a name in encoded-word syntax, such as `=?utf-8?B?...?=`, to its text |
| `Source` (v1) or `FromEmailAddress` (v2) on the call | none | It holds another address than the `From` header: the reason is `its sender differs from its From line` |
| `To` | `to` | As the `Destination.ToAddresses` row says |
| `Destinations` (v1) or `Destination` (v2) on the call | none | It names any address but the one of `To`: Amazon SES sent the email to the addresses it names, as the [raw email guide](https://docs.aws.amazon.com/ses/latest/dg/send-email-raw.html) says. The reason is `its recipients differ from its To line` |
| `Cc`, `Bcc` | none | Always, as the `CcAddresses` row says |
| `Reply-To` | `replyTo` | As the `ReplyToAddresses` row says |
| `Subject` | `subject` | Never. Decode encoded words to text |
| `Message-ID`, `Date` | none | Never. Amazon SES wrote its own, as the [`SendRawEmail` reference](https://docs.aws.amazon.com/ses/latest/APIReference/API_SendRawEmail.html) says, and PostHog writes its own |
| `MIME-Version`, and the boundaries of the message's parts | none | Never. PostHog builds its own MIME message |
| The message's structure | none: PostHog's send takes one `text`, one `html`, and files | It is none of these. An HTML body is a `text/html` body part, or a `multipart/related` that holds one first and inline files after it. A body is a `text/plain` body part, an HTML body, a `multipart/alternative` of a `text/plain` body part and then an HTML body, in that order, or a `multipart/related` that holds such a `multipart/alternative` first and inline files after it. The message is a body, or a `multipart/mixed` with a body first and only files after it. Anything else keeps the site, and the reason is `a MIME structure PostHog doesn't send`: such as two body parts in `multipart/mixed`, which a mail app shows one after the other, or `text/html` before `text/plain` in `multipart/alternative`, where a mail app shows the plain text |
| `X-SES-CONFIGURATION-SET`, `X-SES-MESSAGE-TAGS` | none | As the `ConfigurationSetName` and `EmailTags` rows say: the [event publishing guide](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-send-email.html) names the set and the tags of a raw message in these headers |
| `X-SES-SOURCE-ARN`, `X-SES-FROM-ARN`, `X-SES-RETURN-PATH-ARN`, and `SourceArn`, `FromArn`, `ReturnPathArn` on the call | none | Always, as the `FromEmailAddressIdentityArn` row says |
| `Return-Path` | none | Always, as the `ReturnPath` row says: Amazon SES sends bounces and complaints to it, as the [header fields page](https://docs.aws.amazon.com/ses/latest/dg/header-fields.html) says |
| Any other header, such as `List-Unsubscribe`, `In-Reply-To`, or an `X-` header | none | Always, as the `Headers` row says |
| A `text/plain` body part | `text` | Its `Content-Type` has a parameter other than `charset`, such as `format=flowed`, or its charset is other than UTF-8 or US-ASCII, as the `Charset` row says: US-ASCII text is the same in UTF-8. Decode its transfer encoding, such as quoted-printable, to its text |
| A `text/html` body part | `html` | The same as `text/plain` |
| A file | One entry of `attachments`, as the table below says | Step 3 says so under "Files" |
| Any other part, such as a second HTML part, a `text/calendar` part inside `multipart/alternative`, a `message/rfc822` part, or a signed or encrypted message, such as `multipart/signed` or `application/pkcs7-mime` | none | Always. The reason is `a MIME part PostHog doesn't send: <type>` |

Each file of the message becomes one entry of PostHog's `attachments`, under the PostHog SDK's names, after Step 3's checks under "Files":

| Part of a file | PostHog |
|---|---|
| `filename` of `Content-Disposition`, or `name` of `Content-Type` when it has none | The filename, decoded to its text when it is encoded, such as `filename*=utf-8''...`. A file with neither keeps the site, as Step 3 says |
| The part's body | The content: the bytes the code puts into the part, before their transfer encoding, in the form of bytes the rewrite file gives. Decode a `base64` or `quoted-printable` body that the code encodes itself |
| `Content-Type` | The content type, as the code sets it: a type with parameters follows Step 3 under "Files" |
| `Content-ID` of a part whose `Content-Disposition` is `inline`, or that has none inside `multipart/related` | The content ID without its angle brackets, such as `logo` for `<logo>`: the ID the HTML shows with `cid:logo`. PostHog sends the file inline |
| A part whose `Content-Disposition` is `attachment`, or that has none outside `multipart/related` | No content ID, as the `ContentDisposition` `ATTACHMENT` row above says |
| A part whose `Content-Disposition` is `inline` without a `Content-ID` | none. The site stays, as the `ContentDisposition` `INLINE` row above says |
| `Content-Description`, `Content-Transfer-Encoding` | none, as the `ContentDescription` and `ContentTransferEncoding` rows above say |

A MIME library that reads a file from a local path reads it in the app: read the same file at the same point, to its end. A library that fetches a file from a URL keeps the site, and the reason is `the MIME library fetches <file>`. Amazon SES takes a raw message of up to 10 MB through the v1 API and 40 MB through the v2 API, after Base64 encoding, so Step 3's check of PostHog's 40 MB decides each site.

## Calls

| Amazon SES call | A site stays on Amazon SES when |
|---|---|
| `SendEmail` in any SDK: `SendEmailCommand`, `AWS.SES().sendEmail`, `AWS.SESV2().sendEmail`, `send_email`, `sendEmail`, `SendEmail`, `SendEmailAsync`, `send_email()`, `ExAws.SES.send_email`, `ExAws.SES.send_email_v2`, `POST /v2/email/outbound-emails`, `Action=SendEmail` | A field above keeps it |
| `SendTemplatedEmail` / `send_templated_email` | A field above keeps it, or "Templates" does |
| `SendRawEmail` / `send_raw_email`, and `SendEmail` with `Content.Raw` | As "Raw MIME messages" says |
| `SendBulkEmail`, `SendBulkTemplatedEmail`, and their names in each SDK | Always: each sends several emails in one call |
| Nodemailer's `SES` transport | Always: PostHog has no Nodemailer transport |
| SMTP through `email-smtp.<region>.amazonaws.com` | Always here |
| A framework mailer (Django, Rails, Laravel, Symfony, Swoosh, Bamboo) | Always: PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Code around the send

Most AWS SDKs throw on an error: Node.js, Python, Ruby, PHP, .NET, and Java. The Go, Rust, and Elixir SDKs return an error value. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Amazon SES when |
|---|---|
| A `catch`, `except`, `rescue`, or error check that only logs the error, returns, or throws it again | Never. Log PostHog's error instead |
| A branch on an Amazon SES error name, such as `err.name === 'MessageRejected'`, `e.response['Error']['Code']`, `e.code`, `getAwsErrorCode()`, `ErrorCode`, `errors.As(err, &mr)` with `*types.MessageRejected`, or a `SendEmailError` variant | The name is anything but `TooManyRequestsException`, the v1 API's `Throttling`, or `BadRequestException`. A branch on `TooManyRequestsException` or `Throttling` is a branch on the rate limit, which goes as Step 7 says, and a branch on `BadRequestException` moves as a check of PostHog's error name `validation_error` |
| A branch on the HTTP status, such as `err.$metadata.httpStatusCode`, `e.response['ResponseMetadata']['HTTPStatusCode']`, `getStatusCode()`, `StatusCode`, `HTTPStatusCode()`, or `raw_response()` in Rust | Never. A branch on `400` reads PostHog's error name `validation_error`, and in a site that sends with the v1 API it also took throttling (see "Errors"). A branch on `429` is a branch on the rate limit, which goes as Step 7 says. A branch on another status reads PostHog's status code |
| The `MessageId` stored for a webhook handler or a `GetMessageInsights` read | Always, when a handler or the read uses it |
| The `MessageId` logged | Never. Log PostHog's message id |
| The `MessageId` returned to the site's callers or stored for the app's own use | When the site throws or reports a failure on any error, unless its callers already handle a send without an id: a send PostHog refuses as suppressed has none, as "Rewrite" says. Otherwise never: use PostHog's message id |
| A deadline, timeout, or retry setting on the request or its client | As "HTTP" below says |

## HTTP

A site whose Amazon SES request had its own deadline keeps it, as `7-rewrite.md` says under "Set up the client". Only a raw HTTP request can have one that PostHog's SDK keeps: a timeout the code set on its HTTP client, such as `AbortSignal.timeout(5000)` on `fetch`, `got`'s `timeout.request`, a `timeout` of one number in `requests` or `httpx`, `'timeout'` in Guzzle, a `Net::HTTP` or Faraday timeout that `rewrite-ruby.md` says under "A deadline" is the SDK's kind of limit, Go's `http.Client` `Timeout` or a context with a deadline, and .NET's `HttpClient.Timeout` or a cancellation token with a timeout. Step 7 and the rewrite file's "A deadline" say which limits count and which the SDK can't keep, such as `axios`'s or `ky`'s `timeout`, or one on connecting alone, and those keep the site.

The AWS SDKs and `aws4fetch`'s `AwsClient` retried inside their deadlines and timeouts, each in its own way, so the PostHog SDK can't keep such a deadline, and each of these keeps the site: `moves: no — the PostHog SDK can't keep the request's deadline`.

- A deadline on an AWS SDK or `AwsClient` call, such as `{ abortSignal: AbortSignal.timeout(5000) }`, a Go context with a deadline, or a .NET cancellation token with a timeout.
- A timeout setting in the AWS client's config, such as `requestTimeout`, `read_timeout`, `connect_timeout`, `http_read_timeout`, PHP's `'http' => ['timeout' => ...]`, Rust's `timeout_config`, or `ex_aws`'s `recv_timeout`.

A retry setting alone, in the AWS client's config, such as `maxAttempts`, `retries`, `retry_limit`, Rust's `retry_config`, or `AwsClient`'s `retries`, or in a raw request's HTTP client, such as `got` or `ky` with `POST` in `retry.methods`, `axios-retry`, Faraday's `retry` with `:post` in `methods` or a `retry_if`, a Guzzle retry middleware, or a `requests` adapter with a `Retry`, keeps no site: the send keeps the SDK's own retries, as Step 7 says under "Set up the client".

Follow a context, token, or abort signal back through the callers, as for the distinct ID. One that any caller builds from a timeout, such as `AbortSignal.timeout` or an `AbortSignal.any` that holds one, is a deadline. One that only cancels, such as a request's, is no deadline, and neither is a deadline the runtime or framework puts on the request, such as Lambda's or an incoming gRPC call's. When the callers pass different deadlines, or some pass none, and the send can't take the signal, context, or token, the site stays with the deadline reason. Pass it where the send takes one, as Go's context and .NET's token do. Where the send takes none, as in Node.js, the send goes on after a cancel: note it in the plan row.

## Templates

A site that sends a stored template moves by bringing the template into the code, as `template-to-code.md` says. The check needs the template's content, because the code has only its name or ARN. `account.md` says how to get it, from the account and Region the site sends with. The code renders the template's subject, HTML, and text with the values of the site's `TemplateData`, and the send sets the rendered `subject`, `html`, and `text`.

A site that sends an inline template, `Content.Template.TemplateContent`, already has its content in the code: Amazon SES only filled in the values. It moves the same way, from the content the code passed. Literal strings become the email, as `template-to-code.md` says under "Where the email goes". Content the code reads at run time, such as from a file or a database, stays where it is, and a function next to the send replaces each marker in it. Amazon SES takes only simple substitutions in an inline template, so one that uses anything other than `{{name}}` or a path such as `{{contact.firstName}}` stays: the docs don't say what Amazon SES did with the rest.

`TemplateData` is a JSON string. The code renders from the object it was built from, before `JSON.stringify`, `json.dumps`, `Jason.encode!`, or the language's own encoder. When the code only has the string, such as one read from a queue, parse it first.

Amazon SES templates are Handlebars. In the code:

| Amazon SES | In the code |
|---|---|
| `{{name}}`, `{{ name }}` | The value. Amazon SES inserted it as it is, unescaped, in every part. In the HTML, escape it anyway, except a value the code builds as HTML itself, under the rule of `template-to-code.md` |
| `{{contact.firstName}}` | The nested value, the same way |
| `{{{name}}}` | The same as `{{name}}`: Amazon SES escapes neither |
| A value missing from `TemplateData`, or a missing step of a path | Amazon SES failed the render: it accepted the send, answered a `MessageId`, and never sent it, with a `Rendering Failure` event that says `Attribute '<name>' is not present in the rendering data.` The render in the code raises before the send, so the email still doesn't go out, and the site's error handling now sees it. Note it in the plan row |
| A `null` value, or `""` | The docs name only a missing value. Treat `null` as missing, and render `""` as nothing. Note in the plan row each value the code can pass as `null` or `""` |
| A number or a boolean | As `TemplateData` writes it, such as `10.0`, `3`, or `true`: Python's `True` renders as `true`. The docs don't say how Amazon SES writes a number, so render the text of the JSON |
| `{{#if a}}…{{else if b}}…{{else}}…{{/if}}` | A branch that tests each value for Handlebars truth, in order. With `includeZero=true`, `0` is true |
| `{{#unless a}}…{{else}}…{{/unless}}` | The same branch, with the test turned around |
| `{{#each items}}…{{else}}…{{/each}}` | A loop over the list, or over the values of an object in the order its keys stand in `TemplateData`. The `{{else}}` part shows when there is nothing to walk |
| Inside `{{#each}}`: `{{this}}`, `{{this.name}}`, or a bare `{{name}}` | The current item, or its field. A bare name reads only the item. When an item can lack that field, the template stays: the docs don't say whether Amazon SES failed the render or read the value outside the loop |
| Inside `{{#each}}`: `{{@index}}`, `{{@key}}`, `{{@first}}`, `{{@last}}`, `{{../name}}`, `{{@root.name}}` | The item's position from 0, its key in an object, whether it is the first or the last, and the value one level out or at the top |
| `{{#with contact}}…{{else}}…{{/with}}` | The block, where bare names read the fields of `contact`, or the `{{else}}` part when `contact` is empty: `false`, missing, `null`, `""`, or an empty list. This is not the truth test of `if`: the Handlebars docs list `0` as false for `if` but say only "empty" for `with`, so they don't settle `0`. When the value can be `0`, the template stays, and the reason is `its {{#with}} can take 0` |
| `{{! note }}`, `{{!-- note --}}`, `{{log …}}` | Nothing |
| The template's `Subject` / `SubjectPart` | The send's `subject`, rendered with the same conversions and no escaping |
| The template's `Html` / `HtmlPart` | The send's `html`. A template without an HTML part sends `text` only |
| The template's `Text` / `TextPart` | The send's `text`, with no escaping. A template without a text part sends `html` only |

- Handlebars truth, for `if` and `unless`: `false`, a missing value, `null`, `""`, `0`, and an empty list are false. Everything else is true, including `"0"`, `"false"`, and an empty object. Write that test out in the code, as `template-to-code.md` says. The docs don't say whether a value missing from `TemplateData` that only an `if`, `unless`, `each`, or `with` reads fails the render: treat it as false, and note it in the plan row.
- Any other helper, a `{{> name}}`, and the `{{amazonSESUnsubscribeUrl}}` tag, which Amazon SES fills only for a send with `ListManagementOptions`, keep the template on Amazon SES.
- A template belongs to one account and Region: a template of the same name in another Region, or in another AWS account, is another template. Read each one in the Region its site sends in, as `account.md` says. A `TemplateArn` names its Region after `arn:aws:ses:` and its name after `template/`. Two sites that send the same name in two Regions or accounts share one email only when the two contents are the same. A site whose code runs in several deployments, as `account.md` says at its top, sends a template from each one's account and Region: it moves only when the contents are the same in each, and otherwise stays, and the reason is `its template differs between deployments`.
- An Amazon SES template holds no sender, reply-to address, or preview text, so the send takes the site's own `FromEmailAddress` / `Source` and `ReplyToAddresses`, as the "Fields" table says. Its subject always comes from the template: a templated send has no subject of its own.
- Amazon SES hosts no images, so a template's images sit on the person's own hosts, such as an S3 bucket. Keep every URL, and list none as hosted by the provider.
- `Content.Template.Headers` keeps the site, as the "Fields" table says. `Content.Template.Attachments` moves with the email brought into the code, as "Attachments" says. `SendBulkTemplatedEmail` and `SendBulkEmail` still stay, as "Calls" says: each sends several emails in one call.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the Amazon SES template, makes it transactional, and gives you its template ID. Until then the site stays on Amazon SES. An inline template takes the same path when the person asks for one: read its content from the code for the check. Amazon SES's Handlebars becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

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
- A value the template prints, such as `{{name}}` or a path, that a send can leave out of `TemplateData` or pass as `null`, or a missing step of its path: Amazon SES failed the render and sent nothing, as the table above says, and Liquid renders it as nothing and sends. Check each such value in the code and raise before the send when one is missing, as the render in the code does above, so the email still doesn't go out, but only when the branch that prints it runs for the send's values, under the same `if`, `unless`, and `each` the template has: `{{#if paid}}{{invoiceId}}{{/if}}` with `paid` false prints nothing and raises nothing. Note it in the plan row. A value read only by `if`, `unless`, or `each` follows the bullets on those instead.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on Amazon SES.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`. `{{this}}` is the item itself and becomes `{{ item }}`.
- Any other helper, such as `{{#with}}`, `{{lookup}}`, or `{{log}}`, keeps the template on Amazon SES. So does an inline partial (`{{#* inline}}` and `{{> name}}`), `{{@index}}`, `{{@key}}`, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- `templateData` takes the object `TemplateData` was built from, as above.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `FromEmailAddress` / `Source` or `ReplyToAddresses` next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.

## Webhooks

The handlers stop getting events for a site that moves: Amazon SES no longer sends it. PostHog records the events of a moved send on the person it names with `distinctId`, when the project's **Capture email engagement events** setting is on and the send's tracking doesn't turn engagement off, as Step 7 says under "Sensitive emails and tracking":

| Amazon SES event | PostHog event |
|---|---|
| `Send` | `$workflows_email_sent` |
| `Delivery` | `$workflows_email_delivered` |
| `Bounce` | `$workflows_email_bounced` |
| `Complaint` | `$workflows_email_blocked` |
| `Open` | `$workflows_email_opened` |
| `Click` | `$workflows_email_link_clicked`, only when PostHog tracks the email's clicks: for a template made in PostHog that is not marked sensitive and with tracking on, or a code send whose tracking leaves clicks on, as the table in Step 7 under "Sensitive emails and tracking" says. Step 7 marks every code send sensitive and never turns `clicks` on, so its links go out as they are, and PostHog counts no clicks |
| `Reject`, `Rendering Failure`, `DeliveryDelay`, `Subscription` | none |

A bounce to an address on the account-level suppression list comes as a `Bounce` with `bounceSubType` `OnAccountSuppressionList`. PostHog refuses that send instead, with `recipient_suppressed`, when it holds the address as a `bounce`. An address on the list for `COMPLAINT` gets the moved send.

PostHog's events carry no Amazon SES `mail.messageId` and no `mail.tags`. A site whose events a handler matches by message id or by a tag stays on Amazon SES. A handler fed by an identity's default configuration set gets the events of every send from that identity that names no set: a send that names a set uses that set instead. A handler fed by the identity's SNS notifications (`SetIdentityNotificationTopic`) gets the events of every send from that identity, whatever its set. When either matches by message id or by a tag, every site whose sends it gets stays. A handler that finds the user by the recipient's address, such as `bouncedRecipients[].emailAddress`, keeps no site for that, though the event it acts on can, as below. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, and that its sends can produce, stays: `Reject` and `DeliveryDelay` for any send, `Rendering Failure` only for a templated send, stored or inline, and `Subscription` only for a send with `ListManagementOptions`, which stays anyway. The reason is `its <event> events feed a webhook handler`.

A site whose clicks Amazon SES tracked, and whose events reach a handler that acts on `Click` events, however it finds its records, stays, and the reason is `its clicks feed a webhook handler`, as Step 3 says under "Opens the provider didn't track".

## Suppressions

PostHog keeps one suppression list per project and refuses every moved send to an address it holds as a `bounce`, the import's `BOUNCE` entries, as `account.md` says under "Map each entry". A `COMPLAINT` entry refuses no moved send. Step 5 imports the entries that apply to any moved site, as `account.md` says under "Map each entry", while Amazon SES checked each send only against its own Region's list, for the reasons its configuration set suppresses. A moved site, counted once per deployment as `account.md` says at its top, therefore has sends refused to addresses Amazon SES delivered to when it sends through another list than another moved site, in another Region or with another AWS account, as `account.md` says at its top, or when its set's reasons leave out `BOUNCE` while another moved site's set suppresses it, such as a set that suppresses only `COMPLAINT`, or a set that turns suppression off. Its code handles that refusal like a send that went out, as "Rewrite" says, so nothing tells the app the email didn't go.

Work out these sites from the AWS accounts and Regions the sites send with, the sets' suppression settings, and the account's reasons, which `account.md` reads under "Configuration sets" and "Suppression list". A set whose suppression settings can't be read counts as one whose reasons differ. After an earlier run, as `account.md` says under "An earlier import", the lists and reasons its import took count as one more moved site's, since PostHog's list already holds them. The sites earlier runs moved widen too when this run's import adds a list's `BOUNCE` entries that no earlier import took: name them in the question by the code whose PostHog client carries the provider name `amazon-ses`, with the earlier report's "Send call sites" rows whose status starts with "Moved", and as another app's moved sites when another app's migration imported, and ask about the sites this run moves whose entries add it. Ask the person once, for all of them together, whether PostHog may refuse those sends. Yes: they move, and write `suppressions widened: the person agreed` in each one's note under the sites table. No, or no answer: the sites this run would move stay, and the reason is `suppression list wider than Amazon SES's`. Then work it out again for the sites still moving, since the import now takes fewer entries.

## Auto Validation

When Amazon SES Auto Validation is on, Amazon SES checks each recipient as it delivers and suppresses those below the person's threshold, reported as a `Bounce` with `bounceSubType` `EmailValidationSuppressed`. PostHog has no such check, and no import can carry it, since it judges each address as it sends. The set's `ValidationOptions` decides for its sends when the set holds one, and the account's `ValidationAttributes` otherwise, for a send with no set too, as `account.md` reads them under "Configuration sets" and "Suppression list". A site whose sends it covers, in any deployment that runs it, whichever project that deployment sends into, stays, and the reason is `Amazon SES Auto Validation checks its recipients`. When the setting that decides can't be read, or the set can't be read, so it is unknown which one decides, ask the person whether Auto Validation is on for those sends, in the Amazon SES console under Email Validation and the set's Auto Validation options; no answer counts as on.

## Sending turned off

Amazon SES delivered none of a send's emails when sending was off for it: its configuration set's `SendingOptions.SendingEnabled` is `false`, or, in its Region, the account's `SendingEnabled` is `false`, turned off by the person or paused by AWS, or its `EnforcementStatus` is `SHUTDOWN`. An account whose `ProductionAccessEnabled` is `false` is in the sandbox: Amazon SES sent only to verified addresses and refused every other. PostHog's send has none of these, so a moved site would deliver what Amazon SES didn't. `account.md` reads them under "Configuration sets". A site whose sends one of them covers, in any deployment that runs it, stays, and the reason is `Amazon SES sending is off for it`, or `the Amazon SES account is in the sandbox`, unless the person explicitly agrees that PostHog may deliver those emails. Ask once, naming each such site, the set or account, and the setting. When they agree, the site moves, and its plan row records it, such as `sending off at Amazon SES: the person agreed to deliver through PostHog`. When a setting can't be read, ask the person whether sending is on for the set and the account, in the Amazon SES console under Configuration sets and the Account dashboard, and whether the account has production access; no answer counts as off.

An IAM policy can refuse sends too: a policy of the role or user a site sends with, or of its sending identity, that limits the action the site calls. It limits it when it allows the action only on some ARNs in `Resource` or only under a `Condition`, or denies it on some ARNs or under a condition, such as a staging role that may mail only the company's domain, or a role that may send only from one address or with one configuration set. The action is `ses:SendEmail` for a v2 send and v1 `SendEmail`, and `ses:SendTemplatedEmail` for v1 `SendTemplatedEmail`, and a wildcard that covers it counts too, such as `ses:Send*`, `ses:*`, or `*`. Amazon SES refused every send outside the limit, and PostHog's project key carries no such limit, so a moved site would deliver what Amazon SES didn't. Read the policies the app's infrastructure code grants its sending roles, such as Terraform, CloudFormation, the AWS CDK, or a `serverless.yml`, and each sending identity's `Policies`, which `account.md` reads under "Configuration sets". Judge the policies together, as AWS does. Among the role's or user's own policies, an Allow limits nothing when another of them grants the same action more widely, such as `AmazonSESFullAccess` or `Resource: *`. A permissions boundary, a session policy, or a service control policy limits on its own, whatever the role's policies grant, and an explicit Deny anywhere limits. A statement for a principal other than the one the app sends with, such as another account in an identity's `Policies`, doesn't apply. Count every condition, whatever its key. Then ask the person once whether a policy outside the code, such as a permissions boundary or a service control policy, limits the app's sends in any way: whom they may mail, which identity, configuration set, template, address, name, or feedback address they may send with, or the network, Region, or tags they need. A site stays when such a limit, in any deployment that runs it, refused or could refuse any of its sends. Check only the values the limit reads: for `Resource`, each ARN the send uses, its identity (its From address or that address's domain, whichever Amazon SES verified), its configuration set (the one it names or the identity's default), and its template; for a condition, the value of each key it tests, such as `ses:Recipients`, `ses:FromAddress`, `ses:FromDisplayName`, `ses:FeedbackAddress`, `aws:ResourceTag/<key>`, or `aws:SourceIp`. One the code builds at run time, one the site leaves unset, one the code doesn't hold, such as a tag, the app's network, or its Region, or a literal the limit doesn't let through could be refused. A site whose every value the limit reads is a literal the limit lets through moves. The reason is `an IAM policy limits its sends`, and the site moves only when the person explicitly agrees that PostHog may deliver those emails, as above. When the person doesn't answer, count a policy outside the code as one that limits every site.

## Calls that change the suppression list

`PutSuppressedDestination` adds an address to the account-level suppression list of one Region, with a reason of `BOUNCE` or `COMPLAINT`, `DeleteSuppressedDestination` removes one, and `CreateImportJob` with a `SuppressionListDestination` adds or removes the addresses of a file in Amazon S3. Step 3 and Step 5 say what to do with each such call, such as an unsubscribe handler or a reactivation, in any SDK's spelling, such as `PutSuppressedDestinationCommand` or `delete_suppressed_destination`. They are not sends, and they stay on Amazon SES.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set the provider name to `amazon-ses` on the PostHog client that Step 7 configures, under the name the rewrite file gives, such as `migratedFrom: 'amazon-ses'` in Node.js or `migrated_from="amazon-ses"` in Python, when the client options take it.

**The call.** The Amazon SES send becomes one PostHog send. Build its fields from the input the site built:

- v2 `SendEmail` in any SDK: `FromEmailAddress`, `Destination`, `ReplyToAddresses`, and `Content.Simple` or `Content.Template`.
- v1 `SendEmail` in any SDK: `Source`, `Destination`, `ReplyToAddresses`, and `Message`. v1 `SendTemplatedEmail`: `Source`, `Destination`, `ReplyToAddresses`, `Template` or `TemplateArn`, and `TemplateData`.
- Elixir `ExAws.SES.send_email_v2(destination, content, from, opts)`: the same v2 fields, with `opts[:reply_addresses]` as `ReplyToAddresses`. `ExAws.SES.send_email(dst, msg, from, opts)`: `dst.to`, the `html`, `text`, and `subject` of `build_message`, and `opts[:reply_to]`. `ExAws.SES.send_templated_email(dst, src, template, template_data, opts)`: `dst.to`, `src`, the template's name, the map encoded into `template_data`, and `opts[:reply_to]`.
- A raw HTTP request: the fields of its JSON body or its form parameters.
- v1 `SendRawEmail`, v2 `SendEmail` with `Content.Raw`, and Elixir's `send_raw_email`: the values the code builds the MIME message from, as "Raw MIME messages" says. Remove the code that builds the message when nothing else uses it.

**The fields.**

- `FromEmailAddress` / `Source` becomes `from` as it is, with its name.
- The one entry of `ToAddresses` becomes `to`, as a bare address. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `Subject.Data`, `Body.Html.Data`, and `Body.Text.Data` become `subject`, `html`, and `text`.
- `Content.Simple.Attachments` and `Content.Template.Attachments`, and the files of a raw message, become `attachments`, each file as "Attachments" and "Raw MIME messages" say.
- `ConfigurationOverrides.Tracking` is dropped. A site whose plan note says `opens off` turns off the `opens` switch of tracking, as Step 7 says.

**Templates brought into the code.** The site renders the email from the object of its `TemplateData`, as "Templates" says, and sends `templateKey`, the rendered `subject`, `html`, and `text`, and the site's own `from` and `replyTo`. It sends no `templateId` and no `templateData`. An inline template is sent the same way. Remove the encode of `TemplateData` when nothing else uses the string.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the object of the site's `TemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Amazon SES send threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { code: error.code, name: error.name, statusCode: error.statusCode })`. In that `catch`, a read of `err.name` for logging becomes `err.code`, and a read of `err.$metadata.httpStatusCode` becomes `err.statusCode`. A check of `err.name === 'BadRequestException'` or of the status `400` becomes a check of `err.name === 'validation_error'`.
- **Python.** PostHog's SDK raises too. Replace `except ClientError` with the PostHog exception the rewrite file names, `e.response['Error']['Code']` with its code, `e.response['Error']['Message']` with its message, and `e.response['ResponseMetadata']['HTTPStatusCode']` with its status code. A check of the code `BadRequestException` or the status `400` becomes a check of its name `validation_error`. `ClientError` covered only Amazon SES's answers: a network failure raised `EndpointConnectionError` or another `BotoCoreError` past it. PostHog's exception covers both, so raise it again first when its code is `network_error`, unless a later handler of the same `try`, such as `except BotoCoreError` or `except Exception`, took every network failure: then don't raise it, and run that handler's code for `network_error`, as Step 7 says. When the same `try` also guards other AWS calls, keep their `except` as well.
- **Ruby, PHP, and .NET.** PostHog's SDK throws too. Replace the rescued or caught Amazon SES exception (`Aws::SESV2::Errors::ServiceError`, `Aws\SesV2\Exception\SesV2Exception`, `AmazonSimpleEmailServiceV2Exception`, and their v1 names) with the PostHog exception the rewrite file names, and the error code and status code reads with its own. A check of the code `BadRequestException` or the status `400` becomes a check of PostHog's error name `validation_error`. In Ruby and .NET the service exception covered only Amazon SES's answers, and a network failure (`Seahorse::Client::NetworkingError`, `HttpRequestException`) passed it: raise PostHog's exception again first when its code is `network_error`, before the handler logs or does anything else. In .NET, put a `when (e.Code != "network_error")` filter on each `catch` of PostHog's exception that replaces the service exception, so a network failure passes it untouched, as before. The exception is a later handler of the same `try`, such as `rescue Seahorse::Client::NetworkingError` or a `catch (Exception)`, that took every network failure: it can't catch PostHog's exception, so PostHog's catch takes `network_error` with no raise and no filter for it, and runs that handler's code for it, as Step 7 says. When the handler catches the AWS SDK's base exception (`Aws::Errors::ServiceError`, `Aws\Exception\AwsException`, `Amazon.Runtime.AmazonServiceException`), or its `try` also guards other AWS calls, keep that handler for those calls and add PostHog's next to it.
- **A raw HTTP request.** It failed the way its client does. `axios` (unless its `validateStatus` accepts a failed status), `got` and `ky` (unless `throwHttpErrors: false`), Guzzle (unless `'http_errors' => false`), Faraday with `raise_error`, `raise_for_status()`, and `EnsureSuccessStatusCode()` threw on a refused send: the moved site raises PostHog's error the same way, as the language's bullet says, and a read of the client's status in the `catch` reads PostHog's status code. `fetch`, `aws4fetch`'s `AwsClient.fetch`, `requests`, `httpx`, Ruby's `Net::HTTP`, Go's `net/http`, and .NET `HttpClient` without `EnsureSuccessStatusCode()` answered it as a response: a check of that answer's status becomes a check of PostHog's error, and when the code never read the answer, Step 7's rule for an answer the code never read applies.
- **Go, Rust, and Elixir.** The site checked an error value. Check PostHog's error value the way the rewrite file says under "The answer". A plain `if err != nil`, `?`, or `{:error, _}` branch stays as it is. A branch on the status, such as `HTTPStatusCode()`, Rust's `raw_response()` status, or a status in Elixir's error `reason`, whose shape the installed `ex_aws` gives, reads PostHog's status code, except a branch on `400`, Go's `*types.BadRequestException`, or Rust's `SendEmailError::BadRequestException`, which reads PostHog's error name `validation_error`. In Rust, PostHog's `EmailError` has `status()` for the status code, an `Option<u16>` such as `Some(429)`, and `kind().as_str()` for the error name. A branch that matched only Amazon SES's answers let a network failure pass to the site's next check: Go's `errors.As` with `smithy.APIError`, `*awshttp.ResponseError`, or a `*types.*` error, Rust's `SdkError::ServiceError`, or an Elixir clause that matches only the `reason` the installed `ex_aws` gives for an API error. PostHog returns a network failure as the same error, with the code `network_error`, so give such a branch a check that skips it, such as `emailErr.Code != "network_error"` in Go, `error.code() != "network_error"` in Rust, or a `{:error, %PostHog.Emails.Error{code: "network_error"}}` clause before it in Elixir that takes the path a network failure took before.
- A branch on `TooManyRequestsException`, or on the v1 API's `Throttling`, is a branch on the rate limit: Step 7 says what of it goes and what stays as a branch on a `429` whose code is not `quota_limited`. The v1 API answers a send over the sending rate or the daily quota with the code `Throttling` and status `400`, where v2 answers too many requests with `TooManyRequestsException` and `429`.
- In a site that sends with the v1 API, a branch on the status `400` also took throttling. It becomes a branch on PostHog's error name `validation_error`, and its throttling part follows the bullet above.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Amazon SES took it and didn't send it. When the site throws or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. A refused send has no message id, where Amazon SES answered one: when the code after the send uses the id for more than a log line, such as returning it to its callers or storing it, the site stays, and the reason is `uses the message id of a suppressed send`, unless its callers already handle a send without an id. Note each site that got this branch in the report.

**The Amazon SES client.** Keep the Amazon SES client and its import while any site or other call still uses them. When nothing uses them, remove the import and the client. Keep the package and the AWS credentials for other uses: the AWS SDK package, such as `@aws-sdk/client-sesv2`, `aws-sdk`, `boto3`, `aws-sdk-go-v2`, or `ex_aws`, and the credentials often serve other AWS services in the same app, and `boto3` and `aws-sdk` cover every AWS service in one package. Remove the package only when no code uses it for anything else. The person removes the Amazon SES permissions after the cutover.
