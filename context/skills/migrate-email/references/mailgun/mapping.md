# Mailgun to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailgun call site. A site moves only when every field it sets moves. Otherwise it stays on Mailgun, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python.

## Fields

Mailgun fields are written in their HTTP names. An SDK key sets the field of the same name. Mailgun's docs name no setter, so for a setter, such as on a Go message or a Ruby message builder, read the installed client, as `sdk-reference.md` says under "The installed client", for the field it sets. A setter the installed client doesn't settle either keeps the site, and the reason is `Mailgun SDK call not checked: <setter>`.

| Mailgun | PostHog | A site stays on Mailgun when |
|---|---|---|
| `from` | `from` | Never. `Name <address>` moves as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| The sending domain of the call | none | Never. Step 4 sets up the sender for the domain of `from`. When the two differ, note it in the plan row |
| `to` | `to` | It holds more than one address, as a list or a comma-separated string. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name. A string from one stored address, such as a user's email, holds one address. A string the code joins from several, or takes from input or a mail object that can hold several, counts as several |
| `subject` | `subject` | Never |
| `text`, `html` | `text`, `html` | Never |
| `%recipient.<name>%` in `subject`, `text`, or `html` | none: the code puts the value in, as the `recipient-variables` row says | The send has no `recipient-variables` that holds `<name>` for its `to` address: Mailgun's docs don't say what it renders then. A bare `%recipient%` always stays: the docs don't say what it holds |
| `%unsubscribe_url%`, `%tag_unsubscribe_url%`, or `%mailing_list_unsubscribe_url%` in `subject`, `text`, or `html` | none | Always: Mailgun fills them at send time from its unsubscribe lists |
| `amp-html` | none | Always. PostHog's send doesn't take it yet |
| `message` (MIME) | none | Always. PostHog's send doesn't take it yet |
| `template` with `t:variables`, `h:X-Mailgun-Variables`, or `v:` values | the template's email, brought into the code and rendered with those values, sent as `subject` and `html`, and `text` when the site sets `t:text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `t:version` | the version it names, brought into the code in place of the active one | See "Templates" |
| `t:text` | `text`, written in the code from the version's content | See "Templates". A site that moves to a template made in PostHog stays, as before: the template form has no `t:text` |
| `cc`, `bcc` | none | Always. PostHog's send doesn't take it yet |
| `h:Reply-To` | `replyTo` | It carries a name, holds more than 10 addresses, or the code builds it at run time and you cannot tell that it holds bare addresses only |
| `attachment` | `attachments`, each file without a content ID | Step 3 says so under "Files", or as "Attachments" says |
| `inline` | `attachments`, each file with its filename as its content ID | Step 3 says so under "Files", or as "Attachments" says |
| `h:<Header>`, other than `Reply-To` and `X-Mailgun-Variables` | none | Always: no PostHog SDK takes headers yet |
| `v:<name>`, or `h:X-Mailgun-Variables` on a send without a template | none | Always: no PostHog SDK takes tags yet |
| `o:tag` | none | Always: no PostHog SDK takes tags yet |
| Open and click tracking: `o:tracking`, `o:tracking-opens`, `o:tracking-clicks`, or none of them | none, as Step 7 says | Its emails had no open pixel and the person doesn't agree to PostHog's, or nobody knows whether they had one. See "Tracking" below. A field set to `no` or `false`, or a setter such as Go's `SetTrackingClicks(false)`, counts as set: it turns that tracking off for the send, whatever the domain's setting |
| An `Idempotency-Key` request header | none | Always: Mailgun's docs describe no such header on a send, and the installed client shows only that it sends the header, not what Mailgun does with it. The reason is `Idempotency-Key header not checked` |
| `o:deliverytime`, `o:deliverytime-optimize-period`, `o:time-zone-localize`, `o:deliver-within` | none | Always. PostHog's send doesn't take it yet |
| `recipient-variables`, on a send with one address in `to` and its own `subject`, `text`, or `html` | none: the code puts the values into the subject and the content before the send | `to` holds more than one address, or the send sets `template`. Otherwise Mailgun replaced each `%recipient.<name>%` in the subject, the text, and the HTML with the value of `<name>` in the entry of the `to` address. The code does the same with a plain string replace, under the escaping rule of `template-to-code.md`, and sends the result. Mailgun's docs don't say whether it escaped the value, so escape it in the HTML, unless the code builds it as HTML. A name the entry can lack, or a value that can be anything but a string or a whole number, keeps the site: the docs don't say what Mailgun writes for it. |
| `o:testmode` | none | Always. Test mode is not a send |
| `o:dkim`, `o:secondary-dkim`, `o:secondary-dkim-public`, `o:require-tls`, `o:skip-verification` | none | Always. PostHog's send doesn't take it yet |
| `o:sending-ip`, `o:sending-ip-pool`, `o:archive-to`, `o:suppress-headers`, `o:tracking-pixel-location-top`, `o:campaign` | none | Always. PostHog's send doesn't take it yet |
| Any field this table doesn't name, such as `sender` | none | Always. The reason names the field |

