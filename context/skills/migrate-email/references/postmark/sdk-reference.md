# Postmark SDK reference

This file says what Postmark looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

Postmark sends with a Server API token. It lives in `POSTMARK_SERVER_TOKEN` by convention. Apps also use their own names, such as `POSTMARK_API_TOKEN`, or keep it in framework config, such as Rails credentials (`postmark_api_token`): take the name the client reads. The token `POSTMARK_API_TEST` is Postmark's test token: it checks a send and delivers nothing.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `postmark` | `new postmark.ServerClient(token).sendEmail(message)` |
| Python | `postmark-python` (PyPI), imported as `postmark` | `await postmark.ServerClient(token).outbound.send(email)`, or `postmark.sync.ServerClient` |
| Python, community | `postmarker` (PyPI) | `PostmarkClient(server_token=token).emails.send(...)` |
| Ruby | `postmark`, and `postmark-rails` for Action Mailer | `Postmark::ApiClient.new(token).deliver(...)` |
| PHP | `wildbit/postmark-php` | `(new \Postmark\PostmarkClient($token))->sendEmail(...)` |
| .NET | `Postmark` (NuGet), and its signed build `Postmark-Strong` | `new PostmarkClient(token).SendMessageAsync(message)` |
| Java | `com.postmarkapp:postmark` | `Postmark.getApiClient(token).deliverMessage(message)` |
| Go, community | `github.com/mrz1836/postmark`, `github.com/keighl/postmark` | `client.SendEmail(...)` with a `postmark.Email` |

Postmark has no official Go SDK. The Go packages above are on Postmark's list of community libraries, and their `Email` struct carries the HTTP field names.

These are not Postmark's send SDK, and alone they are not a migration: `postmark-cli` (npm) manages templates from the terminal, `grunt-postmark` is a Grunt task, and `nodemailer` sends through any SMTP server. With `nodemailer-postmark-transport` as its transport, Nodemailer sends through Postmark's API: that is a site.

## Clients and sends

Every SDK takes one message with Postmark's field names: Node.js, .NET, and Java use the HTTP names (`From`, `To`, `HtmlBody`), and Python and Ruby use snake case (`html_body`). `To`, `Cc`, `Bcc`, and `ReplyTo` are strings: several addresses are comma-separated. Ruby and PHP also take a list and join it.

