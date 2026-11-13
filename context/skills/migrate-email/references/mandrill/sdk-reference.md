# Mailchimp Transactional SDK reference

This file says what Mailchimp Transactional, formerly Mandrill, looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `MANDRILL_API_KEY` or `MAILCHIMP_TRANSACTIONAL_API_KEY` by convention. Apps also use their own names: take the name the code reads. When the code makes a client without a key, read the installed client's source for the name it reads itself.

Mailchimp Transactional also has test keys, made in its test mode: a send with a test key answers like a real one and delivers nothing. PostHog has no such key, so a PostHog key in the same place delivers real email to whoever that environment sends to. When Step 6 lists the places that set the key, ask the person once which of them, such as staging or CI, set a test key, and note those places under the phase. For each, the report says under "PostHog secret key" that the place's sends delivered nothing before, and that the person sets a PostHog key there only where real delivery is fine: without one, the moved sends there fail on the missing key. When the person can't tell, say this for every place but production.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `@mailchimp/mailchimp_transactional` | `require('@mailchimp/mailchimp_transactional')(key).messages.send({ message })` |
| Python | `mailchimp-transactional` (PyPI), imported as `mailchimp_transactional` | `MailchimpTransactional.Client(key).messages.send({"message": message})` |
| Ruby | `MailchimpTransactional` | `MailchimpTransactional::Client.new(key).messages.send(message)`, or with the body `{ message: message }` |
| PHP | `mailchimp/transactional` | `$mailchimp->messages->send(['message' => $message])` |
| Node.js, older | `mandrill-api` | `messages.send` on its client, with callbacks the code passes |
| Python, older | `mandrill` (PyPI) | `messages.send` on its client |
| Ruby, older | `mandrill-api` | `messages.send` on its client |
| PHP, older | `mandrill/mandrill` | `messages->send` on a `Mandrill` client |

The official rows are the calls of Mailchimp Transactional's Quick Start and "Send your first email" guides. Its reference doesn't describe the older clients: read the installed client's source for how its send takes the `message`.

The API sends a stored template through `messages/send-template` and a template made in Mailchimp through `messages/send-mc-template`: find each package's method for them in the installed package, such as one named `sendTemplate` or `send_template`. Every send takes one body: `message`, and for a stored template also `template_name` and `template_content`, or `mc_template_id` for one made in Mailchimp, plus the top-level `async`, `ip_pool`, and `send_at`.

Go, .NET, and Elixir have no official SDK. Sites in them call the HTTP API, or use a community client such as `github.com/keighl/mandrill` (Go), `Mandrill.net` (NuGet), or `mandrill` (Hex). Treat a send through a community client like an HTTP send, with the same fields. The `mandrill` npm package is a third-party Node.js client of the Mailchimp Transactional API: treat it the same way.

These are not Mailchimp Transactional, and alone they are not a migration: `@mailchimp/mailchimp_marketing`, `mailchimp-marketing`, `mailchimp3`, `mailchimp/marketing`, and `MailchimpMarketing` call Mailchimp's Marketing API, for campaigns and audiences. `nodemailer` sends through any SMTP server.

## Clients and sends

The API answers a successful send with a list, one entry per recipient: `{ email, status, _id, reject_reason, queued_reason }`. `status` is `sent`, `queued`, `scheduled`, `rejected`, or `invalid`. A `rejected` or `invalid` recipient is not an API error: the call succeeds, and only the entry says the email did not go out. `reject_reason` is one of `hard-bounce`, `soft-bounce`, `spam`, `unsub`, `custom`, `invalid-sender`, `invalid`, `test-mode-limit`, `unsigned`, or `rule`. `_id` is the message id.

Any answer other than HTTP 200 is an API error, with the body `{ status: 'error', code, name, message }`, such as `name: 'Invalid_Key'` with HTTP 401, or `name: 'PaymentRequired'` with HTTP 402.