**Tracking.** PostHog's side is Step 7's: it adds its open pixel to every email, counts clicks only for a template made in PostHog that is not marked sensitive, and no field changes either. Mailgun tracks opens and clicks only when they are on: a send's `o:tracking-opens` or `o:tracking-clicks`, else its `o:tracking`, else the sending domain's setting, which Mailgun turns off for a new domain. A send that sets one of them to `no` or `false` turns that tracking off, even on a domain with tracking on, such as a password reset with `o:tracking-clicks: 'no'`. Work out, for opens and for clicks, whether Mailgun tracked them:

- Opens tracked: the site moves. When Mailgun tracked its clicks too, `htmlonly` included, note in the plan row that PostHog counts no clicks for it, unless it moves to a template made in PostHog that is not marked sensitive.
- Clicks, for a site that moves to a template made in PostHog: Mailgun tracked them when the send's `o:tracking-clicks`, else its `o:tracking`, else the domain's click tracking was on. `htmlonly` tracks the links of the HTML part, the part the template sends, so it counts as tracked. When Mailgun didn't track them, or the site sets neither field and the domain's click tracking is not given, Step 3 asks the person to mark the template sensitive, as it says under "A template in PostHog".
- Opens untracked, because the send's `o:tracking-opens`, else its `o:tracking`, is `no` or `false`, or the site sets neither and the domain's open tracking is off: its emails had no open pixel. Step 3 asks the person about PostHog's, as it says under "Opens the provider didn't track". Without their yes, the site stays, and the reason is `open tracking off`.
- `o:tracking` that disagrees with `o:tracking-opens` on the same send: the site stays, and the reason is `conflicting open tracking`.

When a site sets neither `o:tracking-opens` nor `o:tracking`, ask the person once for each sending domain whether its open and click tracking are on, or read them as `account.md` says. When the domain's open tracking is not given, nobody knows whether the site's emails had an open pixel: the site stays, and the reason is `open tracking not checked`, as Step 3 says under "Opens the provider didn't track".

A domain with unsubscribe tracking on adds an unsubscribe footer to every email Mailgun sends from it, though the site's content holds no unsubscribe link. PostHog adds none, so the moved email would lose it. Ask about it, or read it, with the other tracking settings of each sending domain, for every site. When it is on, the domain's sites stay, and the reason is `Mailgun adds an unsubscribe footer`. When it is not given, they stay too, and the reason is `domain unsubscribe footer not checked`.

Mailgun's docs describe no idempotency key for a send. A moved site sends none either: PostHog's SDK makes one for each call and reuses it on its own retries.

## Attachments

What Mailgun's docs say about files:

- The [messages API reference](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages) takes each file in the request's `multipart/form-data` body, under `attachment`, or under `inline` for a file the HTML shows, and takes no URL for a file.
- The [attachment guide](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-attachments) sends `attachment=@tps-report.txt`, and `inline=@email.jpg` with HTML that shows `<img src="cid:email.jpg">`: an inline file's `cid:` is its filename.
- The [HTTP sending guide](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http) caps a message at 25 MB, under the 40 MB that PostHog takes. The docs set no limit on how many files.

They don't say which filename and content type a file gets. The form part that carries the file decides them, so read what each file's part carries. On a Mailgun SDK, read the installed client, as `sdk-reference.md` says under "The installed client": what its request puts in the part's filename and `Content-Type` for what the code gives it, such as a path, a stream, a buffer, or an object with a filename or a type. On a plain HTTP request, read what the code puts in the part, and the installed form library the same way for what it adds. Name the file you read in the site's plan row. A site that sends files moves as one entry of PostHog's `attachments` per file, after Step 3's checks under "Files":

