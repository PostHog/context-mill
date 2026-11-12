# Mailjet SDK reference

This file says what Mailjet looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

Mailjet authenticates with two keys: the API key and the secret key. They live in `MJ_APIKEY_PUBLIC` and `MJ_APIKEY_PRIVATE` by convention. `laravel-mailjet` reads `MAILJET_APIKEY` and `MAILJET_APISECRET`, and apps also use their own names, such as `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`: take the names the client reads. Both keys count as the provider key wherever a step names it: search for both names.

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

These are not Mailjet's send SDK, and alone they are not a migration: `mjml` renders email markup and sends nothing, `nodemailer` and other SMTP libraries send through any SMTP server, and Mailjet's Parse API (`/v3/REST/parseroute`) receives inbound mail.

## Clients and sends

Every SDK sends the same JSON body to the Send API: `Messages`, a list of messages with PascalCase fields such as `From`, `To`, `Subject`, `TextPart`, and `HTMLPart`. The SDKs pass that body as it is, except the Go structs and the .NET builder, which name the same fields.

A success answers `Messages`, one entry per message in the same order. Each entry has `Status` (`success` or `error`), `CustomID`, and `To`, `Cc`, and `Bcc`, each a list of `{ Email, MessageUUID, MessageID, MessageHref }`. `MessageID` (a number) and `MessageUUID` are the message ids, one per recipient. An entry whose `Status` is `error` has `Errors`, a list of `{ ErrorIdentifier, ErrorCode, StatusCode, ErrorMessage, ErrorRelatedTo }`.

**Node.js.** `.request()` answers `{ body, response }`, with the answer above in `body`. It throws on an answer of 400 or more, and on a network error. The error is an `Error` with `statusCode` (the HTTP status, `null` for a network error), `statusText`, `ErrorMessage`, `ErrorCode`, `ErrorIdentifier`, `ErrorRelatedTo`, `originalMessage`, and `response`.

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

- `new Mailjet({ apiKey, apiSecret })` and `new Mailjet.Client({ apiKey, apiSecret })` make the same client. `require('node-mailjet')` works too.
- `.post('send', { version: 'v3.1', host: 'api.us.mailjet.com' })`, or `config: { host }` on the client, sends to the US host.
- `.post('send')` with no version, or `{ version: 'v3' }`, sends to the v3 Send API, with the v3 body below.
- `.request(body, params, false)` makes no request: it is a test call, not a send.

**Python.** `send.create` answers a `requests.Response`. How it reports an API error depends on the installed `mailjet-rest` version, which the lockfile, or the pin in the manifest, names:

- Before 1.8.0, it does not raise on an API error: the code reads `result.status_code` and `result.json()`. It raises only on a network error or a timeout, such as `mailjet_rest.TimeoutError`, `CriticalApiError`, or `ApiError`.
- From 1.8.0, it also raises on an answer of 400 or more: `ValidationError` for 400, `MailjetAuthError` for 401 and 403, `DoesNotExistError` for 404, and `ApiRateLimitError` for 429, each a `MailjetApiError` with `status_code` and `response_body`. Any other status, such as a 500, raises a plain `ApiError` with no status. A timeout raises `TimeoutError` and a failed connection `CriticalApiError`, both `MailjetNetworkError`s. Every one of them is an `ApiError`. A `result.status_code` check after the call then sees only successes.

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
- `api_url="https://api.us.mailjet.com/"` sends to the US host. A client without `version="v3.1"` sends to the v3 Send API.
- `Client(..., dry_run=True)`, from 1.7.0, makes no request: it answers a `200` and sends nothing.

**Ruby.** `Mailjet.configure` sets `api_key`, `secret_key`, `api_version` (`"v3.1"` for the body above), and `end_point`. `Mailjet::Send.create(messages: [...])` answers a resource whose `attributes[:messages]` holds the answer. It raises `Mailjet::CommunicationError` on an API error, with `code` (the HTTP status), and its subclasses `Mailjet::Unauthorized` (401) and `Mailjet::BadRequest` (400). One case does not raise: when the v3.1 Send API refuses a recipient as an invalid email address, the send answers the error body instead. With `perform_api_call` set to `false`, such as `config.perform_api_call = false` in `Mailjet.configure`, the gem makes no request and sends nothing.

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

**PHP.** `post` answers a `Mailjet\Response` with `success()` (true for a 2xx status), `getStatus()`, `getReasonPhrase()`, `getBody()`, and `getData()`. It does not throw on an API error, only on a network error.

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