Mailchimp Transactional's reference doesn't say what each SDK's send does on an API error or a network error: whether it raises, or answers the error in place of the list, and with which class. Before the rewrite, read the installed SDK's source in the app's dependencies, such as `node_modules`, the virtualenv, `vendor`, or the bundle, and the code's own checks, which show what it expected.

**Node.js.** The guides' samples catch nothing around the send. Code that expected the error in place of the list checks the answer, such as `Array.isArray(response)`, `response instanceof Error`, `response.isAxiosError`, or a read of `response.response`. A site that never checks the answer, around a send that answers its errors, never fails on an error.

```js
const mailchimp = require('@mailchimp/mailchimp_transactional')(process.env.MANDRILL_API_KEY)

const response = await mailchimp.messages.send({
  message: {
    from_email: 'hello@mail.example.com',
    from_name: 'Example',
    to: [{ email: 'jane@example.com', type: 'to' }],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    text: 'Welcome',
  },
})
```

**Python.** The guides' samples catch `mailchimp_transactional.api_client.ApiClientError` around the send and read the error body as `e.text`. Read the installed package for its other attributes, such as the HTTP status, and for what it raises on a network error.

```python
import mailchimp_transactional as MailchimpTransactional
from mailchimp_transactional.api_client import ApiClientError

client = MailchimpTransactional.Client(os.environ["MANDRILL_API_KEY"])
try:
    result = client.messages.send({"message": {
        "from_email": "hello@mail.example.com",
        "to": [{"email": "jane@example.com"}],
        "subject": "Welcome",
        "html": "<p>Welcome</p>",
    }})
except ApiClientError as e:
    log.error("send failed: %s", e.text)
```

**Ruby.** The guides' samples rescue `MailchimpTransactional::ApiError` around the send. Read the installed gem for the error's attributes, such as the HTTP status and the body, and for what it raises on a network error.

```ruby
require 'MailchimpTransactional'

client = MailchimpTransactional::Client.new(ENV['MANDRILL_API_KEY'])
begin
  result = client.messages.send({ message: {
    from_email: 'hello@mail.example.com',
    to: [{ email: 'jane@example.com' }],
    subject: 'Welcome',
    html: '<p>Welcome</p>'
  } })
rescue MailchimpTransactional::ApiError => e
  log.error("send failed: #{e}")
end
```

**PHP.** The guides' samples wrap the send in `try` with `catch (Error $e)`, PHP's own error class, and read `$e->getMessage()`. Code that expected the error in place of the list checks the answer, such as `$response instanceof \GuzzleHttp\Exception\RequestException`. Read the installed package in `vendor`, and the Guzzle version in `composer.lock`, for what the send does on an API error and on a connection error.

```php
$mailchimp = new MailchimpTransactional\ApiClient();
$mailchimp->setApiKey(getenv('MANDRILL_API_KEY'));
$response = $mailchimp->messages->send(['message' => [
    'from_email' => 'hello@mail.example.com',
    'to' => [['email' => 'jane@example.com']],
    'subject' => 'Welcome',
    'html' => '<p>Welcome</p>',
]]);
```

**The older clients.** Mailchimp Transactional's reference doesn't describe them. Read the installed client's source for its send's arguments and for how it reports an API error and a network error, such as an error class of its own or a callback. A Node.js `mandrill-api` send takes callbacks for success and for errors, which the call shows. Some PHP apps keep a copy of the PHP client in their own code, sometimes under other class names: treat a class in the app that posts to `mandrillapp.com/api` and has a `messages->send` method as that client. A send through the PHP client stays, as `mapping.md` says.

**HTTP.** `POST https://mandrillapp.com/api/<version>/messages/send`, with a version such as `1.0`, `1.3`, or `1.4`, sometimes with a `.json` suffix. The key goes in the JSON body as `key`, not in a header. There is no regional host. `messages/send-template` and `messages/send-mc-template` send a stored template. A success answers `200` with the list above. Look for `mandrillapp.com/api` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, `HttpClient`, and `curl` calls.