- **Content.** The same bytes. A file the code hands its client as a path or a stream becomes a read in the app at the send, to the end of the file or stream.
- **Filename.** The filename the part carries. When the installed client doesn't settle it, the site stays, and the reason is `attachment filename not checked`.
- **Content type.** The `Content-Type` the part carries, as it is, parameters included, as Step 3 says. When the part carries none, or the installed client doesn't settle what it carries, the site stays, and the reason is `content type not checked`: the docs don't say what Mailgun gives such a file. Never guess a type, and never strip its parameters.
- **Content ID.** An `inline` file's content ID is its filename, as the attachment guide shows. Pass it, and leave the HTML as it is. An inline file moves only when each `cid:` value of the site's HTML that names one of its inline files is that file's filename; otherwise the site stays, and the reason is `inline content ID not checked`. Step 3 says under "Files" which content IDs and filenames PostHog refuses. An `attachment` file gets no content ID.

## Calls

| Mailgun call | A site stays on Mailgun when |
|---|---|
| The send each of Mailgun's SDK pages shows: `mg.messages.create` (`mailgun.js`), `client.messages.create` (Python), `send_message` with a hash (Ruby), `$mg->messages()->send` (PHP), and `mg.Send` with `mg.NewMessage` (Go `/v5`); and `POST /v3/<domain>/messages` | A field above keeps it, or the code around it does, as "Code around the send" says |
| `/messages.mime`, or an SDK call that sends a full MIME message | Always: a MIME message is built outside the send |
| A send with `recipient-variables` and more than one address in `to`, or an SDK helper that sends a batch | Always: each sends several emails in one call |
| Any other SDK call that sends, such as through a message builder class, `mailgun-js`, or `mailgun-go` before `/v5` | Mailgun's docs don't describe it: read the installed client, as `sdk-reference.md` says under "The installed client", for the request it sends. One `/messages` request moves as that send, with the fields it carries. A MIME or batch send stays as the rows above say. A call the installed client doesn't settle stays, and the reason is `Mailgun SDK call not checked: <call>` |
| A send whose `to` is a Mailgun mailing list address | Always: Mailgun sends it to every member |
| SMTP through `smtp.mailgun.org` or `smtp.eu.mailgun.org` | Always. PostHog has no SMTP relay |
| A framework mailer or transport (Laravel, Symfony, Rails, Django, Nodemailer, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Domains

Mailgun keeps its suppression lists per sending domain, and a send uses the lists of the domain it sends from. PostHog keeps one suppression list per project. When the sites that move send from more than one Mailgun domain, Step 5 imports the lists of each of them into that one list. PostHog then refuses a moved send to an address that any of those domains suppressed, even when the site's own domain never did. Tell the person so, and ask once whether the moved sites may share one suppression list. When they say no, ask which one domain's sites move. The sites of every other domain stay, and the reason is `domain <name> keeps its own suppression list`. Step 5 then imports the lists of the chosen domain only.

## Code around the send

**Mailgun's SDKs.** Mailgun's SDK pages show that the Node.js SDK's `mg.messages.create` rejects its promise on any error, that the Go SDK's `mg.Send` answers an `err`, and that the Python SDK's `client.messages.create` answers the HTTP response. They don't say which failures an SDK raises, throws, or returns an error for, which classes or fields its error has, or whether a network failure takes the same path as an error the API answers. So read the installed client, as `sdk-reference.md` says under "The installed client", for its send: what it does on a failed status and on a network failure (throw, raise, return an error, or answer the response), with which class, and which fields hold the HTTP status and the API's `message`. Read the code's own checks too, which show what it expected. Then write the site as "Errors" in the Rewrite section says, and name the file you read in its plan row. A site stays only when the installed client doesn't settle what reaches the code's handling, and the reason is `Mailgun SDK errors not checked`, with what the code reads, such as `Mailgun SDK errors not checked: err.status`.

**A plain HTTP request** does what its client does, with the options the code gives the client or the request. An option that turns the throw off, such as axios's `validateStatus` that accepts every failed status or got's `throwHttpErrors: false`, makes the client answer a failed status as a response. An option or a call that accepts some failed statuses and throws on others keeps the site on Mailgun, with the reason `the client throws on some failed statuses only`. Such are `validateStatus: s => s < 500`, and the RestSharp calls that throw, as its [error handling page](https://restsharp.dev/docs/advanced/error-handling) lists them: `PostAsync` and the other `<Method>Async` calls, and every call with `ThrowOnAnyError = true`. RestSharp counts a `404` as completed, not as an error. A RestSharp call that page doesn't list, such as a synchronous `Post`, keeps its site too, and the reason is `the client's errors not checked`:

- These throw or raise on a failed status: `axios`, `got`, Ruby's `rest-client`, Guzzle unless `'http_errors' => false`, and .NET `HttpClient` followed by `EnsureSuccessStatusCode()`.
- These answer a failed status as a response: `fetch`, `requests`, `httpx`, Ruby's `Net::HTTP` (unless the code calls `.value`), PHP's `curl_exec`, Guzzle with `'http_errors' => false`, .NET `HttpClient` without `EnsureSuccessStatusCode()`, RestSharp's `ExecuteAsync` and `ExecutePostAsync` without `ThrowOnAnyError`, and Go's `net/http`.

The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailgun when |
|---|---|
| A branch on the text of Mailgun's error: the API's `message`, or the field of an SDK's error that holds it | Always: it branches on Mailgun's error text. A branch on the HTTP status moves: read PostHog's error name `validation_error` for a `400`, and PostHog's status code for any other status, as the Rewrite section says |
| A check of the response's status, such as `response.status_code`, `response.ok`, `raise_for_status()`, `res.status`, or `StatusCode`, on a plain HTTP request or on a Mailgun SDK that answers the response | Never. Read PostHog's error instead, as the Rewrite section says |
| A Mailgun SDK client that the code sets up to send nothing, by a setting other than `o:testmode`: read the installed client, as `sdk-reference.md` says under "The installed client", for what the setting does | Always, when the app turns it on outside its tests, such as from an env setting. When only the tests turn it on, the site moves: note in the report each place that turns it on and each test that reads what the client kept, since those tests now run the real PostHog SDK and intercept its send request, as Step 8 says. A setting the installed client doesn't settle keeps the site, and the reason is `Mailgun SDK call not checked: <setting>` |
| The message `id` stored for a webhook handler or an Events API read | Always, when the handler or the read uses it |
| The message `id` logged or stored for the app's own use | Never. Use PostHog's message id, for a send that goes out: a suppressed send has none, as the Rewrite section says under "Errors" |
| A send the code can cancel, such as a `fetch` or axios request with a `signal` a caller passes in or an `AbortController` it aborts, or a Go `context` or .NET cancellation token that a caller can cancel | Unless the PostHog send in that language takes the same cancellation, as Go's `Send(ctx, ...)` and .NET's `SendAsync(..., cancellationToken)` do: pass it there. Otherwise always, as in Node.js, whose send takes no signal: an email the old code cancelled would go out. A fixed deadline, such as `AbortSignal.timeout(...)`, moves as "HTTP" in the Rewrite section says |
| A read of the answer's headers, such as a rate-limit header | Always: PostHog's answer holds its message id, as the rewrite file says under "The answer", not Mailgun's headers |

## Templates

A template site moves by bringing the template into the code, as `template-to-code.md` says. The check needs the content of the version the site sends, the active one unless the site sets `t:version`, because the code has only the template's name or id. `account.md` says how to get it. The code renders the version's content and subject with the site's values, and the send sets the rendered `subject` and `html`, and `text` when the site sets `t:text`.

The site's values are the object of `t:variables`, else of `h:X-Mailgun-Variables`, else the `v:` values by name. Parse a JSON string into its object. A site that sets `v:` values next to `t:variables` stays when a webhook handler reads them back, as in "Webhooks".

A version whose `engine` is `go` stays: Mailgun's docs describe its Handlebars engine only, so how the Go engine escapes and fills a missing value can't be told.

Mailgun templates are Handlebars, with the block helpers `if`, `unless`, `each`, `with`, and `equal` only. In the code:

| Mailgun | In the code |
|---|---|
| `{{name}}`, `{{ name }}` | The value, escaped. A missing or `null` value renders as nothing |
| `{{user.first_name}}` | The nested value, escaped. A missing step of the path renders as nothing |
| `{{{name}}}` | The value as it is, unescaped, under the rule of `template-to-code.md` |
| `{{#if a}}…{{else if b}}…{{else}}…{{/if}}` | A branch that tests each value for Handlebars truth, in order |
| `{{#unless a}}…{{else}}…{{/unless}}` | The same branch, with the test turned around |
| `{{#each items}}…{{else}}…{{/each}}`, when `items` is always a list or missing | A loop over the list, in order. The `{{else}}` part shows when the list is empty or missing |
| Inside `{{#each}}`: `{{this}}`, `{{this.name}}`, or a bare `{{name}}` | The current item, or its field, escaped |
| Inside `{{#each}}`: `{{@index}}`, `{{@first}}`, `{{@last}}`, `{{../name}}` | The item's position from 0, whether it is the first or the last, and the value one level out |
| `{{#with author}}…{{else}}…{{/with}}` | A branch on the Handlebars truth of `author`. Inside it, a bare name reads a field of `author`. The `{{else}}` part shows when `author` is false |
| `{{#equal plan "pro"}}…{{/equal}}` | A branch on both sides, written as strings, being the same: `5` equals `"5"` |
| The version's `Subject` header | The send's `subject`, with no escaping, when the site sets none |
| The version's `From` header | The send's `from`, when the site sets none |
| The version's `Reply-To` header | The send's `replyTo`, when the site sets no `h:Reply-To`. It meets the rules of "Fields" as a value the site sets: a header with a name, such as `Support <support@example.com>`, or with more than 10 addresses keeps the site on Mailgun |
| `t:text: yes` on the site | The send's `text`: the email's text file, which you write from the version's content with the same words, values, and links, rendered with no escaping. A site without `t:text` sends `html` only |

- Handlebars truth: `false`, a missing value, `null`, `""`, `0`, and an empty list are false. Every other string, number, and list is true, including `"0"` and `"false"`. Write that test out in the code, as `template-to-code.md` says. Mailgun's docs don't define it, and don't say whether an empty object is true: an `if`, `unless`, or `with` on a value that can be an empty object keeps the template on Mailgun.
- Mailgun's docs show each form only with its values set. Where they are silent, the table follows Handlebars: the escaping, a missing value rendering as nothing, `{{else}}` in `each` and `with`, and the `@` and `../` names. Note in the plan row each site whose template uses one of them.
- These keep the template on Mailgun, because the docs don't say what Mailgun does: an `each` over a value that can be an object, whose key order they don't give; a bare name inside `each` or `with` that the item can lack, where Mailgun may read the value outside the block; an `equal` on a value that can be a boolean, a fraction, `null`, or missing, which they don't say how Mailgun writes as a string; and an `{{else}}` inside `equal`.
- Mailgun's docs don't say how `t:text` builds the text part. Name the text file you wrote in the plan row, so the person reads it before the cutover.
- Any other helper, a partial (`{{> name}}`), and a `%recipient%`, `%recipient.<name>%`, `%unsubscribe_url%`, `%tag_unsubscribe_url%`, or `%mailing_list_unsubscribe_url%` tag keep the template on Mailgun: Mailgun fills the tags at send time, from the batch or from its unsubscribe lists. So does a header that holds `{{`: the docs don't say whether Mailgun renders a header.
- A site that sets `text` or `html` next to `template` stays: Mailgun's docs don't say which part it sends then, and the rewrite would drop one.
- A `from`, `subject`, or `h:Reply-To` that the site sets wins over the version's header, as Mailgun's docs say. When neither the site nor the version sets a sender, Mailgun sent from `postmaster@<sending domain>`: write that address in the site's `from` column.
- Mailgun's docs don't name a host for images that its template editor uploads. List each image whose URL has `mailgun` in its host, as `template-to-code.md` says.
- A template site follows "Tracking" like any other site.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the Mailgun template and gives you its template ID, and makes it transactional once a verified sender covers its address, as Step 3 says. Until they give the ID, the site stays on Mailgun.

An email that carries a login code, a reset link, or another secret needs its PostHog template marked sensitive: PostHog then keeps no copy of each sent email's body or filled-in subject, and sends its links as they are, without its click redirect. Templates are not sensitive by default.

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
- `equal` compares both sides as strings, so `5` equals `"5"`. Liquid's `==` doesn't: a number never equals a string. Read what the site sends for the value. When it is always a string, quote the other side, such as `== 'pro'`. When it is always a whole number, write the other side unquoted, such as `{{#equal count "5"}}` becoming `{% if variables.count == 5 %}`; a side that isn't a whole number in plain digits, such as `"05"` or `"5.0"`, keeps the template on Mailgun. A value that can be a string in one send and a number in another, a boolean, a fraction, `null`, or missing keeps the template on Mailgun.
- Any other helper, `{{@index}}`, a partial, a block inside `{{#each}}` that reads a value outside the loop with `../`, and `%recipient.<name>%` or an unsubscribe variable keep the template on Mailgun.
- The site's values, as "Templates" says, become `templateData`.
- The PostHog template carries its own sender, reply-to address, and subject. Tell the person to put the version's `From`, `Reply-To`, and `Subject` headers into it, for each one the site doesn't set. A site that sets `from`, `h:Reply-To`, or `subject` next to `template` moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A template site follows "Tracking" like any other site.

## Webhooks

Mailgun's webhooks stop getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| Mailgun event | PostHog event |
|---|---|
| `accepted` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `permanent_fail` (`failed` with `severity: permanent`), for a bounce | `$workflows_email_bounced` |
| `permanent_fail` for an address on a suppression list | none. PostHog refuses the send instead, with `recipient_suppressed` |
| `complained` | `$workflows_email_blocked` |
| `opened` | `$workflows_email_opened` |
| `clicked` | `$workflows_email_link_clicked`, only for a template made in PostHog that is not marked sensitive. A send in the code form counts no clicks, as Step 7 says |
| `temporary_fail`, `unsubscribed` | none |

PostHog's events carry no Mailgun message id, no `user-variables`, and no Mailgun tags. A site whose events a handler matches by `message.headers["message-id"]`, by a `v:` or `X-Mailgun-Variables` value, or by an `o:tag` stays on Mailgun. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

A site whose emails a handler acts on for an event that has no PostHog event in the table, `temporary_fail` or `unsubscribed`, stays, and the reason is `its <event> events feed a webhook handler`.

A site whose emails a `clicked` handler acts on moves only to a template made in PostHog that is not marked sensitive. Otherwise it stays, and the reason is `its clicks feed a webhook handler`.

## Calls that change the suppression list

Step 5 says what to do with each of these calls. They are not sends, and they stay on Mailgun.

A call that adds to or removes from a domain's bounce or complaint list, `POST` or `DELETE` on `/v3/<domain>/bounces` or `/v3/<domain>/complaints`, or the SDK's call for it, such as `mg.suppressions.create(domain, 'bounces', ...)` in Node.js, changes a list the import takes. A call on `/v3/<domain>/unsubscribes` changes a list the import leaves out, and stays a Mailgun write only.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'mailgun'` on the client that Step 7 configures, when its client options take it.

**The call.** The Mailgun send becomes one PostHog send. Build its fields from the message the site built:

- Node.js `mg.messages.create(domain, data)`: the fields of `data`.
- Python `client.messages.create(data=..., domain=...)`: the fields of `data`.
- Ruby `send_message(domain, params)`: the fields of `params`, or of the message a builder made, as the installed gem builds them.
- PHP `$mg->messages()->send($domain, $params)`: the fields of `$params`.
- Go `mg.NewMessage(...)` and its setters: `from`, `subject`, `text`, `to`, and each field a setter sets.
- Another SDK call: the fields of the request the installed client sends, as "Calls" says.
- A plain HTTP request, such as a Python `requests` or `httpx` post or a .NET request: the fields of its form body.

Drop the domain argument and the Mailgun client of the call.

**HTTP.** A site keeps a deadline that its request or its Mailgun client had, as Step 7 says under "Set up the client". Step 7 also says which kinds of limit the SDK can keep. These count as the site's own deadline: a timeout on the request, such as `requests.post(..., timeout=5)`, Guzzle's `'timeout' => 5`, or `signal: AbortSignal.timeout(5000)`, and a Go context from `context.WithTimeout` passed to `mg.Send`, as the Go page sends with a 10-second timeout. A limit set on a Mailgun SDK client, such as a `timeout` in its options, or an HTTP client the code gives it: Mailgun's docs don't describe it, so read the installed client, as `sdk-reference.md` says under "The installed client", for the limit it sets: on each wait on the network, on the whole request, or on connecting and reading apart, and for one client or every client in the process. Follow Step 7 for that kind of limit: a limit the PostHog SDK in that language keeps moves with the site, and one it can't keep keeps the site. A limit on every client in the process can't be kept either. Name the file you read in the plan row. A limit the installed client doesn't settle keeps the site, and the reason is `Mailgun client timeout not checked`. Without a limit of the code's own, the client's default is not a deadline of the site's own. A limit on connecting alone, or on connecting and reading apart, such as `requests`' `timeout=(1, 10)` or Guzzle's `connect_timeout`, falls under Step 7's rule on such limits. A `signal` or context that a caller can cancel is not a deadline: see "Code around the send".

**The fields.**

- `from` stays as it is. When the code built it from a name and an address, such as with a builder setter that takes both, write `'Name <address>'`, with the name in double quotes when it holds a comma, a quote, or another special character, such as `'"Acme, Inc." <hello@mail.example.com>'`.
- `to` becomes a bare address. A list with one entry becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `attachment` and `inline` become `attachments`, each file as "Attachments" says.
- `h:Reply-To` becomes `replyTo`: one address as a string, and a header with several addresses, such as `a@example.com, b@example.com`, as a list of them, split at each comma and trimmed. PostHog checks each entry as one address.
- The tracking fields, `o:tracking`, `o:tracking-opens`, and `o:tracking-clicks`, and their setters are dropped, and the send gets no `captureEngagement` for them, as Step 7 says.
- `recipient-variables` on a send to one address: replace each `%recipient.<name>%` in the subject, the text, and the HTML with the value of that address's entry before the send, as the "Fields" table says, and drop `recipient-variables`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates brought into the code.** The site renders the email from its template values, as "Templates" says, and sends `templateKey`, the rendered `subject` and `html`, `text` when it set `t:text`, and the `from` and `replyTo` of the site, else of the version's headers. It sends no `templateId` and no `templateData`.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the site's template values, as "Templates" says. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

In each bullet, "the installed client" is the Mailgun client the app has installed, read as "Code around the send" says. Never write what it does from memory.

- **Node.js, `mailgun.js`.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `mg.messages.create` rejected, into a `catch` or past the send, throw from the error so the same path runs. Give the thrown error the field names the installed client's error has for the HTTP status and the API's text, with PostHog's values, such as `if (error) throw Object.assign(new Error(error.message), { <status field>: error.statusCode, <text field>: error.message, name: error.name, code: error.code })`. A network failure has no status in PostHog's error: its `code` is `network_error`. When the installed client gave a network failure a status of its own, a branch on that status, or on a range that holds it, also checks `err.code === 'network_error'`, and a branch on `400` checks `err.name === 'validation_error'`, as Step 7 says. A branch on another status, such as 429, keeps its branch on the status field and throws every other error again, as before. A branch on 429 also checks `err.code !== 'quota_limited'`, as Step 7 says.
- **Node.js, `mailgun-js`.** Replace the callback's call with `const { data, error } = await posthog.emails.send(...)`, and run its body with an `Error` that has the installed package's field names for the status and the text, filled as for `mailgun.js`, or with `null` and `data` on success. A network failure takes the path it took in the installed package.
- **Python, the Mailgun SDK.** Where the installed client answered the response on a failed status, follow the bullet for `requests` below, with its network failure raised as the installed client raised it. Where it raised a class on a failed status, replace `except <that class>` with `except EmailError as e`, and read `e.status_code` for its status field and `e.message` for its text. A class the installed client raised for network failures only becomes `except EmailError as e` that checks `e.code == "network_error"` and raises every other error again. A class that took both takes every PostHog error. A class that took one kind of network failure and not others, such as a timeout alone, keeps the site, as Step 7 says.
- **Ruby and PHP.** Replace the `rescue` or `catch` of each class the installed client raises with `rescue PostHog::EmailError => e` or `catch (\PostHog\EmailError $e)`, and keep only the errors that class took, as the installed client shows. A class for one range of statuses checks that range on `e.status_code` or `$e->getStatusCode()`, or `validation_error` for a `400`. A class that took network failures too also takes `network_error`. A class that took no network failure throws `network_error` again first. A read of its status becomes `e.status_code` or `getStatusCode()`, and a read of its text `e.message` or `getMessage()`. When the installed client gave a network failure a status of its own, a branch on that status checks the code `network_error`, and a comparison of the status reads `e.status_code.to_i` or `(int) $e->getStatusCode()`, so a network failure still compares as before. A PHP client set up to answer a failed status as a response, as the installed client shows, follows the bullet on a status check.
- **A Mailgun SDK send without a `catch`, `rescue`, or `except`.** Where the installed client threw, raised, or returned an error on every failure, PostHog's error takes the same way: in Node.js, with the `if (error) throw` line above. Where it answered a failed status as a response, follow the bullet on a send whose status the code never read.
- **Go.** Where the code read `err` with `errors.As`, `errors.As(err, &e)` takes `var e *posthog.EmailError` in place of the installed client's error type, and a read of its status field becomes `e.StatusCode`. Where that type took no network failure, as the installed client shows, the branch also checks `e.Code != "network_error"`, and every other error takes the path it took before. A branch on `400` checks `e.Name == "validation_error"`. A check of a type the installed client has for one status, such as a rate limit, checks `e.StatusCode` for it. A site that only checked `err != nil` keeps that check. The message id the send answered, such as `resp.ID`, becomes `result.ID`.
- **Python, `requests` or `httpx`, or the Mailgun SDK answering the response.** The code read the response's status. PostHog's SDK raises `EmailError` instead. Wrap the send in `try`, move the branch for a failed status into `except EmailError as e`, and raise it again first when `e.code == "network_error"`: the request raised a network failure past the status check. Keep each branch on one status: a branch on `400` checks `e.name == "validation_error"`, and a branch on another status, such as 429, checks `e.status_code`. Every other error takes the path the old code gave a status it didn't branch on: where the code raised for it, such as an `else: raise`, raise it again; where it went on, log it and go on, as the bullet on a send whose status the code never read says. `raise_for_status()` raised `HTTPError` for every failed status, and a network failure raised `ConnectionError` or `Timeout` past it. So an `except HTTPError` becomes `except EmailError as e` that raises it again first when `e.code == "network_error"`. `requests.ConnectionError` with `Timeout` in one catch takes every network failure and nothing else: such a catch becomes `except EmailError as e` that checks `e.code == "network_error"` and raises every other error again. `requests.RequestException` covers both only after `raise_for_status()`, and then becomes `except EmailError`. Without `raise_for_status()`, it took network failures only.
- **A status check, in any language.** A check of a response's status, such as `!res.ok` after `fetch` or `resp.StatusCode` after Go's `http.Post`, never saw a network failure: the request threw, raised, or returned it first. Move the branch into the handling of PostHog's error, and before it, throw, raise, or return a `network_error` the way the request did. RestSharp's `ExecuteAsync` calls answer a network failure as a response too, with `ResponseStatus` `Error` or `TimedOut` (its [error handling page](https://restsharp.dev/docs/advanced/error-handling)), and PHP's `curl_exec` answers `false`: a branch that took every failure there takes a `network_error` too.
- **A plain HTTP request whose client throws on a failed status**, as "Code around the send" lists. It failed on every API error and every network failure. Keep that: every PostHog error fails the site. In Node.js, throw from `error` as the Node.js bullet says. In Python, Ruby, PHP, and .NET, PostHog's SDK raises on its own. A catch of the client's error, such as `RestClient::ExceptionWithResponse`, Guzzle's `RequestException`, or .NET's `HttpRequestException`, becomes a catch of PostHog's error. A catch that never saw a network failure keeps it out: Guzzle throws a failed connection as `ConnectException`, outside `RequestException`, as its [exceptions section](https://docs.guzzlephp.org/en/stable/quickstart.html#exceptions) shows, so a catch of `RequestException` throws PostHog's error again first when its code is `network_error`. A catch of `TransferException` or `GuzzleException` took both, and takes every PostHog error. A catch that took some network failures and not others tells one kind from another, so the site stays, as Step 7 says: `rest-client`'s `ExceptionWithResponse` takes a timeout, but not `RestClient::ServerBrokeConnection` or a refused connection, and .NET's `HttpRequestException` takes a failed connection, but a timeout throws `TaskCanceledException` outside it, unless that timeout is a deadline the site keeps, which Step 7's .NET exception covers. A read of the client's status in that catch, such as axios's `err.response.status`, got's `err.response.statusCode`, `rest-client`'s `e.http_code`, Guzzle's `$e->getResponse()->getStatusCode()`, or `HttpRequestException.StatusCode`, reads PostHog's status code, and a branch on `400` reads PostHog's error name `validation_error`. Never log the error and go on here.
- **A send whose status the code never read**, on a plain HTTP request whose client answers a failed status as a response, or on a Mailgun SDK that did, as the installed client shows, as "Code around the send" lists. The site let every API error pass, and failed only where the request threw, raised, or returned a network failure. Keep both: handle PostHog's error, throw, raise, or return it when its code is `network_error`, and otherwise log it and go on. RestSharp's `ExecuteAsync` calls and PHP's `curl_exec` answer a network failure without throwing too, so a site on one of them logs a `network_error` and goes on as well. In Node.js, that is a check of `error`; in Python, Ruby, PHP, and .NET, a catch of PostHog's error; in Go, a check of `err` with `errors.As`. Note each such site in the report.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailgun took it and dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. A suppressed send has no message id: when the code after the send uses the id for more than a log line, such as returning it to its callers or storing it, the site stays, and the reason is `uses the message id of a suppressed send`, unless its callers already handle a send without an id. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged the Mailgun `id`, or stored it for the app's own use, takes PostHog's message id instead.

**The Mailgun client.** Keep the Mailgun client, its import, and its `FormData` while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package, `form-data`, and the key: the person removes them after the cutover.

Some packages a Mailgun send needs also serve other code. Name them in the report as kept for other uses, unless nothing else imports them:

- `form-data` is a general form library, such as for file uploads with `axios` or `got`.
- In Ruby, keep `mailgun-ruby` while any config names `:mailgun` as ActionMailer's `delivery_method`.
- In PHP, the PSR-18 client and PSR-7 packages installed for `mailgun/mailgun-php`, such as `symfony/http-client` and `nyholm/psr7` from the PHP page, or `guzzlehttp/guzzle`, are general HTTP libraries.
- A plain HTTP send used the app's HTTP client, such as `requests`, `httpx`, `axios`, or `net/http`. It is not a Mailgun package: keep it.
