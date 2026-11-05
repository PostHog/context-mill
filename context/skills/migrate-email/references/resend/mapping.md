# Resend to PostHog mapping

This file decides, field by field, whether PostHog can send a Resend call site. A site moves only when every field it sets moves. Otherwise it stays on Resend, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full.

The field names below are Node.js's. Every Resend SDK sends the same fields under its language's spelling, such as `reply_to` in Python, Ruby, PHP, and Elixir, `ReplyTo` in Go and .NET, and `with_reply` in Rust, and each PostHog SDK's rewrite file names its own.

## Fields

| Resend | PostHog | A site stays on Resend when |
|---|---|---|
| `from` | `from` | Never. It needs a verified sender (Step 4) |
| `to` | `to` | `to` can hold more than one address. A list with exactly one address moves as that address |
| `subject` | `subject` | Never |
| `html` | `html` | Never |
| `text` | `text` | Never |
| `react` (Node.js only) | `html`, rendered in the app | Never. The app renders the component |
| `template` | a template made in PostHog, sent by its `templateId` with `templateData` | The person keeps it on Resend for now, its content can't be read, it uses syntax beyond variables and fallbacks, the app fills a variable with HTML, or the site sets `from`, `replyTo`, or `subject` next to it |
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
| A send: `resend.emails.send` or `resend.emails.create` (Node.js), `resend.Emails.send` or `send_async` (Python), `Resend::Emails.send` (Ruby), `$resend->emails->send` or `create` (PHP), `client.Emails.Send`, `SendWithContext`, or `SendWithOptions` (Go), `EmailSendAsync` (.NET), `resend.emails.send` (Rust), `Resend.Emails.send` (Elixir), or `POST /emails` | A field above keeps it |
| A batch: `batch.send`, `Batch.send`, `Batch.Send`, `EmailBatchAsync`, `send_batch`, or `POST /emails/batch` | Always |
| SMTP through `smtp.resend.com` | Always. PostHog has no SMTP relay |
| A framework mailer that sends through Resend: Laravel's or Rails' `resend` mailer, the `Resend.Swoosh.Adapter` Swoosh adapter in Elixir, or `Resend.FluentEmail` in .NET | Always. PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Code around the send

| Code | A site stays on Resend when |
|---|---|
| A branch on Resend's error name: `error.name` in Node.js, Go, and Elixir, `error_type` in Python, `getErrorType()` in PHP, or `ErrorType` in .NET | The name is not one of PostHog's: `validation_error`, `missing_api_key`, `invalid_permission`, `not_found`, `concurrent_idempotent_requests`, `invalid_idempotent_request`, `rate_limit_exceeded`, `monthly_quota_exceeded`, `service_unavailable`, `application_error` |
| `emails.get(id)` and a branch on `last_event` | Always: the send and its status read stay together. PostHog's status is not `last_event` |
| `data.id` stored for a webhook or a status read | Always, when Resend webhooks or status reads use the id |

## Content