```json
{
  "key": "<api key>",
  "message": {
    "from_email": "hello@mail.example.com",
    "from_name": "Example",
    "to": [{ "email": "jane@example.com", "type": "to" }],
    "subject": "Welcome",
    "html": "<p>Welcome</p>",
    "text": "Welcome"
  }
}
```

**SMTP.** Mailchimp Transactional takes mail over SMTP at `smtp.mandrillapp.com`, on port 25, 587, 2525, or 465, with any API key as the password and any user name. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. `X-MC-` headers, such as `X-MC-Template`, `X-MC-MergeVars`, `X-MC-Tags`, `X-MC-Metadata`, and `X-MC-SendAt`, carry the API's options over SMTP.

**Frameworks.** Mailers that send every framework mail through Mailchimp Transactional: `djrill` (`EMAIL_BACKEND = "djrill.mail.backends.djrill.DjrillBackend"`) and `django-anymail` with its Mandrill backend (`anymail.backends.mandrill.EmailBackend`) in Django, `mandrill_mailer` in Rails, and `Swoosh.Adapters.Mandrill` and `Bamboo.MandrillAdapter` in Elixir. Each mailable or mailer that sends is a site.

## Send fields

The fields of `message`, and the three top-level fields next to it. Every SDK and the HTTP API use the same names.

| Field | Value |
|---|---|
| `from_email` | The sender address |
| `from_name` | The sender name |
| `to` | A list of `{ email, name, type }`. `type` is `to` (the default), `cc`, or `bcc`: cc and bcc recipients are entries of `to` |
| `subject` | String |
| `html`, `text` | Strings |
| `headers` | Object of extra headers, such as `Reply-To` |
| `important` | Boolean: delivered ahead of other mail |
| `track_opens`, `track_clicks` | Booleans |
| `auto_text`, `auto_html` | Booleans: Mailchimp Transactional makes the missing part |
| `inline_css` | Boolean: Mailchimp Transactional inlines the CSS of the HTML |
| `url_strip_qs` | Boolean: drops query strings when it groups clicked URLs in reports |
| `preserve_recipients` | Boolean: each recipient sees every `to` address. When it is not set, the account's sending default decides |
| `view_content_link` | Boolean: `false` keeps the content out of Mailchimp Transactional's logs |
| `bcc_address` | An address that gets a copy of each recipient's email |
| `tracking_domain`, `signing_domain`, `return_path_domain` | Custom domains for tracked links, DKIM signing, and the return path |
| `merge` | Boolean: evaluate merge tags in the content. On when merge vars are set |
| `merge_language` | `mailchimp` or `handlebars`. When it is not set, the account's sending default decides |
| `global_merge_vars` | A list of `{ name, content }` for every recipient |
| `merge_vars` | A list of `{ rcpt, vars: [{ name, content }] }`, per recipient |
| `tags` | A list of strings, for stats |
| `subaccount` | The id of a subaccount that sends the email |
| `google_analytics_domains`, `google_analytics_campaign` | Adds Google Analytics parameters to links |
| `metadata` | Object of values, sent back in webhook events and searchable |
| `recipient_metadata` | A list of `{ rcpt, values }`, per recipient |
| `attachments` | A list of `{ type, name, content }`. `type` is the MIME type, `content` is base64 |
| `images` | A list of `{ type, name, content }`, inline images. `name` is the content id that the HTML reads as `cid:<name>` |
| `async` (top level) | Boolean: answer `queued` at once. Always on for more than 10 recipients |
| `ip_pool` (top level) | The name of a dedicated IP pool |
| `send_at` (top level) | A UTC time, `YYYY-MM-DD HH:MM:SS`, up to a year ahead |

## Templates stored at Mailchimp Transactional

`messages.sendTemplate` renders a template from the Mailchimp Transactional dashboard. Its content is not in the code: the code sends the template's slug as `template_name`, `template_content`, and the `message` fields.

