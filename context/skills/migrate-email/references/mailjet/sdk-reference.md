# Mailjet SDK reference

This file says what Mailjet looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

Mailjet authenticates with two keys: the API key and the secret key. They live in `MJ_APIKEY_PUBLIC` and `MJ_APIKEY_PRIVATE` by convention, as Mailjet's SDK pages name them. Framework packages and apps also use their own names, such as `MAILJET_APIKEY` and `MAILJET_APISECRET`, or `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`: take the names the client reads. Both keys count as the provider key wherever a step names it: search for both names.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `node-mailjet` | `mailjet.post('send', { version: 'v3.1' }).request({ Messages: [...] })` |
| Python | `mailjet-rest` (PyPI), imported as `mailjet_rest` | `Client(auth=(key, secret), version='v3.1').send.create(data=...)` |
| Ruby | `mailjet` (gem) | `Mailjet::Send.create(messages: [...])` |
| PHP | `mailjet/mailjet-apiv3-php` | `$mj->post(Resources::$Email, ['body' => $body])` |
| Go | `github.com/mailjet/mailjet-apiv3-go/v4`, and earlier majors such as `/v3` | `mailjet.NewMailjetClient(key, secret).SendMailV31(&messages)` |
| .NET | `Mailjet.Api` (NuGet), namespace `Mailjet.Client` | `client.SendTransactionalEmailAsync(email)`, or `client.PostAsync(request)` |
| Java | `com.mailjet:mailjet-client` | `client.post(new MailjetRequest(Emailv31.resource)...)`, or `SendEmailsRequest.sendWith(client)` |

The rows are the packages and send calls of Mailjet's SDK pages and Send API guides. Go's module path carries its major version from v3.0 on.

These are not Mailjet's send SDK, and alone they are not a migration: `mjml` renders email markup and sends nothing, `nodemailer` and other SMTP libraries send through any SMTP server, and Mailjet's Parse API (`/v3/REST/parseroute`) receives inbound mail.

## Clients and sends

Every SDK sends the same JSON body to the Send API: `Messages`, a list of messages with PascalCase fields such as `From`, `To`, `Subject`, `TextPart`, and `HTMLPart`. The SDKs pass that body as it is, except the Go structs and the .NET builder, which name the same fields.

A success answers `Messages`, one entry per message in the same order. Each entry has `Status` (`success` or `error`), `CustomID`, and `To`, `Cc`, and `Bcc`, each a list of `{ Email, MessageUUID, MessageID, MessageHref }`. `MessageID` (a number) and `MessageUUID` are the message ids, one per recipient. An entry whose `Status` is `error` has `Errors`, a list of `{ ErrorIdentifier, ErrorCode, StatusCode, ErrorMessage, ErrorRelatedTo }`, whose `StatusCode` follows the HTTP status, such as `400` for an invalid address (`mj-0013`). An error of the whole request, such as malformed JSON, answers one `{ ErrorIdentifier, ErrorCode, ErrorMessage, StatusCode }` without `Messages`. Mailjet's pages don't say which HTTP status the whole call answers when it refuses a message.

Mailjet's SDK pages show how each SDK sends and how their samples read a failed send. For most SDKs they don't say what the send does on an API error or a network error: whether it raises or answers, with which class and which attributes, and whether it retries first. Before the rewrite, read the SDK client installed in the person's app, such as in `node_modules`, the virtualenv, `vendor`, the bundle, the Go module cache, or the NuGet packages, and the code's own checks, which show what it expected. Name the file you read in the plan row. When the installed client isn't there to read, or doesn't settle a question this file or `mapping.md` sends you to it for, the site stays, and the reason is `mailjet client not checked`.

**Node.js.** `.request()` answers a result whose `body` holds the answer above. Mailjet's samples `.catch` the error and read `err.statusCode`. Its Node.js page says a `2xx` answer resolves even when some of its messages have `Status: error`. It doesn't say which answers reject, what a network error does, or what else the error carries: read the installed `node-mailjet` for each.

