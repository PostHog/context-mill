# Resend SDK reference

This file says what Resend looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

## Key

The API key lives in `RESEND_API_KEY` by convention. Apps also use their own names, such as `PRIVATE_RESEND_API_KEY`: take the name the client reads.

## Packages

- Node.js: `resend`.
- Python: `resend` (PyPI).
- Ruby: `resend` (RubyGems), and `resend-rails`.
- PHP: `resend/resend-php`, and `resend/resend-laravel` for Laravel.
- Go: `github.com/resend/resend-go`.
- Elixir: `resend` (Hex).
- Java: `com.resend:resend-java`.
- .NET: `Resend`.
- Rust: `resend-rs`.

These are not Resend, and alone they are not a migration: `@react-email/components`, `@react-email/render`, `react-email`, and `jsx-email` render emails, and `nodemailer` sends through any SMTP server.

## Clients

```js
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
```

```python
import resend
resend.api_key = os.environ["RESEND_API_KEY"]
```

Look for `new Resend(`, `from 'resend'`, `require('resend')`, `import resend`, `Resend.api_key`, `Resend::`, `Resend::client(`, `resend.NewClient(`, `AddResend(`, `IResend`, `ResendClient`, `Resend::new(` in Rust, and `Resend.client(` or `config :resend` in Elixir.

## Sends

**Node.js.** `resend.emails.send(payload, options?)`, and its alias `resend.emails.create(...)`. The answer is `{ data, error }`: `data.id` is the email's id, and `error` has `name`, `message`, and `statusCode`. The SDK does not throw on API errors.

```js
const { data, error } = await resend.emails.send({
  from: 'Example <hello@mail.example.com>',
  to: ['jane@example.com'],
  subject: 'Welcome',
  html: '<p>Welcome</p>',
}, { idempotencyKey: `welcome:${user.id}` })
```

**Python.** `resend.Emails.send(params, options)` and `await resend.Emails.send_async(...)`, with the same fields in snake_case in a dict, and `options={"idempotency_key": ...}`. It answers a dict with `"id"`, and raises a `resend.exceptions.ResendError` subclass on an API error, with `code` (the HTTP status) and `error_type` (the error name).

**Ruby.** `Resend::Emails.send(params, options: { idempotency_key: ... })`, with symbol keys in snake_case. It answers a hash-like response with `[:id]`, and raises a `Resend::Error` subclass for the HTTP status, such as `Resend::Error::RateLimitExceededError`.

**PHP.** `$resend = Resend::client($key)`, then `$resend->emails->send([...], ['idempotency_key' => ...])` or its alias `create`, with snake_case keys. Laravel apps use the facade, `Resend\Laravel\Facades\Resend::emails()->send(...)`. It answers a `Resend\Email` with `->id`, and throws `Resend\Exceptions\ErrorException` with `getErrorType()` (the error name) and `getErrorCode()` (the HTTP status).

**Go.** `client := resend.NewClient(key)`, then `client.Emails.Send(params)`, `client.Emails.SendWithContext(ctx, params)`, or `client.Emails.SendWithOptions(ctx, params, &resend.SendEmailOptions{IdempotencyKey: ...})`, with a `*resend.SendEmailRequest{From, To, Subject, Html, Text, ReplyTo, ...}`. It answers a `*resend.SendEmailResponse` with `Id` and an error, which is a `*resend.ResendError` with `StatusCode` and `Name` for an API error.

**.NET.** `IResend`, registered with `services.AddResend(...)` or created as a `ResendClient`, then `await resend.EmailSendAsync(message)` or `EmailSendAsync(idempotencyKey, message)`, with an `EmailMessage { From, To, Subject, HtmlBody, TextBody, ReplyTo, ... }`. It answers a `ResendResponse<Guid>` with `Content`, and throws `ResendException` with `StatusCode` and `ErrorType` on an API error, unless its options set `ThrowExceptions = false`: then the response has `Success` and `Exception`.

**Rust.** `let resend = Resend::new(key)`, then `resend.emails.send(CreateEmailBaseOptions::new(from, to, subject).with_html(...))`, with `.with_text(...)`, `.with_reply(...)`, and `.with_idempotency_key(...)`. It answers a `Result` with a `CreateEmailResponse { id }`, or a `resend_rs::Error`.

