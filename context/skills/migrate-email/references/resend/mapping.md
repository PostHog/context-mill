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
| `template` | a template made in PostHog, sent by its `templateId` with `templateData` | The person keeps it on Resend for now, its content can't be read, it uses syntax beyond variables and fallbacks, the app fills a variable with HTML, or the site sets `from`, `replyTo` / `reply_to`, or `subject` next to it |
| `cc`, `bcc` | none | Always |
| `replyTo` / `reply_to` | `replyTo` / `reply_to`, as a list | An entry carries a name, such as `Jane <jane@example.com>`, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A single address moves as a list of one |
| `headers` | none | Always |
| `tags` | none | Always |
| `attachments` | none | Always |
| `idempotencyKey` / `Idempotency-Key` | `idempotencyKey` / `Idempotency-Key` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. Otherwise the key keeps its value, and PostHog keeps it for 24 hours as Resend does. The two providers don't share keys: a retry that runs after the deploy, of a send Resend already took, sends a second email. Note it in the report |
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
- The check needs the template's content from the Resend dashboard, because the code has only its id.
- In the PostHog template, `{{{NAME}}}` becomes `{{ variables.NAME }}`, and the name keeps its case. `{{{NAME|there}}}` becomes `{{ variables.NAME | default: 'there' }}`, and a variable with a `fallback_value` in the template's definition gets the same `default`. Quote a fallback that holds a `'` with `"` instead. Liquid has no escape character in a quoted value.
- Liquid's `default` also replaces an empty string, which Resend inserts as it is. When the code can pass an empty string for a variable with a fallback, the email shows the fallback instead. Note it in the report.
- Resend inserts a variable's value as it is. PostHog's Liquid escapes HTML in a value, so `<b>` shows as text. A variable is HTML when the code fills it with markup or with a renderer's output, and such a variable keeps the site on Resend. A variable the app fills with plain values, such as names, numbers, and URLs, renders the same.
- A template that holds anything other than `{{{VAR}}}` and `{{{VAR|fallback}}}` placeholders, such as a section, a loop, or a condition, stays on Resend. So does a fallback that holds both `'` and `"`, and a fallback that holds HTML, such as a link: Liquid escapes the fallback too, so the markup shows as text.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo` / `reply_to`, or `subject` next to `template` stays on Resend.
