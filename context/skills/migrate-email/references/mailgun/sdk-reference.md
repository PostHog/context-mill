# Mailgun SDK reference

This file says what Mailgun looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `MAILGUN_API_KEY` by convention. Apps also use their own names, such as `MAILGUN_KEY` or `MAILGUN_SECRET`, and the Go SDK's `NewMailgunFromEnv` reads `MG_API_KEY`: take the name the client reads.

Every send also names a Mailgun sending domain, often from `MAILGUN_DOMAIN`. The domain is not a key. The webhook signing key, such as `MAILGUN_WEBHOOK_SIGNING_KEY` or `MG_WEBHOOK_SIGNING_KEY`, is a separate secret that only webhook handlers read.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `mailgun.js`, with `form-data` or the built-in `FormData` | `mg.messages.create(domain, data)` |
| Node.js | `mailgun-js`, an older package that is no longer maintained | `mailgun.messages().send(data, callback)` |
| Python | `mailgun` (PyPI), imported as `mailgun` | `client.messages.create(domain=..., data=...)` |
| Ruby | `mailgun-ruby`, required as `mailgun-ruby` or `mailgun` | `Mailgun::Client.new(key).send_message(domain, params)` |
| PHP | `mailgun/mailgun-php` | `Mailgun::create($key)->messages()->send($domain, $params)` |
| Go | `github.com/mailgun/mailgun-go/v5`, or `/v4` in older code | `mg.Send(ctx, message)` |
| Java | `com.mailgun:mailgun-java` | `mailgunMessagesApi.sendMessage(domain, message)` |

Mailgun has no official .NET SDK. .NET apps, and many Python apps, send with plain HTTP requests (see **HTTP**).

These are not Mailgun's send SDK, and alone they are not a migration: `flanker` parses email addresses, `nodemailer` sends through any SMTP server, and `@react-email/components` only renders. A call of `mailgun.js` or another Mailgun SDK that only validates addresses, or manages lists, domains, routes, or webhooks, is not a send.

## Clients and sends

