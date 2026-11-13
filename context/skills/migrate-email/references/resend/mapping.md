# Resend to PostHog mapping

This file decides, field by field, whether PostHog can send a Resend call site. A site moves only when every field it sets moves. Otherwise it stays on Resend, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full.

The field names below are Node.js's. Every Resend SDK sends the same fields under its language's spelling, such as `reply_to` in Python, Ruby, PHP, and Elixir, `ReplyTo` in Go and .NET, and `with_reply` in Rust, and each PostHog SDK's rewrite file names its own.

## Fields

| Resend | PostHog | A site stays on Resend when |
|---|---|---|
| `from` | `from` | Never. It needs a verified sender (Step 4) |
| `to` | `to`, one bare address | `to` can hold more than one address, its entry carries a name, such as `Jane <jane@example.com>`, or the code builds it at run time and you cannot tell that it holds a bare address only. A list with exactly one bare address moves as that address |
| `subject` | `subject` | Never |
| `html` | `html` | Never |
| `text` | `text` | It is an empty string next to `html` or `react`, or the code builds it at run time and it can be one, such as a helper's default `text = ''` or `input.text ?? ''`: Resend then sends no text part, and PostHog makes one from the HTML whenever a send has no text. The reason is `turns the plain-text part off`. A `text` left out moves: Resend made the text part from the HTML too. So does an empty `Text` in Go, whose SDK leaves an empty `Text` out of the request |
| `react` (Node.js only) | `html`, rendered in the app | Never. The app renders the component |
| `template` | the template's email, brought into the code and rendered with the site's `variables`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
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
| Code that reads what Resend's answer carries from its response headers: `headers` on the answer in Node.js, `http_headers` on the answer or `headers` on an error in Python, `headers` on the answer or an error in Ruby, and `RateLimitExceededError`'s `rate_limit_limit`, `rate_limit_remaining`, `rate_limit_reset`, and `retry_after`, the fields of `*resend.RateLimitError` in Go, `Limits` on the answer or the exception in .NET, the `ratelimit_*` fields of `Error::RateLimit` in Rust, the headers of an HTTP request's answer, and the same in any SDK whose answer or error carries them | When it reads anything but the retry delay of a refused send, such as a `retry-after` header of a `429`: PostHog's answer carries no headers, and its error carries only the retry delay. The reason is `reads <header or field> from Resend's answer`. The retry delay moves as "The retry delay" says. A `headers` the code takes from the answer and never uses goes away |
| A send the code can cancel, such as a request with a `signal` a caller passes in or an `AbortController` it aborts, on a `fetch` or axios request or in the options of `resend.emails.send(payload, { signal })`, which the SDK passes to its request, or a Go `context` or .NET cancellation token that a caller can cancel | Unless the PostHog send in that language takes the same cancellation, as Go's `Send(ctx, ...)` and .NET's `SendAsync(..., cancellationToken)` do: pass it there. Otherwise always, as in Node.js, whose send takes no signal: an email the old code cancelled would go out. A fixed deadline, such as `AbortSignal.timeout(...)`, moves as Step 7 says |

## Content

- `html`, `text`, and `react` content is rendered for one recipient before the send. PostHog sends it as it is.

## Templates

A `template` site moves by bringing the template into the code, as `template-to-code.md` says. The check needs the template's content, because the code has only its id or alias. `account.md` says how to get it. The code renders the template's HTML, text, and subject with the site's `variables`, and the send sets the rendered `subject`, `html`, and `text`.

Resend templates hold only variables, with an optional fallback. In the code:

| Resend | In the code |
|---|---|
| `{{{NAME}}}` in the HTML | The value. Resend inserts it as it is and never escapes it, so it falls under the rule of `template-to-code.md`: escape it, unless the code builds it as HTML itself, such as a link or a list it joins. Then insert it as it is, and name it in the plan row |
| `{{{NAME}}}` in the subject or the text | The value as it is, with no escaping |
| `{{{NAME\|there}}}`, and a variable whose definition has a `fallback_value` | The value, or the fallback when the site doesn't pass the variable. Resend inserts an empty string as it is, so `""` renders as nothing, not as the fallback. A fallback is the template's own text: in the HTML it goes in as it is, so a fallback that holds HTML, such as a link, renders as before |
| A variable of type `number` | The number written as a decimal, such as `3` or `2.5`. Note in the plan row where the language writes a whole float differently, such as Python's `3.0` |
| The template's `subject` | The send's `subject`, rendered with the same variables. A subject the site sets next to `template` wins: Resend sends the value the send passes over the template's |
| The template's `from` and `reply_to` | The send's `from` and reply-to address. A value the site sets next to `template` wins, the same way. A value the send takes from the template meets the rules of "Fields" as one the site sets: a reply-to address with a name, such as `Support <support@example.com>`, keeps the site on Resend |
| The template's `html` and `text` | The send's `html` and `text`. A template without `text` sends `html` only: Resend made its text part from the HTML, and PostHog does the same. A template whose `text` is an empty string sent no text part, which a PostHog send can't do: it stays on Resend, and the reason is `turns the plain-text part off` |

