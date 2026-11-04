# SendGrid SDK reference

This file says what SendGrid looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `SENDGRID_API_KEY` by convention. Apps also use their own names, such as `SENDGRID_KEY`: take the name the client reads.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `@sendgrid/mail`, and `@sendgrid/client` for raw API requests | `sgMail.send(msg)` |
| Python | `sendgrid` (PyPI) | `SendGridAPIClient(key).send(Mail(...))` |
| Ruby | `sendgrid-ruby` | `SendGrid::API.new(api_key:).client.mail._('send').post(request_body:)` |
| PHP | `sendgrid/sendgrid` | `(new \SendGrid($key))->send($email)` |
| Go | `github.com/sendgrid/sendgrid-go` with `helpers/mail` | `sendgrid.NewSendClient(key).Send(message)` |
| .NET | `SendGrid` (NuGet), and `SendGrid.Extensions.DependencyInjection` | `client.SendEmailAsync(msg)` |
| Java | `com.sendgrid:sendgrid-java` | `sg.api(request)` with `Mail` |

These are not SendGrid's send SDK, and alone they are not a migration: `@sendgrid/eventwebhook` checks webhook signatures, `@sendgrid/inbound-mail-parser` reads inbound mail, and `nodemailer` sends through any SMTP server.

## Clients and sends

**Node.js.** `sgMail.send(msg)` answers `[response, body]`: `response.statusCode` is `202`, and `response.headers['x-message-id']` is the message id. It throws a `ResponseError` on an API error: `err.code` is the HTTP status, and `err.response.body.errors` is a list of `{ message, field, help }`.

```js
import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

await sgMail.send({
  to: 'jane@example.com',
  from: { email: 'hello@mail.example.com', name: 'Example' },
  subject: 'Welcome',
  text: 'Welcome',
  html: '<p>Welcome</p>',
})
```

- `sgMail.send(msg)` with a list in `to` sends **one** email that every address sees.
- `sgMail.send(msg, true)` and `sgMail.sendMultiple(msg)` send one email per address in `to`.
- `sgMail.send([msg1, msg2])` sends several emails in one call.
- `@sendgrid/client`: `client.request({ method: 'POST', url: '/v3/mail/send', body })` sends the HTTP body below.

**Python.** It raises `python_http_client.exceptions.HTTPError` and its subclasses, such as `BadRequestsError` and `TooManyRequestsError`, on an API error. `e.status_code` and `e.body` hold the answer. A success answers a response with `status_code` `202` and the message id in `headers['X-Message-Id']`.

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

message = Mail(
    from_email=("hello@mail.example.com", "Example"),
    to_emails="jane@example.com",
    subject="Welcome",
    html_content="<p>Welcome</p>",
    plain_text_content="Welcome",
)
response = SendGridAPIClient(os.environ["SENDGRID_API_KEY"]).send(message)
```

- `Mail(..., is_multiple=True)` sends one email per address in `to_emails`.
- `message.template_id` and `message.dynamic_template_data` send a dynamic template.
- `message.add_cc(...)`, `message.add_bcc(...)`, `message.reply_to = ReplyTo(...)`, `message.attachment = Attachment(FileContent(...), FileName(...), FileType(...), Disposition(...), ContentId(...))`, `message.category = Category(...)`, `message.custom_arg = CustomArg(...)`, `message.header = Header(...)`, `message.send_at = SendAt(...)`, and `message.asm = Asm(...)` set the other fields.
- `sg.client.mail.send.post(request_body=data)` sends a raw HTTP body.

**Ruby.** The send answers a response with `status_code` (a string, such as `"202"`), `body`, and `headers`. It does not raise on an API error: the code reads `status_code`.

```ruby
require 'sendgrid-ruby'

