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

Look for `new Resend(`, `from 'resend'`, `require('resend')`, `import resend`, `Resend::`, and `resend.NewClient(`.

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

**Python.** `resend.Emails.send(params)`, with the same fields in snake_case, and `options={"idempotency_key": ...}`. It raises on API errors.

**Batch.** `resend.batch.send([...])` in Node.js and `resend.Batch.send([...])` in Python send up to 100 emails in one call.

**HTTP.** `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, a JSON body with the snake_case fields, and an optional `Idempotency-Key` header. `POST https://api.resend.com/emails/batch` is the batch send. Look for `api.resend.com` in `fetch`, `axios`, `got`, `requests`, `httpx`, and `curl` calls.

**SMTP.** Resend also takes mail over SMTP at `smtp.resend.com`, with the user `resend` and the API key as the password. Look for that host in Nodemailer transports, `MAIL_HOST` or `SMTP_HOST` settings, and framework mail config.

**Frameworks.** Laravel's `resend` mailer (`MAIL_MAILER=resend`) and Rails' `resend` delivery method send every framework mail through Resend: each mailable or mailer that sends is a site.

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

A send with `template: { id: 'tmpl_...', variables: { FIRST_NAME: 'Jane' } }` renders a template from the Resend dashboard. Its content is not in the code. The template reads variables as `{{{FIRST_NAME}}}`, with an optional fallback: `{{{FIRST_NAME|there}}}`.

## Status reads

`resend.emails.get(id)` and `GET https://api.resend.com/emails/{id}` return the email with `last_event`, such as `delivered`, `bounced`, or `complained`. Code that branches on `last_event` reads Resend's delivery state.

## Other APIs

`resend.contacts`, `resend.audiences`, `resend.segments`, `resend.broadcasts`, `resend.domains`, `resend.apiKeys`, `resend.webhooks`, and their HTTP routes are not transactional sends.
