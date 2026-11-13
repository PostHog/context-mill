# Mailgun SDK reference

This file says what Mailgun looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `MAILGUN_API_KEY` by convention, as Mailgun's SDK pages name it. Apps also use their own names, such as `MAILGUN_KEY` or `MAILGUN_SECRET`: take the name the client reads.

Every send also names a Mailgun sending domain, often from `MAILGUN_DOMAIN`. The domain is not a key. The webhook signing key, such as `MAILGUN_WEBHOOK_SIGNING_KEY`, is a separate secret that only webhook handlers read.

## Packages

Mailgun's [SDK pages](https://documentation.mailgun.com/docs/mailgun/sdk/introduction) name its official SDKs and show each one's install, client, and send call, and little else. This file says what those pages and the [API reference](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages) say. Where they say nothing about an SDK, `mapping.md` keeps its sites on Mailgun.

| Language | Package | Send |
|---|---|---|
| Node.js | `mailgun.js`, with `form-data` | `mg.messages.create(domain, data)` |
| Python | `mailgun` (PyPI), imported as `from mailgun.client import Client` | `client.messages.create(data=..., domain=...)` |
| Ruby | `mailgun-ruby`, required as `mailgun-ruby` | `Mailgun::Client.new(key).send_message(domain, params)` |
| PHP | `mailgun/mailgun-php` | `Mailgun::create($key)->messages()->send($domain, $params)` |
| Go | `github.com/mailgun/mailgun-go/v5` | `mg.Send(ctx, message)` |
| Java | `com.mailgun:mailgun-java` | `mailgunMessagesApi.sendMessage(domain, message)` |

Code can also use `mailgun-js`, an older Node.js package, or `mailgun-go` before `/v5`. Mailgun's docs don't describe either.

Mailgun's SDK pages list no .NET SDK. .NET apps, and many Python apps, send with plain HTTP requests (see **HTTP**).

These are not Mailgun's send SDK, and alone they are not a migration: `flanker` parses email addresses, `nodemailer` sends through any SMTP server, and `@react-email/components` only renders. A call of `mailgun.js` or another Mailgun SDK that only validates addresses, or manages lists, domains, routes, or webhooks, is not a send.

## Clients and sends