```js
import Mailjet from 'node-mailjet'
const mailjet = Mailjet.apiConnect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE)

const result = await mailjet.post('send', { version: 'v3.1' }).request({
  Messages: [{
    From: { Email: 'hello@mail.example.com', Name: 'Example' },
    To: [{ Email: 'jane@example.com', Name: 'Jane' }],
    Subject: 'Welcome',
    TextPart: 'Welcome',
    HTMLPart: '<p>Welcome</p>',
  }],
})
const messageId = result.body.Messages[0].To[0].MessageID
```

- `new Mailjet({ apiKey, apiSecret })`, `Mailjet.apiConnect(key, secret, { config, options })`, and `new Client({ apiKey, apiSecret })`, with `Client` imported from `node-mailjet`, make the client. `require('node-mailjet')` works too. node-mailjet 3.x and older make it with `require('node-mailjet').connect(key, secret)`, as Mailjet's older samples show.
- The `config` sets `host`, the API host, `api.mailjet.com` by default, and `version`. It goes on the client or on one `.post(...)`, whose config wins. `.post('send', { version: 'v3.1' })` sends to the v3.1 Send API. `v3` is the default: `.post('send')` with no version, on a client with no version set, or `{ version: 'v3' }`, sends to the v3 Send API, with the v3 body below. On a 3.x client made with options, such as `connect(key, secret, options)`, read the installed client for whether they set the version of a `.post` that gives none.
- `.request(body, params, false)` makes no request: Mailjet's Node.js page says it builds the request without sending it. It is a test call, not a send. A 3.x client may have its own switch, such as a `perform_api_call` option: read the installed client for whether it has one, and for where it reads it.
- The client's `options` take `timeout`, the milliseconds before the request is aborted, `30000` by default since v7, such as `new Mailjet({ apiKey, apiSecret, options: { timeout: 5000 } })`. Mailjet's Node.js page says the options pass through to axios, the client's HTTP library. Read the installed client for any retry option it takes, and for how a 3.x client takes a timeout and what it limits.

**Python.** `send.create` answers a `requests.Response`. Mailjet's Python page says an HTTP error such as `400` or `404` doesn't raise: the code reads `result.status_code` and `result.json()`. A network error raises: its sample catches `mailjet_rest.TimeoutError` for a timeout and `CriticalApiError` for a failed connection, and imports `ApiError`. The client retries a `429` and `5xx` answers itself, with backoff, before it answers. The page doesn't say how many times, what a `401`, `403`, `429`, or `5xx` does once the retries run out, which versions behave this way, or which other classes the client raises. Read the installed `mailjet_rest` in the virtualenv, such as its `client.py` and the module that defines its errors, for what the send does on each failed status and on a network error, and for the retries, and name its version and the files in the plan row.

```python
from mailjet_rest import Client

mailjet = Client(auth=(os.environ["MJ_APIKEY_PUBLIC"], os.environ["MJ_APIKEY_PRIVATE"]), version="v3.1")
result = mailjet.send.create(data={
    "Messages": [{
        "From": {"Email": "hello@mail.example.com", "Name": "Example"},
        "To": [{"Email": "jane@example.com"}],
        "Subject": "Welcome",
        "TextPart": "Welcome",
        "HTMLPart": "<p>Welcome</p>",
    }]
})
if result.status_code != 200:
    ...
```

- The client also runs as a context manager: `with Client(...) as mailjet:`.
- `v3` is the default: a client without `version="v3.1"` sends to the v3 Send API, with the v3 body below.
- `timeout=` sets a timeout on `Client(...)`, or on one call, such as `send.create(data=..., timeout=5)`.
- `Client(..., dry_run=True)` makes no POST: Mailjet's Python page says it answers a mock `200 OK` for every request that changes state, and sends nothing.

**Ruby.** `Mailjet.configure` sets `api_key`, `secret_key`, and `api_version` (`"v3.1"` for the body above). `v3` is the default, as Mailjet's Ruby page says and its v3 sample shows: a gem that doesn't set `'v3.1'` sends to the v3 Send API, with the v3 body below. `Mailjet::Send.create(messages: [...])` answers a resource whose `attributes[:messages]` holds the answer. Mailjet's pages show no error handling for the gem. Read the installed gem in the bundle, such as its `lib/mailjet` files, for:

