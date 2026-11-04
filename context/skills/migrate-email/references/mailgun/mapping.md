# Mailgun to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailgun call site. A site moves only when every field it sets moves. Otherwise it stays on Mailgun, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

## Fields

Mailgun fields are written in their HTTP names. The SDK setters in `sdk-reference.md` set the same fields, such as Go's `AddCC` for `cc` or Ruby's `variable` for `v:`.

| Mailgun | PostHog | A site stays on Mailgun when |
|---|---|---|
| `from` | `from` | Never. `Name <address>` moves as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| The sending domain of the call | none | Never. Step 4 sets up the sender for the domain of `from`. When the two differ, note it in the plan row |
| `to` | `to` | It holds more than one address, as a list or a comma-separated string. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name. A string from one stored address, such as a user's email, holds one address. A string the code joins from several, or takes from input or a mail object that can hold several, counts as several |
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
| Open and click tracking: `o:tracking`, `o:tracking-opens`, `o:tracking-clicks`, or none of them | `captureEngagement: false`, or no field | See "Tracking" below. A field set to `no` or `false`, or a setter such as Go's `SetTrackingClicks(false)`, counts as set: it turns that tracking off for the send, whatever the domain's setting |
| An `Idempotency-Key` request header | `idempotencyKey` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. A key built from a value whose length or characters the code doesn't bound, such as a URL or text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site |
| `o:deliverytime`, `o:deliverytime-optimize-period`, `o:time-zone-localize`, `o:deliver-within` | none | Always. PostHog's send doesn't take it yet |
| `recipient-variables` | none | Always. PostHog's send doesn't take it yet |
| `o:testmode` | none | Always. Test mode is not a send |
| `o:dkim`, `o:secondary-dkim`, `o:secondary-dkim-public`, `o:require-tls`, `o:skip-verification` | none | Always. PostHog's send doesn't take it yet |
| `o:sending-ip`, `o:sending-ip-pool`, `o:archive-to`, `o:suppress-headers`, `o:tracking-pixel-location-top`, `o:campaign` | none | Always. PostHog's send doesn't take it yet |
| Any field this table doesn't name, such as `sender` | none | Always. The reason names the field |

**Tracking.** PostHog captures opens and clicks unless the send sets `captureEngagement: false`, which turns off both. Mailgun tracks each one only when it is on: a send's `o:tracking-opens` or `o:tracking-clicks`, else its `o:tracking`, else the sending domain's setting, which Mailgun turns off for a new domain. A send that sets one of them to `no` or `false` turns that tracking off, even on a domain with tracking on, such as a password reset with `o:tracking-clicks: 'no'`. Work out, for opens and for clicks, whether Mailgun tracked them:

- Both on: the site moves with no `captureEngagement` field.
- Both off: the site moves with `captureEngagement: false`.
- One on and one off, click tracking set to `htmlonly`, or `o:tracking` that disagrees with `o:tracking-opens` or `o:tracking-clicks` on the same send: the site stays.
- The installed SDK has no `captureEngagement`, and Mailgun tracked neither: the site stays.

When a site sets no field for one of them, ask the person once for each sending domain whether its open and click tracking are on, or read them as `account.md` says. When the answer is not given, the site stays, and the reason is `domain tracking not checked`.

