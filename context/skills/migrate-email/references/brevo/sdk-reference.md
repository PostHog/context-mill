# Brevo SDK reference

This file says what Brevo looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

Brevo was called Sendinblue. Code that names Sendinblue, `sib`, or `api.sendinblue.com` is Brevo too.

## Key

The API key lives in `BREVO_API_KEY` by convention, and in `SENDINBLUE_API_KEY` in older apps. A Brevo API key starts with `xkeysib-`. Apps also use their own names: take the name the client reads. The SMTP relay uses a separate SMTP key, not the API key.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `@getbrevo/brevo` 4.x and later | `new BrevoClient({ apiKey }).transactionalEmails.sendTransacEmail({...})` |
| Node.js | `@getbrevo/brevo` 1.x to 3.x | `new TransactionalEmailsApi().sendTransacEmail(sendSmtpEmail)` |
| Node.js | `sib-api-v3-sdk`, `@sendinblue/client`, `sib-api-v3-typescript` | `new TransactionalEmailsApi().sendTransacEmail(sendSmtpEmail)` |
| Python | `brevo-python` 4.x and later (module `brevo`) | `Brevo(api_key=...).transactional_emails.send_transac_email(...)` |
| Python | `brevo-python` 1.x (module `brevo_python`), `sib-api-v3-sdk` (module `sib_api_v3_sdk`) | `TransactionalEmailsApi(ApiClient(configuration)).send_transac_email(SendSmtpEmail(...))` |
| PHP | `getbrevo/brevo-php` 4.x and later (namespace `Brevo\`) | `(new Brevo($key))->transactionalEmails->sendTransacEmail(new SendTransacEmailRequest([...]))` |
| PHP | `getbrevo/brevo-php` 1.x and 2.x (namespace `Brevo\Client\`), `sendinblue/api-v3-sdk` (namespace `SendinBlue\Client\`) | `(new TransactionalEmailsApi($http, $config))->sendTransacEmail($sendSmtpEmail)` |
| Ruby | `brevo` gem, and the older `sib-api-v3-sdk` gem (module `SibApiV3Sdk`) | `Brevo::TransactionalEmailsApi.new.send_transac_email(send_smtp_email)` |
| Go | `github.com/getbrevo/brevo-go`, imported from `github.com/getbrevo/brevo-go/lib` | `client.TransactionalEmailsApi.SendTransacEmail(ctx, sendSmtpEmail)` |
| .NET | `brevo_csharp` (NuGet), older `sib_api_v3_sdk` | `new TransactionalEmailsApi().SendTransacEmail(sendSmtpEmail)` |
| Java | `com.brevo:brevo` | `TransactionalEmailsApi.sendTransacEmail(sendSmtpEmail)` |

These are not a Brevo send, and alone they are not a migration: `nodemailer` sends through any SMTP server, and the same Brevo SDKs also send SMS and WhatsApp messages (`sendTransacSms`, `sendWhatsappMessage`), which are not email.

## Clients and sends

Every SDK sends the same body as the HTTP API below. A success answers `messageId`, or `messageIds` for a send with `messageVersions`.

**Node.js, `@getbrevo/brevo` 4.x and later.** `sendTransacEmail` answers `{ messageId }`. It throws a `BrevoError` on an API error, with `statusCode`, `message`, and `body` (`{ code, message }`). Its subclasses are under the `Brevo` export, such as `Brevo.BadRequestError`, `Brevo.UnauthorizedError`, and `Brevo.TooManyRequestsError`. The client retries `408`, `429`, and `5xx` answers twice by default.

```js
import { BrevoClient } from '@getbrevo/brevo'
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY })

