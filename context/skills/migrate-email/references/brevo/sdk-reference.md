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
| Node.js | `sib-api-v3-sdk`, `@sendinblue/client`, `sib-api-v3-typescript` | `sendTransacEmail` |
| Python | `brevo-python` 4.x and later (module `brevo`) | `Brevo(api_key=...).transactional_emails.send_transac_email(...)` |
| Python | `brevo-python` 1.x (module `brevo_python`), `sib-api-v3-sdk` (module `sib_api_v3_sdk`) | `send_transac_email` |
| PHP | `getbrevo/brevo-php` 4.x and later (namespace `Brevo\`) | `(new Brevo($key))->transactionalEmails->sendTransacEmail(new SendTransacEmailRequest([...]))` |
| PHP | the legacy `getbrevo/brevo-php` (namespace `Brevo\Client\`), `sendinblue/api-v3-sdk` (namespace `SendinBlue\Client\`) | `(new TransactionalEmailsApi($http, $config))->sendTransacEmail($sendSmtpEmail)` |
| Ruby | `brevo` gem, and the older `sib-api-v3-sdk` gem (module `SibApiV3Sdk`) | `send_transac_email` |
| Go | `github.com/getbrevo/brevo-go`, and the older `github.com/sendinblue/APIv3-go-library` | `SendTransacEmail` |
| .NET | `brevo_csharp`, and the older `sib_api_v3_sdk` | `SendTransacEmail` |
| Java | `com.brevo:brevo` | `sendTransacEmail` |

Brevo's SDK guides describe the Node.js, Python, and PHP SDKs: the current ones, and as they were before, `@getbrevo/brevo` 3.x, `brevo-python` 1.x, and the legacy PHP SDK. For Ruby, Go, .NET, and Java, Brevo's docs link only each SDK's source repository. They don't describe the `sib-api-v3-sdk`, `sib-api-v3-typescript`, `@sendinblue/client`, or `sendinblue/api-v3-sdk` packages. Where this file says to, read the installed package in the app's dependencies, such as `node_modules`, the virtualenv, `vendor`, the bundle, the Go module cache, or the NuGet packages, and name the file you read in the plan row. The send is the API's `sendTransacEmail` in each SDK's casing.

These are not a Brevo send, and alone they are not a migration: `nodemailer` sends through any SMTP server, and the same Brevo SDKs also send SMS and WhatsApp messages (`sendTransacSms`, `sendWhatsappMessage`), which are not email.

## Clients and sends

Every SDK sends the same body as the HTTP API below. A success answers `messageId`, or `messageIds` for a send with `messageVersions`.

**Node.js, `@getbrevo/brevo` 4.x and later.** `sendTransacEmail` answers `{ messageId }`. It throws a `BrevoError` on an API error, with `statusCode`, `message`, `body` (`{ code, message }`), and `rawResponse`, which holds the headers. Its subclasses are under the `Brevo` export, such as `Brevo.BadRequestError`, `Brevo.UnauthorizedError`, and `Brevo.TooManyRequestsError`. `BrevoTimeoutError` is the other top-level error. The guide doesn't say what the SDK throws on another network failure, or whether `BrevoTimeoutError` is a `BrevoError`: read the installed package. The guide lists `408`, `429`, `500`, `502`, `503`, and `504` as the answers the client retries, twice by default: read the installed package for whether it retries other `5xx` answers too. It waits up to 60 seconds for a request.

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

**Node.js, `@getbrevo/brevo` 1.x to 3.x.** `api.authentications.apiKey.apiKey = key` sets the key, a `new SendSmtpEmail()` takes the fields as properties, and `new TransactionalEmailsApi().sendTransacEmail(message)` sends it. The guide shows no answer or error for these versions, and had no retries built in. For them, and for `sib-api-v3-typescript`, `@sendinblue/client`, and `sib-api-v3-sdk`, read the installed package for what the send answers, where the message id is, and what it rejects with on an API error and on a network failure.

**Python, `brevo-python` 4.x and later.** `send_transac_email` takes the fields as keyword arguments in snake case, and answers a result whose `message_id` is the message id. It raises `ApiError`, from `brevo.core.api_error`, on a non-2xx answer, with `status_code`, `body`, and `headers`, or a typed subclass, such as `BadRequestError` or `TooManyRequestsError`. The guide doesn't say what it raises on a network failure: read the installed package. `AsyncBrevo` is the async client. The client retries `408`, `429`, and `5xx` answers twice by default, and waits up to 60 seconds for a request.

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

The other arguments are the API's fields in snake case, such as `cc`, `bcc`, `reply_to`, `attachment`, `template_id`, `params`, `tags`, `headers`, `scheduled_at`, `batch_id`, and `message_versions`.

**Python, `brevo-python` 1.x.** `configuration = brevo_python.Configuration()` and `configuration.api_key['api-key'] = key` set the key, and its error is `ApiException` from `brevo_python.rest`. The guide shows no send for 1.x and had no retries built in. For 1.x, and for `sib-api-v3-sdk` (module `sib_api_v3_sdk`), read the installed package for the send, its answer, and what it raises on an API error and on a network failure.

**PHP, `getbrevo/brevo-php` 4.x and later.** `sendTransacEmail` answers an object whose `messageId` property is the message id. It throws `Brevo\Exceptions\BrevoApiException` on a non-2xx answer, with `getCode()` (the HTTP status), `getMessage()`, and `getBody()`. `Brevo\Exceptions\BrevoException` is the base class of every SDK error. The client retries `408`, `429`, and `5xx` answers twice by default, and sets no timeout of its own: the HTTP client's default holds, and Guzzle's is none.

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

**PHP, the legacy SDK and `sendinblue/api-v3-sdk`.** `Configuration::getDefaultConfiguration()->setApiKey('api-key', $key)` sets the key, `new TransactionalEmailsApi(new \GuzzleHttp\Client(), $config)` is the client, and a `SendSmtpEmail` takes setters such as `setSender`, `setTo`, `setSubject`, and `setHtmlContent`. Brevo's guide says its errors are Guzzle exceptions, and that it had no retries built in. Read the installed package in `vendor` for what `sendTransacEmail` answers and what it throws on an API error and on a network failure.

**Ruby, Go, .NET, and Java.** Brevo's docs describe none of these SDKs. Read the installed package for how it takes the key, what its send answers, where the message id is, and what it raises, returns, or throws on an API error and on a network failure. Each takes the fields below, in its casing.

**HTTP.** `POST https://api.brevo.com/v3/smtp/email`, or the older host `api.sendinblue.com`, with the header `api-key: <key>`. The API has one host. A send answers `201` with `{ "messageId": "<...>" }`, and a scheduled send answers `202`. An error answers `{ "code", "message" }`, such as `{ "code": "invalid_parameter", ... }`. Look for `api.brevo.com` and `api.sendinblue.com` in `fetch`, `axios`, `got`, `ky`, `requests`, `httpx`, `net/http`, and `curl` calls.

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

**Frameworks.** Mailers that send every framework mail through Brevo: `django-anymail` with `anymail.backends.brevo.EmailBackend` (or the older `anymail.backends.sendinblue.EmailBackend`) in Django, `symfony/brevo-mailer` (`MAILER_DSN=brevo+api://...` or `brevo+smtp://...`) in Symfony, and `Swoosh.Adapters.Brevo` (or `Swoosh.Adapters.Sendinblue`) in Elixir. A Rails app can register its own ActionMailer delivery method, with `add_delivery_method`, whose `deliver!` calls a Brevo SDK: every mailer set to that method sends through Brevo. Each mailable or mailer that sends is a site.

## Send fields

Node.js and HTTP names. Python uses the same names in snake case, and Ruby, Go, and .NET most likely in their language's casing: snake case in Ruby, Pascal case in Go and .NET. Where a name in the code differs, the installed package shows which field it is.

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
| `attachment` | A list of `{ content, name }`, with `content` base64, or `{ url, name }`, a file Brevo fetches, as `mapping.md` says under "Attachments" |
| `tags` | A list of strings, sent back in webhook events |
| `headers` | Object of custom headers. `idempotencyKey` in it is Brevo's idempotency key, and `X-Mailin-custom` is sent back in webhook events |
| `scheduledAt` | A date and time for a scheduled send |
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
