# SparkPost SDK reference

This file says what SparkPost looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `SPARKPOST_API_KEY` by convention, and the Node.js, Python, and Ruby clients read it from there when the code passes no key. Apps also use their own names, such as `SPARKPOST_SECRET` in Laravel: take the name the client reads.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `sparkpost` (npm) | `client.transmissions.send(transmission)` |
| Python | `sparkpost` (PyPI) | `SparkPost(key).transmissions.send(**fields)` |
| Ruby | `sparkpost` (gem) | `SparkPost::Client.new(key).transmission.send_message(to, from, subject, html, **options)` |
| PHP | `sparkpost/sparkpost` | `$sparky->transmissions->post($payload)` |
| Go | `github.com/SparkPost/gosparkpost` | `client.Send(&sp.Transmission{...})` |
| Java | `com.sparkpost:sparkpost` | `client.sendMessage(...)`, or `ResourceTransmissions.create(connection, 0, transmission)` |
| Elixir | `sparkpost` (Hex) | `SparkPost.Transmission.send(%SparkPost.Transmission{...})`, or `SparkPost.send(to:, from:, subject:, text:, html:)` |
| .NET | `SparkPost` (NuGet), a community library SparkPost points .NET users to | `client.Transmissions.Send(transmission)` |

SparkPost calls a send a **transmission**. One transmission sends one email to each entry in `recipients`.

SparkPost's sandbox domain is `sparkpostbox.com`, such as `testing@sparkpostbox.com`: an account sends its first test emails from it before it has a sending domain.

These are not SparkPost's send SDK, and alone they are not a migration: `@types/sparkpost` holds types only, `heml` builds email HTML only, `gosparkpost/events` only parses webhook events, and `nodemailer` alone sends through any SMTP server.

## Clients and sends

**Node.js.** `send` answers a promise of the response body, `{ results: { id, total_accepted_recipients, total_rejected_recipients } }`: `results.id` is the transmission id. It rejects with a `SparkPostError` on an API error: `err.statusCode` is the HTTP status, and `err.errors` is a list of `{ message, description, code }`. A callback as the last argument gets `(err, data)` instead.

```js
const SparkPost = require('sparkpost')
const client = new SparkPost(process.env.SPARKPOST_API_KEY)

await client.transmissions.send({
  content: {
    from: { email: 'hello@mail.example.com', name: 'Example' },
    subject: 'Welcome',
    text: 'Welcome',
    html: '<p>Welcome</p>',
  },
  recipients: [{ address: { email: 'jane@example.com', name: 'Jane' } }],
})
```

- `new SparkPost(key, { origin: 'https://api.eu.sparkpost.com:443' })` sends from an EU account. `endpoint` is a second name for `origin`.
- Top-level `cc` and `bcc`, each a list of `{ address }`, are the SDK's own fields: it turns them into recipients with `header_to` and a `CC` header before the request.
- `send(transmission, options)` passes `options` as query parameters, such as `num_rcpt_errors`. They are not send fields.
- `client.request(...)`, `client.post({ uri: 'transmissions', json })` send a raw body.
- Version 1.x of `sparkpost` takes `client.transmissions.send({ transmissionBody }, callback)`: the transmission sits under `transmissionBody`, and its keys may be written in camelCase, such as `substitutionData` or `campaignId`, which the SDK turns into the HTTP names. It runs every key, at every depth, through lodash's `snakeCase`, so `substitutionData: { firstName: 'Jane', address1 }` reaches SparkPost as `substitution_data: { first_name: 'Jane', address_1 }`. Only the values of the top-level keys written as `substitution_data`, `metadata`, `tags`, `attributes`, or `headers`, and `content.email_rfc822`, keep their keys as written. The values of `recipients[].substitution_data` and `content.headers` are renamed too. The callback gets `(err, res)`, where `res` is the HTTP response and `res.body.results.id` the transmission id. An API error has `err.statusCode` and `err.errors`, as in 2.x, and a network error is the HTTP library's own error.

**Python.** It raises `sparkpost.exceptions.SparkPostAPIException` on an API error: `e.status` is the HTTP status, `e.errors` a list of strings, and `e.response` the `requests` response. A success answers the `results` dict, whose `id` is the transmission id.