const { messageId } = await brevo.transactionalEmails.sendTransacEmail({
  sender: { email: 'hello@mail.example.com', name: 'Example' },
  to: [{ email: 'jane@example.com', name: 'Jane' }],
  subject: 'Welcome',
  htmlContent: '<p>Welcome</p>',
  textContent: 'Welcome',
})
```

**Node.js, `@getbrevo/brevo` 1.x to 3.x, `sib-api-v3-typescript`, and `@sendinblue/client`.** The key is set with `api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, key)` or `api.authentications.apiKey.apiKey = key`. A `new SendSmtpEmail()` takes the fields as properties. `sendTransacEmail` answers `{ response, body }`, and `body.messageId` is the message id. It rejects on an API error: in `@getbrevo/brevo` and `sib-api-v3-typescript` with an `HttpError` that has `statusCode`, `response`, and `body`, and in `@sendinblue/client` with a plain `{ response, body }` whose `response.statusCode` is the status.

**Node.js, `sib-api-v3-sdk`.** `SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = key` sets the key. `new SibApiV3Sdk.TransactionalEmailsApi().sendTransacEmail(sendSmtpEmail)` answers `{ messageId }`. It rejects on an API error with an error whose `status` is the HTTP status and whose `response.body` is the answer.

**Python, `brevo-python` 4.x and later.** `send_transac_email` takes the fields as keyword arguments in snake case, and answers a result whose `message_id` is the message id. It raises `brevo.core.api_error.ApiError` on an API error, with `status_code` and `body`, and subclasses such as `brevo.BadRequestError`. `AsyncBrevo` is the async client.

```python
from brevo import Brevo
from brevo.transactional_emails import SendTransacEmailRequestSender, SendTransacEmailRequestToItem

client = Brevo(api_key=os.environ["BREVO_API_KEY"])
result = client.transactional_emails.send_transac_email(
    sender=SendTransacEmailRequestSender(email="hello@mail.example.com", name="Example"),
    to=[SendTransacEmailRequestToItem(email="jane@example.com")],
    subject="Welcome",
    html_content="<p>Welcome</p>",
    text_content="Welcome",
)
```

The other arguments are `cc`, `bcc`, `reply_to`, `attachment` (a list of `SendTransacEmailRequestAttachmentItem(content=, name=, url=)`), `template_id`, `params`, `tags`, `headers`, `scheduled_at`, `batch_id`, and `message_versions`.

**Python, `brevo-python` 1.x and `sib-api-v3-sdk`.** `configuration.api_key['api-key'] = key` sets the key. `send_transac_email(SendSmtpEmail(sender=, to=, subject=, html_content=, text_content=, ...))` answers a `CreateSmtpEmail` whose `message_id` is the message id. It raises `ApiException` from the module's `rest`, with `status`, `reason`, and `body`.

**PHP, `getbrevo/brevo-php` 4.x and later.** `sendTransacEmail` answers a `SendTransacEmailResponse` whose `messageId` property is the message id. It throws `Brevo\Exceptions\BrevoApiException` on an API error, with `getCode()` (the HTTP status), `getMessage()`, and `getBody()`.

```php
use Brevo\Brevo;
use Brevo\TransactionalEmails\Requests\SendTransacEmailRequest;
use Brevo\TransactionalEmails\Types\SendTransacEmailRequestSender;
use Brevo\TransactionalEmails\Types\SendTransacEmailRequestToItem;

$brevo = new Brevo(getenv('BREVO_API_KEY'));
$result = $brevo->transactionalEmails->sendTransacEmail(new SendTransacEmailRequest([
    'sender' => new SendTransacEmailRequestSender(['email' => 'hello@mail.example.com', 'name' => 'Example']),
    'to' => [new SendTransacEmailRequestToItem(['email' => 'jane@example.com'])],
    'subject' => 'Welcome',
    'htmlContent' => '<p>Welcome</p>',
]));
```

**PHP, 1.x, 2.x, and `sendinblue/api-v3-sdk`.** `Configuration::getDefaultConfiguration()->setApiKey('api-key', $key)` sets the key, and a `SendSmtpEmail` takes setters such as `setSender`, `setTo`, `setSubject`, and `setHtmlContent`. `sendTransacEmail` answers a `CreateSmtpEmail` whose `getMessageId()` is the message id. It throws the namespace's `ApiException` on an API error, with `getCode()` and `getResponseBody()`.

**Ruby.** `Brevo.configure { |config| config.api_key['api-key'] = key }` sets the key. `send_transac_email(Brevo::SendSmtpEmail.new(sender:, to:, subject:, html_content:, ...))` answers a `CreateSmtpEmail` whose `message_id` is the message id. It raises `Brevo::ApiError` on an API error, with `code` (the HTTP status) and `response_body`.

**Go.** `SendTransacEmail` answers `(CreateSmtpEmail, *http.Response, error)`, and `result.MessageId` is the message id. `err` is set for a network error and for an API error: an answer of 300 or more comes back as a `brevo.GenericSwaggerError`, with `Error()` and `Body()`. Code may also read `resp.StatusCode`.

```go
import brevo "github.com/getbrevo/brevo-go/lib"