Write the `\|` above as a plain `|`. The table escapes it.

- Any other syntax in the template, such as a section, a loop, or a condition, keeps it on Resend: these files say what only variables and fallbacks do. The reason names the syntax.
- A variable the template reads without a fallback, which the site can leave out, keeps the template on Resend: these files don't say what Resend renders then. The reason is `<NAME> can be missing`. A site that always passes it moves.
- These files name no host where Resend keeps a template's images. List each image whose host isn't the app's own, and ask the person once whether Resend hosts any of them, so the report can name those, as `template-to-code.md` says.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the Resend template and gives you its template ID, and makes it transactional once a verified sender covers its address, as Step 3 says. Until they give the ID, the site stays on Resend.

An email that carries a login code, a reset link, or another secret needs its PostHog template marked sensitive: PostHog then keeps no copy of each sent email's body or filled-in subject, and sends its links as they are, without its click redirect. Templates are not sensitive by default.

- In the PostHog template, `{{{NAME}}}` becomes `{{ variables.NAME }}`, and the name keeps its case. `{{{NAME|there}}}` becomes `{{ variables.NAME | default: 'there' }}`, and a variable with a `fallback_value` in the template's definition gets the same `default`. Quote every fallback with `'`: a `"` inside the template's JSON body raises `TokenizationError`. Liquid has no escape character in a quoted value, so a fallback that holds a `'` keeps the site on Resend.
- Liquid's `default` also replaces an empty string, which Resend inserts as it is. When the code can pass an empty string for a variable with a fallback, the email shows the fallback instead. Note it in the report.
- Resend inserts a variable's value as it is. PostHog's Liquid escapes HTML in a value, so `<b>` shows as text. A variable is HTML when the code fills it with markup or with a renderer's output, and such a variable keeps the site on Resend. A variable the app fills with plain values, such as names, numbers, and URLs, renders the same.
- A template that holds anything other than `{{{VAR}}}` and `{{{VAR|fallback}}}` placeholders, such as a section, a loop, or a condition, stays on Resend. So does a fallback that holds a `'`, and a fallback that holds HTML, such as a link: Liquid escapes the fallback too, so the markup shows as text.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `replyTo` / `reply_to`, or `subject` next to `template` stays on Resend.

## Webhooks

Resend stops sending email events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when the project's **Capture email engagement events** setting is on and the send's tracking doesn't turn engagement off, as Step 7 says under "Sensitive emails and tracking":

| Resend event | PostHog event |
|---|---|
| `email.sent` | `$workflows_email_sent` |
| `email.delivered` | `$workflows_email_delivered` |
| `email.bounced` | `$workflows_email_bounced` |
| `email.complained` | `$workflows_email_blocked` |
| `email.opened` | `$workflows_email_opened` |
| `email.clicked` | `$workflows_email_link_clicked`, only when PostHog tracks the email's clicks: for a template made in PostHog that is not marked sensitive, or a code send whose tracking leaves clicks on, as the table in Step 7 under "Sensitive emails and tracking" says. Step 7 marks every code send sensitive and never turns `clicks` on, so its links go out as they are, and PostHog counts no clicks |
| Every other email event, such as `email.delivery_delayed` | none |

PostHog's events carry no Resend `email_id` and no `tags`. A site whose events a handler matches by `email_id` or by a tag stays on Resend. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, such as `email.delivery_delayed`, stays, and the reason is `its <event> events feed a webhook handler`. A site whose emails an `email.clicked` handler acts on moves only to a template made in PostHog that is not marked sensitive, since Step 7 never tracks a code send's clicks: it marks every code send sensitive and never turns `clicks` on. When its plan note says `opens off`, it stays too: a template in PostHog with tracking off counts neither opens nor clicks. Otherwise it stays, and the reason is `its clicks feed a webhook handler`.

## Calls that change the suppression list

Step 5 says what to do with each of these calls. They are not sends, and they stay on Resend.