```python
from sparkpost import SparkPost

sp = SparkPost(os.environ["SPARKPOST_API_KEY"])
sp.transmissions.send(
    recipients=["jane@example.com"],
    from_email="Example <hello@mail.example.com>",
    subject="Welcome",
    html="<p>Welcome</p>",
    text="Welcome",
)
```

- `SparkPost(key, base_uri="api.eu.sparkpost.com")`, or `base_uri=sparkpost.EU_API`, sends from an EU account.
- The keyword names differ from the HTTP names: `from_email`, `template` (a stored template id), `campaign`, `track_opens`, `track_initial_opens`, `track_clicks`, `use_sandbox`, `custom_headers`, `recipient_list`, and `start_time`. `cc` and `bcc` take lists of addresses. The rest keep their HTTP names, such as `reply_to`, `substitution_data`, `metadata`, `attachments`, `transactional`, `ip_pool`, and `return_path`.
- An attachment is `{ type, name, data }`, or `{ type, name, filename }` where `filename` is a path the SDK reads.
- `sparkpost.tornado` has an async client with the same `transmissions.send`.

**Ruby.** `send_message` raises `SparkPost::DeliveryException` with the API's `errors` list as its message when the answer holds `errors`, and answers the `results` hash otherwise. The gem's source repository is gone, and its last release is old.

```ruby
require 'sparkpost'

sp = SparkPost::Client.new(ENV['SPARKPOST_API_KEY'])
sp.transmission.send_message('jane@example.com', 'hello@mail.example.com', 'Welcome', '<p>Welcome</p>', text_message: 'Welcome')
```

- `SparkPost::Client.new(key, 'https://api.eu.sparkpost.com')` sends from an EU account. Without a host argument it reads `SPARKPOST_API_HOST`.
- `to` can be a list. Each other keyword goes into the HTTP body as it is. `send_payload(body)` sends a raw body.

**PHP.** The client is async by default: `post` answers a `SparkPostPromise`, and `->wait()` answers the response or throws. With `'async' => false` it answers a `SparkPostResponse` directly. An API error throws `SparkPost\SparkPostException`: `getCode()` is the HTTP status, `getMessage()` the raw body, and `getBody()` the decoded body with its `errors`. `getBody()['results']['id']` of a response is the transmission id.

```php
use SparkPost\SparkPost;

$sparky = new SparkPost($httpClient, ['key' => getenv('SPARKPOST_API_KEY'), 'async' => false]);
$response = $sparky->transmissions->post([
    'content' => ['from' => 'hello@mail.example.com', 'subject' => 'Welcome', 'html' => '<p>Welcome</p>'],
    'recipients' => [['address' => ['email' => 'jane@example.com']]],
]);
```

- `'host' => 'api.eu.sparkpost.com'` sends from an EU account.
- `cc` and `bcc` in the payload are the SDK's own fields, as in Node.js.
- `post($payload, $headers)` sends extra request headers, such as `Idempotency-Key`. `$sparky->request('POST', 'transmissions', $body)` sends a raw body.

**Go.** `Send` answers `(id string, res *sp.Response, err error)`: `id` is the transmission id. `err` is set for a network error and for an API error, which is an `sp.SPErrors` list of `{ Message, Code, Description }`. `res.HTTP.StatusCode` holds the HTTP status.

```go
var client sp.Client
err := client.Init(&sp.Config{BaseUrl: "https://api.sparkpost.com", ApiKey: os.Getenv("SPARKPOST_API_KEY"), ApiVersion: 1})

id, _, err := client.Send(&sp.Transmission{
    Recipients: []string{"jane@example.com"},
    Content: sp.Content{From: "hello@mail.example.com", Subject: "Welcome", HTML: "<p>Welcome</p>"},
})
```

- `BaseUrl: "https://api.eu.sparkpost.com"` sends from an EU account. `SendContext(ctx, t)` takes a context.
- `Recipients` takes `[]string`, `[]sp.Recipient{{Address: sp.Address{Email, Name, HeaderTo}}}`, or a `map[string]string{"list_id": ...}`.
- `Content` takes `sp.Content{From, ReplyTo, Subject, HTML, Text, Headers, Attachments, InlineImages, EmailRFC822}`, or a `map[string]string{"template_id": ...}` for a stored template. `sp.Attachment` is `{MIMEType, Filename, B64Data}`.
- `Options: &sp.TxOptions{...}` sets `StartTime`, `Sandbox`, `SkipSuppression`, `IPPool`, `InlineCSS`, `OpenTracking`, `ClickTracking`, and `Transactional`.