**Elixir.** `Resend.Emails.send(%{from: ..., to: ..., subject: ..., html: ...})`, or `Resend.Emails.send(client, %{...})`, with the API key in `config :resend, Resend.Client, api_key: ...`. It takes no idempotency key. It answers `{:ok, %Resend.Emails.Email{id: ...}}` or `{:error, %Resend.Error{name: ..., status_code: ...}}`.

**Java.** `resend.emails().send(...)` in `com.resend:resend-java`. PostHog has no SDK that sends email in Java, so these sends stay.

**Batch.** `resend.batch.send([...])` in Node.js, `resend.Batch.send([...])` in Python, `Resend::Batch.send([...])` in Ruby, `$resend->batch->send([...])` in PHP, `client.Batch.Send(...)` in Go, `EmailBatchAsync(...)` in .NET, `resend.batch.send(...)` in Rust, and `Resend.Emails.send_batch(...)` in Elixir send up to 100 emails in one call.

**HTTP.** `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, a JSON body with the snake_case fields, and an optional `Idempotency-Key` header. `POST https://api.resend.com/emails/batch` is the batch send. Look for `api.resend.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, and `curl` calls.

**SMTP.** Resend also takes mail over SMTP at `smtp.resend.com`, with the user `resend` and the API key as the password. Look for that host in Nodemailer transports, `MAIL_HOST` or `SMTP_HOST` settings, and framework mail config.

**Frameworks.** Laravel's `resend` mailer (`MAIL_MAILER=resend`), Rails' `resend` delivery method, the Swoosh adapter `Resend.Swoosh.Adapter` in Elixir, and the `Resend.FluentEmail` sender in .NET send every framework mail through Resend: each mailable or mailer that sends is a site.

## Send fields

| Node.js field | HTTP field | Value |
|---|---|---|
| `from` | `from` | One address, with an optional name: `Name <a@example.com>` |
| `to` | `to` | One address, or a list of up to 50 |
| `subject` | `subject` | String |
| `html` | `html` | String |
| `text` | `text` | String. Resend derives one from `html` when it is absent |
| `react` | (none) | A React element that the Node.js SDK renders to HTML |
| `cc`, `bcc` | `cc`, `bcc` | One address or a list |
| `replyTo` | `reply_to` | One address or a list |
| `headers` | `headers` | Object of custom headers |
| `tags` | `tags` | List of `{ name, value }` |
| `attachments` | `attachments` | List of `{ filename, content, path, contentType, contentId }`. `content` is a Buffer or base64, `path` is a URL Resend fetches |
| `scheduledAt` | `scheduled_at` | A time to send later |
| `topicId` | `topic_id` | A topic the recipient can unsubscribe from |
| `template` | `template` | `{ id, variables }`: a template stored at Resend |
| `idempotencyKey` option | `Idempotency-Key` header | Up to 256 characters, kept for 24 hours |

## Templates stored at Resend

A send with `template: { id: '...', variables: { PRODUCT: 'Laptop' } }` renders a template from the Resend dashboard. `id` is the template's id or its alias. Its content is not in the code.

- The template reads variables as `{{{PRODUCT}}}`, with an optional fallback: `{{{PRODUCT|a laptop}}}`. A variable's definition in the template can also carry a `fallback_value`.
- A variable's type is `string` or `number`.
- The template can hold a default `from`, `subject`, and `reply_to`. A value the send passes wins over the default.
- A send with `template` passes no `html`, `text`, or `react`.

## Webhooks

Resend posts each event to an endpoint of the app, signed through Svix. An event has `type`, `created_at`, and `data`, which holds the send's `email_id`, `from`, `to`, `subject`, and `tags`. An email event's `type` is such as `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, or `email.clicked`. Resend also sends events on contacts and domains.

Look for routes that read `email_id` or an `email.` event type, `resend.webhooks.verify`, `Webhook` from `svix`, and the `svix-id`, `svix-timestamp`, and `svix-signature` headers.

## Status reads

`resend.emails.get(id)` and `GET https://api.resend.com/emails/{id}` return the email with `last_event`, such as `delivered`, `bounced`, or `complained`. Code that branches on `last_event` reads Resend's delivery state.

## Other APIs

`resend.contacts`, `resend.audiences`, `resend.segments`, `resend.broadcasts`, `resend.domains`, `resend.apiKeys`, `resend.webhooks`, and their HTTP routes are not transactional sends.