- `html`, `text`, and `react` content is rendered for one recipient before the send. PostHog sends it as it is.
- A `template` site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Resend template, makes it transactional, and gives you its template ID. Until then the site stays on Resend.
- The check needs the template's content, because the code has only its id. `account.md` says how to get it.
- In the PostHog template, `{{{NAME}}}` becomes `{{ variables.NAME }}`, and the name keeps its case. `{{{NAME|there}}}` becomes `{{ variables.NAME | default: 'there' }}`, and a variable with a `fallback_value` in the template's definition gets the same `default`. Quote every fallback with `'`: a `"` inside the template's JSON body raises `TokenizationError`. Liquid has no escape character in a quoted value, so a fallback that holds a `'` keeps the site on Resend.
- Liquid's `default` also replaces an empty string, which Resend inserts as it is. When the code can pass an empty string for a variable with a fallback, the email shows the fallback instead. Note it in the report.
- Resend inserts a variable's value as it is. PostHog's Liquid escapes HTML in a value, so `<b>` shows as text. A variable is HTML when the code fills it with markup or with a renderer's output, and such a variable keeps the site on Resend. A variable the app fills with plain values, such as names, numbers, and URLs, renders the same.
- A template that holds anything other than `{{{VAR}}}` and `{{{VAR|fallback}}}` placeholders, such as a section, a loop, or a condition, stays on Resend. So does a fallback that holds a `'`, and a fallback that holds HTML, such as a link: Liquid escapes the fallback too, so the markup shows as text.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo`, or `subject` next to `template` stays on Resend.

## Rewrite

How a site that moves is written with PostHog's SDK for its language. Step 7 says when to use each part, and the SDK's rewrite file gives the PostHog side of each call.

**The PostHog client.** Set the provider name to `resend` on the PostHog client that Step 7 configures, under the name the rewrite file gives, such as `migratedFrom: 'resend'` in Node.js or `migrated_from="resend"` in Python, when the client options take it.

**The fields.**

- A `to` that is a list with one entry becomes that entry, such as `to: ['jane@example.com']` becoming `to: 'jane@example.com'`.
- When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers, so the type keeps a second address out. Never send one email per address in a loop, and never drop the addresses after the first.
- `from`, `subject`, `html`, `text`, and the reply-to address keep their values, under the PostHog SDK's names.
- A send with rendered content gets a template key, as Step 7 says.
- The idempotency key moves into the send, under the PostHog SDK's name for it.

**Templates made in PostHog.** The site sends the template ID the person gave, and the template data with the site's `variables`. It sends no template key, subject, body, `from`, or reply-to address: the template holds them.

**HTTP.** A request to `https://api.resend.com/emails`, through `fetch`, `axios`, `requests`, `httpx`, `net/http`, Faraday, Guzzle, `HttpClient`, `reqwest`, `Req`, or `curl`, becomes the SDK's send in that language. The `Idempotency-Key` header becomes the send's idempotency key. Code that read the response status reads the SDK's error instead.

**Suppressed recipients.** Resend takes a send to a suppressed address and drops it later. PostHog refuses it with the error code `recipient_suppressed` (name `validation_error`). When the site throws, retries, or reports a failure on any error, handle that code before that branch, as the rewrite file shows, the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The Resend client.** Keep Resend's client, its import, and its setup while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the Resend package and its key: the person removes them after the cutover.

### Node.js

- `resend.emails.send(payload, { idempotencyKey })` and `resend.emails.create(...)` become one `posthog.emails.send({ ... })`. The options object goes away: `idempotencyKey` moves into the payload.
- `react: <Welcome name={name} />` becomes `html: await render(<Welcome name={name} />)`, with `import { render } from '@react-email/render'`. Keep a `text` the site already passes.
- An HTTP body's snake_case fields become camelCase: `reply_to` becomes `replyTo`.
- posthog-node answers `{ data, error }` like Resend and never throws on an API error. `data.id` is PostHog's message ID, so code that logs it or stores it for the app's own use keeps working. `error.name` uses Resend's names, so `if (error.name === 'rate_limit_exceeded')` keeps working, and `error.message` and `error.statusCode` keep their names.

### Python

- `resend.Emails.send(params, options={"idempotency_key": key})` becomes `posthog.emails.send(...)` with keyword arguments: `params["from"]` becomes `from_=`, and the options' `idempotency_key` becomes `idempotency_key=`. `resend.Emails.send_async` becomes the same call on `AsyncPosthog`, awaited.
- Resend answers a dict, and PostHog a `SendEmailResult`: `response["id"]` becomes `result.id`.
- Both raise on an API error. `except resend.exceptions.ResendError` becomes `except EmailError`, from `posthog.emails`. A class that stands for an HTTP status, such as `resend.exceptions.RateLimitError` for `429`, becomes `EmailError` with a check of `error.status_code`, such as `error.status_code == 429`, because one status covers more than one PostHog name.
- Resend's `error.code` is the HTTP status, and PostHog's is a string error code. Code that read `error.code` reads `error.status_code`, and code that read `error.error_type` reads `error.name`.

### Ruby