**.NET.** `client.Transmissions.Send(transmission)` answers a `Task<SendTransmissionResponse>` with `Id`, `TotalAcceptedRecipients`, and `TotalRejectedRecipients`. It throws a `SparkPost.ResponseException` on an API error, whose `Response` has `StatusCode` and `Content`.

```csharp
var transmission = new Transmission();
transmission.Content.From.Email = "hello@mail.example.com";
transmission.Content.Subject = "Welcome";
transmission.Content.Html = "<p>Welcome</p>";
transmission.Recipients.Add(new Recipient { Address = new Address { Email = "jane@example.com" } });
var response = await new Client(Environment.GetEnvironmentVariable("SPARKPOST_API_KEY")).Transmissions.Send(transmission);
```

- `new Client(key, "https://api.eu.sparkpost.com")` sends from an EU account.
- A `Recipient` with `Type = RecipientType.CC` or `RecipientType.BCC` is a cc or bcc. `transmission.Content.TemplateId` sends a stored template.

**Elixir.** `SparkPost.Transmission.send/1` answers a `%SparkPost.Transmission.Response{id: id, total_accepted_recipients: n, total_rejected_recipients: n}` on success, and a `%SparkPost.Endpoint.Error{status_code: code, errors: errors}` on an API or network error. It answers no `{:ok, _}` tuple.

```elixir
alias SparkPost.{Content, Transmission}

Transmission.send(%Transmission{
  recipients: ["jane@example.com"],
  content: %Content.Inline{from: "hello@mail.example.com", subject: "Welcome", text: "Welcome", html: "<p>Welcome</p>"}
})
```

- `config :sparkpost, api_key: ...` sets the key, and `api_endpoint` the host for an EU account.
- `%Content.TemplateRef{template_id: ...}` sends a stored template, and `%Content.Raw{email_rfc822: ...}` raw MIME. `Content.to_attachment(name, type, data)` builds an attachment.

