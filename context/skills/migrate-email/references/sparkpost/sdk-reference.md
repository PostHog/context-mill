# SparkPost SDK reference

This file says what SparkPost looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `SPARKPOST_API_KEY` by convention, and the Python library's docs recommend that variable, which `SparkPost()` reads when the code passes no key. Apps also use their own names, such as `SPARKPOST_SECRET` in Laravel: take the name the client reads.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `sparkpost` (npm) | `client.transmissions.send(transmission)` |
| Python | `sparkpost` (PyPI) | `SparkPost(key).transmissions.send(**fields)` |
| Ruby | `sparkpost` (gem) | `send_message(...)` on a `SparkPost::Client` |
| PHP | `sparkpost/sparkpost` | `$sparky->transmissions->post($payload)` |
| Go | `github.com/SparkPost/gosparkpost` | `client.Send(&sp.Transmission{...})` |
| Java | the `com.sparkpost` library | `new Client(key).sendMessage(...)` |
| Elixir | `sparkpost` (Hex) | `SparkPost.Transmission.send(%SparkPost.Transmission{...})`, or `SparkPost.send(to:, from:, subject:, text:, html:)` |
| .NET | `SparkPost` (NuGet), a community library SparkPost points .NET users to | `client.Transmissions.Send(transmission)` |

SparkPost calls a send a **transmission**. One transmission sends one email to each entry in `recipients`.

SparkPost's sandbox domain is `sparkpostbox.com`, such as `testing@sparkpostbox.com`: an account sends its first test emails from it before it has a sending domain.

These are not SparkPost's send SDK, and alone they are not a migration: `@types/sparkpost` holds types only, `heml` builds email HTML only, `gosparkpost/events` only parses webhook events, and `nodemailer` alone sends through any SMTP server.

## Clients and sends

Only the call shapes below come from SparkPost's docs and the SDKs' own docs pages: its developer hub's samples, the Python library's docs, the Go package's docs, and the Elixir library's docs. Where they don't name a class, a property, or an option, read it from the site's own code, and never assume one.

**Node.js.** SparkPost's sample sends with `client.transmissions.send(transmission)` and handles the answer with `.then(...)` and an error with `.catch(...)`. The API's answer holds `{ results: { id, total_accepted_recipients, total_rejected_recipients } }`, where `results.id` is the transmission id, and an error answer holds the HTTP status and `{ errors: [{ message, description, code }] }`. SparkPost's docs don't name the error the SDK rejects with or its properties: read which ones the site's `catch` reads for the HTTP status and the API's `errors`.

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

- A key the API reference doesn't list for a transmission, such as a top-level `cc` or `bcc`, is the SDK's own, and SparkPost's docs don't say what the SDK sends for it. A `cc` or `bcc` is a cc or bcc, as `mapping.md` says. Any other such key keeps the site on SparkPost, and the reason is `sets <key>, which SparkPost's docs don't describe`.
- A second argument to `send`, or a callback, is not a transmission field either. A second argument that isn't a callback keeps the site on SparkPost for the same reason.
- A transmission wrapped in `transmissionBody`, such as `client.transmissions.send({ transmissionBody }, callback)`, is an older SDK's call, which SparkPost's docs don't describe. It stays, as `mapping.md` says under "Calls".

**Python.** The library's docs say `send` returns a dict with the transmission id and the number of accepted and rejected recipients, and raises `SparkPostAPIException` when the transmission can't be sent. They don't name its attributes: read which ones the site's `except` reads for the HTTP status and the API's errors.

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

- `SparkPost(key, 'https://api.eu.sparkpost.com/api')`, the host as a second argument, sends from an EU account.
- The keyword names differ from the HTTP names: `from_email`, `template` (a stored template id), `campaign`, `track_opens`, `track_clicks`, `use_sandbox`, `custom_headers`, `recipient_list`, and `start_time`. `cc` and `bcc` take lists of addresses. The rest keep their HTTP names, such as `reply_to`, `substitution_data`, `metadata`, `attachments`, `inline_images`, `transactional`, `skip_suppression`, `ip_pool`, `inline_css`, and `return_path`. A keyword the docs don't list keeps the site on SparkPost, and the reason is `sets <keyword>, which SparkPost's docs don't describe`.
- An attachment is `{ type, name, data }`, or `{ type, name, filename }` where `filename` is a path the library reads and encodes.