**Node.js, `mailgun.js`.** As the [Node.js page](https://documentation.mailgun.com/docs/mailgun/sdk/nodejs_sdk) shows, `new Mailgun(formData).client({ username: 'api', key })` makes the client, and `mg.messages.create(domain, data)` answers a promise whose `catch` gets any error. The page doesn't describe the error's fields. A send that goes through answers what the API answers: `id`, the message id, and `message`.

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

- The client takes the base URL of the domain's region in its options, `https://api.eu.mailgun.net` for the EU, as the Node.js page says.
- `to`, `cc`, and `bcc` take one address, a comma-separated string, or a list, as the API reference says. Several addresses in `to` send **one** email that shows every address, unless `recipient-variables` is set, as [Batch Sending](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/batch-sending) says.

**Node.js, `mailgun-js`.** Mailgun's docs don't describe this package. `mapping.md` keeps its sites on Mailgun.

**Python.** As the [Python page](https://documentation.mailgun.com/docs/mailgun/sdk/python_sdk) shows, `Client(auth=("api", key))` makes the client, and `client.messages.create(data=..., domain=...)` answers the HTTP response, which the page reads with `.json()`: its `id` is the message id. The page doesn't say what the SDK raises, or for which failures.

```python
import os
from mailgun.client import Client

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

**Ruby.** As the [Ruby page](https://documentation.mailgun.com/docs/mailgun/sdk/ruby_sdk) shows, `Mailgun::Client.new(key)` makes the client, and `send_message(domain, params)` sends a hash of fields. The page doesn't describe the answer, what the gem raises, or its other classes.

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

**PHP.** As the [PHP page](https://documentation.mailgun.com/docs/mailgun/sdk/php_sdk) shows, `Mailgun::create($key)` makes the client, `Mailgun::create($key, 'https://api.eu.mailgun.net')` the EU one, and `$mg->messages()->send($domain, $params)` sends an array of fields. The SDK sends through a PSR-18 HTTP client that the app installs, such as `symfony/http-client` with `nyholm/psr7`. The page doesn't describe the answer or what the SDK throws.

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

**Go.** As the [Go page](https://documentation.mailgun.com/docs/mailgun/sdk/go_sdk) shows for `/v5`, `mailgun.NewMailgun(key)` makes the client, `mg.SetAPIBase(mailgun.APIBaseEU)` points it at the EU, `mg.NewMessage(domain, from, subject, text, to)` builds the message, and `resp, err := mg.Send(ctx, message)` sends it, with `resp.ID` the message id. Per the page, the message takes attachments and Bcc recipients too; it names no setter, and doesn't describe what `err` holds.

```go
mg := mailgun.NewMailgun(os.Getenv("MAILGUN_API_KEY"))
m := mg.NewMessage("mail.example.com", "Example <hello@mail.example.com>", "Welcome", "Welcome", "jane@example.com")
resp, err := mg.Send(ctx, m)
```

**Java.** `mailgunMessagesApi.sendMessage(domain, message)` with a `Message.builder()`, as the [Java page](https://documentation.mailgun.com/docs/mailgun/sdk/java_sdk) shows. PostHog has no Java email send.

**EU region.** An app whose domain is in the EU region sets the EU API host in code or config. Each of these means every API request in `account.md` goes to `api.eu.mailgun.net`:

- Node.js: `https://api.eu.mailgun.net` in the `client({ ... })` options.
- PHP: `Mailgun::create($key, 'https://api.eu.mailgun.net')`.
- Go: `mg.SetAPIBase(mailgun.APIBaseEU)`.
- Any other code, env variable, or config value that holds `api.eu.mailgun.net` and reaches a Mailgun client or request.

**HTTP.** `POST https://api.mailgun.net/v3/<domain>/messages`, or `api.eu.mailgun.net` for a domain in the EU region, with HTTP basic auth: the user `api` and the API key as the password. The API reference describes a `multipart/form-data` body, one field per value, so a field such as `to` or `attachment` can repeat. A success answers `200` with `{ "id", "message" }`. An error answers its status, `400`, `401`, `429`, or `500` in the API reference, plus `403`, `404`, and `420` (the `/messages` recipients limit) in the [API overview](https://documentation.mailgun.com/docs/mailgun/api-reference/api-overview), usually with `{ "message": "..." }`. Look for `api.mailgun.net` and `api.eu.mailgun.net` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, Ruby `RestClient` and `Net::HTTP`, PHP `curl_init` and Guzzle, .NET `HttpClient` and `RestSharp`, and `curl` calls. A request built from a base URL and a path, such as `{domain}/messages`, is a send too.

```
from=Example <hello@mail.example.com>
to=jane@example.com
subject=Welcome
text=Welcome
html=<p>Welcome</p>
```

`POST /v3/<domain>/messages.mime` sends a full MIME message.

**SMTP.** Mailgun takes mail over SMTP at `smtp.mailgun.org`, or `smtp.eu.mailgun.org`, on ports 25, 465, 587, and 2525, with SMTP credentials of the domain, such as `postmaster@mail.example.com`. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. `X-Mailgun-*` headers, such as `X-Mailgun-Tag`, `X-Mailgun-Variables`, and `X-Mailgun-Deliver-By`, carry Mailgun options over SMTP.

**Frameworks.** Mailers that send every framework mail through Mailgun: Laravel's `mailgun` mailer (`MAIL_MAILER=mailgun`, with `domain`, `secret`, and `endpoint` under `services.mailgun`), `symfony/mailgun-mailer` in Symfony, `delivery_method = :mailgun` in Rails, `django-anymail` with its Mailgun backend in Django, `nodemailer-mailgun-transport` in Nodemailer, and `Swoosh.Adapters.Mailgun` and `Bamboo.MailgunAdapter` in Elixir. Each mailable or mailer that sends is a site.

## Send fields

The HTTP form fields. The Node.js, Python, Ruby, and PHP pages pass the same names as keys.

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
| `inline` | A file with `inline` disposition, which the HTML shows as `cid:<filename>`, as Mailgun's attachment guide does. Repeats |
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

The Events API (`GET https://api.mailgun.net/v3/<domain>/events`, with filters such as `message-id`, `recipient`, or `event`) and the Logs API (`/v1/analytics/logs`) read a message's delivery state. So does an SDK call that reads events or logs. Code that reads them reads Mailgun's state.

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

Look for routes that read `event-data`, `user-variables`, or `message.headers`, an HMAC over `timestamp` and `token`, and an SDK helper that verifies a webhook signature.

## Other APIs

Domains, DNS checks, DKIM keys, mailing lists and members, routes and inbound mail, templates, suppressions (bounces, complaints, unsubscribes, allowlists), webhook settings, tags, stats and metrics, logs, address validation, IPs and IP pools, subaccounts, and API keys (`/v3/domains`, `/v4/domains`, `/v3/lists`, `/v3/routes`, `/v3/<domain>/templates`, `/v4/templates`, `/v3/<domain>/bounces`, `/v3/<domain>/complaints`, `/v3/<domain>/unsubscribes`, `/v3/<domain>/whitelists`, `/v3/domains/<domain>/webhooks`, `/v1/keys`) are not transactional sends.