**HTTP.** `POST https://api.sparkpost.com/api/v1/transmissions`, or `api.eu.sparkpost.com` for an EU account, with the key as the whole `Authorization` header (no `Bearer`), or Basic auth with the key as the user and an empty password. A success answers `200` with `{ "results": { "id", "total_accepted_recipients", "total_rejected_recipients" } }`. An error answers `{ "errors": [{ "message", "description", "code" }] }`, such as `420` for a sending limit. A `200` whose `errors` holds code `2000` means some recipients were rejected. An `Idempotency-Key` header makes a retry safe. Look for `api.sparkpost.com` and `api.eu.sparkpost.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

```json
{
  "options": { "transactional": true },
  "recipients": [{ "address": { "email": "jane@example.com", "name": "Jane" }, "substitution_data": { "name": "Jane" } }],
  "content": { "from": { "email": "hello@mail.example.com", "name": "Example" }, "subject": "Welcome", "html": "<p>Hi {{name}}</p>", "text": "Hi {{name}}" }
}
```

**EU accounts.** An app on an EU account names `api.eu.sparkpost.com` in its code, or sets the client's host by a setting whose value may live elsewhere: Node.js `origin` or `endpoint`, Python `base_uri=sparkpost.EU_API` or the Django setting `SPARKPOST_BASE_URI`, Ruby's `SPARKPOST_API_HOST` env variable, PHP `'host'`, Go `Config.BaseUrl`, .NET `Client.ApiHost`, and Elixir `config :sparkpost, api_endpoint:`. Read the value of that setting, in the env files too. When it names `api.eu.sparkpost.com`, every API request in `account.md` goes to `api.eu.sparkpost.com`.

**SMTP.** SparkPost takes mail over SMTP at `smtp.sparkpostmail.com`, or `smtp.eu.sparkpostmail.com` for an EU account, on port 587 or 2525, with the user `SMTP_Injection` and an API key as the password. Look for those hosts in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. An `X-MSYS-API` header carries SparkPost options over SMTP, such as `campaign_id`, `metadata`, `tags`, `cc`, `bcc`, and `options`.

**Frameworks.** Mailers that send every framework mail through SparkPost: `sparkpost.django.email_backend.SparkPostEmailBackend` and `django-anymail` with its SparkPost backend (`anymail.backends.sparkpost.EmailBackend`) in Django, `sparkpost_rails` in Rails, a SparkPost mail driver in Laravel (`MAIL_MAILER=sparkpost`, such as `vemcogroup/laravel-sparkpost-driver`), `Swoosh.Adapters.SparkPost` and `bamboo_sparkpost` in Elixir, and `nodemailer-sparkpost-transport` in Node.js. Each mailable or mailer that sends is a site.

## Send fields

The HTTP names, which the Node.js, PHP, and Elixir SDKs use too. Python renames a few, as above, and Go and .NET use their own case.

| Field | Value |
|---|---|
| `recipients` | A list of recipient objects, or `{ list_id }` for a stored recipient list |
| `recipients[].address` | An address, or `{ email, name, header_to }`. `header_to` shows another address in the To header, which makes the recipient a cc or bcc |
| `recipients[].substitution_data` | Object of template values for this recipient |
| `recipients[].metadata` | Object of values for this recipient, sent back in webhook events and readable by the template |
| `recipients[].tags` | A list of labels, sent back in webhook events |
| `recipients[].return_path`, `recipients[].options` | The envelope sender, and tracking options, for this recipient |
| `cc`, `bcc` | Node.js, PHP, and Python only: lists the SDK turns into recipients with `header_to`, and a `CC` header for `cc` |
| `content.from` | An address, `Name <address>`, or `{ email, name }` |
| `content.subject` | String |
| `content.html`, `content.text` | Strings |
| `content.amp_html` | AMP HTML |
| `content.reply_to` | An address, or `Name <address>` |
| `content.headers` | Object of custom headers, such as `CC` |
| `content.attachments` | A list of `{ name, type, data }`. `data` is base64 |
| `content.inline_images` | A list of `{ name, type, data }`, shown with `<img src="cid:name">` |
| `content.template_id` | A stored template. `content.use_draft_template: true` sends its draft |
| `content.ab_test_id` | A stored A/B test |
| `content.email_rfc822` | A whole raw MIME message |
| `substitution_data` | Object of template values for every recipient |
| `metadata` | Object of values for every recipient, sent back in webhook events |
| `campaign_id` | String, sent back in webhook events and used in reports |
| `description` | String that names the transmission in SparkPost |
| `return_path` | The envelope sender on a bounce domain |
| `override` | `from`, `reply_to`, and `list_id` that replace a stored template's values |
| `tracking_domain` | A custom tracking domain for this send |
| `options.start_time` | A send time, up to 3 days ahead |
| `options.open_tracking`, `options.initial_open`, `options.click_tracking` | Booleans |
| `options.transactional` | Boolean, `false` by default: transactional and non-transactional mail differ in suppressions and unsubscribe handling |
| `options.sandbox` | Sends from SparkPost's sandbox domain |
| `options.skip_suppression` | Sends to suppressed addresses (Enterprise) |
| `options.ip_pool`, `options.dkim_key` | A dedicated IP pool, and a DKIM key |
| `options.inline_css` | Moves `<style>` CSS into the HTML |
| `options.perform_substitutions` | `false` turns the template language off for inline `text`, `html`, and `amp_html`, but not for `from`, `subject`, `reply_to`, or `headers` |
| `options.enable_minimized_event_passthrough` | Strips open events down |
| `Idempotency-Key` header | Makes a retry safe for 24 hours |

**Content is a template.** SparkPost runs `from`, `subject`, `text`, `html`, `amp_html`, `reply_to`, and `headers` through its template language, inline content too, with values from `substitution_data` and `metadata`. `options.perform_substitutions: false` turns it off for `text`, `html`, and `amp_html` only: `from`, `subject`, `reply_to`, and `headers` still go through it. So `{{name}}` in inline `html` is a placeholder, not text, unless that option is `false`.

## Templates stored at SparkPost

A send with `content.template_id` renders a template from the SparkPost app. Its content is not in the code. A template has a published version, which sends by default, and a draft.

The template language, in templates and in inline content:

- `{{name}}`, `{{user.first_name}}`, `{{user['city']}}` insert a value. A missing or `null` value inserts an empty string. `{{ name or 'there' }}` sets a fallback.
- Values are HTML-escaped in `html` and `amp_html`, and not in `text`. `{{{raw}}}` inserts a value without escaping. An expression inside a link URL is URL-encoded instead.
- `{{if paid}}`, `{{elseif ...}}`, `{{else}}`, `{{end}}`, with `==`, `!=`, `<`, `>`, `<=`, `>=`, `and`, `or`, and `not`.
- `{{each items}}` … `{{end}}` loops, with `loop_var` (`loop_vars.<name>` in nested loops) and `loop_index`. `{{#items}}` is a length, `items[1]` the first item, and `+ - * /` are arithmetic.
- Macros: `render_dynamic_content(dynamic_html.x)`, `render_snippet(...)`, `empty(...)`, and the brace macros, such as `opening_double_curly()`.
- Reserved values: `address.name`, `address.email`, `email`, `email_id`, `env_from`, and `return_path`. `address.email`, `email`, and `email_id` all hold the recipient's address.
- Link attributes: `data-msys-linkname`, `data-msys-unsubscribe`, `data-msys-clicktrack`, `data-msys-sublink`, and `data-msys-revoke-tracking`, written as `[[data-msys-...]]` after a link in `text`.

## Status reads

The Events API (`GET /api/v1/events/message`, filtered by `transmissions`, `recipients`, and more) and the Metrics API (`/api/v1/metrics/...`) read SparkPost's delivery state. Code that reads them reads SparkPost's state.

## Webhooks

An event webhook posts a JSON list to an endpoint of the app, in batches. Each entry is `{ "msys": { "<group>": { ...event } } }`, where the group is `message_event`, `track_event`, `gen_event`, `unsubscribe_event`, `relay_event`, `ab_test_event`, or `ingest_event`. Each event has `type`, `event_id`, `transmission_id`, `message_id`, `rcpt_to`, `rcpt_meta` (the send's `metadata`), `rcpt_tags`, `campaign_id`, `template_id`, and `timestamp`.

| Group | `type` |
|---|---|
| `message_event` | `injection`, `delivery`, `bounce`, `out_of_band`, `spam_complaint`, `policy_rejection`, `delay` |
| `track_event` | `open`, `initial_open`, `click`, `amp_open`, `amp_initial_open`, `amp_click` |
| `gen_event` | `generation_failure`, `generation_rejection` |
| `unsubscribe_event` | `list_unsubscribe`, `link_unsubscribe` |
| `relay_event`, `ab_test_event`, `ingest_event` | Inbound mail, A/B tests, and event uploads: not sends |

SparkPost signs no payload. A webhook authenticates with Basic auth, with an OAuth 2.0 bearer token it fetches from the app, or with an `X-MessageSystems-Webhook-Token` header on older webhooks. Each batch carries an `X-MessageSystems-Batch-ID` header.

```js
app.post('/webhooks/sparkpost', express.json(), (req, res) => {
  for (const { msys } of req.body) {
    const event = msys.message_event ?? msys.track_event
    if (event?.type === 'bounce') markBounced(event.rcpt_to)
  }
  res.sendStatus(200)
})
```

Look for routes that read `msys`, `message_event`, `track_event`, `transmission_id`, `rcpt_meta`, or `X-MessageSystems-Batch-ID`, and for the `github.com/SparkPost/gosparkpost/events` package.

## Other APIs

Templates, recipient lists, suppressions, sending, bounce, and tracking domains, subaccounts, webhooks, relay webhooks, inbound domains, snippets, A/B tests, recipient validation, metrics, and events (`/api/v1/templates`, `/recipient-lists`, `/suppression-list`, `/sending-domains`, `/tracking-domains`, `/subaccounts`, `/webhooks`, `/relay-webhooks`, `/inbound-domains`, `/ab-test`, `/recipient-validation`, `/metrics`, and `/events`) are not sends. `DELETE /api/v1/transmissions?campaign_id=...` cancels scheduled transmissions.