**Ruby.** SparkPost's docs have no Ruby sample, and the gem's docs page couldn't be read. A Ruby site sends through `send_message` on a `SparkPost::Client`, or through its own request to the API. Read the fields from the site's code: a keyword or hash key names its field, and a positional argument names none. A `send_message` call with positional arguments keeps the site on SparkPost, and the reason is `SparkPost's Ruby call doesn't name its fields`, unless the site's own code shows which field each argument is, such as a wrapper whose parameters are named `to`, `from`, `subject`, and `html`. Read the `rescue` around the send for the error class it catches and what it reads from it.

**PHP.** SparkPost's sample builds `new SparkPost($httpClient, ['key' => ...])`, turns async off with `$sparky->setOptions(['async' => false])`, and sends with `$sparky->transmissions->post([...])`, whose payload takes the HTTP names. A client that doesn't turn async off may answer a promise, which the site settles with `->wait()` or `->then(...)`. SparkPost's docs don't name the library's response or exception classes: read which methods the site calls for the HTTP status, the API's `errors`, and `results.id`.

```php
use SparkPost\SparkPost;

$sparky = new SparkPost($httpClient, ['key' => getenv('SPARKPOST_API_KEY')]);
$sparky->setOptions(['async' => false]);
$response = $sparky->transmissions->post([
    'content' => ['from' => 'hello@mail.example.com', 'subject' => 'Welcome', 'html' => '<p>Welcome</p>'],
    'recipients' => [['address' => ['email' => 'jane@example.com']]],
]);
```

- A payload key the API reference doesn't list, such as `cc` or `bcc`, is the library's own, as in Node.js.

**Go.** The package's docs give `Send(t *Transmission) (id string, res *Response, err error)`: `id` is the transmission id. `res.HTTP` is the HTTP response, with its `StatusCode`, and `res.Errors` the API's errors, an `sp.SPErrors` list of `{ Message, Code, Description, Part, Line }`. The docs don't say which errors `err` carries: read how the site checks it.

```go
var client sp.Client
err := client.Init(&sp.Config{BaseUrl: "https://api.sparkpost.com", ApiKey: os.Getenv("SPARKPOST_API_KEY"), ApiVersion: 1})

id, _, err := client.Send(&sp.Transmission{
    Recipients: []string{"jane@example.com"},
    Content: sp.Content{From: "hello@mail.example.com", Subject: "Welcome", HTML: "<p>Welcome</p>"},
})
```

- `Config.BaseUrl` sets the host, such as `"https://api.eu.sparkpost.com"` for an EU account. `SendContext(ctx, t)` takes a context.
- `Recipients` takes `[]string`, `[]sp.Recipient{{Address: sp.Address{Email, Name, HeaderTo}}}`, or another value the code builds in the shape of the HTTP `recipients`, such as a map with `list_id`.
- `Content` takes `sp.Content{From, ReplyTo, Subject, HTML, Text, Headers, Attachments, InlineImages, EmailRFC822}`, or another value in the shape of the HTTP `content`, such as a map with `template_id` for a stored template. `sp.Attachment` is `{MIMEType, Filename, B64Data}`, which the docs tag `type`, `name`, and `data`.
- `Options: &sp.TxOptions{...}` sets `StartTime`, `Sandbox`, `SkipSuppression`, `IPPool`, `InlineCSS`, `PerformSubstitutions`, and, through its `TmplOptions`, `OpenTracking`, `ClickTracking`, and `Transactional`.

**.NET.** SparkPost's sample, for a library a community member maintains and SparkPost endorses, builds a `Transmission` and sends it with `new Client(key).Transmissions.Send(transmission)`. SparkPost's docs don't say what the send answers or throws: read what the site awaits, which properties it reads, and the class its `catch` names.

```csharp
var transmission = new Transmission();
transmission.Content.From.Email = "hello@mail.example.com";
transmission.Content.Subject = "Welcome";
transmission.Content.Html = "<p>Welcome</p>";
transmission.Recipients.Add(new Recipient { Address = new Address { Email = "jane@example.com" } });
var response = await new Client(Environment.GetEnvironmentVariable("SPARKPOST_API_KEY")).Transmissions.Send(transmission);
```

- A property the code sets that isn't in the sample, such as a recipient's type, or a template id on the content, maps to the HTTP field of the same name when its name says which one. When it doesn't, the site stays, and the reason is `sets <property>, which SparkPost's docs don't describe`.