- What the send does on an API error and on a network error: the class it raises, such as one of its own, the attribute that holds the HTTP status, and any refused send it answers in the body instead of raising.
- Whether `Mailjet::Send.create` takes options of its own next to the messages, such as a `version:`, and which Send API it then calls.
- The setting that sets the API host, and any setting that turns the request off, such as a `perform_api_call`.

```ruby
require 'mailjet'

Mailjet.configure do |config|
  config.api_key = ENV['MJ_APIKEY_PUBLIC']
  config.secret_key = ENV['MJ_APIKEY_PRIVATE']
  config.api_version = 'v3.1'
end

result = Mailjet::Send.create(messages: [{
  'From' => { 'Email' => 'hello@mail.example.com', 'Name' => 'Example' },
  'To' => [{ 'Email' => 'jane@example.com' }],
  'Subject' => 'Welcome',
  'HTMLPart' => '<p>Welcome</p>'
}])
```

**PHP.** `post` answers a `Mailjet\Response` with `success()` (whether the call succeeded), `getStatus()` (the HTTP status, such as `400`), `getReasonPhrase()`, `getData()`, and `getCount()`, as Mailjet's PHP page lists them. Its samples read `$response->success()`: a failed status comes back as the response. Since 2.0, the client sends through the PSR-18 HTTP client the code gives it, or one it finds, such as Guzzle, and timeouts, proxies, and retries are set on that client. The page doesn't say what the send does on a network error, or how 1.x sends. Read the installed `mailjet/mailjet-apiv3-php` in `vendor`, and its HTTP client and their versions in `composer.lock`, for what reaches the code on a network error, such as Guzzle's `ConnectException` or a PSR-18 `NetworkExceptionInterface`, and for 1.x's own timeout methods.

```php
use \Mailjet\Resources;

$mj = new \Mailjet\Client(getenv('MJ_APIKEY_PUBLIC'), getenv('MJ_APIKEY_PRIVATE'), true, ['version' => 'v3.1']);
$response = $mj->post(Resources::$Email, ['body' => [
    'Messages' => [[
        'From' => ['Email' => 'hello@mail.example.com', 'Name' => 'Example'],
        'To' => [['Email' => 'jane@example.com']],
        'Subject' => 'Welcome',
        'HTMLPart' => '<p>Welcome</p>',
    ]],
]]);
if (!$response->success()) { /* ... */ }
```

`v3` is the default: a client without `'version' => 'v3.1'` sends `Resources::$Email` to the v3 Send API. The third argument of `Client` is `$call`: with `false`, the client makes no request, as Mailjet's PHP page says, and sends nothing. Read the installed client for whether a `post`'s own options, such as a `'call'` key, change that for one call, and for the option that sets the API host.

**Go.** `SendMailV31(&messages)` answers the result and an `error`, which Mailjet's samples check with `if err != nil`. The pages don't say which error types it answers, or the result's field names. Read the installed module in the Go module cache, such as `$(go env GOMODCACHE)/github.com/mailjet/mailjet-apiv3-go/v4@<version>`, for the error on an API error, such as a type that holds the answer's `Messages[].Errors`, and the statuses each type stands for, for the error on a network error, and for where the result holds the message id.

```go
client := mailjet.NewMailjetClient(os.Getenv("MJ_APIKEY_PUBLIC"), os.Getenv("MJ_APIKEY_PRIVATE"))
messages := mailjet.MessagesV31{Info: []mailjet.InfoMessagesV31{{
    From:     &mailjet.RecipientV31{Email: "hello@mail.example.com", Name: "Example"},
    To:       &mailjet.RecipientsV31{{Email: "jane@example.com"}},
    Subject:  "Welcome",
    TextPart: "Welcome",
    HTMLPart: "<p>Welcome</p>",
}}}
res, err := client.SendMailV31(&messages)
```

