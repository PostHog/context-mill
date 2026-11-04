# Mailgun to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailgun call site. A site moves only when every field it sets moves. Otherwise it stays on Mailgun, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

## Fields

Mailgun fields are written in their HTTP names. The SDK setters in `sdk-reference.md` set the same fields, such as Go's `AddCC` for `cc` or Ruby's `variable` for `v:`.

| Mailgun | PostHog | A site stays on Mailgun when |
|---|---|---|
| `from` | `from` | Never. `Name <address>` moves as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| The sending domain of the call | none | Never. Step 4 sets up the sender for the domain of `from`. When the two differ, note it in the plan row |
| `to` | `to` | It holds more than one address, as a list or a comma-separated string. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `subject` | `subject` | Never |
| `text`, `html` | `text`, `html` | Never |
| `%recipient.<name>%`, `%unsubscribe_url%`, `%tag_unsubscribe_url%`, or `%mailing_list_unsubscribe_url%` in `subject`, `text`, or `html` | none | Always: Mailgun fills them at send time |
| `amp-html` | none | Always. PostHog's send doesn't take it yet |
| `message` (MIME) | none | Always. PostHog's send doesn't take it yet |
| `template` with `t:variables`, `h:X-Mailgun-Variables`, or `v:` values | a template made in PostHog, sent by its `templateId` with `templateData` | See "Templates" |
| `t:version` | the PostHog template made from that version | See "Templates" |
| `t:text` | none | Always. PostHog's send doesn't take it yet |
| `cc`, `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `Name <address>` moves as the bare address, as for `to` |
| `h:Reply-To` | `replyTo` | It carries a name, holds more than 10 addresses, or the code builds it at run time and you cannot tell that it holds bare addresses only |
| `attachment` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all. A file given by path moves when the rewrite can read it, as for any other file |
| `inline` | `attachments`, with `contentId` | As for `attachment`. `contentId` is the file name the HTML references as `cid:<filename>`, bare, without `cid:` |
| `h:<Header>`, other than `Reply-To` and `X-Mailgun-Variables` | none | Always: no PostHog SDK takes headers yet |
| `v:<name>`, or `h:X-Mailgun-Variables` on a send without a template | none | Always: no PostHog SDK takes tags yet |
| `o:tag` | none | Always: no PostHog SDK takes tags yet |
| `o:tracking`, `o:tracking-opens`, or `o:tracking-clicks` set to `no` or `false` | `captureEngagement: false` | The installed SDK has no `captureEngagement`, or a tracking field is set to anything else, such as `yes` or `htmlonly`. `false` turns off both open and click capture: note it in the plan row |
| An `Idempotency-Key` request header | `idempotencyKey` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. A key built from a value whose length or characters the code doesn't bound, such as a URL or text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site |
| `o:deliverytime`, `o:deliverytime-optimize-period`, `o:time-zone-localize`, `o:deliver-within` | none | Always. PostHog's send doesn't take it yet |
| `recipient-variables` | none | Always. PostHog's send doesn't take it yet |
| `o:testmode` | none | Always. Test mode is not a send |
| `o:dkim`, `o:secondary-dkim`, `o:secondary-dkim-public`, `o:require-tls`, `o:skip-verification` | none | Always. PostHog's send doesn't take it yet |
| `o:sending-ip`, `o:sending-ip-pool`, `o:archive-to`, `o:suppress-headers`, `o:tracking-pixel-location-top`, `o:campaign` | none | Always. PostHog's send doesn't take it yet |

A Mailgun send has no idempotency key, apart from an `Idempotency-Key` header the code passes. A moved site without one sends none either: PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Mailgun call | A site stays on Mailgun when |
|---|---|
| `mg.messages.create`, `mailgun.messages().send`, `client.messages.create`, `send_message` with a hash or a `MessageBuilder`, `$mg->messages()->send`, `mg.Send` with `NewMessage`, `POST /v3/<domain>/messages` | A field above keeps it |
| `/messages.mime`, `client.mimemessage.create`, `send_message` with `message:`, `$mg->messages()->sendMime`, `mailgun.NewMIMEMessage` | Always: a MIME message is built outside the send |
| `Mailgun::BatchMessage`, `$mg->messages()->getBatchMessage`, `AddRecipientAndVariables`, or any send with `recipient-variables` | Always: each sends several emails in one call |
| A send whose `to` is a Mailgun mailing list address | Always: Mailgun sends it to every member |
| SMTP through `smtp.mailgun.org` or `smtp.eu.mailgun.org` | Always. PostHog has no SMTP relay |
| A framework mailer or transport (Laravel, Symfony, Rails, Django, Nodemailer, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Mailgun's SDKs report an error in two ways. The Node.js, Ruby, PHP, and Go SDKs raise or return an error. The Python SDK, and every plain HTTP request, answer a response, and the code reads its status code. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailgun when |
|---|---|
| A `catch` or `rescue` that reads `err.status`, `err.statusCode`, `err.details`, `err.message`, `e.status`, `getResponseCode()`, `getResponseBody()`, or an `UnexpectedResponseError`'s `Actual` or `Data` | It branches on Mailgun's error text. A branch on the HTTP status moves: read PostHog's error name `validation_error` for a `400`, and PostHog's status code for any other status, as the Rewrite section says |
| A check of `response.status_code`, `response.ok`, `raise_for_status()`, `res.status`, `getStatusCode()`, or `StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| The message `id` stored for a webhook handler or an Events API read | Always, when the handler or the read uses it |
| The message `id` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Mailgun template, makes it transactional, and gives you its template ID. Until then the site stays on Mailgun. The check needs the content of the version the site sends, the active one unless the site sets `t:version`, because the code has only the template's name. `account.md` says how to get it.