| Adds an address | Removes an address |
|---|---|
| `resend.suppressions.add(...)`, `resend.suppressions.batch.add(...)`, `POST /suppressions`, `POST /suppressions/batch/add`, and each SDK's spelling of them, such as `Resend::Suppressions.add` in Ruby or `client.Suppressions.Add` in Go | `resend.suppressions.remove(...)`, `resend.suppressions.batch.remove(...)`, `DELETE /suppressions/{id or email}`, `POST /suppressions/batch/remove`, and each SDK's spelling of them |

A contact's `unsubscribed` flag is not on this list, as `account.md` says, so a call that sets it is not one of these.

## Rewrite

How a site that moves is written with PostHog's SDK for its language. Step 7 says when to use each part, and the SDK's rewrite file gives the PostHog side of each call.

**The PostHog client.** Set the provider name to `resend` on the PostHog client that Step 7 configures, under the name the rewrite file gives, such as `migratedFrom: 'resend'` in Node.js or `migrated_from="resend"` in Python, when the client options take it.

**The fields.**

- A `to` that is a list with one entry becomes that entry, such as `to: ['jane@example.com']` becoming `to: 'jane@example.com'`.
- When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers, so the type keeps a second address out. Never send one email per address in a loop, and never drop the addresses after the first.
- `from`, `subject`, `html`, `text`, and the reply-to address keep their values, under the PostHog SDK's names.
- A send with rendered content gets a template key, as Step 7 says.
- The idempotency key moves into the send, under the PostHog SDK's name for it.
- Resend sets open and click tracking per domain, not per send, so the call doesn't show it. Step 3 reads the domain's open tracking from the person, as `account.md` says under "Open tracking". A site whose plan note says `opens off` turns off the `opens` switch of tracking, as Step 7 says. Click tracking needs no question: Step 7 marks every code send sensitive, so PostHog doesn't track its clicks, and Step 7 never turns them on. When the domain tracks clicks in Resend, note in the report that PostHog doesn't count these emails' clicks.

**Templates brought into the code.** The site renders the email from its `variables`, as "Templates" says, and sends the template key, the rendered subject, HTML, and text, and the `from` and reply-to address: the site's own where it sets them, otherwise the template's. It sends no template ID and no template data.

**Templates made in PostHog.** The site sends the template ID the person gave, and the template data with the site's `variables`. It sends no template key, subject, body, `from`, or reply-to address: the template holds them.

**HTTP.** A request to `https://api.resend.com/emails`, through `fetch`, `axios`, `requests`, `httpx`, `net/http`, Faraday, Guzzle, `HttpClient`, `reqwest`, `Req`, or `curl`, becomes the SDK's send in that language. The `Idempotency-Key` header becomes the send's idempotency key. Code that read the response status reads the SDK's error instead. A request with its own deadline, such as `signal: AbortSignal.timeout(5000)` or `requests.post(..., timeout=5)`, keeps it, as Step 7 says under "Set up the client". An axios `timeout: 5000` in Node.js is a limit the SDK can't keep, as Step 7 says there.

**Suppressed recipients.** Resend takes a send to a suppressed address and drops it later. PostHog refuses it with the error code `recipient_suppressed` (name `validation_error`). When the site throws, retries, or reports a failure on any error, handle that code before that branch, as the rewrite file shows, the way the site handled a send that went out: log it and go on. A suppressed send has no message ID: when the code after the send uses the ID for more than a log line, such as returning it to its callers or storing it, the site stays, and the reason is `uses the message id of a suppressed send`, unless its callers already handle a send without an ID. Note each site that got this branch in the report.

**Error handlers.** The parts below change Resend's error to PostHog's. When the same `try`, `begin`, or error check also covers a call that stays on Resend, such as `resend.Contacts.create`, keep Resend's handler for that call and add PostHog's next to it. Resend's API names a `503` answer `service_unavailable`, and every PostHog SDK also names a network failure that is left after its retries `service_unavailable`, with the code `network_error`. So a branch on the name `service_unavailable` also checks that the code is not `network_error`, such as `error.name === 'service_unavailable' && error.code !== 'network_error'`, and a network failure takes the path the old code gave it, as Step 7 says under "Rewrite each site", such as Node.js's branch on `application_error` below, wherever that branch stands.