- `InfoMessagesV31` holds the fields of one message, as Mailjet's samples show: `From` as a `*mailjet.RecipientV31`, `To` as a `*mailjet.RecipientsV31`, `Subject`, `TextPart`, `HTMLPart`, and `Attachments` and `InlinedAttachments` as `*mailjet.AttachmentsV31` and `*mailjet.InlinedAttachmentsV31`. `MessagesV31` holds `Info` (the messages), and its sandbox sample sets `SandboxMode` next to it. Read the installed module for the names of the other fields.
- `client.SendMail(&mailjet.InfoSendMail{...})` sends through the v3 Send API, as Mailjet's v3 sample shows. A send of the module through Mailjet's SMTP host, such as a method named `SendMailSMTP`, goes through SMTP.
- `client.SetClient(httpClient)` gives the client an `*http.Client` of the code's own, for a proxy or a timeout.

**.NET.** Two forms:

- `client.SendTransactionalEmailAsync(email)`, with an email built by `new TransactionalEmailBuilder()`, answers a response whose `Messages` holds one entry per message, with `Status` and `Errors` as above. Mailjet's pages show no error handling for it. Read the installed `Mailjet.Api` package for what it does with a failed status: whether it returns the response, throws an exception of its own, such as one with the HTTP status, or does each for some answers, such as by whether the answer holds `Messages`. Read it also for any argument that sets `SandboxMode` for the call, and for any method that sends several emails in one call.
- `client.PostAsync(request)`, with a `new MailjetRequest { Resource = ... }` whose body is set with `.Property(...)`, answers a `MailjetResponse` with `IsSuccessStatusCode`, `StatusCode`, `GetErrorInfo()`, `GetErrorMessage()`, and `GetData()`. Mailjet's samples read `IsSuccessStatusCode` and then `StatusCode`: a failed status comes back as the response. They send with `Resource = Send.Resource`, to the v3.1 Send API on a client set with `Version = ApiVersion.V3_1`, and to the v3 Send API without it. Since 2.0.0 the client takes the version from the resource: read the installed package for the Send API each send resource calls.

```csharp
var client = new MailjetClient(
    Environment.GetEnvironmentVariable("MJ_APIKEY_PUBLIC"),
    Environment.GetEnvironmentVariable("MJ_APIKEY_PRIVATE"));
var email = new TransactionalEmailBuilder()
    .WithFrom(new SendContact("hello@mail.example.com", "Example"))
    .WithTo(new SendContact("jane@example.com"))
    .WithSubject("Welcome")
    .WithTextPart("Welcome")
    .WithHtmlPart("<p>Welcome</p>")
    .Build();
var response = await client.SendTransactionalEmailAsync(email);
```

Mailjet's samples set `From`, `To`, `Subject`, `TextPart`, and `HTMLPart` with `WithFrom`, `WithTo`, `WithSubject`, `WithTextPart`, and `WithHtmlPart`. The builder has a `With...` method for other fields too: read the installed package for their names. Apps that use dependency injection register `IMailjetClient` with `AddHttpClient<IMailjetClient, MailjetClient>`. The client can also take an `HttpClientHandler` as its third argument, such as for a proxy.

**US setup.** Mailjet's pages name one API host, `api.mailjet.com`. An account on Mailjet's US setup sends to `api.us.mailjet.com` instead. An app on it either names that host in a URL, or sets a host on its Mailjet client: `host` in the `config` of the Node.js client or of one `.post(...)`, as Mailjet's Node.js page shows. For the other clients, find the setting in the code and the installed client, such as an option named `api_url`, `end_point`, `url`, or `baseUrl`, a third argument of Go's `NewMailjetClient`, or the base address of .NET's client or of the `HttpClient` it takes, and read its value. When the setting reads an env variable or a config file, read its value there. Either one means every API request in `account.md` goes to that host.

**HTTP.** `POST https://api.mailjet.com/v3.1/send`, or `api.us.mailjet.com` for an account on Mailjet's US setup, with HTTP Basic auth: the API key as the user and the secret key as the password. A message Mailjet refuses comes back in `Messages` with `Status: "error"` and its `Errors`, as "Clients and sends" says. Look for `api.mailjet.com` and `api.us.mailjet.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

```json
{
  "Messages": [{
    "From": { "Email": "hello@mail.example.com", "Name": "Example" },
    "To": [{ "Email": "jane@example.com", "Name": "Jane" }],
    "Subject": "Welcome",
    "TextPart": "Welcome",
    "HTMLPart": "<p>Welcome</p>"
  }]
}
```