**Elixir.** The library's docs show `SparkPost.Transmission.send/1` answering a `%SparkPost.Transmission.Response{id: id, total_accepted_recipients: n, total_rejected_recipients: n}`. They list `SparkPost.Endpoint.Error` among its exceptions, raised when SparkPost answers with `errors`, with the fields `status_code`, `errors`, and `results`. Read whether the site rescues it or matches it as a value.

```elixir
alias SparkPost.{Content, Transmission}

Transmission.send(%Transmission{
  recipients: ["jane@example.com"],
  content: %Content.Inline{from: "hello@mail.example.com", subject: "Welcome", text: "Welcome", html: "<p>Welcome</p>"}
})
```

- `config :sparkpost, api_key: ...` sets the key. The docs name no host setting: look for `api.eu.sparkpost.com` in the app's config.
- `%Content.TemplateRef{template_id: ...}` sends a stored template, and `%Content.Raw{...}` raw MIME. `Content.to_attachment(name, type, data)` builds an attachment.

**HTTP.** `POST https://api.sparkpost.com/api/v1/transmissions`, or `api.eu.sparkpost.com` for an EU account, with the key as the whole `Authorization` header (no `Bearer`), or Basic auth with the key as the user and an empty password. A success answers `200` with `{ "results": { "id", "total_accepted_recipients", "total_rejected_recipients" } }`. An error answers `{ "errors": [{ "message", "description", "code" }] }`, such as `420` for a sending limit. A `200` whose `errors` holds code `2000` means some recipients were rejected. An `Idempotency-Key` header makes a retry safe. Look for `api.sparkpost.com` and `api.eu.sparkpost.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

```json
{
  "options": { "transactional": true },
  "recipients": [{ "address": { "email": "jane@example.com", "name": "Jane" }, "substitution_data": { "name": "Jane" } }],
  "content": { "from": { "email": "hello@mail.example.com", "name": "Example" }, "subject": "Welcome", "html": "<p>Hi {{name}}</p>", "text": "Hi {{name}}" }
}
```

**EU accounts.** An app on an EU account names `api.eu.sparkpost.com` in its code, or sets the client's host by a setting whose value may live elsewhere, such as Python's second argument to `SparkPost(...)` or Go's `Config.BaseUrl`. For the other SDKs, SparkPost's docs name no host setting: look for `api.eu.sparkpost.com` in the client's options, the app's config, and the env files, and read the value of any setting the client takes it from. When it names `api.eu.sparkpost.com`, every API request in `account.md` goes to `api.eu.sparkpost.com`.

**SMTP.** SparkPost takes mail over SMTP at `smtp.sparkpostmail.com`, or `smtp.eu.sparkpostmail.com` for an EU account, on port 587 or 2525, with the user `SMTP_Injection` and an API key as the password. Look for those hosts in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. An `X-MSYS-API` header carries SparkPost options over SMTP, such as `campaign_id`, `metadata`, `tags`, `cc`, `bcc`, and `options`.

**Frameworks.** Mailers that send every framework mail through SparkPost: `sparkpost.django.email_backend.SparkPostEmailBackend` and `django-anymail` with its SparkPost backend (`anymail.backends.sparkpost.EmailBackend`) in Django, `sparkpost_rails` in Rails, a SparkPost mail driver in Laravel (`MAIL_MAILER=sparkpost`, such as `vemcogroup/laravel-sparkpost-driver`), `Swoosh.Adapters.SparkPost` and `bamboo_sparkpost` in Elixir, and `nodemailer-sparkpost-transport` in Node.js. Each mailable or mailer that sends is a site.

## Send fields

The HTTP names, which SparkPost's Node.js and PHP samples use too. Python renames a few, as above, and Go, .NET, and Elixir use their own structs.

| Field | Value |
|---|---|
| `recipients` | A list of recipient objects, or `{ list_id }` for a stored recipient list |
| `recipients[].address` | An address, or `{ email, name, header_to }`. `header_to` shows another address in the To header, which makes the recipient a cc or bcc |
| `recipients[].substitution_data` | Object of template values for this recipient |
| `recipients[].metadata` | Object of values for this recipient, sent back in webhook events and readable by the template |
| `recipients[].tags` | A list of labels, sent back in webhook events |
| `recipients[].return_path`, `recipients[].options` | The envelope sender, and tracking options, for this recipient |
| `cc`, `bcc` | Not API fields: an SDK's own, such as Python's keywords. Each is a cc or bcc |
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
| `override` | `from`, `reply_to`, `list_id`, and `headers` that replace the content's values, inline or a stored template's |
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