A version whose `engine` is `go` stays: this file converts Handlebars only.

Mailgun's Handlebars becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| Mailgun | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{user.first_name}}` | `{{ variables.user.first_name }}` |
| `{{#if paid}}…{{else if trial}}…{{else}}…{{/if}}`, when `paid` and `trial` are booleans | `{% if variables.paid %}…{% elsif variables.trial %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{this.name}}{{/each}}` or `{{#each items}}{{name}}{{/each}}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{this}}` inside `{{#each items}}` | `{{ item }}` |
| `{{#with author}}{{first_name}}{{/with}}`, when the site always sends `author` as an object with values | `{{ variables.author.first_name }}`, for each name inside the block |
| `{{#equal plan "pro"}}…{{/equal}}` | `{% if variables.plan == 'pro' %}…{% endif %}` |
| The version's `Subject` header, or the send's `subject` | The PostHog template's subject, with the same conversions |

- Handlebars `{{name}}` escapes HTML, and so does PostHog's Liquid, so plain values render the same.
- Handlebars treats `0`, an empty string, and an empty list as false, and Liquid treats them as true. Read what the site sends for each `if` and `unless` value. A value that is not always a boolean, `null`, or missing keeps the template on Mailgun.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on Mailgun.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`.
- Handlebars skips a `{{#with}}` block when its value is missing or empty, and the Liquid above doesn't. A `with` whose value can be missing or empty, or that has an `{{else}}`, keeps the template on Mailgun.
- `{{{name}}}` inserts HTML as it is. PostHog's Liquid escapes it, so a template that uses triple braces stays on Mailgun.
- `equal` compares both sides as strings. When the code passes the value as a number or a boolean, compare with it unquoted in Liquid, such as `== 5`.
- Any other helper, `{{@index}}`, a partial, a block inside `{{#each}}` that reads a value outside the loop with `../`, and `%recipient.<name>%` or an unsubscribe variable keep the template on Mailgun.
- The site's values become `templateData`: the object of `t:variables`, else of `h:X-Mailgun-Variables`, else the `v:` values by name. Parse a JSON string into its object. A site that sets `v:` values next to `t:variables` stays when a webhook handler reads them back, as in "Webhooks".
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from`, `h:Reply-To`, or `subject` next to `template` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc`, `bcc`, `attachment`, `inline`, or an `o:` option, such as `o:tracking`, `o:tracking-opens`, or `o:tracking-clicks`, next to `template` stays: a template made in PostHog sends with its own settings, and the template form takes none of them.

## Webhooks

Mailgun's webhooks stop getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Mailgun event | PostHog event |
|---|---|
| `accepted` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `permanent_fail` (`failed` with `severity: permanent`), for a bounce | `$workflows_email_bounced` |
| `permanent_fail` for an address on a suppression list | none. PostHog refuses the send instead, with `recipient_suppressed` |
| `complained` | `$workflows_email_blocked` |
| `opened` | `$workflows_email_opened` |
| `clicked` | `$workflows_email_link_clicked` |
| `temporary_fail`, `unsubscribed` | none |

PostHog's events carry no Mailgun message id, no `user-variables`, and no Mailgun tags. A site whose events a handler matches by `message.headers["message-id"]`, by a `v:` or `X-Mailgun-Variables` value, or by an `o:tag` stays on Mailgun. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'mailgun'` on the client that Step 7 configures, when its client options take it.

**The call.** The Mailgun send becomes one PostHog send. Build its fields from the message the site built:

- Node.js `mg.messages.create(domain, data)` and `mailgun.messages().send(data, callback)`: the fields of `data`.
- Python `client.messages.create(domain=, data=, files=)`, or a `requests` or `httpx` post: the fields of `data`, and the files of `files`.
- Ruby `send_message(domain, params)`: the fields of `params`, or the fields a `MessageBuilder` set.
- PHP `$mg->messages()->send($domain, $params)`: the fields of `$params`.
- Go `NewMessage(...)` and its setters: `from`, `subject`, `text`, `to`, and each field a setter sets.
- A plain HTTP request in another language, such as .NET: the fields of its form body.

Drop the domain argument and the Mailgun client of the call.

**The fields.**

- `from` stays as it is. When the code built it from a name and an address, such as with a builder setter that takes both, write `'Name <address>'`, with the name in double quotes when it holds a comma, a quote, or another special character, such as `'"Acme, Inc." <hello@mail.example.com>'`.
- `to`, `cc`, and `bcc` become bare addresses. A list with one entry in `to` becomes that entry. A comma-separated string becomes a list. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `h:Reply-To` becomes `replyTo`.
- An attachment becomes `{ filename, content, contentType }`: Node.js `{ data, filename, contentType }`, Python `("attachment", (filename, content))`, and Go `AddBufferAttachment(filename, content)`. Mailgun takes the raw file, so `content` is the same bytes in every language, and Go and Elixir need no decoding. Content that is a path or a stream is read into its bytes first. Content that is a string of the file's text becomes its bytes, such as `Buffer.from(text)` in Node.js or `text.encode()` in Python: PostHog reads a string as base64. An `inline` file also gets `contentId` set to its file name, bare, such as `logo.png`, so the HTML's `cid:logo.png` still finds it.
- `o:tracking: 'no'`, or both `o:tracking-opens` and `o:tracking-clicks` set to `no`, becomes `captureEngagement: false`.
- A Python `headers={"Idempotency-Key": key}` becomes `idempotency_key=key`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's template values, as "Templates" says. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `mg.messages.create` threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { status: error.statusCode, details: error.message, name: error.name })`. `err.status` keeps holding the HTTP status, and `err.details` the text. A check of `err.status === 400` becomes a check of `err.name === 'validation_error'`, as Step 7 says. A `catch` that branches on another status, such as 429, keeps its branch on `err.status` and throws every other error again, as before. For `mailgun-js`, call the callback with `Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name })` as its error, with the same change to a check of `400`, or `null` and `data` on success.
- **Python.** The code read the response's status. PostHog's SDK raises `EmailError` instead. Wrap the send in `try`, move the branch for a failed status into `except EmailError as e`, and keep each branch on one status: a branch on `400` checks `e.name == "validation_error"`, and a branch on another status, such as 429, checks `e.status_code`. Each raises every other error again. `raise_for_status()` raised `HTTPError` for every failed status, so an `except HTTPError` becomes `except EmailError`. `mailgun.ApiError`, `MailgunTimeoutError`, and `requests.ConnectionError` or `Timeout` are network errors only: a catch of one becomes `except EmailError as e` that checks `e.code == "network_error"` and raises every other error again. `requests.RequestException` covers both, and becomes `except EmailError`.
- **Ruby.** `Mailgun::CommunicationError` covers every failed status and network error, so `rescue Mailgun::CommunicationError` becomes `rescue PostHog::EmailError`, and `e.status` becomes `e.status_code`. A rescue of one subclass becomes `rescue PostHog::EmailError => e` that checks for the same kind of error and raises every other error again with `raise`: `Mailgun::BadRequest` checks `e.name == 'validation_error'`, and `Mailgun::Unauthorized` checks `e.status_code == 401`. A branch on `e.status == 400` becomes a check of `e.name == 'validation_error'`.
- **PHP.** `HttpClientException` is a 4xx answer and `HttpServerException` a 5xx answer, and neither is a network error. Each becomes `catch (\PostHog\EmailError $e)` that keeps only its own errors and throws every other one again: a 4xx catch checks `$e->getErrorName() === 'validation_error' || ($e->getStatusCode() >= 400 && $e->getStatusCode() < 500)`, a 5xx catch checks `$e->getStatusCode() >= 500`, and a catch of both checks `$e->getErrorCode() !== 'network_error'`. A branch on `getResponseCode() === 400` checks `$e->getErrorName() === 'validation_error'`, and a branch on another status, such as 429, checks `getStatusCode()`. A read of `getResponseBody()['message']` becomes `getMessage()`. A client with `NoopHydrator` read `getStatusCode()` on the response: wrap the send in `try` and move that branch into the `catch`, as above.
- **Go.** `var e *mailgun.UnexpectedResponseError` read with `errors.As(err, &e)` becomes `var e *posthog.EmailError`, and `e.Actual` becomes `e.StatusCode`. PostHog answers a network error as a `*posthog.EmailError` too, with `e.Code == "network_error"`, where Mailgun's network error matched no `UnexpectedResponseError`: the branch also checks `e.Code != "network_error"`, and every other error takes the path it took before. A branch on `e.Actual == 400` checks `e.Name == "validation_error"`, and a branch on another status reads `e.StatusCode`. A check for `*mailgun.RateLimitedError` checks `e.StatusCode == 429`, and every other error takes the path it took before. A site that only checked `err != nil` keeps that check. `resp.ID`, or the `id` that `/v4` answered, becomes `result.ID`.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailgun took it and dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged the Mailgun `id`, or stored it for the app's own use, takes PostHog's message id instead.

**The Mailgun client.** Keep the Mailgun client, its import, and its `FormData` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package, `form-data`, and the key: the person removes them after the cutover.

Some packages a Mailgun send needs also serve other code. Name them in the report as kept for other uses, unless nothing else imports them:

- `form-data` is a general form library, such as for file uploads with `axios` or `got`.
- In Ruby, `mailgun-ruby` also carries the ActionMailer delivery method `:mailgun`. It stays while `config.action_mailer.delivery_method` is `:mailgun`.
- In PHP, the PSR-18 client and PSR-7 packages installed for `mailgun/mailgun-php`, such as `symfony/http-client`, `guzzlehttp/guzzle`, or `nyholm/psr7`, are general HTTP libraries.
- A plain HTTP send used the app's HTTP client, such as `requests`, `httpx`, `axios`, or `net/http`. It is not a Mailgun package: keep it.
