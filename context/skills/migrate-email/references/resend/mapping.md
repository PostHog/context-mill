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
| `template` | a local template in the app's code | The template uses syntax beyond variables and fallbacks |
| `cc`, `bcc` | `cc`, `bcc` | An entry carries a name, such as `Jane <jane@example.com>`, or there are more than 10 |
| `replyTo` / `reply_to` | `replyTo` / `reply_to` | Never |
| `headers` | `headers` | A header is one PostHog sets itself (`From`, `To`, `Cc`, `Bcc`, `Reply-To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, `Sender`, `Return-Path`, `Auto-Submitted`, any `Content-*`, `X-PostHog-*`, `X-SES-*`), a value has a line break or a non-ASCII character, or there are more than 10 |
| `tags` | `tags` | A name or value has characters other than ASCII letters, digits, `_`, and `-`, a name starts with `ph_`, or there are more than 10 |
| `attachments` | `attachments` | An attachment uses `path` (a URL Resend fetches), the files can be more than 10 or more than 512 KB in total, or a file type is one mailbox providers block, such as `.exe` |
| `idempotencyKey` / `Idempotency-Key` | `idempotencyKey` / `Idempotency-Key` | Never. The key keeps its value |
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
- A `template` site needs the template's content from the Resend dashboard, because the code has only its id. PostHog's Liquid escapes HTML in a variable's value. A variable the app fills with HTML keeps the site on Resend.