- `Resend::Emails.send(params, options: { idempotency_key: key })` becomes `POSTHOG.emails.send(...)` with keyword arguments, and the options' `idempotency_key` becomes `idempotency_key:`.
- Resend answers a hash-like response, and PostHog a `SendResult`: `response[:id]` becomes `result.id`.
- Both raise on an API error. `rescue Resend::Error` becomes `rescue PostHog::EmailError`. A class that stands for an HTTP status, such as `Resend::Error::RateLimitExceededError` for `429`, becomes `PostHog::EmailError` with a check of `e.status_code`, such as `e.status_code == 429`, because one status covers more than one PostHog name.

### PHP

- `$resend->emails->send([...], ['idempotency_key' => $key])`, `$resend->emails->create(...)`, and Laravel's `Resend::emails()->send(...)` facade become `$posthog->emails()->send([...])` on the email client the rewrite file sets up, and the options' `idempotency_key` moves into the array.
- Resend answers a `Resend\Email`, and PostHog a `SendEmailResult`: `$email->id` becomes `$result->getId()`.
- Both throw on an API error. `catch (\Resend\Exceptions\ErrorException $e)` becomes `catch (\PostHog\EmailError $e)`.
- Resend's `getErrorCode()` is the HTTP status as an `int`, and PostHog's `getErrorCode()` is a string error code. Code that read `getErrorCode()` reads `getStatusCode()`, and code that read `getErrorType()` reads `getErrorName()`.

### Go

- `client.Emails.Send(params)`, `SendWithContext(ctx, params)`, and `SendWithOptions(ctx, params, &resend.SendEmailOptions{IdempotencyKey: key})` become `client.Emails().Send(ctx, posthog.CodeEmail{...})`. Pass the site's context, or `context.Background()` where the old call had none. `Html` becomes `HTML`, and the options' `IdempotencyKey` moves into the email.
- Both answer a pointer and an error: `resp.Id` becomes `result.ID`.
- `*resend.ResendError` becomes `*posthog.EmailError`, read with `errors.As`. `StatusCode` and `Name` keep their names.

### .NET

- `await resend.EmailSendAsync(message)` and `EmailSendAsync(idempotencyKey, message)` become `await emails.SendAsync(new SendCodeEmailOptions { ... })`. `HtmlBody` becomes `Html`, `TextBody` becomes `Text`, and the idempotency key moves into the options.
- Resend answers a `ResendResponse<Guid>`, and PostHog a `SendEmailResult`: `response.Content` becomes `result.Id`, a `string`. Where the code keeps the ID as a `Guid` that stays inside the code the site owns, keep it as a `string`. When the `Guid` reaches a database column or another service, the site stays, with the reason `stores the message ID as a Guid`.
- Resend throws `ResendException` unless its options set `ThrowExceptions = false`, and PostHog always throws `EmailException`. `catch (ResendException e)` becomes `catch (EmailException e)`, and a check of `e.ErrorType`, an enum such as `ErrorType.RateLimitExceeded`, becomes a check of `e.Name`, a string such as `"rate_limit_exceeded"`. Code that checked `response.Success` catches `EmailException` instead.

### Rust

- `resend.emails.send(CreateEmailBaseOptions::new(from, to, subject).with_html(html))`, with `.with_text(...)`, `.with_reply(...)`, and `.with_idempotency_key(key)`, becomes `posthog.emails().send(CodeEmail::new(to, template_key, subject).html(html))`, with `.text(...)`, `.reply_to(...)`, `.idempotency_key(key)`, and `.from(from)` for the sender the old call passed.
- Both answer a `Result`: `response.id` becomes `result.id`.
- `resend_rs::Error` becomes `posthog_rs::EmailError`. A match on Resend's error name becomes a match on `error.kind().as_str()`.

### Elixir

- `Resend.Emails.send(%{from: ..., to: ..., ...})`, with or without a client as the first argument, becomes `PostHog.Emails.send(from: ..., to: ..., ...)` with a keyword list. Resend's Elixir SDK takes no idempotency key, so the site sends none unless the old code set one some other way.
- `{:ok, %Resend.Emails.Email{id: id}}` becomes `{:ok, result}` with `result.id`.
- `{:error, %Resend.Error{}}` becomes `{:error, %PostHog.Emails.Error{}}`. Resend's `name` is a string and PostHog's is an atom: a match on `name: "rate_limit_exceeded"` becomes `name: :rate_limit_exceeded`.