**Node.js, `mailgun.js`.** `mg.messages.create` answers `{ status, id, message }`: `id` is the message id in angle brackets, such as `<20260203192638.000be97f99f8cea1@mail.example.com>`. It throws on an API error: the error has `type: 'MailgunAPIError'`, `status` (the HTTP status), `message`, and `details` (the text of Mailgun's answer).

```js
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

const mg = new Mailgun(FormData).client({ username: 'api', key: process.env.MAILGUN_API_KEY })

await mg.messages.create('mail.example.com', {
  from: 'Example <hello@mail.example.com>',
  to: ['jane@example.com'],
  subject: 'Welcome',
  text: 'Welcome',
  html: '<p>Welcome</p>',
})
```

- The client takes `url: 'https://api.eu.mailgun.net'` for a domain in the EU region.
- `to`, `cc`, and `bcc` take one address, a comma-separated string, or a list. Several addresses in `to` send **one** email that every address sees, unless `recipient-variables` is set.
- `attachment` and `inline` take `{ data, filename, contentType }` or a list of them. `data` is a `Buffer`, a string, a stream, or a `Blob`.
- A `message` field sends a full MIME message to `/messages.mime`.

**Node.js, `mailgun-js`.** `require('mailgun-js')({ apiKey, domain })` makes the client, and `mailgun.messages().send(data, (error, body) => ...)` sends the same fields. An API error comes to the callback as `error`, with the HTTP status in `error.statusCode`. `body.id` is the message id.

**Python.** `client.messages.create` answers the HTTP response, and does not raise on an API error: the code reads `response.status_code` or `response.ok`, and `response.json()["id"]` is the message id. It raises `mailgun.ApiError`, or its subclass `MailgunTimeoutError`, only when the request can't be made, such as on a network error or a timeout. `AsyncClient` is the same with `await`.

```python
import os
from mailgun import Client

client = Client(auth=("api", os.environ["MAILGUN_API_KEY"]))
response = client.messages.create(
    domain="mail.example.com",
    data={
        "from": "Example <hello@mail.example.com>",
        "to": "jane@example.com",
        "subject": "Welcome",
        "text": "Welcome",
        "html": "<p>Welcome</p>",
    },
)
```

- `Client(auth=..., api_url="https://api.eu.mailgun.net")` is the EU client.
- Files go in `files=`, such as `[("attachment", ("report.pdf", data)), ("inline", ("logo.png", data))]`.
- `headers={"Idempotency-Key": ...}` passes a request header.
- `client.mimemessage.create(...)` sends a full MIME message.

**Ruby.** `send_message` answers a `Mailgun::Response`: `response.to_h['id']` is the message id. It raises `Mailgun::CommunicationError` on an API error, with `status` (the HTTP status) and a `message` that holds Mailgun's text. `Mailgun::BadRequest` (400) and `Mailgun::Unauthorized` (401) are its subclasses.

```ruby
require 'mailgun-ruby'

mg = Mailgun::Client.new(ENV['MAILGUN_API_KEY'])
mg.send_message('mail.example.com', {
  from: 'Example <hello@mail.example.com>',
  to: 'jane@example.com',
  subject: 'Welcome',
  text: 'Welcome',
  html: '<p>Welcome</p>'
})
```

- `Mailgun::Client.new(key, 'api.eu.mailgun.net')` is the EU client.
- `Mailgun::MessageBuilder` builds the same fields: `from`, `add_recipient(:to | :cc | :bcc, address)`, `reply_to`, `subject`, `body_text`, `body_html`, `add_attachment(path_or_io, filename)`, `add_inline_image`, `add_tag`, `variable` (a `v:` value), `header`, `deliver_at`, `track_opens`, `track_clicks`, `test_mode`, `template`, `template_version`, and `add_custom_parameter`. `send_message(domain, builder)` sends it.
- `Mailgun::BatchMessage.new(mg, domain)` sends one email per recipient, in parts of 1,000.
- Test mode: `Mailgun.configure { |config| config.test_mode = true }`, or `enable_test_mode!` on a client. The client then keeps each message in `Mailgun::Client.deliveries` and sends nothing.

**PHP.** `send` answers a `SendResponse`: `getId()` is the message id and `getMessage()` the text. It throws `Mailgun\Exception\HttpClientException` on a 4xx answer, with `getResponseCode()` and `getResponseBody()`, and `Mailgun\Exception\HttpServerException` on a 5xx answer. A client built with `NoopHydrator` throws neither: it answers the raw PSR-7 response, and the code reads `getStatusCode()`.

```php
use Mailgun\Mailgun;

$mg = Mailgun::create(getenv('MAILGUN_API_KEY')); // EU: Mailgun::create($key, 'https://api.eu.mailgun.net')
$mg->messages()->send('mail.example.com', [
    'from' => 'Example <hello@mail.example.com>',
    'to' => 'jane@example.com',
    'subject' => 'Welcome',
    'text' => 'Welcome',
    'html' => '<p>Welcome</p>',
]);
```

- `attachment` and `inline` take a list of `['filePath' => ...]` or `['fileContent' => ..., 'filename' => ...]`.
- `$mg->messages()->sendMime(...)` sends a full MIME message, and `$mg->messages()->getBatchMessage($domain)` sends one email per recipient.

**Go.** In `/v5`, `mg.Send(ctx, m)` answers `(mtypes.SendMessageResponse, error)`: `resp.ID` is the message id. In `/v4`, it answers `(message, id string, err error)`. An API error is a `*mailgun.UnexpectedResponseError`, with `Actual` (the HTTP status) and `Data` (Mailgun's answer). A 429 is a `*mailgun.RateLimitedError` that wraps it. Read them with `errors.As`.

```go
mg := mailgun.NewMailgun(os.Getenv("MAILGUN_API_KEY")) // v4: mailgun.NewMailgun(domain, key)
m := mailgun.NewMessage("mail.example.com", "Example <hello@mail.example.com>", "Welcome", "Welcome", "jane@example.com")
m.SetHTML("<p>Welcome</p>")
resp, err := mg.Send(ctx, m)
```

- In `/v4`, `mailgun.NewMessage(from, subject, text, to...)` and `mg.NewMessage(...)` take no domain, and `SetHtml` sets the HTML.
- `mg.SetAPIBase(mailgun.APIBaseEU)` is the EU client.
- The message takes `AddCC`, `AddBCC`, `SetReplyTo`, `AddBufferAttachment(filename, []byte)`, `AddReaderAttachment`, `AddAttachment(path)`, `AddInline`, `AddTag`, `AddVariable` (a `v:` value), `AddHeader`, `SetTemplate`, `SetTemplateVersion`, `AddTemplateVariable`, `SetDeliveryTime`, `SetTracking`, `SetTrackingClicks`, `SetTrackingOpens`, `EnableTestMode`, and `AddRecipientAndVariables` (batch sending).
- `mailgun.NewMIMEMessage(...)` sends a full MIME message.

**Java.** `MailgunMessagesApi.sendMessage(domain, message)` with a `Message` builder. PostHog has no Java email send.

**EU region.** An app whose domain is in the EU region sets the EU API host in code or config. Each of these means every API request in `account.md` goes to `api.eu.mailgun.net`:

- Node.js: `url: 'https://api.eu.mailgun.net'` in the `client({ ... })` options.
- Python: `api_url="https://api.eu.mailgun.net"` on `Client`.
- Ruby: `Mailgun::Client.new(key, 'api.eu.mailgun.net')`, or `api_host: 'api.eu.mailgun.net'` in `config.action_mailer.mailgun_settings`.
- PHP: `Mailgun::create($key, 'https://api.eu.mailgun.net')`.
- Go: `mg.SetAPIBase(mailgun.APIBaseEU)`.
- Any env variable or config value that holds `api.eu.mailgun.net` and is passed to one of these.

**HTTP.** `POST https://api.mailgun.net/v3/<domain>/messages`, or `api.eu.mailgun.net` for a domain in the EU region, with HTTP basic auth: the user `api` and the API key as the password. The body is `multipart/form-data` or form-encoded, one field per value, so a field such as `to` or `attachment` can repeat. A success answers `200` with `{ "id": "<...>", "message": "Queued. Thank you." }`. An error answers its status, usually with `{ "message": "..." }`. Look for `api.mailgun.net` and `api.eu.mailgun.net` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, `HttpClient`, and `curl` calls.

```
from=Example <hello@mail.example.com>
to=jane@example.com
subject=Welcome
text=Welcome
html=<p>Welcome</p>
```

`POST /v3/<domain>/messages.mime` sends a full MIME message.

**SMTP.** Mailgun takes mail over SMTP at `smtp.mailgun.org`, or `smtp.eu.mailgun.org`, on ports 25, 465, 587, and 2525, with SMTP credentials of the domain, such as `postmaster@mail.example.com`. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. `X-Mailgun-*` headers, such as `X-Mailgun-Tag`, `X-Mailgun-Variables`, and `X-Mailgun-Deliver-By`, carry Mailgun options over SMTP.

**Frameworks.** Mailers that send every framework mail through Mailgun: Laravel's `mailgun` mailer (`MAIL_MAILER=mailgun`, with `domain`, `secret`, and `endpoint` under `services.mailgun`), `symfony/mailgun-mailer` in Symfony, `delivery_method = :mailgun` from `mailgun-ruby` in Rails, `django-anymail` with its Mailgun backend in Django, `nodemailer-mailgun-transport` in Nodemailer, and `Swoosh.Adapters.Mailgun` and `Bamboo.MailgunAdapter` in Elixir. Each mailable or mailer that sends is a site.

## Send fields

The HTTP form fields. The SDKs take the same names as keys, apart from the setters named above.

| Field | Value |
|---|---|
| `from` | An address, or `Name <address>` |
| `to` | One or more addresses, as a list or a comma-separated string. Each may be `Name <address>` |
| `cc`, `bcc` | Same as `to` |
| `subject` | String |
| `text`, `html` | Strings |
| `amp-html` | The AMP part of the message |
| `message` | A full MIME message, on `/messages.mime` only |
| `attachment` | A file. Repeats for several files |
| `inline` | A file shown inline, referenced from the HTML as `cid:<filename>`. Repeats |
| `template` | The name, or the id, of a template stored at Mailgun |
| `t:version` | A version of the template other than the active one |
| `t:text` | `yes` renders a plain-text part from the template |
| `t:variables` | A JSON object that fills the template |
| `h:X-Mailgun-Variables` | A JSON object of custom variables. It fills a template too |
| `h:Reply-To` | The reply-to address |
| `h:<Header>` | Any other custom header |
| `v:<name>` | A custom variable, sent back in webhook events as `user-variables`. It fills a template too, unless `t:variables` is set |
| `o:tag` | A tag string. Repeats, up to 3 tags per message |
| `o:deliverytime` | A send time, up to 3 or 7 days ahead, by plan |
| `o:deliverytime-optimize-period`, `o:time-zone-localize`, `o:deliver-within` | Send Time Optimization, Timezone Optimization, and a delivery window |
| `o:testmode` | `yes`: Mailgun takes the message and does not deliver it |
| `o:tracking`, `o:tracking-clicks`, `o:tracking-opens` | `yes`, `no`, `true`, `false`, or `htmlonly` for clicks: tracking per message |
| `o:tracking-pixel-location-top` | Where the open pixel sits |
| `o:dkim`, `o:secondary-dkim`, `o:secondary-dkim-public` | DKIM signing per message |
| `o:require-tls`, `o:skip-verification` | TLS rules for delivery |
| `o:sending-ip`, `o:sending-ip-pool` | The IP or IP pool to send from |
| `o:archive-to` | A URL that gets a copy of each delivered message |
| `o:suppress-headers` | `X-Mailgun-*` headers to strip |
| `o:campaign` | A campaign id |
| `recipient-variables` | A JSON object of values per recipient, for batch sending: one email per address in `to`, up to 1,000 |

The `o:`, `h:`, `v:`, and `t:` fields add up to at most 16 KB.

A body or subject can also hold Mailgun's own variables, which Mailgun fills at send time: `%recipient.<name>%` from `recipient-variables`, and `%unsubscribe_url%`, `%tag_unsubscribe_url%`, and `%mailing_list_unsubscribe_url%`.

## Templates stored at Mailgun

A send with `template` renders a template stored at Mailgun, by name or id, with values from `t:variables`, `h:X-Mailgun-Variables`, or `v:` fields. Its content is not in the code.

- A template belongs to one sending domain, or to the account.
- A template has versions. The active version is used unless `t:version` names another. A version holds `template` (the content), `engine`, and `headers`, which can set `From`, `Subject`, and `Reply-To`. A `from` or `subject` on the send wins over the template's.
- The `handlebars` engine, the default, takes `{{name}}`, `{{user.name}}`, `{{{raw}}}`, and the block helpers `if` with `else` and `else if`, `unless`, `each`, `with`, and `equal`. The `go` engine takes Go templates.

## Status reads

The Events API (`GET https://api.mailgun.net/v3/<domain>/events`, with filters such as `message-id`, `recipient`, or `event`) and the Logs API (`/v1/analytics/logs`) read a message's delivery state. So do the SDK calls `mg.events.get` in Node.js, `client.events.get` in Python, `ListEvents` and `PollEvents` in Go, and `mg.get("#{domain}/events")` in Ruby. Code that reads them reads Mailgun's state.

## Webhooks

Mailgun posts one JSON object per event to an endpoint of the app: `{ "signature": { "timestamp", "token", "signature" }, "event-data": { ... } }`. A webhook is set up per domain or for the account, for one or more of the events `accepted`, `delivered`, `temporary_fail`, `permanent_fail`, `opened`, `clicked`, `unsubscribed`, and `complained`.

- `event-data.event` is `accepted`, `delivered`, `failed`, `opened`, `clicked`, `unsubscribed`, or `complained`. A `failed` event has `severity`, `permanent` or `temporary`, and `reason`, such as `bounce`.
- `event-data.id` is the event's id. `event-data.message.headers["message-id"]` is the send's message id, without the angle brackets the send answered.
- `event-data.recipient` is the address. `event-data.tags` holds the `o:tag` values, and `event-data["user-variables"]` holds the `v:` and `X-Mailgun-Variables` values.
- The signature is a hex HMAC-SHA256 of `timestamp` and `token` joined, keyed with the webhook signing key of the account. A subaccount event also carries `parent-signature`.

```js
app.post('/webhooks/mailgun', express.json(), (req, res) => {
  const { timestamp, token, signature } = req.body.signature
  const digest = crypto.createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY).update(timestamp + token).digest('hex')
  if (digest !== signature) return res.sendStatus(406)
  const event = req.body['event-data']
  if (event.event === 'failed' && event.severity === 'permanent') markBounced(event.recipient)
  res.sendStatus(200)
})
```

Look for routes that read `event-data`, `user-variables`, or `message.headers`, an HMAC over `timestamp` and `token`, and the SDK helpers `VerifyWebhookSignature` with `mtypes.WebhookPayload` and `events.ParseEvent` in Go, and `$mg->webhooks($signingKey)->verifyWebhookSignature($timestamp, $token, $signature)` in PHP.

## Other APIs

Domains, DNS checks, DKIM keys, mailing lists and members, routes and inbound mail, templates, suppressions (bounces, complaints, unsubscribes, allowlists), webhook settings, tags, stats and metrics, logs, address validation, IPs and IP pools, subaccounts, and API keys (`/v3/domains`, `/v4/domains`, `/v3/lists`, `/v3/routes`, `/v3/<domain>/templates`, `/v4/templates`, `/v3/<domain>/bounces`, `/v3/<domain>/complaints`, `/v3/<domain>/unsubscribes`, `/v3/<domain>/whitelists`, `/v3/domains/<domain>/webhooks`, `/v1/keys`) are not transactional sends.
