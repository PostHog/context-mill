# Resend to PostHog mapping

This file decides, field by field, whether PostHog can send a Resend call site. A site moves only when every field it sets moves. Otherwise it stays on Resend, and the reason names the first field or feature that keeps it there. `transactional-email-api.md` has the PostHog side in full.

## Fields

| Resend | PostHog | A site stays on Resend when |
|---|---|---|
| `from` | `from` | Never. It needs a verified sender (Step 4) |
| `to` | `to` | `to` can hold more than one address. A list with exactly one address moves as that address |
| `subject` | `subject` | Never |
| `html` | `html` | Never |
| `text` | `text` | Never |
| `react` | `html`, rendered in the app | Never. The app renders the component |
| `template` | a local template in the app's code | Its content can't be read, it uses syntax beyond variables and fallbacks, or the app fills a variable with HTML |
| `cc`, `bcc` | `cc`, `bcc` | An entry carries a name, such as `Jane <jane@example.com>`, or there are more than 10 |
| `replyTo` / `reply_to` | `replyTo` / `reply_to` | Never |
| `headers` | `headers` | A header is one PostHog sets itself (`From`, `To`, `Cc`, `Bcc`, `Reply-To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, `Sender`, `Return-Path`, `Auto-Submitted`, any `Content-*`, `X-PostHog-*`, `X-SES-*`), a value has a line break or a non-ASCII character, or there are more than 10 |
| `tags` | `tags` | A name or value has characters other than ASCII letters, digits, `_`, and `-`, a name starts with `ph_`, or there are more than 10 |
| `attachments` | `attachments` | An attachment uses `path` (a URL Resend fetches), the files can be more than 10 or more than 512 KB in total, or a file type is one mailbox providers block, such as `.exe` |
| `idempotencyKey` / `Idempotency-Key` | `idempotencyKey` / `Idempotency-Key` | The key can hold a space or a non-ASCII character, or be longer than 255 characters. Otherwise the key keeps its value and its meaning: both providers keep a key for 24 hours |
| `scheduledAt` / `scheduled_at` | none | Always |
| `topicId` / `topic_id` | none | Always |

## Calls

| Resend call | A site stays on Resend when |
|---|---|
| `emails.send`, `emails.create`, `Emails.send`, `POST /emails` | A field above keeps it |
| `batch.send`, `Batch.send`, `POST /emails/batch` | Always |
| SMTP through `smtp.resend.com` | Always. PostHog has no SMTP relay |
| Laravel's or Rails' `resend` mailer | Always. PostHog has no mailer driver |
| A send in a language other than JavaScript or TypeScript | Always, until the skill moves that language |

## Code around the send

| Code | A site stays on Resend when |
|---|---|
| `if (error.name === '...')` | The name is not one of PostHog's: `validation_error`, `missing_api_key`, `invalid_permission`, `not_found`, `concurrent_idempotent_requests`, `invalid_idempotent_request`, `rate_limit_exceeded`, `monthly_quota_exceeded`, `service_unavailable`, `application_error` |
| `emails.get(id)` and a branch on `last_event` | Always: the send and its status read stay together. PostHog's status is not `last_event` |
| `data.id` stored for a webhook or a status read | Always, when Resend webhooks or status reads use the id |

## Content

- `html`, `text`, and `react` content is rendered for one recipient before the send. PostHog sends it as it is.
- A `template` site needs the template's content, because the code has only its id. `account.md` says how to get it.
- Resend inserts a variable's value as it is. PostHog's Liquid escapes HTML in a value, so `<b>` shows as text. A variable is HTML when the code fills it with markup or with a renderer's output. A variable the app fills with plain values, such as names, numbers, and URLs, renders the same.
- A template that holds anything other than `{{{VAR}}}` and `{{{VAR|fallback}}}` placeholders, such as a section, a loop, or a condition, stays on Resend.

## Rewrite

How a site that moves is written with `posthog-node`. Step 7 says when to use each part.

**The call.** `resend.emails.send(payload, { idempotencyKey })` and `resend.emails.create(...)` become one `posthog.emails.send({ ... })`. The options object goes away: `idempotencyKey` moves into the payload.

**The fields.**

- `to: ['jane@example.com']` becomes `to: 'jane@example.com'`. A value that is a list with one entry becomes that entry.
- `from`, `subject`, `html`, `text`, `replyTo`, `cc`, `bcc`, `headers`, and `tags` keep their names and values.
- `attachments` keep `filename`, `content`, `contentType`, and `contentId`.
- Each send gets a `templateKey`, as Step 7 says.

**React.** `react: <Welcome name={name} />` becomes `html: await render(<Welcome name={name} />)`, with `import { render } from '@react-email/render'`. Keep a `text` the site already passes.

**HTTP.** A `fetch` or `axios` call to `https://api.resend.com/emails` becomes `posthog.emails.send` with the camelCase fields: `reply_to` becomes `replyTo`, and the `Idempotency-Key` header becomes `idempotencyKey`. Code that read the response status reads `error` instead.

**Templates stored at Resend.** The template becomes a module in the app's code, in the format of the send skill's local template: a `subject` and an `html` string, and a `text` string when the template has one.

- `{{{NAME}}}` becomes `{{ variables.NAME }}`. The name keeps its case.
- `{{{NAME|there}}}` becomes `{{ variables.NAME | default: "there" }}`. A variable with a `fallback_value` in the template's definition gets the same `default`. Escape a `"` in the fallback as `\"`.
- Liquid's `default` also replaces an empty string, which Resend inserts as it is. When the code can pass an empty string for a variable with a fallback, the email shows the fallback instead. Note it in the report.
- The site sends `templateKey`, `subject`, `html`, `text` when there is one, and `templateData` with the site's `variables` object unchanged.
- The site's own `subject`, `from`, and `replyTo` win over the template's. When the site has none, use the template's: put its `from` and `replyTo` on the send, and its subject in the module.
- The template's alias, or its name in lowercase with `-` between words, becomes the `templateKey` and the module's file name.

**The answer.** posthog-node answers `{ data, error }` like Resend and never throws on an API error.

- `data.id` is PostHog's message id. Code that logs it or stores it for the app's own use keeps working.
- `error.name` uses Resend's names, so `if (error.name === 'rate_limit_exceeded')` keeps working. `error.message` and `error.statusCode` keep their names.

**The Resend client.** Keep `new Resend(...)` and its import while any site or other call still uses it. When nothing uses it, remove the import and the client, and keep the `resend` package and its key: the person removes them after the cutover.
