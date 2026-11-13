# Brevo to PostHog mapping

This file decides, field by field, whether PostHog can send a Brevo call site. A site moves only when every field it sets moves. Otherwise it stays on Brevo, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python. Brevo fields are written in their HTTP names, such as `htmlContent`: `sdk-reference.md` gives them in each SDK.

## Fields

| Brevo | PostHog | A site stays on Brevo when |
|---|---|---|
| `sender` `{ email, name }` | `from` | Never. It becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `sender` `{ id }` | none | Always: the code names a sender saved in Brevo, not an address |
| `sender` with a `name` and no `email` or `id` | none | Always: the address comes from Brevo, not the code |
| `to` | `to` | It holds more than one entry. A list with one entry moves as that entry's address: note in the plan row when the entry carries a name, because the To line loses it |
| `subject` | `subject` | Never |
| `htmlContent`, `textContent` | `html`, `text` | Never, when the content holds no `{{` or `{%`. Content the code doesn't hold in full, such as content read from a database, a file, a CMS, or a caller, counts as content that can hold them. With `params`, see the next row. Without `params`, content that holds them or can hold them moves only as "Templates" says |
| `params` on a send with its own `htmlContent` or `textContent` | none: the code renders the content and the `subject` with `params` before the send | A part of the content keeps it, as "Templates" says. Brevo filled its template language, such as `{{ params.NAME }}`, into the send's own content. The code renders it with the same rules, and sends the result |
| `templateId` with `params` | the template's email, brought into the code and rendered with `params`, sent as `subject` and `html`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `cc`, `bcc` | none | Always. PostHog's send doesn't take it yet |
| `replyTo` | `replyTo` | It carries a `name` |
| `contactPixelTrackingConsent`, set to `true` or `false`, or `removeTrackingPixel: true`, on a `to`, `cc`, or `bcc` entry | none | Always, `false` included: with per-contact tracking consent on, `false` makes Brevo count the recipient's opens and clicks without tying them to the recipient, and `removeTrackingPixel: true` sends the email with no open pixel. PostHog adds its open pixel to every email, and its send takes no tracking setting per recipient |
| Open and click tracking, which the send leaves to the account | none: PostHog adds its open pixel, and counts clicks only as "Tracking" says | Brevo tied its opens to no recipient or tracked them by consent, or nobody can tell, or its opens were untracked and the person didn't agree to PostHog's open pixel. See "Tracking" below |
| `attachment`, with `content` or `url` | none | Always. PostHog's send doesn't take it yet |
| `headers` with `idempotencyKey` (or `IdempotencyKey`) only | `idempotencyKey` | The key can hold anything but visible ASCII characters, such as a space, or be longer than 255 characters. PostHog takes 1 to 255 visible ASCII characters. A key built from a value whose length or characters the code doesn't bound, such as a URL or text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site. Brevo keeps a key for 15 minutes, and PostHog keeps it for 24 hours. A key the code can send again for another email within 24 hours, such as one built only from a user id and the email's kind, keeps the site too: PostHog would send no new email for it, or refuse it with `idempotency_key_reused` |
| `headers`, any other header | none | Always: no PostHog SDK takes headers yet |
| `tags` | none | Always: no PostHog SDK takes tags yet |
| `scheduledAt` | none | Always. PostHog's send doesn't take it yet |
| `batchId` | none | Always. PostHog's send doesn't take it yet |
| `messageVersions` | none | Always: it sends several emails in one call |

A Brevo send without an idempotency key moves without one.

**Tracking.** PostHog adds its open pixel to every email it sends, to count opens. It counts clicks only for a template made in PostHog that is not marked sensitive: a send in the code form counts none, as Step 7 says. No field changes this: `captureEngagement` decides only whether the email's events land on the recipient's person, so tracking never maps to it. Brevo tracks a transactional send's opens and clicks per recipient, unless an account setting changes that. Ask the person for those settings once, as `account.md` says under "Tracking settings", and work out what Brevo did for a send that sets no `contactPixelTrackingConsent` or `removeTrackingPixel`:

- Anonymous tracking on: the site stays, and the reason is `account tracking anonymized`. Brevo counted opens without tying them to a recipient, and PostHog ties a moved send's opens to the person it names.
- Per-contact tracking consent on: the site stays, and the reason is `per-contact tracking consent on`. Brevo tracked a recipient's opens only as their consent said, and PostHog adds its open pixel to every email.
- The person can't say whether anonymous tracking or per-contact tracking consent is on: the site stays, and the reason is `account tracking not checked`.
- These three keep the site even when Brevo's open tracking was off: each setting limits, or might limit, how the account's tracking is tied to a recipient. A yes to PostHog's open pixel doesn't cover that, since PostHog ties a moved send's opens to the person it names.
- Otherwise, opens follow Step 3 under "Opens the provider didn't track". Brevo turned off open tracking for the account: its emails had no open pixel, so the site moves only when the person agrees to PostHog's, and otherwise stays with the reason `open tracking off`. The person can't say whether Brevo turned it off: the site stays, and the reason is `open tracking not checked`. Open tracking on: Brevo tracked opens per recipient, and the site moves.
- For a site that moves, when Brevo tracked its clicks too, note in the plan row whether PostHog counts them, as above. When it didn't, or nobody knows, a site that moves to a template made in PostHog follows Step 3 under "A template in PostHog".