mail = SendGrid::Mail.new(
  SendGrid::Email.new(email: 'hello@mail.example.com', name: 'Example'),
  'Welcome',
  SendGrid::Email.new(email: 'jane@example.com'),
  SendGrid::Content.new(type: 'text/html', value: '<p>Welcome</p>')
)
sg = SendGrid::API.new(api_key: ENV['SENDGRID_API_KEY'])
response = sg.client.mail._('send').post(request_body: mail.to_json)
```

A `SendGrid::Personalization` with `add_to`, `add_cc`, `add_bcc`, and `add_dynamic_template_data` builds the recipients, and `mail.template_id`, `mail.reply_to`, `mail.add_attachment`, `mail.add_category`, `mail.add_custom_arg`, `mail.add_header`, `mail.send_at`, and `mail.asm` set the rest.

**PHP.** `send` answers a response with `statusCode()`, `headers()`, and `body()`. It does not throw on an API error, only on a network error.

```php
$email = new \SendGrid\Mail\Mail();
$email->setFrom('hello@mail.example.com', 'Example');
$email->setSubject('Welcome');
$email->addTo('jane@example.com');
$email->addContent('text/html', '<p>Welcome</p>');
$response = (new \SendGrid(getenv('SENDGRID_API_KEY')))->send($email);
```

The other setters are `addCc`, `addBcc`, `setReplyTo`, `addAttachment($content, $type, $filename, $disposition, $contentId)`, `setTemplateId`, `addDynamicTemplateDatas`, `addCategory`, `addCustomArg`, `addHeader`, `setSendAt`, and `setAsm`.

**Go.** `Send` answers `(*rest.Response, error)`. `err` is set only for a network error: an API error is a `response.StatusCode` of 400 or more. The message id is in `response.Headers["X-Message-Id"]`.

```go
from := mail.NewEmail("Example", "hello@mail.example.com")
to := mail.NewEmail("", "jane@example.com")
message := mail.NewSingleEmail(from, "Welcome", to, "Welcome", "<p>Welcome</p>")
response, err := sendgrid.NewSendClient(os.Getenv("SENDGRID_API_KEY")).Send(message)
```

`mail.NewV3Mail()` with `mail.NewPersonalization()` (`AddTos`, `AddCCs`, `AddBCCs`, `SetDynamicTemplateData`) builds the full form, with `SetTemplateID`, `SetReplyTo`, `AddAttachment`, `AddCategories`, `SetCustomArg`, `SetHeader`, `SetSendAt`, and `SetASM`.

**.NET.** `SendEmailAsync` answers a `Response` with `StatusCode`, `IsSuccessStatusCode`, `Headers`, and `Body`. It does not throw on an API error unless the client options set `HttpErrorAsException`.

```csharp
var client = new SendGridClient(Environment.GetEnvironmentVariable("SENDGRID_API_KEY"));
var msg = MailHelper.CreateSingleEmail(
    new EmailAddress("hello@mail.example.com", "Example"),
    new EmailAddress("jane@example.com"),
    "Welcome", "Welcome", "<p>Welcome</p>");
var response = await client.SendEmailAsync(msg);
```

`MailHelper.CreateSingleEmailToMultipleRecipients` and `CreateMultipleEmailsToMultipleRecipients` send to several addresses. A `SendGridMessage` takes `SetFrom`, `AddTo`, `AddCc`, `AddBcc`, `SetReplyTo`, `AddAttachment(filename, base64Content, type, disposition, contentId)`, `SetTemplateId`, `SetTemplateData`, `AddCategory`, `AddCustomArg`, `AddHeader`, `SetSendAt`, and `SetAsm`. Apps that use dependency injection take an `ISendGridClient`.

**HTTP.** `POST https://api.sendgrid.com/v3/mail/send`, or `api.eu.sendgrid.com` for an EU subuser, with `Authorization: Bearer <key>`. A success answers `202` with no body and the message id in the `X-Message-Id` header. An error answers `{ "errors": [{ "message", "field", "help" }] }`. Look for `api.sendgrid.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, and `curl` calls.

**EU subusers.** An app on an EU subuser either names `api.eu.sendgrid.com`, or sets the client's data residency to `eu`, such as `client.setDataResidency('eu')` on `@sendgrid/client` in Node.js or `sg.set_sendgrid_data_residency("eu")` in Python. Either one means every API request in `account.md` goes to `api.eu.sendgrid.com`.

```json
{
  "personalizations": [{ "to": [{ "email": "jane@example.com" }], "dynamic_template_data": { "name": "Jane" } }],
  "from": { "email": "hello@mail.example.com", "name": "Example" },
  "subject": "Welcome",
  "content": [{ "type": "text/plain", "value": "Welcome" }, { "type": "text/html", "value": "<p>Welcome</p>" }]
}
```

**SMTP.** SendGrid takes mail over SMTP at `smtp.sendgrid.net`, with the user `apikey` and the API key as the password. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, or `SMTP_HOST` settings, and framework mail config. An `X-SMTPAPI` header carries SendGrid options over SMTP.

