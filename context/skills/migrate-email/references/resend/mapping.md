# Resend to PostHog mapping

This file decides, field by field, whether PostHog can send a Resend call site. A site moves only when every field it sets moves. Otherwise it stays on Resend, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full.

## Fields

| Resend | PostHog | A site stays on Resend when |
|---|---|---|
| `from` | `from` | Never. It needs a verified sender (Step 4) |
| `to` | `to` | `to` can hold more than one address. A list with exactly one address moves as that address |
| `subject` | `subject` | Never |
| `html` | `html` | Never |
| `text` | `text` | Never |
| `react` | `html`, rendered in the app | Never. The app renders the component |
| `template` | a template made in PostHog, sent by its `templateId` with `templateData` | The person keeps it on Resend for now, its content can't be read, it uses syntax beyond variables and fallbacks, the app fills a variable with HTML, or the site sets `from`, `replyTo`, or `subject` next to it |
| `cc`, `bcc` | none | Always |
| `replyTo` / `reply_to` | `replyTo` / `reply_to`, as a list | An entry carries a name, such as `Jane <jane@example.com>`, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A single address moves as a list of one |
| `headers` | none | Always |
| `tags` | none | Always |
| `attachments` | none | Always |
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
- A `template` site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Resend template, makes it transactional, and gives you its template ID. Until then the site stays on Resend.
- The check needs the template's content from the Resend dashboard, because the code has only its id. In the PostHog template, `{{{NAME}}}` becomes `{{ variables.NAME }}`, and `{{{NAME|there}}}` becomes `{{ variables.NAME | default: 'there' }}`. PostHog's Liquid escapes HTML in a variable's value, so a variable the app fills with HTML keeps the site on Resend.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo`, or `subject` next to `template` stays on Resend.