cfg := brevo.NewConfiguration()
cfg.AddDefaultHeader("api-key", os.Getenv("BREVO_API_KEY"))
client := brevo.NewAPIClient(cfg)

result, resp, err := client.TransactionalEmailsApi.SendTransacEmail(ctx, brevo.SendSmtpEmail{
    Sender:      &brevo.SendSmtpEmailSender{Name: "Example", Email: "hello@mail.example.com"},
    To:          []brevo.SendSmtpEmailTo{{Email: "jane@example.com"}},
    Subject:     "Welcome",
    HtmlContent: "<p>Welcome</p>",
    TextContent: "Welcome",
})
```

The struct also takes `Cc`, `Bcc`, `ReplyTo`, `Attachment` (`[]SendSmtpEmailAttachment{Url, Content, Name}`, with `Content` a base64 string), `TemplateId`, `Params`, `Tags`, `Headers`, `ScheduledAt`, `BatchId`, and `MessageVersions`.

**.NET.** `Configuration.Default.ApiKey.Add("api-key", key)`, or `AddApiKey`, sets the key. `new TransactionalEmailsApi().SendTransacEmail(sendSmtpEmail)` and `SendTransacEmailAsync` answer a `CreateSmtpEmail` whose `MessageId` is the message id. They throw `brevo_csharp.Client.ApiException` on an answer of 400 or more, with `ErrorCode` (the HTTP status) and `ErrorContent`. A `SendSmtpEmailAttachment` takes `Content` as `byte[]`.

**HTTP.** `POST https://api.brevo.com/v3/smtp/email`, or the older host `api.sendinblue.com`, with the header `api-key: <key>`. The API has one host. A send answers `201` with `{ "messageId": "<...>" }`, and a scheduled send answers `202`. An error answers `{ "code", "message" }`, such as `{ "code": "invalid_parameter", ... }`. Look for `api.brevo.com` and `api.sendinblue.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

```json
{
  "sender": { "email": "hello@mail.example.com", "name": "Example" },
  "to": [{ "email": "jane@example.com", "name": "Jane" }],
  "subject": "Welcome",
  "htmlContent": "<p>Welcome</p>",
  "textContent": "Welcome"
}
```

**SMTP.** Brevo takes mail over SMTP at `smtp-relay.brevo.com`, on port 587 or 2525, or 465 with TLS, with an SMTP login and an SMTP key from the Brevo dashboard. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config.

**Frameworks.** Mailers that send every framework mail through Brevo: `django-anymail` with `anymail.backends.brevo.EmailBackend` (or the older `anymail.backends.sendinblue.EmailBackend`) in Django, `symfony/brevo-mailer` (`MAILER_DSN=brevo+api://...` or `brevo+smtp://...`) in Symfony, and `Swoosh.Adapters.Brevo` (or `Swoosh.Adapters.Sendinblue`) in Elixir. Each mailable or mailer that sends is a site.

## Send fields

Node.js and HTTP names. Python and Ruby use the same names in snake case, Go and .NET in Pascal case.