**Frameworks.** Mailers that send every framework mail through SendGrid: `django-sendgrid-v5` and `django-anymail` with its SendGrid backend in Django, `sendgrid-actionmailer` in Rails, `s-ichikawa/laravel-sendgrid-driver` (`MAIL_MAILER=sendgrid`) in Laravel, and the SendGrid adapters of Swoosh and Bamboo in Elixir. Each mailable or mailer that sends is a site.

## Send fields

Node.js names, with the HTTP names where they differ. The other SDKs use the same names in their own case.

| Node.js field | HTTP field | Value |
|---|---|---|
| `from` | `from` | An address, or `{ email, name }` |
| `to` | `personalizations[].to` | An address, `{ email, name }`, or a list of them |
| `cc`, `bcc` | `personalizations[].cc`, `bcc` | Same as `to` |
| `replyTo` | `reply_to` | An address, or `{ email, name }` |
| `replyToList` | `reply_to_list` | A list of `{ email, name }` |
| `subject` | `subject` | String |
| `text`, `html` | `content` | Strings. HTTP sends `[{ type: 'text/plain', value }, { type: 'text/html', value }]` |
| `content` | `content` | A list of `{ type, value }` |
| `templateId` | `template_id` | A dynamic template (`d-...`), or a legacy template |
| `dynamicTemplateData` | `personalizations[].dynamic_template_data` | Object that fills a dynamic template |
| `substitutions` | `personalizations[].substitutions` | Values for a legacy template's `-name-` tags |
| `attachments` | `attachments` | A list of `{ content, filename, type, disposition, contentId }`. `content` is base64 |
| `categories` | `categories` | A list of strings |
| `customArgs` | `custom_args` | Object of string values, sent back in webhook events |
| `headers` | `headers` | Object of custom headers |
| `sendAt` | `send_at` | A Unix time, up to 72 hours ahead |
| `batchId` | `batch_id` | A batch that can be cancelled or paused |
| `asm` | `asm` | `{ groupId, groupsToDisplay }`: an unsubscribe group |
| `ipPoolName` | `ip_pool_name` | String |
| `mailSettings` | `mail_settings` | Such as `sandboxMode`, `bypassListManagement`, `footer` |
| `trackingSettings` | `tracking_settings` | Such as `clickTracking`, `openTracking`, `subscriptionTracking`, `ganalytics` |
| `personalizations` | `personalizations` | A list of recipient groups, each with its own `to`, `cc`, `bcc`, `subject`, data, and `sendAt` |

## Templates stored at SendGrid

A send with `templateId: 'd-...'` and `dynamicTemplateData` renders a dynamic template from the SendGrid dashboard. Its content is not in the code.

- A dynamic template uses Handlebars: `{{name}}`, `{{user.name}}`, `{{{raw}}}`, `{{#if}}`, `{{#unless}}`, `{{#each}}`, and helpers such as `{{#equals}}`, `{{formatDate}}`, and `{{insert}}`.
- A template has versions. The active version holds `subject`, `html_content`, and `plain_content`.
- A legacy template has an id without the `d-` prefix, and reads `substitutions` as `-name-` tags.

## Status reads

The Email Activity API (`GET https://api.sendgrid.com/v3/messages`) reads a message's delivery state. Code that reads it reads SendGrid's state.

## Webhooks

The Event Webhook posts a JSON list of events to an endpoint of the app. Each event has `email`, `timestamp`, `event`, `sg_event_id`, `sg_message_id`, and the send's `custom_args` and `category`. `event` is one of `processed`, `dropped`, `deferred`, `delivered`, `bounce`, `open`, `click`, `spamreport`, `unsubscribe`, `group_unsubscribe`, and `group_resubscribe`.

Look for routes that read `sg_message_id` or `sg_event_id`, `EventWebhook` and `verifySignature` from `@sendgrid/eventwebhook`, and the `X-Twilio-Email-Event-Webhook-Signature` header.

## Other APIs

Marketing Campaigns, contacts, lists, segments, unsubscribe groups, suppressions, templates, API keys, subusers, and stats (`/v3/marketing/*`, `/v3/contactdb/*`, `/v3/asm/*`, `/v3/suppression/*`, `/v3/templates`, `/v3/api_keys`, `/v3/stats`) are not transactional sends.