The options `['url' => 'api.us.mailjet.com']` send to the US host. A client without `'version' => 'v3.1'` sends `Resources::$Email` to the v3 Send API. The third argument of `Client` is `$call`: with `false`, or `'call' => false` in the options, the client makes no request and sends nothing.

**Go.** `SendMailV31` answers `(*mailjet.ResultsV31, error)`. The error is a `*mailjet.APIFeedbackErrorsV31` on a 400 or 403 answer (`Messages[].Errors[]` with `ErrorCode`, `ErrorMessage`, and `StatusCode`), a `*mailjet.ErrorInfoV31` on any other error answer (`StatusCode`, `Message`), or a network error. `res.ResultsV31[0].To[0].MessageID` is the message id.

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

- `InfoMessagesV31` holds the fields of one message, with `*RecipientV31` for `From`, `ReplyTo`, and `Sender`, `*RecipientsV31` for `To`, `Cc`, and `Bcc`, and `*AttachmentsV31` and `*InlinedAttachmentsV31` for files. `MessagesV31` holds `Info` (the messages), `SandBoxMode`, and `AdvanceErrorHandling`.
- `NewMailjetClient(key, secret, "https://api.us.mailjet.com")` sends to the US host.
- `client.SendMail(&mailjet.InfoSendMail{...})` sends through the v3 Send API, and `client.SendMailSMTP(&mailjet.InfoSMTP{...})` through SMTP.

**.NET.** Two forms:

- `client.SendTransactionalEmailAsync(email)`, with an email built by `new TransactionalEmailBuilder()`, answers a `TransactionalEmailResponse` whose `Messages[0].Status` is `"success"` or `"error"`, with `Errors`. It throws `Mailjet.Client.Exceptions.MailjetServerException`, with `HttpCode`, only when the answer has no `Messages`. `SendTransactionalEmailsAsync(emails)` sends several in one call.
- `client.PostAsync(request)`, with a `new MailjetRequest { Resource = SendV31.Resource }` whose body is set with `.Property(...)`, answers a `MailjetResponse` with `IsSuccessStatusCode`, `StatusCode`, `GetErrorMessage()`, and `GetData()`. It does not throw on an API error.

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

The builder also takes `WithReplyTo`, `WithCc`, `WithBcc`, `WithAttachment`, `WithInlinedAttachment`, `WithTemplateId`, `WithTemplateLanguage`, `WithVariable`, `WithVariables`, `WithTemplateErrorReporting`, `WithTemplateErrorDeliver`, `WithCustomId`, `WithEventPayload`, `WithCustomCampaign`, `WithDeduplicateCampaign`, `WithPriority`, `WithTrackOpens`, `WithTrackClicks`, `WithUrlTags`, `WithHeader`, and `WithSender`. Apps that use dependency injection register `IMailjetClient` with `AddHttpClient<IMailjetClient, MailjetClient>`.

**US setup.** An app on Mailjet's US setup either names `api.us.mailjet.com` in a URL, or sets the host on its Mailjet client: `host` in `config` on the Node.js client or in the options of one `.post(...)`, `api_url` on Python's `Client`, `end_point` in Ruby's `Mailjet.configure`, the `'url'` option of PHP's `Client`, the third argument of Go's `NewMailjetClient`, or `SetBaseURL` and `SetURL` on its client, `BaseAdress` on .NET's `MailjetClient` (or the `BaseAddress` of the `HttpClient` it takes), and `baseUrl` in Java's `ClientOptions`. When the setting reads an env variable or a config file, read its value there. Either one means every API request in `account.md` goes to `api.us.mailjet.com`.

**HTTP.** `POST https://api.mailjet.com/v3.1/send`, or `api.us.mailjet.com` for an account on Mailjet's US setup, with HTTP Basic auth: the API key as the user and the secret key as the password. An error answer of 400 carries the same `Messages` list with `Status: "error"`. Look for `api.mailjet.com` and `api.us.mailjet.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

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

**Frameworks.** Mailers that send every framework mail through Mailjet: `django-anymail` with its Mailjet backend in Django, the `mailjet` gem's `delivery_method = :mailjet` (SMTP) or `:mailjet_api` in Rails, `mailjet/laravel-mailjet` (`MAIL_MAILER=mailjet`, or `MAIL_DRIVER` in Laravel 6 and older) in Laravel, `symfony/mailjet-mailer` in Symfony, and the Mailjet adapter of Swoosh in Elixir. Each mailable or mailer that sends is a site.

## Send fields

The fields of one message in the v3.1 body, as every SDK sends them. Go names them the same in `InfoMessagesV31`, and the .NET builder has a `With...` method for each.

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
| `MonitoringCategory` | A category of Mailjet's real-time monitoring. The Go struct has it |
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