**The v3 Send API.** `POST https://api.mailjet.com/v3/send` takes an older body: `FromEmail`, `FromName`, `Recipients` (a list of `{ Email, Name, Vars }`) or `To`, `Cc`, and `Bcc` as one string of addresses, `Subject`, `Text-part`, `Html-part`, `Mj-TemplateID`, `Mj-TemplateLanguage`, `Vars`, `Attachments` and `Inline_attachments` (`{ "Content-type", Filename, Content }`), `Mj-CustomID`, `Mj-EventPayload`, `Mj-campaign`, `Mj-deduplicatecampaign`, `Mj-prio`, `Mj-trackopen`, `Mj-trackclick`, `Headers`, and `Messages` for several messages. A success answers `Sent`, a list of `{ Email, MessageID, MessageUUID }`.

**SMTP.** Mailjet takes mail over SMTP at `in-v3.mailjet.com` (older setups name `in.mailjet.com`), on port 25, 80, 465, 587, 588, or 2525, with the API key as the user and the secret key as the password. Look for those hosts in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. Headers such as `X-MJ-TemplateID`, `X-MJ-Vars`, `X-MJ-CustomID`, `X-MJ-EventPayload`, `X-Mailjet-Campaign`, and `X-MJ-MonitoringCategory` carry Mailjet options over SMTP.

**Frameworks.** Mailers that send every framework mail through Mailjet: `django-anymail` with its Mailjet backend in Django, the `mailjet` gem's `delivery_method = :mailjet` (SMTP) or `:mailjet_api` in Rails, `mailjet/laravel-mailjet` in Laravel, set as the mailer in the mail config or `.env`, such as `MAIL_MAILER=mailjet`, or `MAIL_DRIVER` in Laravel 6 and older, `symfony/mailjet-mailer` in Symfony, and the Mailjet adapter of Swoosh in Elixir. Each mailable or mailer that sends is a site.

## Send fields

The fields of one message in the v3.1 body, as the SDKs that take the JSON body send them. Go's `InfoMessagesV31` and the .NET builder set them under their own names, as "Clients and sends" says.

| Field | Value |
|---|---|
| `From` | `{ Email, Name }` |
| `Sender` | `{ Email, Name }`: the address that sends on behalf of `From` |
| `To` | A list of `{ Email, Name }` |
| `Cc`, `Bcc` | Same as `To` |
| `ReplyTo` | `{ Email, Name }` |
| `Subject` | String |
| `TextPart`, `HTMLPart` | Strings |
| `TemplateID` | The number of a template stored at Mailjet |
| `TemplateLanguage` | `true` turns on Mailjet's template language in the template or in `TextPart` and `HTMLPart` |
| `Variables` | Object of values for the template language |
| `TemplateErrorReporting` | `{ Email, Name }` that gets a copy when the template language fails |
| `TemplateErrorDeliver` | `true` sends the email even when the template language fails |
| `Attachments` | A list of `{ ContentType, Filename, Base64Content }` |
| `InlinedAttachments` | The same, with `ContentID`. HTML shows the file with `cid:<ContentID>`, or `cid:<Filename>` without a `ContentID` |
| `Headers` | Object of custom headers |
| `CustomID` | String, sent back in webhook events and readable with the message API |
| `EventPayload` | String, sent back in webhook events |
| `CustomCampaign` | A campaign name that groups the sends in Mailjet's statistics |
| `DeduplicateCampaign` | `true` sends a campaign only once to each contact |
| `MonitoringCategory` | A category of Mailjet's real-time monitoring. Mailjet's v3.1 reference doesn't list it, but code may still set it |
| `Priority` | `0` to `3`, the order in the account's sending queue. `2` is the default |
| `TrackOpens`, `TrackClicks` | `account_default`, `disabled`, `enabled`, or `anon` |
| `URLTags` | A query string that Mailjet adds to every link |

Three fields sit next to `Messages`, outside each message:

| Field | Value |
|---|---|
| `Globals` | Any message field except `To`, applied to every message |
| `SandboxMode` | `true` checks the body and sends nothing |
| `AdvanceErrorHandling` | `true` turns on more checks and detailed errors |

