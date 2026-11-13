# Postmark SDK reference

This file says what Postmark looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

Postmark sends with a Server API token. It lives in `POSTMARK_SERVER_TOKEN` by convention. Apps also use their own names, such as `POSTMARK_API_TOKEN`, or keep it in framework config, such as Rails credentials (`postmark_api_token`): take the name the client reads. The token `POSTMARK_API_TEST` is Postmark's test token: it checks a send and delivers nothing.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `postmark` | `new postmark.ServerClient(token).sendEmail(message)` |
| Python | `postmark-python` (PyPI), imported as `postmark` | `await postmark.ServerClient(token).outbound.send(email)` |
| Python, community | `postmarker` (PyPI) | `PostmarkClient(server_token=token).emails.send(...)` |
| Ruby | `postmark`, and `postmark-rails` for Action Mailer | `Postmark::ApiClient.new(token).deliver(...)` |
| PHP | `wildbit/postmark-php` | `(new \Postmark\PostmarkClient($token))->sendEmail(...)` |
| .NET | `Postmark` (NuGet), and its signed build `Postmark-Strong` | `new PostmarkClient(token).SendMessageAsync(message)` |
| Java | `com.postmarkapp:postmark` | `Postmark.getApiClient(token).deliverMessage(message)` |
| Go, community | `github.com/mrz1836/postmark`, `github.com/keighl/postmark` | The package's send |

Postmark has no official Go SDK. The Go packages above are on Postmark's list of community libraries.

These are not Postmark's send SDK, and alone they are not a migration: `postmark-cli` (npm) manages templates from the terminal, `grunt-postmark` is a Grunt task, and `nodemailer` sends through any SMTP server. With `nodemailer-postmark-transport` as its transport, Nodemailer sends through Postmark's API: that is a site.

## Clients and sends

Every official library takes one message with Postmark's field names, as Postmark's "Official libraries" page shows: Node.js and .NET use the HTTP names (`From`, `To`, `HtmlBody`), Python and Ruby use snake case (`html_body`), with `sender` for `From` in `postmark-python`, and PHP takes them as arguments. `To`, `Cc`, `Bcc`, and `ReplyTo` are strings in the API: several addresses are comma-separated.

That page shows how each library sends. Postmark's docs don't give a library's error classes, the other names of its methods and fields, the values it sends for a field the code leaves out, its timeouts, or its retries: `mapping.md` says under "What Postmark's docs don't give" how to read them from the client installed in the app.

**Node.js.** `new ServerClient(token)` from `postmark`, or `new postmark.ServerClient(token)` with `require("postmark")`. `sendEmail(message)` sends one email, and `sendEmailWithTemplate(message)` sends a stored template, with `TemplateAlias` or `TemplateId` and `TemplateModel`. Each answers the API's answer, with `MessageID`, and rejects on an error, as the page's batch example shows.

```js
import { ServerClient } from 'postmark'
const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN)

await client.sendEmail({
  From: 'Example <hello@mail.example.com>',
  To: 'jane@example.com',
  Subject: 'Welcome',
  HtmlBody: '<p>Welcome</p>',
  TextBody: 'Welcome',
  MessageStream: 'outbound',
})
```

**Python.** `postmark-python` is async: each call is awaited, with `postmark.ServerClient(token)` used as an async context manager or closed with `await client.close()`. `client.outbound.send({...})` takes a dict with snake case keys and `sender` for `From`, and its answer has `message_id`.

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

**Python, `postmarker`.** Its own docs, on Read the Docs, cover it. `PostmarkClient(server_token=...)` with `client.emails.send(From=, To=, Subject=, HtmlBody=, TextBody=, ...)`, `client.emails.send_with_template(TemplateId=, TemplateModel=, ...)`, and `client.emails.send_batch(...)`, and messages built with `client.emails.Email(...)`, `EmailTemplate(...)`, `EmailBatch(...)`, and `EmailTemplateBatch(...)`. Its reference gives `TrackLinks="None"` and `TrackOpens=None` as the defaults of a send. `PostmarkClient` takes `timeout`, which it passes to `requests`, and `max_retries`, 0 by default, which it passes to `requests`' `HTTPAdapter`. A client built with `inline_css=True`, or with a `css_inline.CSSInliner` as `inline_css`, moves the CSS of `HtmlBody`'s `<style>` blocks into `style` attributes before it sends, with the `postmarker[css-inline]` extra. With `inline_css=True`, it loads no stylesheet from a `<link>` tag.

**Ruby.** `Postmark::ApiClient.new(token)`, with `deliver(from:, to:, subject:, html_body:, ...)`. The gem also sends stored templates and `Mail::Message`s, under the names the installed gem gives. `postmark-rails` sends every Action Mailer mail through Postmark: `config.action_mailer.delivery_method = :postmark`, with `postmark_settings = { api_token: ... }`, a hash that takes the options of `Postmark::ApiClient`. Each mailer method that sends is a site.

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

**PHP.** `new PostmarkClient($token)`, from `use Postmark\PostmarkClient;`, with `sendEmail($from, $to, $subject, $htmlBody, ...)`: the page shows its first four arguments, and the installed client declares the rest. The client also sends stored templates, batches, and message models, and builds attachments, under the names it gives.

```php
use Postmark\PostmarkClient;

$client = new PostmarkClient(getenv('POSTMARK_SERVER_TOKEN'));
$response = $client->sendEmail(
    'Example <hello@mail.example.com>',
    'jane@example.com',
    'Welcome',
    '<p>Welcome</p>'
);
```

**.NET.** `new PostmarkClient(token)`, from `using PostmarkDotNet;`, with `await client.SendMessageAsync(message)` for a `PostmarkMessage` with `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, `Tag`, `TrackOpens`, and `Headers`. `message.AddAttachment(content, name, contentType, contentId)` adds a file, such as `AddAttachment(File.ReadAllBytes("test.jpg"), "test.jpg", "image/jpg", "cid:embed_name.jpg")`. The client also sends stored templates and batches, under the names it gives.

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

**Go, community.** `github.com/mrz1836/postmark` and `github.com/keighl/postmark` are on Postmark's list of community libraries. Read the installed package for its client, its send, and its message type.

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

**Frameworks.** Mailers that send every framework mail through Postmark: a Django email backend of a Postmark package, such as `postmarker.django.EmailBackend`, and `anymail.backends.postmark.EmailBackend` in Django; `postmark-rails` in Rails; `MAIL_MAILER=postmark` with `symfony/postmark-mailer` in Laravel and Symfony; `Swoosh.Adapters.Postmark` in Swoosh and `Bamboo.PostmarkAdapter` (`bamboo_postmark`) in Bamboo for Elixir; and `nodemailer-postmark-transport` in Nodemailer. Each mailable or mailer that sends is a site.

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