| Field | Value |
|---|---|
| `sender` | `{ email, name }`, or `{ id }`: a sender saved in Brevo. Not needed with `templateId` |
| `to` | A list of `{ email, name }`. An entry can also set `contactPixelTrackingConsent` and `removeTrackingPixel`, the recipient's open and click tracking |
| `cc`, `bcc` | Lists of `{ email, name }`, with the same tracking settings |
| `replyTo` | `{ email, name }` |
| `subject` | String. Not needed with `templateId` |
| `htmlContent`, `textContent` | Strings. Ignored with `templateId` |
| `templateId` | A number: a template stored in Brevo |
| `params` | Object that fills `{{ params.NAME }}` in a template, or in the send's own `htmlContent` and `textContent` |
| `attachment` | A list of `{ content, name }`, with `content` base64, or `{ url, name }`, a file Brevo fetches |
| `tags` | A list of strings, sent back in webhook events |
| `headers` | Object of custom headers. `idempotencyKey` in it is Brevo's idempotency key, and `X-Mailin-custom` is sent back in webhook events |
| `scheduledAt` | A date and time, up to 72 hours ahead |
| `batchId` | A UUID for a scheduled batch, which can be read or cancelled |
| `messageVersions` | A list of versions, each with its own `to`, `cc`, `bcc`, `replyTo`, `subject`, `params`, and content: several emails in one call |

## Templates stored at Brevo

A send with `templateId` renders a template from the Brevo dashboard. Its content is not in the code. The template holds its `subject`, `htmlContent`, `sender`, `replyTo`, `toField`, and `tag`, so the send may set no `sender` or `subject`. It can also hold an attachment, added in the dashboard under its advanced options.

- The template language reads the send's values as `{{ params.name }}`, `{{ params.user.first_name }}`, and `{{ params.items.0.name }}`.
- It reads contact attributes as `{{ contact.FIRSTNAME }}`, data feeds as `{{ feed.alias.field }}`, the send time as `{{ time_now }}`, and links as `{{ mirror }}`, `{{ unsubscribe }}`, and `{{ update_profile }}`.
- Tags are `{% if %}`, `{% elif %}`, `{% else %}`, `{% endif %}`, and `{% for item in params.items %}…{% endfor %}`, with `forloop.Counter`, `forloop.First`, and `forloop.Last` inside a loop.
- Filters follow a pipe, such as `{{ params.name|default:"there" }}`, `|upper`, `|lower`, `|floatformat:2`, and `|date:"..."`.
- A template in Brevo's old template language reads no `params`.

## Status reads

`GET /v3/smtp/emails` (filtered by `messageId`, `email`, or `templateId`), `GET /v3/smtp/emails/{uuid}`, `GET /v3/smtp/statistics/events`, and `GET /v3/smtp/emailStatus/{identifier}` read a message's state at Brevo. `DELETE /v3/smtp/email/{identifier}` cancels a scheduled send. Code that calls them reads Brevo's state, and the SDKs name them `getTransacEmailsList`, `getTransacEmailContent`, `getEmailEventReport`, `getScheduledEmailById`, and `deleteScheduledEmailById`.

## Webhooks

A transactional webhook posts one event as JSON to an endpoint of the app, or a list of events when it is set up as batched. Each event has `event`, `email`, `message-id`, `ts_event`, `subject`, `tags`, `template_id`, and `X-Mailin-custom` when the send set that header. `event` is one of `request`, `delivered`, `deferred`, `soft_bounce`, `hard_bounce`, `spam`, `blocked`, `invalid_email`, `opened`, `unique_opened`, `proxy_open`, `unique_proxy_open`, `click`, and `unsubscribed`. When the webhook is created, these are named `sent` or `request`, `delivered`, `deferred`, `softBounce`, `hardBounce`, `spam`, `blocked`, `invalid`, `opened`, `uniqueOpened`, `click`, and `unsubscribed`.

Brevo signs no event. A handler checks a username and password in the URL, a bearer token in `Authorization`, a header the webhook was set up with, or Brevo's IP ranges. Look for routes that read `message-id`, `ts_event`, or `X-Mailin-custom`, or that branch on event names such as `hard_bounce` and `unique_opened`.

## Other APIs

Contacts, lists, email campaigns, senders and domains, webhooks, templates, blocked contacts and domains, statistics, SMS, WhatsApp, events, and CRM (`/v3/contacts`, `/v3/emailCampaigns`, `/v3/senders`, `/v3/webhooks`, `/v3/smtp/templates`, `/v3/smtp/blockedContacts`, `/v3/smtp/blockedDomains`, `/v3/smtp/statistics`, `/v3/transactionalSMS`, `/v3/whatsapp`, `/v3/events`, `/v3/crm`) are not transactional email sends.