The Send API v3.1 takes up to 50 messages in one call, and the v3 Send API up to 100. One call can carry 15 MB in all.

## Templates stored at Mailjet

A send with `TemplateID` (v3: `Mj-TemplateID`) renders a template from the Mailjet dashboard. Its content is not in the code. `TemplateLanguage: true` makes Mailjet fill it with `Variables` (v3: `Vars`).

Mailjet's template language:

- `{{var:name}}` prints a value of `Variables`, and `{{var:name:"default"}}` or `{{var:name:default}}` prints a default when the value is not set. `{{var:user.first_name}}` reads a nested value. The v3 Send API also takes `[[var:name]]`.
- `{% if var:paid %}…{% elseif … %}…{% else %}…{% endif %}`, and `{% for item in var:items %}{{ item.name }}{% endfor %}`.
- Comparisons `>`, `<`, `>=`, `<=`, `=`, `==`, `===`, `!=`, `<>`, logic `and`, `or`, `xor`, `not`, and arithmetic `+`, `-`, `*`, `/`, `div`, `mod`.
- `{{data:name}}` prints a contact property stored at Mailjet, `{{mj:contact.email}}` and the other `mj:` values print Mailjet data, and `{{segment:name}}` reads a segment.
- Functions such as `Upper`, `Lower`, `Capitalize`, `Round`, `Int`, `FormatNumber`, `FormatNumberLocale`, `UrlEncode`, `Escape`, `HasOpenedSince`, and `HasClickedSince`, and `{% set name = value %}`.

A template holds an HTML part, a text part, and headers: `From`, `Subject`, and `Reply-to`. A template built in Mailjet's drag-and-drop or MJML editor has its HTML part rendered from that.

The template language also works in `TextPart` and `HTMLPart` of a send without a stored template, when the send sets `TemplateLanguage: true` and `Variables`.

## Status reads

`GET https://api.mailjet.com/v3/REST/message/{message_id}`, `/v3/REST/messagehistory/{message_id}`, and `/v3/REST/messageinformation` read a message's state and its events. A `GET /v3/REST/message?CustomID=...` finds a message by its `CustomID`. Code that reads them reads Mailjet's state.

## Webhooks

Mailjet's Event API posts JSON to a URL of the app, set in the account preferences (Event tracking) or with `/v3/REST/eventcallbackurl`. Each event has `event`, `time`, `email`, `MessageID`, `Message_GUID`, `mj_campaign_id`, `mj_contact_id`, `customcampaign`, and the send's `CustomID` and `Payload` (its `EventPayload`). `event` is one of `sent`, `open`, `click`, `bounce`, `spam`, `blocked`, and `unsub`. A `bounce` adds `hard_bounce`, `blocked`, `error_related_to`, `error`, and `comment`, a `blocked` adds `error_related_to` and `error`, and a `spam` adds `source`.

- A callback URL set to group events (`Version` 2) gets a JSON list of events in one post. Otherwise each post holds one event object. A handler can read both.
- `sent` means the receiving mail server took the email.
- Mailjet signs nothing. A handler is protected by basic auth in the callback URL, such as `https://user:password@example.com/mailjet/events`, and checks the `Authorization` header.
- Ruby apps can mount `Mailjet::Rack::Endpoint` on a path, with a block that gets each event's params.

Look for routes that read `MessageID`, `Message_GUID`, `mj_message_id`, `mj_contact_id`, `CustomID`, or `Payload` from a posted body with an `event` of the values above, `Mailjet::Rack::Endpoint`, and `eventcallbackurl` calls.

## Other APIs

Contacts, contact lists, segments, campaign drafts and newsletters, templates, senders and DNS, API keys and subaccounts, statistics, the Parse API, the Event API setup, and SMS (`/v3/REST/contact`, `/v3/REST/contactslist`, `/v3/REST/contactfilter`, `/v3/REST/campaigndraft`, `/v3/REST/newsletter`, `/v3/REST/template`, `/v3/REST/sender`, `/v3/REST/dns`, `/v3/REST/apikey`, `/v3/REST/statcounters`, `/v3/REST/parseroute`, `/v3/REST/eventcallbackurl`, and the `v4` SMS API) are not transactional sends.