## Calls

| Brevo call | A site stays on Brevo when |
|---|---|
| `transactionalEmails.sendTransacEmail`, `TransactionalEmailsApi.sendTransacEmail`, `send_transac_email`, `SendTransacEmail`, `SendTransacEmailAsync`, `POST /v3/smtp/email` | A field above keeps it |
| A send with `messageVersions`, or with more than one entry in `to` | Always |
| A loop that sends one email per address | Never for the call itself: each call is one send. Keep the loop |
| SMTP through `smtp-relay.brevo.com` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A framework mailer (Django Anymail, Symfony Mailer, Swoosh), or a delivery method the app registers with Rails ActionMailer that sends through Brevo | Always. PostHog has no mailer driver |
| .NET `SendTransacEmail`, the sync send | As the .NET rewrite file says under "The send" for a synchronous send |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Code around the send

Every Brevo SDK reports an API error by throwing, except Go, which answers an error value. `sdk-reference.md` names each SDK's error and its fields. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Brevo when |
|---|---|
| A `catch`, `except`, or `rescue` that reads the error's status, such as `err.statusCode`, `e.status_code`, `e.status`, `getCode()`, `code`, or `ErrorCode` | Never. A check of `400` or `422` reads PostHog's error name `validation_error`, and a check of any other status reads PostHog's status code |
| A branch on a Brevo error class, such as `Brevo.TooManyRequestsError` or `Brevo.BadRequestError` | Never. `BadRequestError` (400) and `UnprocessableEntityError` (422) become a branch on PostHog's error name `validation_error`. The others become a branch on PostHog's status code: `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `TooManyRequestsError` 429. A check of the base error, `BrevoError` or `HttpError`, follows the Node.js bullet under "Errors" in the Rewrite section |
| A branch on `BrevoTimeoutError`, a branch on `BrevoError` from `@getbrevo/brevo` 4.x or 5.x that goes on after the error instead of throwing it again, or a Ruby branch on `Brevo::ApiError` that tests for `code` `0` alone or for no `code` alone | Always: each tells one kind of network failure from another, so the site stays, `catches one kind of network failure`, as Step 7 says. In 4.x and 5.x `BrevoTimeoutError` is not a `BrevoError`, so a `BrevoError` branch took every network failure but a timeout. Ruby's `code` `0` is a connection failure, and no `code` a timeout |
| A Python `except` on the legacy `ApiException` of `brevo-python` 1.x or `sib-api-v3-sdk`, or a PHP `catch` on the `ApiException` of 1.x, 2.x, or `sendinblue/api-v3-sdk` with Guzzle 7, where an error with status `0` took another path than the other network failures, which went past every handler on the `try`, such as a handler that logs and returns on some statuses it doesn't name, or one that branches on `status == 0` | Always: the handler tells one kind of network failure from another, so the site stays, `catches one kind of network failure`, as Step 7 says. These SDKs raised a TLS failure, and with Guzzle 7 some other failures, as `ApiException` with status `0`, and every other network failure past it |
| A send the code can cancel, such as a request with a `signal` a caller passes in or an `AbortController` it aborts, on a `fetch` or axios request or as `abortSignal` in the request options of `@getbrevo/brevo` 4.x and later, or a Go `context` or .NET cancellation token that a caller can cancel | Unless the PostHog send in that language takes the same cancellation, as Go's `Send(ctx, ...)` and .NET's `SendAsync(..., cancellationToken)` do: pass it there. Otherwise always, as in Node.js, whose send takes no signal: an email the old code cancelled would go out. A fixed deadline, such as `AbortSignal.timeout(...)`, moves as "HTTP" under "Rewrite" says |
| A read of the response headers on Brevo's error, such as `Retry-After` from `err.rawResponse.headers` in `@getbrevo/brevo` 6.x, `err.response.headers` in 1.x to 3.x, `e.headers` in Python, `getResponseHeaders()` in PHP, or `response_headers` in Ruby | Always: PostHog's error carries no headers, so the site stays, and the reason is `reads the headers of a Brevo error` |
| A send the code starts without waiting for it: `async_req=True` on a `brevo-python` 1.x or `sib-api-v3-sdk` send, whose thread it reads with `.get()`, or PHP's `sendTransacEmailAsync`, whose promise it reads with `wait()` or `then()` | Always: PostHog's send in Python and PHP answers only when the send is done, so the site stays, and the reason is `sends without waiting for the answer` |
| A retry or a wait on `429` or `TooManyRequestsError` | Never, unless it reads the error's headers, as the row above says. Keep it. It now runs when PostHog's error has the status code `429` and a code other than `quota_limited`: PostHog answers a used-up quota with `429` and `quota_limited`, and no retry clears it. PostHog's SDK already retries a rate limit twice inside each send: note that in the plan row |
| A branch on Brevo's error `code` or `message` text, such as `invalid_parameter` | Always |
| A check of an HTTP status, such as `res.ok`, `res.status`, or Go's `resp.StatusCode` | Never. Read PostHog's error instead, as the Rewrite section says |
| The `messageId` stored for a webhook or a status read | Always, when a webhook handler or a status read uses it |
| The `messageId` logged or stored for the app's own use | Never for a log line. Use PostHog's message id. A suppressed send has none: when the code after the send uses the id for more than a log line, such as returning it to its callers or storing it, the site stays, and the reason is `uses the message id of a suppressed send`, unless its callers already handle a send without an id |

## Templates

A template site moves by bringing the template into the code, as `template-to-code.md` says. The check needs the template's content, because the code has only its id. `account.md` says how to get it. The code renders the template's HTML and subject with the site's `params`, and the send sets the rendered `subject` and `html`.

A send with its own `htmlContent` or `textContent` and `params` moves the same way: the code renders that content with `params` under the table below, and sends the result. The docs don't say whether Brevo rendered such a send's `subject`. A subject without `{{` or `{%` is the same either way. A subject with them moves only when the person confirms, from an email the site sent, that the subject showed the values. Otherwise the site stays, and the reason is `subject rendering not checked`.

A send with its own content and no `params` whose `htmlContent`, `textContent`, or `subject` holds `{{` or `{%`, such as `{{ contact.FIRSTNAME }}` or `{{ unsubscribe }}`, or can hold them because the code doesn't hold it in full, is one the docs don't cover: Brevo may have filled it in or sent it as written. It moves only when the person confirms, from an email the site sent, which one Brevo did. When Brevo filled it in, the code renders it under the table below with no values, and every placeholder rule holds: for content the code doesn't hold in full, the person also confirms which placeholders it can hold, and each must pass. When Brevo sent it as written, it moves as it is. Otherwise the site stays, and the reason is `content rendering not checked`.

Brevo's template language works like Django's templates. In the code:

| Brevo | In the code |
|---|---|
| `{{ params.name }}` | The value, escaped. A missing value and `null` render as nothing. A string renders as it is. A number renders as the app's JSON encoder wrote it into `params`, such as `40` or `40.5`: the docs don't say how Brevo writes one, so note it in the plan row. A boolean, a list, or an object written out keeps the template: the docs don't say how Brevo writes them |
| `{{ params.user.first_name }}`, `{{ params.items.0.name }}` | The nested value, or the list entry at that position from 0, escaped. A missing step of the path renders as nothing |
| `{{ params.name\|safe }}`, and every value inside `{% autoescape off %}…{% endautoescape %}` | The value as it is, unescaped, under the rule of `template-to-code.md` |
| `{{ params.name\|escape }}` | The value, escaped once |
| `{{ params.name\|default:"there" }}` | The value, escaped, or `there` when Brevo's truth test below finds the value false: missing, `null`, `""`, `0`, `false`, an empty list, or an empty object |
| `{{ params.name\|default_if_none:"there" }}` | The value, escaped, or `there` only when it is missing or `null`. `""` stays `""` |
| `\|upper`, `\|lower` | The value as text, in upper or lower case, letter by letter in Unicode |
| `\|capfirst` | The value as text, with its first character in upper case and the rest as it is |
| `\|title` | Each word with its first letter in upper case and the rest in lower case, where a word is a run of letters and digits. A value that can hold an apostrophe or a word that starts with a digit keeps the template: the docs don't say how Brevo writes those |
| `\|truncatechars:N` | The value as text when it has at most N characters. Otherwise its first N-1 characters followed by `…`, so the result has N characters |
| `\|floatformat:N` | The number with N decimals when N is above 0. With `0`, a negative N, or no N: a whole number with no decimals, and any other number with as many decimals as N without its sign, or 1 with no N. The docs say it takes numbers only, so a value that is not always a number keeps the template. They don't say how a value exactly halfway rounds: when the code can pass one, such as `2.5`, note it in the plan row |
| `\|integer`, `\|float` | The number, or a string of a number, cut to a whole number toward 0, or written with six decimals, such as `10.000000` |
| `\|lang_format:"en,%.2f"`, `\|lang_format:"fr,%.2f"` | The number with that many decimals, with `,` between thousands and `.` before the decimals for `en`, and a non-breaking space (U+00A0) between thousands and `,` before the decimals for `fr`. Write the separators yourself, not with the language's locale formatting, which can use other spaces. Without the `%.Nf` part, or with another language, it keeps the template: the docs show examples only, not how many decimals it keeps or how other languages group digits |
| `\|length` | The number of characters in a string, of entries in a list or an object, and `0` for anything else |
| `\|first`, `\|last` | The first or last entry of a list, or the first or last character of a string. On an object, it keeps the template |
| `\|join:", "` on a list of strings | The strings joined with the separator, escaped as a whole. Without a separator, or on a list that holds anything but strings, it keeps the template |
| `\|base64_encode`, with `std`, `raw_std`, `url`, or `raw_url` | The value's UTF-8 bytes in base64: standard, standard without `=` padding, URL-safe with `-` and `_`, or URL-safe without padding. With no option, standard |
| `\|time_parse:"…"`, `\|time_parse_rfc3339` | The string read as a time, with the layout written as Go writes its reference time `Monday January 2 15:04:05 -0700 MST 2006`, English names, and UTC when the string names no zone. Parts the layout leaves out are 0 |
| `\|date:"…"` on a parsed time | The time written with the same kind of layout, in English, with the language's date formatting. The tokens are `2006` `06` `January` `Jan` `01` `1` `02` `2` `_2` `Monday` `Mon` `15` `03` `3` `04` `4` `05` `5` `PM` `pm` `-0700` `-07:00` `MST`. Any other token keeps the template |
| `\|date_i18n:"de,…"` | As `date`, with day and month names in `en`, `fr`, `it`, `es`, `de`, or `pt`. It moves only with full names (`Monday`, `January`), written as that language's own names, such as `Freitag`. Abbreviated names keep the template: the docs don't say which Brevo writes |
| `\|time_in_location:"Europe/Berlin"`, `\|time_add_date:"1,2,3"`, `\|time_add_duration:"1h2m3s"`, `\|time_unix` | The time in that IANA zone; plus years, months, and days, where a day past the month's end rolls over into the next month, such as January 31 plus one month being March 3, or March 2 in a leap year; plus hours, minutes, and seconds; and the Unix time in seconds |
| `{{ time_now }}` with `date` | The send time, in the time zone set in the Brevo account, or UTC when none is set: ask the person for it once. A time written without `date` keeps the template |
| `{% if a %}…{% elif b %}…{% else %}…{% endif %}` | A branch that tests each value for Brevo's truth, in order |
| `not`, `and`, `or`, and parentheses in a condition | The same test written out: `not` binds tightest, then `and`, then `or`, and parentheses group as written |
| `==`, `!=` | Two numbers equal by value, so `3` equals `3.0`. Any other two values equal only when they have the same type and value, so `"3"` doesn't equal `3`, and a string compares with its case. Brevo's docs warn that a test on a number with decimals may not give the right result: a `==` or `!=` on a value that can be one keeps the template |
| `>`, `<`, `>=`, `<=` | A comparison of numbers, after turning a string of a number, such as `"10"`, into that number. A side that can be anything else keeps the template: the docs don't say how Brevo compares it |
| `"x" in params.name` | Whether the string holds `x`, or the list holds an entry equal to `x` as `==` says. On an object, it keeps the template |
| `{% for item in params.items %}…{% endfor %}`, with `reversed` or `limit:N` | A loop over the list, in order, backwards, or over its first N entries. Inside it, `item` is the entry, and `params.name` still reads the send's value. A `for` over a value that can be anything but a list, `null`, or missing keeps the template: the docs describe lists only |
| `{% else %}` or `{% empty %}` before `{% endfor %}` | What shows when the list is empty, missing, or `null` |
| `forloop.Counter`, `forloop.Counter0`, `forloop.Revcounter`, `forloop.Revcounter0`, `forloop.First`, `forloop.Last`, `forloop.Parentloop` | The entry's position from 1 or from 0, how many entries are left counting this one or not, whether it is the first or the last, and the same values for the loop around this one. With `limit`, `Revcounter`, `Revcounter0`, and `Last` keep the template: the docs don't say whether they count the whole list |
| `{% comment %}…{% endcomment %}`, `{% verbatim %}…{% endverbatim %}` | Nothing, and the text between the tags as it is |
| `{% set x = … %}`, `{% with x = … %}…{% endwith %}` | A local value with that name, from the same expression |
| `{{ contact.ATTRIBUTE }}` | The value the app keeps for that attribute, only as the bullet below says. Otherwise it keeps the template |
| The template's `subject` | The send's `subject`, rendered with the same rules and no escaping |
| The template's `sender` | The send's `from`, as `'Name <email>'`, as the "Fields" table says for `sender` |
| The template's `replyTo` | The send's `replyTo` |
| The template's `toField` | Nothing: PostHog's `to` takes one address, and the To line loses the name the field set. Note it in the plan row |

Write the `\|` above as a plain `|`. The table escapes it.

- Brevo's truth: `false`, a missing value, `null`, `""`, `0`, `0.0`, an empty list, and an empty object are false. Everything else is true, including `"0"`, `"false"`, and `" "`. Write that test out in the code, as `template-to-code.md` says.
- `{{ contact.ATTRIBUTE }}` reads the contact saved in Brevo for the recipient. It moves only when the person names the value of the app that the attribute is copied from, and the site already holds that value for the same recipient, such as `FIRSTNAME` from the user record the site sends to. `{{ contact.EMAIL }}` is the site's `to` address. The code passes that value as a variable, and the plan row notes that the email now shows the app's value: a recipient that had no contact in Brevo, or an older copy of the value, got something else before. Otherwise the template stays, and the reason is `reads Brevo contact attribute <ATTRIBUTE>`.
- Any other filter or tag keeps the template on Brevo, such as `|slice`, whose docs don't agree with their own examples, `|urlencode`, `|escapejs`, `|aes_256`, the `hash_` filters, `{% for key, value in … %}`, `{% cycle %}`, `{% firstof %}`, `{% ifchanged %}`, `{% now %}`, `{% filter %}`, and `{% include %}`. So does `{{ feed.… }}`, a coupon code, and every link Brevo fills from its account: `{{ mirror }}`, `{{ unsubscribe }}`, `{{ update_profile }}`, `{{ revoke_open_pixel_tracking }}`, and `{{ doubleoptin }}`.
- A template in Brevo's old template language reads no `params`. When its placeholders are not `{{ … }}` and `{% … %}`, it stays.
- A Brevo template has no plain text part and no separate preview text: a preheader is part of its HTML. The send has `html` only. A send with its own `textContent` and no `templateId` sends it as `text`. The docs don't say whether Brevo escaped values in a text part or a subject: the code never does, as `template-to-code.md` says.
- A template's `tag` is not carried over. When the template has a tag and a webhook handler reads `tags` back, the site stays. When it has a tag and no handler reads it, note in the plan row that the tag is lost.
- A Brevo template can carry its own attachment, added in its advanced options. The send doesn't name it, and `account.md` says how to find it. A template with an attachment keeps the site on Brevo.
- A template whose `sender` has an `id` and no `email` stays, as the "Fields" table says for `sender`.
- Brevo applies the template's sender and subject unless the send sets its own, so a site's `sender` and `subject` next to `templateId` win over the template's. The docs don't say how Brevo treated a site's subject that holds `{{` or `{%`: such a subject keeps the site. The docs don't say whether a site's `replyTo` wins over the template's: the site moves only when the template has no reply-to address, or the site's is the same in every send as the template's. Brevo ignores a site's `htmlContent` and `textContent` next to `templateId`, so the send drops them.
- Images uploaded to Brevo have URLs on `img.mailinblue.com`, or on another host with `brevo`, `sendinblue`, or `mailinblue` in its name. Keep them, and list them, as `template-to-code.md` says.
- A template site follows "Tracking" like any other site.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the Brevo template and gives you its template ID, and makes it transactional once a verified sender covers its address, as Step 3 says. Until they give the ID, the site stays on Brevo.

An email that carries a login code, a reset link, or another secret needs its PostHog template marked sensitive: PostHog then keeps no copy of each sent email's body or filled-in subject, and sends its links as they are, without its click redirect. Templates are not sensitive by default.

Brevo's template language becomes Liquid in the PostHog template. Values move from `params` to `variables`, and each name keeps its case:

| Brevo | PostHog |
|---|---|
| `{{ params.name }}` | `{{ variables.name }}` |
| `{{ params.user.first_name }}` | `{{ variables.user.first_name }}` |
| `{{ params.items.0.name }}` | `{{ variables.items[0].name }}` |
| `{% if params.paid %}…{% elif params.due %}…{% else %}…{% endif %}`, when `paid` and `due` are booleans | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{% if not params.paid %}…{% endif %}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{% if params.plan == "pro" %}`, and `!=` the same way | `{% if variables.plan == 'pro' %}`, with the string in single quotes |
| `>`, `<`, `>=`, `<=` in a condition, when both sides are always numbers | the same |
| `and` or `or` in a condition, when it uses only one of the two, and each side is a comparison or a value that is always a boolean, `null`, or missing | the same |
| `{% for item in params.items %}{{ item.name }}{% endfor %}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{% for item in params.items reversed %}`, when `items` is a list | `{% for item in variables.items reversed %}` |
| `{{ forloop.Counter }}`, `{{ forloop.Counter0 }}` | `{{ forloop.index }}`, `{{ forloop.index0 }}` |
| `{% if forloop.First %}`, `{% if forloop.Last %}` | `{% if forloop.first %}`, `{% if forloop.last %}` |
| `{{ params.name\|default:"there" }}`, when `name` is always a string, `null`, or missing | `{{ variables.name \| default: 'there' }}` |
| `{{ params.name\|upper }}`, `{{ params.name\|lower }}` | `{{ variables.name \| upcase }}`, `{{ variables.name \| downcase }}` |
| The template's subject | The PostHog template's subject, with the same conversions |
| The template's sender and reply-to address | The PostHog template's sender and reply-to address |

Write the `\|` above as a plain `|`. The table escapes it.

- Brevo's `if` treats `0`, an empty string, an empty list, and an empty object as false, and Liquid treats them as true. Read what the site sends for each value that a condition tests on its own: after `if`, `elif`, or `if not`, or on one side of `and` or `or`, such as `count` in `{% if params.count and params.paid %}`. A value that is not always a boolean, `null`, or missing keeps the template on Brevo.
- Brevo's `for` also walks the keys of an object. A `for` over a value that is not always a list keeps the template on Brevo.
- Brevo compares with `>`, `<`, `>=`, and `<=` as numbers, and turns a string such as `"10"` into a number first. Liquid compares two strings by their characters. A comparison whose sides are not always numbers keeps the template on Brevo.
- Brevo takes parentheses in a condition. Liquid takes none, and checks `and` and `or` from right to left, so a condition that mixes them can group differently. A condition that mixes `and` and `or`, or uses parentheses, keeps the template on Brevo. So does `not` anywhere but at the start of `{% if not … %}`, such as `{% elif not … %}` or `not` next to `and` or `or`.
- Any other tag, such as `{% empty %}`, `{% set %}`, `{% with %}`, or `{% include %}`, keeps the template on Brevo.
- `{{ contact.ATTRIBUTE }}` reads a contact saved in Brevo. A PostHog send has no contact to read, so a template that uses it stays on Brevo. So does a template with `{{ feed.… }}`, `{{ time_now }}`, `{{ mirror }}`, `{{ unsubscribe }}`, `{{ update_profile }}`, `{{ revoke_open_pixel_tracking }}`, or `{{ doubleoptin }}`, and a template whose `toField` reads a contact attribute.
- Any other filter, such as `|safe`, `|date`, `|floatformat`, `|capfirst`, `|title`, `|truncatechars`, `|lang_format`, `|time_parse`, `|base64_encode`, or `|aes_256`, keeps the template on Brevo. So does a condition with `in`, and `forloop.Revcounter`.
- PostHog's Liquid escapes HTML in a value. When the code passes a value that holds HTML markup, such as a block of rendered rows, the template stays on Brevo.
- Brevo's `default` replaces every value its `if` treats as false, such as `0`. Liquid's `default` doesn't replace `0`. A `default` on a value that is not always a string, `null`, or missing keeps the template on Brevo.
- A Brevo template has no plain text part. The PostHog template takes its HTML, and no text the person didn't write.
- The bullets above on the old template language, the template's tag, and its attachment hold for a template made in PostHog too.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `sender`, `replyTo`, or `subject` next to `templateId` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets a recipient's tracking setting next to `templateId` stays, as the "Fields" table says.
- A template site follows "Tracking" like any other site.

## Webhooks

A Brevo webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| Brevo event | PostHog event |
|---|---|
| `request` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `hard_bounce` | `$workflows_email_bounced` |
| `spam` | `$workflows_email_blocked` |
| `opened`, `unique_opened` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked`, only for a template made in PostHog that is not marked sensitive. A send in the code form counts no clicks, as Step 7 says |
| `blocked`, `invalid_email` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `soft_bounce`, `deferred`, `unsubscribed`, `proxy_open`, `unique_proxy_open` | none |

PostHog's events carry no Brevo `message-id`, no `tags`, and no `X-Mailin-custom`. A site whose events a handler matches by message id, by a tag, or by `X-Mailin-custom` stays on Brevo. For every other handler, such as one that matches by the recipient's address, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, such as `soft_bounce` or `deferred`, stays, and the reason is `its <event> events feed a webhook handler`. A site whose emails a `click` handler acts on moves only to a template made in PostHog that is not marked sensitive. Otherwise it stays, and the reason is `its clicks feed a webhook handler`.

## Calls that change the blocked list

Step 5's "Calls that change the provider's list" covers these calls. Each one goes by its name in every SDK's casing, as `sdk-reference.md` says: Python and Ruby use snake case, Go and .NET Pascal case, and .NET adds an `Async` form, such as `BlockNewDomainAsync`. Match the names without regard to case or separators.

- `DELETE /v3/smtp/blockedContacts/{email}`, which the SDKs name `unblockOrResubscribeATransactionalContact`, `smtpBlockedContactsEmailDelete`, or `smtp_blocked_contacts_email_delete`, takes an address off Brevo's list. It counts for the entries the import takes: hard bounces, spam complaints, and the admin blocks and unsubscribes it took, as `account.md` says.
- `smtpBlacklistSender` on a contact create or update blocks the address for those senders only. It counts as an address added when, with it, Brevo blocks the address for every sender that sends through PostHog, as `account.md` says under "Map each entry". When it can name a sender a moved site sends from, a sender it takes from a variable included, the moved sends from that sender would reach the addresses it blocks: it goes into the question `account.md` asks under "Blocks for some senders", which is asked for it even when no list was read. Yes: it counts as an address added. No, or no answer: each moved site whose sender it can name stays, with that section's reason.
- `POST /v3/smtp/blockedDomains`, which the SDKs name `blockNewDomain`, `block_new_domain`, or `BlockNewDomain`, blocks every address on a domain. PostHog's list takes addresses, not domains, so the call can't change it: a domain it blocks still gets the moved sends, and the call adds no "Before cutover" item to make it change PostHog's list. It goes into the question `account.md` asks under "Blocked domains", which is asked for it even when the account blocks no domain today. Yes: the sites move, and the report names the call. No, or no answer: the moved sites stay, as that section says. `DELETE /v3/smtp/blockedDomains/{domain}` changes nothing PostHog holds, and adds no item either.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'brevo'` on the client that Step 7 configures, when its client options take it.

**The call.** The Brevo send becomes one PostHog send. Build its fields from the message the site built:

- Node.js `sendTransacEmail({...})`, or a `SendSmtpEmail` whose properties the code sets: its fields.
- Python `send_transac_email(...)` keyword arguments, or `SendSmtpEmail(...)`: the same fields.
- PHP `new SendTransacEmailRequest([...])`, or a `SendSmtpEmail` and its setters: the same fields.
- Ruby `Brevo::SendSmtpEmail.new(...)`, Go `brevo.SendSmtpEmail{...}`, and .NET `new SendSmtpEmail(...)`: the same fields.
- A raw HTTP body: the same fields.

**The fields.**

- `sender: { email: 'hello@mail.example.com', name: 'Example' }` becomes `from: 'Example <hello@mail.example.com>'`. A name with a comma, a quote, or another special character goes in double quotes, such as `'"Example, Inc." <hello@mail.example.com>'`, with a quote in the name escaped as `\"`. A `sender` without a name becomes the bare address.
- `to: [{ email, name }]` becomes `to: email`. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `replyTo: { email }` becomes `replyTo: email`.
- `htmlContent` becomes `html`, and `textContent` becomes `text`. With `params`, they are the content the code rendered, as "Templates" says, and the send has no `params`.
- `headers: { idempotencyKey: key }` becomes `idempotencyKey: key`.
- The send gets no `captureEngagement` for Brevo's tracking, as "Tracking" says.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates brought into the code.** The site renders the email from `params`, as "Templates" says, and sends `templateKey`, the rendered `subject` and `html`, and the `from` and `replyTo` from the site or else from the template. It sends no `templateId` and no `templateData`.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's `params`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them. Brevo's `templateId` is a number and PostHog's is a UUID string: never reuse the Brevo number.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Brevo send threw into a `catch`, throw from the error so the same `catch` runs, and keep each property the `catch` reads, with PostHog's status code in it: `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name, code: error.code })`. A network failure has no status: `err.code` is `network_error` then. Name the status the way the old error did: `statusCode` for `@getbrevo/brevo` and `sib-api-v3-typescript`, `response: { statusCode: error.statusCode }` where the `catch` reads `err.response.statusCode`, as with `@sendinblue/client` and the `HttpError` of `@getbrevo/brevo` 1.x to 3.x, and `status` for `sib-api-v3-sdk`. A read of `err.body` or `err.response.body` becomes a read of `err.message`. A check of `400` or `422`, or an `instanceof` branch on `Brevo.BadRequestError` or `Brevo.UnprocessableEntityError`, becomes a check of `err.name === 'validation_error'`. An `instanceof` branch on another Brevo error class becomes a check of its status code, from the table under "Code around the send". A check of Brevo's base error matches no status, so mark the thrown error with `fromPostHog: true` in the `Object.assign` and check that instead. In `@getbrevo/brevo` 4.x and later, `instanceof BrevoError` caught API errors and network failures, so it becomes `err?.fromPostHog`. A timeout, `BrevoTimeoutError`, is a `BrevoError` from 6.x on. In 4.x and 5.x it went past the check, so there a branch that goes on after the error keeps the site, as the table under "Code around the send" says. In `@getbrevo/brevo` 1.x to 3.x and `sib-api-v3-typescript`, `instanceof HttpError` caught only Brevo's answers, and a network failure went past it, so it becomes `err?.fromPostHog && err.code !== 'network_error'`. A branch on `BrevoTimeoutError` keeps the site, as that table says. When the `catch` handled only that class or status and threw the rest again, it keeps doing so: never widen it. A raw HTTP site that threw on `!res.ok` throws on `error` the same way.
- **Python.** PostHog's SDK raises too. Replace `except ApiError` (or `ApiException`) with the PostHog exception the rewrite file names, and `e.status_code` (or `e.status`) with its status code. A read of `e.body` becomes a read of its message. Brevo's Python errors cover only its answers: a network failure raised the HTTP library's error past them. PostHog's exception covers both, so raise it again first when its code is `network_error`. One exception: `brevo-python` 1.x and `sib-api-v3-sdk` wrapped a TLS failure in `ApiException` with `status` `0`, so their `except ApiException` caught that one network failure. PostHog's `network_error` can't tell a TLS failure from the others. A site moves only when an error with `status` `0` took the same path as every other network failure: raised past every handler on the `try`. It raises `network_error` again first. Any other site keeps it, as the table under "Code around the send" says. A catch of one Brevo error class, or an `except` that handles one status, becomes a catch of the PostHog exception that checks for the same kind of error, and raises every other error again: `429` (`TooManyRequestsError`) checks the status code, and `400` or `422` (`BadRequestError`, `UnprocessableEntityError`) checks the name `validation_error`, as Step 7 says.
- **PHP, Ruby, and .NET.** PostHog's SDK throws too. Replace the Brevo exception in the `catch` or `rescue` with PostHog's, and the status read (`getCode()`, `code`, `ErrorCode`) with its status code. A `catch` or `rescue` that handled one status checks for the same kind of error, and throws or raises every other error again: a branch on `400` or `422` reads PostHog's error name `validation_error` (`getErrorName()`, `name`, `Name`), and a branch on another status, such as 429, reads PostHog's status code. Ruby's `Brevo::ApiError` also takes network failures: `code` `0` for a connection failure, and no `code` for a timeout. A branch that takes both, such as on `e.code.to_i == 0`, reads `e.code == 'network_error'`. A branch on one of them alone keeps the site, as the table under "Code around the send" says. In .NET, `ApiException` of `brevo_csharp` and `sib_api_v3_sdk` covers only Brevo's answers of 400 or more, and a network failure threw the HTTP client's error past it, such as `HttpRequestException`: a `catch (ApiException e)` throws PostHog's error again first when its `Code` is `network_error`. In PHP, `BrevoApiException` of 4.x and later covers only Brevo's answers, and a network failure threw `BrevoException` past it: a `catch (BrevoApiException $e)` throws PostHog's error again first when its code is `network_error`, and a `catch (BrevoException $e)` takes both, as PostHog's does. The `ApiException` of 1.x, 2.x, and `sendinblue/api-v3-sdk` wraps Guzzle's `RequestException`. Read Guzzle's major version from `composer.lock`. With Guzzle 6, a connection failure or a timeout came in as `ApiException` with `getCode()` `0`, so a branch on `0` reads `getErrorCode() === 'network_error'`. With Guzzle 7, the failures Guzzle counts as connection errors, such as a DNS failure, a refused connection, or a timeout, went past the `catch` as `ConnectException`, and the others, such as a TLS certificate failure, came in as `ApiException` with `getCode()` `0`. There a site moves only when an error with code `0` took the same path as every other network failure: thrown past every `catch` on the `try`. It throws PostHog's error again first when its code is `network_error`. Any other site keeps it, as the table under "Code around the send" says.
- **Go.** `err` stays the error to check. A check of `resp.StatusCode` becomes a check of `err`: a status of 400 or more becomes "there is an error", a branch on `400` or `422` reads `Name` (`validation_error`) from the `*posthog.EmailError` with `errors.As`, and a branch on another status, such as 429, reads its `StatusCode`. Every other error goes back the way it did before, such as returned to the caller.
- **A raw HTTP request.** It failed the way its client does, with the options the code gives it. These threw on a refused send: `axios` unless `validateStatus` accepts a failed status, `got` and `ky` unless `throwHttpErrors: false`, Guzzle unless `'http_errors' => false`, Faraday with `raise_error`, `requests` or `httpx` followed by `raise_for_status()`, and .NET `HttpClient` followed by `EnsureSuccessStatusCode()`. Their sites fail on every PostHog error, as the bullet for the language says, and a read of the client's status, such as axios's `err.response.status`, reads PostHog's status code. `fetch`, `requests`, `httpx`, Ruby `Net::HTTP`, Go `net/http`, PHP `curl_exec`, and .NET `HttpClient` without `EnsureSuccessStatusCode()` answered a refused send as a response. A site on one of them that never read the status logs PostHog's error and goes on, and raises or returns it when its code is `network_error`, as Step 7 says. PHP's `curl_exec` didn't raise on a network failure either: it returned `false`. A site that never checked that went on after a network failure too, so its moved site also logs `network_error` and goes on. Note each such site in the report.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. A suppressed send has no message id, as the table under "Code around the send" says. Note each site that got this branch in the report.
- When the same `try`, `begin`, or error check also covers a call that stays on Brevo, such as a contact create, keep Brevo's handler for that call and add PostHog's next to it.

**HTTP.** A request to `https://api.brevo.com/v3/smtp/email` or `api.sendinblue.com`, through `fetch`, `axios`, `got`, `ky`, `requests`, `httpx`, `net/http`, Faraday, Guzzle, `HttpClient`, `Req`, or `curl`, becomes the SDK's send in that language, with the fields "The call" builds. The `api-key` header goes away. A site whose request had its own deadline keeps it, as Step 7 says under "Set up the client". These count as one: a timeout on the request, such as `signal: AbortSignal.timeout(5000)` or `requests.post(..., timeout=5)`, and a timeout the code gives a Brevo SDK's client or send, such as `timeoutInSeconds` on `@getbrevo/brevo` 4.x and later, `'timeout'` in the client or request options of `getbrevo/brevo-php` 6.x or of the Guzzle client handed to an older one, or a Go `context` with a deadline. An `abortSignal` such as `AbortSignal.timeout(5000)` in the request options of `@getbrevo/brevo` 4.x and later counts too: one signal covers every attempt, so it is the deadline of the whole send. An SDK's own default, such as the 60 seconds of `@getbrevo/brevo`, is not one. A send with its own deadline gets no retries, as Step 7 says, also where the Brevo SDK retried. Two Brevo settings are deadlines the PostHog SDK can't keep, so their sites stay, as Step 7 says: `_request_timeout` on a `brevo-python` 1.x or `sib-api-v3-sdk` send, which as one number sets urllib3's `total`, a cap on connecting and reading together, and as a pair limits them apart, and Ruby's `config.timeout`, which Typhoeus applies to the whole request, as `rewrite-ruby.md` says under "A deadline". An axios or `ky` `timeout` is a limit the SDK can't keep, as Step 7 says. A retry count the code gives a Brevo SDK's client or send on a site without its own deadline, such as `maxRetries: 0`, or `max_retries=0` in Python, for a job whose queue retries, becomes the PostHog send's retries. Where the Brevo SDK retried, note in the plan row and the report which retries the site loses: PostHog's SDK retries network failures and rate limits, as Step 7 says, not every `408` or `5xx` answer, and a send with its own deadline retries nothing. `@getbrevo/brevo` 4.x and later and `getbrevo/brevo-php` 6.x retried `408`, `429`, and `5xx` answers twice unless the code set another count, and never a request that ran out of time. `brevo-python` 1.x and `sib-api-v3-sdk` left urllib3's default, 3 retries of a failed connection, a connect timeout included. For the other SDKs, read the installed package's source.

**The answer.** The message id of a moved send is PostHog's. Code that logged Brevo's `messageId`, or stored it for the app's own use, takes PostHog's message id instead, for a send that goes out.

**The Brevo client.** Keep the Brevo client, its import, and the line that sets its key while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover. Each Brevo SDK also serves Brevo's other APIs, such as contacts, email campaigns, SMS, WhatsApp, and CRM (`sdk-reference.md`, "Other APIs"). While any code calls one of them, or imports or re-exports the Brevo client for another part of the app, the package and its key stay after the cutover too.
