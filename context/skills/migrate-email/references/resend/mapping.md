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
| `cc`, `bcc` | none | Always. PostHog's send doesn't take it yet |
| `replyTo` / `reply_to` | `replyTo`, one address or a list | An entry carries a name, such as `Jane <jane@example.com>`, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `headers` | none | Always. PostHog's send doesn't take it yet |
| `tags` | none | Always. PostHog's send doesn't take it yet |
| `attachments` | none | Always. PostHog's send doesn't take it yet |
| `idempotencyKey` / `Idempotency-Key` | `idempotencyKey` / `Idempotency-Key` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. A key built from a value whose length or characters the code doesn't bound, such as a URL or text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site. Otherwise the key keeps its value, and PostHog keeps it for 24 hours as Resend does. The two providers don't share keys: a retry that runs after the deploy, of a send Resend already took, sends a second email. Note it in the report |
| `scheduledAt` / `scheduled_at` | none | Always. PostHog's send doesn't take it yet |
| `topicId` / `topic_id` | none | Always. PostHog's send doesn't take it yet |

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
- A `template` site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Resend template and gives you its template ID, and makes it transactional once a verified sender covers its address, as Step 3 says. Until they give the ID, the site stays on Resend.
- An email that carries a login code, a reset link, or another secret needs its PostHog template marked sensitive: PostHog then keeps no copy of each sent email's body or filled-in subject, and a clicked link keeps only the site's address. Templates are not sensitive by default.
- The check needs the template's content, because the code has only its id. `account.md` says how to get it.
- In the PostHog template, `{{{NAME}}}` becomes `{{ variables.NAME }}`, and the name keeps its case. `{{{NAME|there}}}` becomes `{{ variables.NAME | default: 'there' }}`, and a variable with a `fallback_value` in the template's definition gets the same `default`. Quote every fallback with `'`: a `"` inside the template's JSON body raises `TokenizationError`. Liquid has no escape character in a quoted value, so a fallback that holds a `'` keeps the site on Resend.
- Liquid's `default` also replaces an empty string, which Resend inserts as it is. When the code can pass an empty string for a variable with a fallback, the email shows the fallback instead. Note it in the report.
- Resend inserts a variable's value as it is. PostHog's Liquid escapes HTML in a value, so `<b>` shows as text. A variable is HTML when the code fills it with markup or with a renderer's output, and such a variable keeps the site on Resend. A variable the app fills with plain values, such as names, numbers, and URLs, renders the same.
- A template that holds anything other than `{{{VAR}}}` and `{{{VAR|fallback}}}` placeholders, such as a section, a loop, or a condition, stays on Resend. So does a fallback that holds a `'`, and a fallback that holds HTML, such as a link: Liquid escapes the fallback too, so the markup shows as text.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo` / `reply_to`, or `subject` next to `template` stays on Resend.

## Rewrite

How a site that moves is written with `posthog-node`. Step 7 says when to use each part.

**The PostHog client.** Set `migratedFrom: 'resend'` on the `posthog-node` client that Step 7 configures, when its client options take it.

**The call.** `resend.emails.send(payload, { idempotencyKey })` and `resend.emails.create(...)` become one `posthog.emails.send({ ... })`. The options object goes away: `idempotencyKey` moves into the payload.

**The fields.**

- `to: ['jane@example.com']` becomes `to: 'jane@example.com'`. A value that is a list with one entry becomes that entry.
- When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers, so the type keeps a second address out. Never send one email per address in a loop, and never drop the addresses after the first.
- `from`, `subject`, `html`, `text`, and `replyTo` keep their names and values.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**React.** `react: <Welcome name={name} />` becomes `html: await render(<Welcome name={name} />)`, with `import { render } from '@react-email/render'`. Keep a `text` the site already passes.

**HTTP.** A `fetch` or `axios` call to `https://api.resend.com/emails` becomes `posthog.emails.send` with the camelCase fields: `reply_to` becomes `replyTo`, and the `Idempotency-Key` header becomes `idempotencyKey`. Code that read the response status reads `error` instead. A request with its own deadline, such as `signal: AbortSignal.timeout(5000)` or axios `timeout: 5000`, keeps it: set `emailRequestTimeoutMs` to that value on the client the sends use, and pass `maxRetries: 0` on the send, since the request never retried. posthog-node otherwise waits up to 15 seconds and retries twice, which can run past the site's deadline. When sites use different deadlines, set the shortest, and note the sites whose deadline it shortens.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `variables` object. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**The answer.** posthog-node answers `{ data, error }` like Resend and never throws on an API error.

- `data.id` is PostHog's message id. Code that logs it or stores it for the app's own use keeps working.
- `error.name` uses Resend's names, so `if (error.name === 'rate_limit_exceeded')` keeps working. `error.message` and `error.statusCode` keep their names.
- Resend takes a send to a suppressed address and drops it later. PostHog refuses it with `error.code` `recipient_suppressed` (name `validation_error`). When the site throws, retries, or reports a failure on any error, add `if (error?.code === 'recipient_suppressed')` before that branch and handle it the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The Resend client.** Keep `new Resend(...)` and its import while any site or other call still uses it. When nothing uses it, remove the import and the client, and keep the `resend` package and its key: the person removes them after the cutover.