A Mailgun send has no idempotency key, apart from an `Idempotency-Key` header the code passes. A moved site without one sends none either: PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Mailgun call | A site stays on Mailgun when |
|---|---|
| `mg.messages.create`, `mailgun.messages().send`, `client.messages.create`, `send_message` with a hash or a `MessageBuilder`, `$mg->messages()->send`, `mg.Send` with `NewMessage`, `POST /v3/<domain>/messages` | A field above keeps it |
| `/messages.mime`, `client.mimemessage.create`, `send_message` with `message:`, `$mg->messages()->sendMime`, `mailgun.NewMIMEMessage` | Always: a MIME message is built outside the send |
| `Mailgun::BatchMessage`, `$mg->messages()->getBatchMessage`, `AddRecipientAndVariables`, or any send with `recipient-variables` | Always: each sends several emails in one call |
| A send whose `to` is a Mailgun mailing list address | Always: Mailgun sends it to every member |
| SMTP through `smtp.mailgun.org` or `smtp.eu.mailgun.org` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A framework mailer or transport (Laravel, Symfony, Rails, Django, Nodemailer, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Domains

Mailgun keeps its suppression lists per sending domain, and a send uses the lists of the domain it sends from. PostHog keeps one suppression list per project. When the sites that move send from more than one Mailgun domain, Step 5 imports the lists of each of them into that one list. PostHog then refuses a moved send to an address that any of those domains suppressed, even when the site's own domain never did. Tell the person so, and ask once whether the moved sites may share one suppression list. When they say no, ask which one domain's sites move. The sites of every other domain stay, and the reason is `domain <name> keeps its own suppression list`.

## Code around the send

Mailgun's SDKs report an error in two ways. The Node.js, Ruby, PHP, and Go SDKs throw, raise, or return an error on a failed status and on a network failure. The Python SDK answers the response on a failed status, and raises only when the request can't be made. A plain HTTP request does what its client does, with the options the code gives the client or the request. An option that turns the throw off, such as axios's `validateStatus` that accepts a failed status or got's `throwHttpErrors: false`, makes the client answer a failed status as a response:

- These throw or raise on a failed status: `axios`, `got`, Ruby's `rest-client`, Guzzle unless `'http_errors' => false`, .NET `HttpClient` followed by `EnsureSuccessStatusCode()`, and RestSharp with `ThrowOnAnyError = true`, or from version 107 with `Post` or `PostAsync`, which throw on any failed status but `404`.
- These answer a failed status as a response: `fetch`, `requests`, `httpx`, Ruby's `Net::HTTP` (unless the code calls `.value`), PHP's `curl_exec`, Guzzle with `'http_errors' => false`, .NET `HttpClient` without `EnsureSuccessStatusCode()`, RestSharp's `Execute`, `ExecuteAsync`, and `ExecutePostAsync`, and every RestSharp call before version 107, and Go's `net/http`.

`posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailgun when |
|---|---|
| A `catch` or `rescue` that reads `err.status`, `err.statusCode`, `err.details`, `err.message`, `e.status`, `getResponseCode()`, `getResponseBody()`, or an `UnexpectedResponseError`'s `Actual` or `Data` | It branches on Mailgun's error text. A branch on the HTTP status moves: read PostHog's error name `validation_error` for a `400`, and PostHog's status code for any other status, as the Rewrite section says |
| A check of `response.status_code`, `response.ok`, `raise_for_status()`, `res.status`, `getStatusCode()`, or `StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| A Ruby client in test mode: `Mailgun.configure` with `test_mode = true`, or `enable_test_mode!` on the client. It keeps the message in `Mailgun::Client.deliveries` and sends nothing | Always, when the app turns it on outside its tests, such as from an env setting. When only the tests turn it on, the site moves: note in the report each place that turns it on and each test that reads `Mailgun::Client.deliveries`, since those tests now need the PostHog send stubbed |
| The message `id` stored for a webhook handler or an Events API read | Always, when the handler or the read uses it |
| The message `id` logged or stored for the app's own use | Never. Use PostHog's message id |
| A read of the answer's headers, such as a rate-limit header | Always: PostHog's answer holds its message id, as `posthog-sdks.md` says, not Mailgun's headers |

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
- Inside `{{#each}}`, a bare name reads the current item, as `this.<name>` does, and so does a helper's argument, such as `paid` in `{{#if paid}}` or `lines` in `{{#each lines}}`. It becomes `item.<name>`, never `variables.<name>`: `{{name}}` becomes `{{ item.name }}`, and `{{#if paid}}` becomes `{% if item.paid %}`. Each nested `each` gets its own loop name, such as `line` for `lines`, and reads its own item by that name. The truthiness and list rules above apply to the item's values too.
- Handlebars skips a `{{#with}}` block when its value is missing or empty, and the Liquid above doesn't. A `with` whose value can be missing or empty, or that has an `{{else}}`, keeps the template on Mailgun.
- `{{{name}}}` inserts HTML as it is. PostHog's Liquid escapes it, so a template that uses triple braces stays on Mailgun.
- `equal` compares both sides as strings. When the code passes the value as a number or a boolean, compare with it unquoted in Liquid, such as `== 5`.
- Any other helper, `{{@index}}`, a partial, a block inside `{{#each}}` that reads a value outside the loop with `../`, and `%recipient.<name>%` or an unsubscribe variable keep the template on Mailgun.
- The site's values become `templateData`: the object of `t:variables`, else of `h:X-Mailgun-Variables`, else the `v:` values by name. Parse a JSON string into its object. A site that sets `v:` values next to `t:variables` stays when a webhook handler reads them back, as in "Webhooks".
- The PostHog template carries its own sender, reply-to address, and subject. Tell the person to put the version's `From`, `Reply-To`, and `Subject` headers into it, for each one the site doesn't set. A site that sets `from`, `h:Reply-To`, or `subject` next to `template` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc`, `bcc`, `attachment`, `inline`, or an `o:` option, such as `o:tracking`, `o:tracking-opens`, or `o:tracking-clicks`, next to `template` stays: a template made in PostHog sends with its own settings, and the template form takes none of them. So does a template site whose sending domain has open or click tracking off, as "Tracking" says: the template form takes no `captureEngagement`.

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
- Tracking becomes `captureEngagement: false` when Mailgun tracked neither opens nor clicks, as "Tracking" says, whether the send turned them off or the domain did. Drop the tracking fields. When both were on, drop them and set nothing. Note in the plan row each site that got `captureEngagement: false` from the domain's setting.
- A Python `headers={"Idempotency-Key": key}` becomes `idempotency_key=key`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's template values, as "Templates" says. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `mg.messages.create` threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { status: error.statusCode, details: error.message, name: error.name, code: error.code })`. `err.status` keeps holding the HTTP status, and `err.details` the text. A network failure has no status: `err.code` is `network_error` then. A check of `err.status === 400` becomes a check of `err.name === 'validation_error'`, as Step 7 says. A `catch` that branches on another status, such as 429, keeps its branch on `err.status` and throws every other error again, as before. A branch on 429 also checks `err.code !== 'quota_limited'`, as Step 7 says. For `mailgun-js`, call the callback with `Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name, code: error.code })` as its error, with the same change to a check of `400`, or `null` and `data` on success.
- **Python.** The code read the response's status. PostHog's SDK raises `EmailError` instead. Wrap the send in `try`, move the branch for a failed status into `except EmailError as e`, and raise it again first when `e.code == "network_error"`: Mailgun's SDK and `requests` raised a network failure past the status check. Keep each branch on one status: a branch on `400` checks `e.name == "validation_error"`, and a branch on another status, such as 429, checks `e.status_code`. Each raises every other error again. `raise_for_status()` raised `HTTPError` for every failed status, and a network failure raised `ConnectionError` or `Timeout` past it. So an `except HTTPError` becomes `except EmailError as e` that raises it again first when `e.code == "network_error"`. `mailgun.ApiError`, `MailgunTimeoutError`, and `requests.ConnectionError` or `Timeout` are network errors only: a catch of one becomes `except EmailError as e` that checks `e.code == "network_error"` and raises every other error again. `requests.RequestException` covers both, and becomes `except EmailError`.
- **Ruby.** `Mailgun::CommunicationError` covers every failed status and network error, so `rescue Mailgun::CommunicationError` becomes `rescue PostHog::EmailError`, and `e.status` becomes `e.status_code`. A rescue of one subclass becomes `rescue PostHog::EmailError => e` that checks for the same kind of error and raises every other error again with `raise`: `Mailgun::BadRequest` checks `e.name == 'validation_error'`, and `Mailgun::Unauthorized` checks `e.status_code == 401`. A branch on `e.status == 400` becomes a check of `e.name == 'validation_error'`.
- **PHP.** `HttpClientException` is a 4xx answer and `HttpServerException` a 5xx answer, and neither is a network error. Each becomes `catch (\PostHog\EmailError $e)` that keeps only its own errors and throws every other one again: a 4xx catch checks `$e->getErrorName() === 'validation_error' || ($e->getStatusCode() >= 400 && $e->getStatusCode() < 500)`, a 5xx catch checks `$e->getStatusCode() >= 500`, and a catch of both checks `$e->getErrorCode() !== 'network_error'`. A branch on `getResponseCode() === 400` checks `$e->getErrorName() === 'validation_error'`, and a branch on another status, such as 429, checks `getStatusCode()`. A read of `getResponseBody()['message']` becomes `getMessage()`. A client with `NoopHydrator` read `getStatusCode()` on the response: wrap the send in `try` and move that branch into the `catch`, as above.
- **Go.** `var e *mailgun.UnexpectedResponseError` read with `errors.As(err, &e)` becomes `var e *posthog.EmailError`, and `e.Actual` becomes `e.StatusCode`. PostHog answers a network error as a `*posthog.EmailError` too, with `e.Code == "network_error"`, where Mailgun's network error matched no `UnexpectedResponseError`: the branch also checks `e.Code != "network_error"`, and every other error takes the path it took before. A branch on `e.Actual == 400` checks `e.Name == "validation_error"`, and a branch on another status reads `e.StatusCode`. A check for `*mailgun.RateLimitedError` checks `e.StatusCode == 429`, and every other error takes the path it took before. A site that only checked `err != nil` keeps that check. `resp.ID`, or the `id` that `/v4` answered, becomes `result.ID`.
- **A status check, in any language.** A check of a response's status, such as `!res.ok` after `fetch`, `getStatusCode()` with `NoopHydrator`, or `resp.StatusCode` after Go's `http.Post`, never saw a network failure: the request threw, raised, or returned it first. Move the branch into the handling of PostHog's error, and before it, throw, raise, or return a `network_error` the way the request did. RestSharp's `Execute` calls and PHP's `curl_exec` answer a network failure as a response too, with status `0` or `false`: a branch that took every failure there takes a `network_error` too.
- **A plain HTTP request whose client throws on a failed status**, as "Code around the send" lists. It failed on every API error and every network failure, as Mailgun's Node.js SDK does. Keep that: every PostHog error fails the site. In Node.js, throw from `error` as the Node.js bullet says. In Python, Ruby, PHP, and .NET, PostHog's SDK raises on its own. A catch of the client's error, such as `RestClient::ExceptionWithResponse`, Guzzle's `RequestException`, or .NET's `HttpRequestException`, becomes a catch of PostHog's error. A read of the client's status in that catch, such as axios's `err.response.status`, got's `err.response.statusCode`, `rest-client`'s `e.http_code`, Guzzle's `$e->getResponse()->getStatusCode()`, or `HttpRequestException.StatusCode`, reads PostHog's status code, and a branch on `400` reads PostHog's error name `validation_error`. Never log the error and go on here.
- **A send whose status the code never read**, on Mailgun's Python SDK or a plain HTTP request whose client answers a failed status as a response, as "Code around the send" lists. The site let every API error pass, and failed only where the request threw, raised, or returned a network failure. Keep both: handle PostHog's error, throw, raise, or return it when its code is `network_error`, and otherwise log it and go on. RestSharp's `Execute` calls and PHP's `curl_exec` answer a network failure without throwing too, so a site on one of them logs a `network_error` and goes on as well. In Node.js, that is a check of `error`; in Python, Ruby, PHP, and .NET, a catch of PostHog's error; in Go, a check of `err` with `errors.As`. Note each such site in the report.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailgun took it and dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged the Mailgun `id`, or stored it for the app's own use, takes PostHog's message id instead.

**Suppression writes.** A call that adds to or removes from a domain's bounce or complaint list, `POST` or `DELETE` on `/v3/<domain>/bounces` or `/v3/<domain>/complaints`, or the SDK's call for it, such as `mg.suppressions.create(domain, 'bounces', ...)` in Node.js, changes a list the import takes: Step 5 says what the report asks for it. A call on `/v3/<domain>/unsubscribes` changes a list the import leaves out, and stays a Mailgun write only.

**The Mailgun client.** Keep the Mailgun client, its import, and its `FormData` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package, `form-data`, and the key: the person removes them after the cutover.

Some packages a Mailgun send needs also serve other code. Name them in the report as kept for other uses, unless nothing else imports them:

- `form-data` is a general form library, such as for file uploads with `axios` or `got`.
- In Ruby, `mailgun-ruby` also carries the ActionMailer delivery method `:mailgun`. It stays while `config.action_mailer.delivery_method` is `:mailgun`.
- In PHP, the PSR-18 client and PSR-7 packages installed for `mailgun/mailgun-php`, such as `symfony/http-client`, `guzzlehttp/guzzle`, or `nyholm/psr7`, are general HTTP libraries.
- A plain HTTP send used the app's HTTP client, such as `requests`, `httpx`, `axios`, or `net/http`. It is not a Mailgun package: keep it.