**Node.js.** `sendEmail` answers `{ To, SubmittedAt, MessageID, ErrorCode, Message }`, and `MessageID` is the message id. It throws on an API error. Every error is a `postmark.Errors.PostmarkError`, with `message`, `code` (Postmark's `ErrorCode`), and `statusCode` (the HTTP status). The subclasses are `InvalidAPIKeyError` (401), `ApiInputError` (422), with its own subclasses `InactiveRecipientsError` (code 406, with `recipients`) and `InvalidEmailRequestError` (code 300), `RateLimitExceededError` (429), `InternalServerError` (500), `ServiceUnavailablerError` (503), and `UnknownError`.

```js
import * as postmark from 'postmark'
const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN)

await client.sendEmail({
  From: 'Example <hello@mail.example.com>',
  To: 'jane@example.com',
  Subject: 'Welcome',
  HtmlBody: '<p>Welcome</p>',
  TextBody: 'Welcome',
  MessageStream: 'outbound',
})
```

- `client.sendEmailWithTemplate({ TemplateId | TemplateAlias, TemplateModel, From, To, ... })` sends a stored template.
- `client.sendEmailBatch([...])` and `client.sendEmailBatchWithTemplates([...])` send up to 500 emails in one call. They answer HTTP 200 with one result per email: a failed email has a non-zero `ErrorCode` in its result and throws nothing.
- `client.sendBulkEmail({ From, Subject, HtmlBody, Messages: [{ To, TemplateModel }, ...] })` sends one message to many recipients through Postmark's Bulk API.
- `postmark.Message`, `postmark.TemplatedMessage`, `postmark.Attachment`, and `postmark.Header` are classes with the same fields. `new postmark.Client(token)` is the same `ServerClient`.

**Python.** `postmark-python` is async. Each call is awaited, and `postmark.sync.ServerClient` wraps it for sync code. A message is a dict or a model, with snake case keys and `sender` for `From`: the SDK also takes the HTTP names. `send` answers a `SendResponse` with `message_id`, `error_code`, `message`, `to`, and `submitted_at`. It raises on an API error. Every error is a `postmark.exceptions.PostmarkException`, with `message`, `error_code`, and `http_status`. The API errors are `PostmarkAPIException` and its subclasses `InvalidAPIKeyException`, `ValidationException` (422, and codes 300 and 405), `InactiveRecipientException` (code 406, with `inactive_recipients`), `RateLimitException`, and `ServerException`. A message that fails the SDK's own checks raises `InvalidEmailException`, and a timeout raises `TimeoutException`.

```python
import postmark

async with postmark.ServerClient(os.environ["POSTMARK_SERVER_TOKEN"]) as client:
    response = await client.outbound.send({
        "sender": "Example <hello@mail.example.com>",
        "to": "jane@example.com",
        "subject": "Welcome",
        "html_body": "<p>Welcome</p>",
        "text_body": "Welcome",
    })
```

- `client.outbound.send_with_template({ "template_id" | "template_alias", "template_model", "sender", "to", ... })` sends a stored template.
- `client.outbound.send_batch([...])` and `send_batch_with_template([...])` send up to 500 emails and answer one `SendResponse` per email: a failed email has `success` false and raises nothing.
- `client.outbound.send_bulk({...})` sends one message to many recipients.

**Python, `postmarker`.** `PostmarkClient(server_token=...)` with `client.emails.send(From=, To=, Subject=, HtmlBody=, TextBody=, ...)`, `client.emails.send_with_template(TemplateId=, TemplateModel=, ...)`, and `client.emails.send_batch(...)`. `To`, `Cc`, and `Bcc` take a string or a list. `send` answers the API's dict, with `MessageID`. It raises `postmarker.exceptions.ClientError` on an API error, with `error_code`. `emails.send`, `emails.send_with_template`, and a message built with `client.emails.Email(...)` or `client.emails.EmailTemplate(...)` send `TrackLinks: "None"` when the code doesn't pass it, and `TrackOpens: null`, which follows the server, when the code doesn't pass that.

**Ruby.** `deliver` takes a hash with snake case keys and answers a hash: `:message_id`, `:error_code`, `:message`, `:to`, and `:submitted_at`. It raises on an API error. Every error is a `Postmark::Error`. API errors are `Postmark::HttpServerError`, with `status_code`, `message`, and `full_response` (the parsed body): its subclasses are `Postmark::InvalidApiKeyError` (401), `Postmark::ApiInputError` (422, with `error_code`) and its subclasses `Postmark::InactiveRecipientError` (code 406, with `recipients`) and `Postmark::InvalidEmailRequestError` (code 300), and `Postmark::InternalServerError`. `Postmark::TimeoutError` covers a timeout.

```ruby
require 'postmark'

client = Postmark::ApiClient.new(ENV['POSTMARK_SERVER_TOKEN'])
client.deliver(
  from: 'Example <hello@mail.example.com>',
  to: 'jane@example.com',
  subject: 'Welcome',
  html_body: '<p>Welcome</p>',
  text_body: 'Welcome'
)
```

- `deliver_with_template(template_id: | template_alias:, template_model:, from:, to:, ...)` sends a stored template.
- `deliver_in_batches([...])` and `deliver_in_batches_with_templates([...])` send many emails in one call.
- `deliver_message(mail)` and `deliver_messages([...])` send a `Mail::Message`.
- `postmark-rails` sends every Action Mailer mail through Postmark: `config.action_mailer.delivery_method = :postmark`, with `postmark_settings = { api_token: ... }`. Each mailer method that sends is a site. A mailer can set `tag`, `metadata`, `track_opens`, `track_links`, and `message_stream` on the mail.

**PHP.** `sendEmail` takes its fields as arguments in this order: `$from, $to, $subject, $htmlBody, $textBody, $tag, $trackOpens, $replyTo, $cc, $bcc, $headers, $attachments, $trackLinks, $metadata, $messageStream`. It answers a `PostmarkResponse` with `getMessageID()` and `getErrorCode()`. It throws `Postmark\Models\PostmarkException` on an API error, with `getMessage()`, `getHttpStatusCode()`, and `getPostmarkApiErrorCode()`.

```php
use Postmark\PostmarkClient;

$client = new PostmarkClient(getenv('POSTMARK_SERVER_TOKEN'));
$response = $client->sendEmail(
    'Example <hello@mail.example.com>',
    'jane@example.com',
    'Welcome',
    '<p>Welcome</p>',
    'Welcome'
);
```

`sendEmailWithTemplate($from, $to, $templateIdOrAlias, $templateModel, $inlineCss = true, ...)` sends a stored template, `sendEmailBatch` and `sendEmailBatchWithTemplate` send many, and `sendEmailModel` takes a `PostmarkMessage`, and `sendEmailWithTemplateModel` a `TemplatedPostmarkMessage`. `PostmarkAttachment::fromRawData`, `fromBase64EncodedData`, and `fromFile` build attachments.

**.NET.** `SendMessageAsync` takes a `PostmarkMessage` (namespace `PostmarkDotNet`) with `From`, `To`, `Cc`, `Bcc`, `ReplyTo`, `Subject`, `HtmlBody`, `TextBody`, `Tag`, `Metadata`, `Headers`, `Attachments`, `TrackOpens`, `TrackLinks`, and `MessageStream`. It answers a `PostmarkResponse` with `MessageID`, `Status`, `ErrorCode`, and `Message`. It throws `PostmarkDotNet.Exceptions.PostmarkValidationException` when the API answers anything but 200: its `Response` is the `PostmarkResponse`, with `ErrorCode` and `Message`. An answer it can't parse throws `Postmark.Exceptions.PostmarkResponseException` instead, with the raw body, which is not a `PostmarkValidationException`. `SendMessageAsync(from, to, subject, textBody, htmlBody, headers, metadata, messageStream)` and the constructor `new PostmarkMessage(from, to, subject, textBody, htmlBody, headers, metadata, messageStream)` take the fields as arguments, with the text body before the HTML body. `SendMessage`, with the same arguments or a message, is the synchronous shim of the 1.x client, marked obsolete.

```csharp
var client = new PostmarkClient(Environment.GetEnvironmentVariable("POSTMARK_SERVER_TOKEN"));
var response = await client.SendMessageAsync(new PostmarkMessage
{
    From = "Example <hello@mail.example.com>",
    To = "jane@example.com",
    Subject = "Welcome",
    HtmlBody = "<p>Welcome</p>",
    TextBody = "Welcome",
});
```

`SendMessagesAsync(...)` sends a batch, and `SendEmailWithTemplateAsync(TemplatedPostmarkMessage)` sends a stored template.

**Go, community.** `mrz1836/postmark`: `postmark.NewClient(serverToken, accountToken).SendEmail(ctx, postmark.Email{...})` answers `(EmailResponse, error)` and returns an error when the answer's `ErrorCode` is not 0. `keighl/postmark` has the same `SendEmail(email)` without `ctx`. Both have `SendEmailBatch`.

**HTTP.** `POST https://api.postmarkapp.com/email`, with `X-Postmark-Server-Token: <token>`, `Accept: application/json`, and `Content-Type: application/json`. Postmark has one API host, with no regional host. A success answers 200 with `{ "To", "SubmittedAt", "MessageID", "ErrorCode": 0, "Message": "OK" }`. An error answers 401, 422, 429, 500, or 503, with `{ "ErrorCode", "Message" }` and the code also in the `X-PM-ApiErrorCode` header. Look for `api.postmarkapp.com` and `X-Postmark-Server-Token` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

```json
{
  "From": "Example <hello@mail.example.com>",
  "To": "jane@example.com",
  "Subject": "Welcome",
  "HtmlBody": "<p>Welcome</p>",
  "TextBody": "Welcome",
  "MessageStream": "outbound"
}
```

The other send routes are `POST /email/withTemplate`, `POST /email/batch` and `POST /email/batchWithTemplates` (up to 500 emails), and `POST /email/bulk`.

The API error codes a send can answer include `10` (bad or missing token), `300` (invalid email request, such as a bad address or too many recipients), `406` (inactive recipient: the address is on the stream's suppression list, so Postmark refuses the send), `1101` (template not found), and `1235` (message stream not found).

**SMTP.** Postmark takes mail over SMTP at `smtp.postmarkapp.com`, and at `smtp-broadcasts.postmarkapp.com` for broadcast streams, on port 25, 2525, or 587. The user and the password are both the Server API token, or an SMTP token's access key and secret key. Look for those hosts in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. The headers `X-PM-Message-Stream`, `X-PM-Tag`, `X-PM-Metadata-<name>`, and `X-PM-KeepID` carry Postmark options over SMTP.

**Frameworks.** Mailers that send every framework mail through Postmark: `postmark.django.EmailBackend` (from `postmark-python[django]`), `postmarker.django.EmailBackend`, and `anymail.backends.postmark.EmailBackend` in Django; `postmark-rails` in Rails; `MAIL_MAILER=postmark` with `symfony/postmark-mailer` in Laravel and Symfony; `Swoosh.Adapters.Postmark` in Swoosh and `Bamboo.PostmarkAdapter` (`bamboo_postmark`) in Bamboo for Elixir; and `nodemailer-postmark-transport` in Nodemailer. Each mailable or mailer that sends is a site.

## Send fields

HTTP names. Node.js, .NET, and Java use them as they are, Python and Ruby use snake case (`html_body`, `track_links`, `message_stream`, and `sender` for `From` in `postmark-python`), and PHP takes them as arguments.

| Field | Value |
|---|---|
| `From` | An address, or `Name <address>`. It needs a confirmed sender signature or domain at Postmark |
| `To` | One address, or several comma-separated. At most 50 across `To`, `Cc`, and `Bcc` |
| `Cc`, `Bcc` | Same as `To` |
| `ReplyTo` | An address, or several comma-separated |
| `Subject` | String |
| `HtmlBody`, `TextBody` | Strings. At least one is required |
| `TemplateId` or `TemplateAlias`, with `TemplateModel` | A stored template, and the object that fills it. Only on the template routes |
| `InlineCss` | Boolean, only on the template routes. On by default: Postmark inlines the template's `<style>` blocks |
| `Tag` | One string, such as `welcome` |
| `Metadata` | Object of string values, sent back in webhook events |
| `Headers` | A list of `{ Name, Value }` |
| `Attachments` | A list of `{ Name, Content, ContentType, ContentID }`. `Content` is base64. `ContentID` such as `cid:logo.png` shows the file inline as `<img src="cid:logo.png">` |
| `TrackOpens` | Boolean. Overrides the server's open tracking setting |
| `TrackLinks` | `None`, `HtmlAndText`, `HtmlOnly`, or `TextOnly`. Overrides the server's link tracking setting |
| `MessageStream` | A stream ID. `outbound`, the default transactional stream, when it is left out |

A Postmark send has no idempotency key and no send time.

## Templates stored at Postmark

A send to `/email/withTemplate`, with `TemplateId` or `TemplateAlias` and `TemplateModel`, renders a template from the Postmark dashboard. Its content is not in the code.

- A template has a `Subject`, an `HtmlBody`, and a `TextBody`, and all three use Mustachio: `{{name}}`, `{{person.first_name}}`, `{{{raw}}}` and `{{& raw}}`, sections `{{#person}}…{{/person}}`, inverted sections `{{^items}}…{{/items}}`, loops `{{#each items}}…{{/each}}`, the current value `{{.}}`, and parent values `{{../name}}`.
- A section renders when its value passes Mustachio's truth test. Inside it, names are read from that value, and `../` reads an outer one. `mapping.md` says under "Templates" what each tag renders, and which templates move.
- A standard template can name a layout in `LayoutTemplate`. The layout wraps it at `{{{ @content }}}`, and has no subject.
- `{{{ pm:unsubscribe }}}` inserts Postmark's unsubscribe link.
- An alias holds letters, digits, `.`, `-`, and `_`, and starts with a letter. `TemplateId` is a number.

## Status reads

The Messages API (`GET https://api.postmarkapp.com/messages/outbound`, `/messages/outbound/{messageid}/details`, `/messages/outbound/opens`, and `/messages/outbound/clicks`) and the Bounces API (`GET /bounces`, `/bounces/{bounceid}`) read Postmark's delivery state by message id. Code that reads them reads Postmark's state.

## Webhooks

Postmark posts one event per request, as JSON, to the URL set on each message stream. `RecordType` names the event: `Delivery`, `Bounce`, `SpamComplaint`, `Open`, `Click`, or `SubscriptionChange`. Each event carries `MessageID`, `MessageStream`, `Tag`, and the send's `Metadata`. The address is `Recipient` in `Delivery`, `Open`, `Click`, and `SubscriptionChange`, and `Email` in `Bounce` and `SpamComplaint`.

- `Bounce` carries `Type`, such as `HardBounce`, `SoftBounce`, or `Transient`, and `Inactive`, which says whether Postmark deactivated the address.
- `SubscriptionChange` fires when an address is put on or taken off the stream's suppression list, with `SuppressSending`, `SuppressionReason`, and `Origin`.

Postmark signs no webhook. An endpoint checks basic auth in the webhook URL (`https://user:pass@...`) or a custom header that the webhook sends. Look for routes that read `RecordType`, `MessageID`, or `Metadata`, the `X-PM-Webhook-Trace-Id` and `X-PM-Retries-Remaining` headers, and handlers typed with the SDK's webhook models.

```js
app.post('/webhooks/postmark', express.json(), (req, res) => {
  const event = req.body
  if (event.RecordType === 'Bounce' && event.Inactive) markEmailBounced(event.Email)
  res.sendStatus(200)
})
```

## Other APIs

Inbound processing, broadcast message streams, message streams, suppressions, templates, servers, domains, sender signatures, webhooks, stats, and data removals (`/messages/inbound`, `/message-streams`, `/message-streams/{stream}/suppressions`, `/templates`, `/servers`, `/domains`, `/senders`, `/webhooks`, `/stats`, `/data-removals`) are not transactional sends.