- The template holds a subject, a sender address and name, HTML, and text. A `subject`, `from_email`, or `from_name` in `message` replaces the template's. An `html` in `message` is sent when the template has no HTML.
- A template has a draft and a published version. Sends use the published version.
- `template_content` is a list of `{ name, content }`. Each fills the template's region marked `mc:edit="<name>"` with `content`, usually HTML. Regions work only with the Mailchimp merge language.
- With `merge_language: 'mailchimp'`, merge tags look like `*|NAME|*`, with `*|IF:NAME|*`, `*|IF:NAME=value|*`, `*|ELSEIF:...|*`, `*|ELSE:|*`, `*|IFNOT:NAME|*`, and `*|END:IF|*`, and modifiers such as `*|HTML:NAME|*` (raw HTML), `*|UPPER:NAME|*`, `*|LOWER:NAME|*`, `*|TITLE:NAME|*`, `*|URL:NAME|*`, `*|DATE:format|*`, and `*|UNSUB:url|*`. `*|FNAME|*`, `*|LNAME|*`, and `*|EMAIL|*` come from the recipient.
- With `merge_language: 'handlebars'`, merge tags look like `{{name}}`, `{{{raw}}}`, `{{#if}}`, `{{elseif}}`, `{{else}}`, `{{#unless}}`, `{{#each}}` with `{{this}}`, `{{#with}}`, comparisons in backticks such as ``{{#if `total > 3`}}``, and the helpers `upper`, `lower`, `title`, `url`, `date`, `striptags`, and `unsub`. Names are not case-sensitive.
- Merge tags also work in `html`, `text`, and `subject` that the code sends with `messages.send`, filled from `global_merge_vars` and `merge_vars`.
- `messages.sendMcTemplate` sends a template made in Mailchimp by its `mc_template_id`.

## Status reads

`messages/info` reads one message by its `_id`, with its `state` and its opens and clicks. `messages/search`, `messages/content`, `messages/list-scheduled`, `messages/cancel-scheduled`, and `messages/reschedule` read or change sent and scheduled messages. Code that calls them reads Mailchimp Transactional's state.

## Webhooks

A webhook posts the app's endpoint a form-encoded body with one field, `mandrill_events`: a JSON list of up to 1,000 events. Each message event has `event`, `ts`, `_id` (the message id of the send), and `msg`, with `msg.email`, `msg.subject`, `msg.state`, `msg.tags`, `msg.metadata`, and `msg._id`. `event` is one of `send`, `deferral`, `hard_bounce`, `soft_bounce`, `delivered`, `open`, `click`, `spam`, `unsub`, and `reject`. Sync events, with `type` and `action` in place of `event`, report changes to the rejection denylist and allowlist. Inbound mail posts to the same kind of route.

Each request carries an `X-Mandrill-Signature` header: a base64 HMAC-SHA1, with the webhook's key, of the webhook's URL followed by each POST field's name and value in name order.

```js
app.post('/webhooks/mandrill', express.urlencoded({ extended: false }), (req, res) => {
  const signed = 'https://app.example.com/webhooks/mandrill' + 'mandrill_events' + req.body.mandrill_events
  const expected = crypto.createHmac('sha1', process.env.MANDRILL_WEBHOOK_KEY).update(signed).digest('base64')
  if (req.header('X-Mandrill-Signature') !== expected) return res.sendStatus(403)
  for (const event of JSON.parse(req.body.mandrill_events)) {
    if (event.event === 'hard_bounce') markBounced(event.msg.email)
  }
  res.sendStatus(200)
})
```

Look for routes that read `mandrill_events`, the `X-Mandrill-Signature` header, a webhook key variable such as `MANDRILL_WEBHOOK_KEY`, and Anymail's `anymail.webhooks.mandrill` tracking view.

## Other APIs

Templates, rejects, allowlists, senders, subaccounts, tags, URLs, webhooks, exports, inbound, IPs, metadata, users, and SMS (`templates/*`, `rejects/*`, `allowlists/*`, `senders/*`, `subaccounts/*`, `tags/*`, `urls/*`, `webhooks/*`, `exports/*`, `inbound/*`, `ips/*`, `metadata/*`, `users/*`, `messages/send-sms`) are not email sends. `messages/send-raw` sends a whole MIME document: it is a send, and it always stays.