**The retry delay.** A site that reads the retry delay of a refused send reads the PostHog error's instead, under the name and in the unit its rewrite file gives under "The answer". Resend carries it in the `retry-after` header, in seconds: in `headers` on the answer in Node.js, `headers` on the error in Python, `RateLimitExceededError`'s `retry_after`, a whole number, in Ruby, `*resend.RateLimitError`'s `RetryAfter`, a string, in Go, and `Limits.RetryAfter` in .NET. Convert where the units differ. PostHog sets it only when its answer named a wait, so keep the path the old code gave a missing header. A send through a client with retries has already waited and retried a rate limit by itself by then. A site that keeps its own deadline sends with no retries, as Step 7 says under "Set up the client", so its own wait and retry stay as they are.

**The Resend client.** Keep Resend's client, its import, and its setup while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the Resend package and its key: the person removes them after the cutover.

### Node.js

- `resend.emails.send(payload, { idempotencyKey })` and `resend.emails.create(...)` become one `posthog.emails.send({ ... })`. The options object goes away: `idempotencyKey` moves into the payload. A `signal` in it is code around the send, as the table above says.
- `react: <Welcome name={name} />` becomes `html: await render(<Welcome name={name} />)`, with `import { render } from '@react-email/render'`. Keep a `text` the site already passes.
- An HTTP body's snake_case fields become camelCase: `reply_to` becomes `replyTo`.
- posthog-node answers `{ data, error }` like Resend and never throws on an API error. `data.id` is PostHog's message ID, so code that logs it or stores it for the app's own use keeps working for a send that goes out. A suppressed send has none, as "Suppressed recipients" says. `error.name` uses Resend's names, so `if (error.name === 'rate_limit_exceeded')` keeps working, and `error.message` and `error.statusCode` keep their names.
- Resend answers a network failure as an `error` with the name `application_error` and a `statusCode` of `null`. posthog-node answers it with the code `network_error`, the name `service_unavailable`, and no `statusCode`. A branch on `error.name === 'application_error'` took network failures too: it also takes `error.code === 'network_error'`. A check of `error.statusCode === null` becomes `error.statusCode == null`, which a local argument error matches too, as Resend's `null` did.

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
- `*resend.ResendError` becomes `*posthog.EmailError`, read with `errors.As`. `StatusCode` and `Name` keep their names. Every other check of a Resend error, such as one for the rate limit, with its own type or sentinel, becomes `errors.As` with `*posthog.EmailError` and a check of `StatusCode`, such as `StatusCode == 429`.

### .NET

- `await resend.EmailSendAsync(message)` and `EmailSendAsync(idempotencyKey, message)` become `await emails.SendAsync(new SendCodeEmailOptions { ... })`. `HtmlBody` becomes `Html`, `TextBody` becomes `Text`, and the idempotency key moves into the options.
- Resend answers a `ResendResponse<Guid>`, and PostHog a `SendEmailResult`: `response.Content` becomes `result.Id`, a `string` that holds a UUID, as Step 7 says. Where the code keeps the ID as a `Guid`, it becomes `Guid.Parse(result.Id)`, for a send that goes out, as "Suppressed recipients" says.
- Resend throws `ResendException` unless its options set `ThrowExceptions = false`, and PostHog always throws `EmailException`. `catch (ResendException e)` becomes `catch (EmailException e)`, and a check of `e.ErrorType`, an enum such as `ErrorType.RateLimitExceeded`, becomes a check of `e.Name`, a string such as `"rate_limit_exceeded"`. Code that checked `response.Success` catches `EmailException` instead.

### Rust

- `resend.emails.send(CreateEmailBaseOptions::new(from, to, subject).with_html(html))`, with `.with_text(...)`, `.with_reply(...)`, and `.with_idempotency_key(key)`, becomes `posthog.emails().send(CodeEmail::new(to, template_key, subject).html(html))`, with `.text(...)`, `.reply_to(...)`, `.idempotency_key(key)`, and `.from(from)` for the sender the old call passed.
- Both answer a `Result`: `response.id` becomes `result.id`.
- `resend_rs::Error` becomes `posthog_rs::EmailError`. A match on Resend's error name becomes a match on `error.kind().as_str()`.

### Elixir

- `Resend.Emails.send(%{from: ..., to: ..., ...})`, with or without a client as the first argument, becomes `PostHog.Emails.send(MyApp.PostHogEmail, from: ..., to: ..., ...)` with the email instance's name first and a keyword list. Resend's Elixir SDK takes no idempotency key, so the site sends none unless the old code set one some other way.
- `{:ok, %Resend.Emails.Email{id: id}}` becomes `{:ok, result}` with `result.id`.
- `{:error, %Resend.Error{}}` becomes `{:error, %PostHog.Emails.Error{}}`. Resend's `name` is a string and PostHog's is an atom: a match on `name: "rate_limit_exceeded"` becomes `name: :rate_limit_exceeded`.
