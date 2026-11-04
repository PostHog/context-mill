# Mailchimp Transactional to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailchimp Transactional call site. A site moves only when every field it sets moves. Otherwise it stays on Mailchimp Transactional, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

The site's fields are the fields of `message`, plus the top-level `async`, `ip_pool`, and `send_at`. A field set to `null` is not set.

A field the site doesn't set takes the account's Sending Defaults: `track_opens`, `track_clicks`, `inline_css`, and `auto_html`. Classify the site with that value, as if the site set it. `account.md` says how to read them, and "Tracking" says what happens when the person can't say.

## Fields

| Mailchimp Transactional | PostHog | A site stays on Mailchimp Transactional when |
|---|---|---|
| `from_email` with `from_name` | `from` | Never. `from_email` with `from_name` becomes `'Name <email>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `to` entries of type `to`, or without a type | `to` | There is more than one. One entry moves as its bare address: note in the plan row when the To line loses its `name` |
| `to` entries of type `cc` | `cc` | The installed SDK has no `cc` (Step 7 checks), there are more than 10, the code builds the list at run time and you cannot tell it stays at 10 or fewer, or the site does not set `preserve_recipients: true`. Without it, the account's default decided whether each recipient saw the other addresses, and the code can't show which |
| `to` entries of type `bcc` | `bcc` | The installed SDK has no `bcc`, there are more than 10, or the code builds the list at run time and you cannot tell it stays at 10 or fewer |
| `bcc_address` | `bcc`, one address | The installed SDK has no `bcc`, or the site sends to more than one recipient |
| `subject` | `subject` | It holds a merge tag (see `merge`) |
| `html`, `text` | `html`, `text` | They hold a merge tag (see `merge`) |
| `headers` with `Reply-To` | `replyTo`, one address or a list | The value carries a name, there are more than 10 addresses, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `headers` with any other header | none | Always: no PostHog SDK takes headers yet |
| `merge`, `merge_language`, `global_merge_vars`, `merge_vars` on a site with `html` or `text` | none | `html`, `text`, `subject`, or `from_name` holds a merge tag, such as `*\|NAME\|*` or `{{name}}`. Without a merge tag in them, the values change nothing, and the site moves without them |
| `merge_vars` with entries for more than one `rcpt` | none | Always: the site sends to several recipients |
| `track_opens`, `track_clicks`, set to `true` or `false` | `captureEngagement: false` when Mailchimp Transactional tracked neither opens nor clicks | See "Tracking" below |
| `auto_text` set to `true` | none | Never. PostHog makes the text part from `html` when the send has no `text` |
| `auto_html` set to `true` | none | The site sends no `html` |
| `inline_css` or `auto_html` set to `false` | none | Never. It overrides an account default that is on, and PostHog does neither |
| `inline_css` set to `true` | none | Always. PostHog's send doesn't take it yet |
| `important` set to `true` | none | Always. PostHog's send doesn't take it yet |
| `view_content_link` set to `false` | none | Always. PostHog's send doesn't take it yet |
| `url_strip_qs`, `preserve_recipients` | none | Never on their own. They change only Mailchimp Transactional's reports, or what several recipients see |
| `async` | none | Never on its own. It changes only when Mailchimp Transactional answers |
| `tags` | none | Always: no PostHog SDK takes tags yet |
| `metadata`, `recipient_metadata` | none | Always: no PostHog SDK takes metadata yet |
| `attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files with `images`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `images` | `attachments`, each with `contentId` | The same as `attachments`, counted together with them |
| `subaccount` | none | Always. The subaccount has its own reports, quota, and denylist at Mailchimp Transactional |
| `tracking_domain`, `signing_domain`, `return_path_domain` | none | Always. PostHog's send doesn't take it yet |
| `google_analytics_domains`, `google_analytics_campaign` | none | Always. PostHog's send doesn't take it yet |
| `ip_pool` | none | Always. PostHog's send doesn't take it yet |
| `send_at` | none | Always. PostHog's send doesn't take it yet |

**Tracking.** PostHog captures opens and clicks unless the send sets `captureEngagement: false`, which turns off both. Mailchimp Transactional tracks opens when the send's `track_opens` is `true`, and clicks when its `track_clicks` is `true`. A send that leaves either one out takes the account's Sending Defaults for it, as `account.md` says. Click tracking that the account turns on for HTML emails only, or for text emails only, counts as on for an email that has that part, and as off for one that hasn't: when it counts as on, note in the plan row that PostHog tracks links in both parts. Work out, for opens and for clicks, whether Mailchimp Transactional tracked them:

- Both on: the site moves with no `captureEngagement` field.
- Both off: the site moves with `captureEngagement: false`.
- One on and one off, such as `track_clicks: false` on an account that tracks opens: the site stays, because `captureEngagement: false` turns off both.
- The installed SDK has no `captureEngagement`, and Mailchimp Transactional tracked neither: the site stays.
- A template site that Mailchimp Transactional sent with either one off stays, as "Templates" says.

When a site leaves out `track_opens` or `track_clicks`, and the person can't say what the Sending Defaults set for it, the site stays, and the reason is `account tracking not checked`. The API has no read of the Sending Defaults.

A Mailchimp Transactional send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Mailchimp Transactional call | A site stays on Mailchimp Transactional when |
|---|---|
| `messages.send` in every SDK and older client, a community client's send, `POST /api/<version>/messages/send` | A field above keeps it |
| `messages.sendTemplate`, `send_template`, `POST /api/<version>/messages/send-template` | A field above keeps it, or "Templates" does |
| `messages.sendMcTemplate`, `send_mc_template`, `messages/send-mc-template` | Always. The template lives in Mailchimp. It moves once the person makes it in PostHog and the site is checked as a stored template |
| `messages.sendRaw`, `send_raw`, `messages/send-raw` | Always. PostHog takes no MIME document |
| Several entries of type `to`, with or without `preserve_recipients: false` | Always: each sends several emails, or one email to several people, in one call |
| SMTP through `smtp.mandrillapp.com` | Always here. `migrate-email-smtp` moves sends through SMTP: run `wizard migrate smtp` for them, or `wizard skill migrate-email-smtp` on a wizard whose `migrate` takes no provider |
| A framework mailer (djrill, Anymail, `mandrill_mailer`, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |
| A send through the older PHP client `mandrill/mandrill`, or through a copy of it kept in the app's own code, even under other class names, that posts to `mandrillapp.com/api` | Always. Its source is no longer published, so the rewrite can't tell how the site failed |

## Code around the send

Mailchimp Transactional's SDKs report an error in two ways. The Python and Ruby SDKs, and every older client, raise. The Node.js and PHP SDKs never throw: they answer the error object in place of the list. A plain HTTP request does what its client does, with the options the code gives it:

- These throw or raise on a failed status: `axios` unless its `validateStatus` accepts the status, `got` and `ky` unless `throwHttpErrors: false`, Guzzle unless `'http_errors' => false`, Faraday with the `raise_error` middleware, and any request followed by `raise_for_status()` or `EnsureSuccessStatusCode()`.
- These answer a failed status as a response: `fetch`, `requests`, `httpx`, Ruby's `Net::HTTP`, PHP's `curl_exec`, Go's `net/http`, .NET `HttpClient` without `EnsureSuccessStatusCode()`, and Guzzle with `'http_errors' => false`.
- A community client does what its source does on a failed status: read it.

And in every SDK, a recipient that Mailchimp Transactional refused comes back in a successful answer with the status `rejected` or `invalid`. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailchimp Transactional when |
|---|---|
| A check of the answer for an error: `Array.isArray(response)`, `response instanceof Error`, `response.isAxiosError`, `response.response.status`, `instanceof RequestException` | Never. Read PostHog's error instead, as the Rewrite section says |
| A `catch`, `except`, or `rescue` of `ApiClientError`, `MailchimpTransactional::ApiError`, `mandrill.Error`, or `Mandrill::Error`, or an `onError` callback | It branches on a Mailchimp Transactional error `name` other than `ValidationError`, such as `Invalid_Key`, or a subclass other than `ValidationError`, such as `mandrill.InvalidKeyError`. A branch on `ValidationError`, by `name` or by a subclass such as `mandrill.ValidationError` or `Mandrill::ValidationError`, moves: it reads PostHog's error name `validation_error`, after `recipient_suppressed`. A branch on another HTTP status, such as `429`, moves: read PostHog's status code. A retry on `429` also checks PostHog's error code, as the Rewrite section says |
| A check of a recipient's `status` for `rejected` or `invalid`, or of `sent`, `queued`, and `scheduled` as success | Never. PostHog's SDK reports a send it refuses as an error, such as `recipient_suppressed` for a suppressed address. A branch on `invalid` alone reads PostHog's error name `validation_error`, after `recipient_suppressed` |
| A branch on one `reject_reason` | The reason is not `hard-bounce`, `spam`, or `custom`, or the site handles those three differently, such as marking a user bounced on `hard-bounce` and unsubscribing them on `spam`. PostHog answers all three as `recipient_suppressed`, so the site moves only when it does the same for each |
| A recipient's `_id` stored for a webhook or a status read | Always, when a webhook handler or `messages/info` uses it |
| A recipient's `_id` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A stored template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Mailchimp Transactional template, makes it transactional, and gives you its template ID. Until then the site stays on Mailchimp Transactional. The check needs the content of the template's published version, because the code has only its slug. `account.md` says how to get it.

- The site's `merge_language` says which merge tags the template uses. When the site doesn't set it, the account's default decides: read the template, `*|NAME|*` is the Mailchimp language and `{{name}}` is Handlebars.
- A site whose `template_content` holds an entry stays: it fills an `mc:edit` region with content, usually HTML, and PostHog's Liquid escapes HTML in a value. An empty `template_content`, such as `[]`, moves. So does a list whose entries have no `name`, such as `[{}]`, which the API's own examples send: an entry with no `name` fills no region.
- Mailchimp Transactional reads merge var names in any case. PostHog's Liquid doesn't: write each variable with the name the code sends, such as `{{ variables.first_name }}` for `{ name: 'first_name' }`, even when the template writes `*|FIRST_NAME|*`. Names that differ only in case are one variable, such as `reset_url` in `global_merge_vars` and `RESET_URL` in `merge_vars`: use one spelling in the template and in `templateData`.

Merge tags become Liquid in the PostHog template. Values move under `variables`.

| Mailchimp merge language | PostHog |
|---|---|
| `*\|NAME\|*` | `{{ variables.NAME }}` |
| `*\|IF:NAME\|*…*\|ELSE:\|*…*\|END:IF\|*`, when `NAME` is a boolean | `{% if variables.NAME %}…{% else %}…{% endif %}` |
| `*\|IF:NAME=value\|*`, `*\|IF:NAME!=value\|*`, when `NAME` is a string | `{% if variables.NAME == 'value' %}`, `{% if variables.NAME != 'value' %}` |
| `*\|ELSEIF:NAME=value\|*`, when `NAME` is a string | `{% elsif variables.NAME == 'value' %}` |
| `*\|IFNOT:NAME\|*…*\|END:IF\|*`, when `NAME` is a boolean | `{% unless variables.NAME %}…{% endunless %}` |
| `*\|UPPER:NAME\|*`, `*\|LOWER:NAME\|*` | `{{ variables.NAME \| upcase }}`, `{{ variables.NAME \| downcase }}` |

| Handlebars | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{user.first_name}}` | `{{ variables.user.first_name }}` |
| `{{#if paid}}…{{elseif due}}…{{else}}…{{/if}}`, when `paid` and `due` are booleans | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{this.name}}{{/each}}` or `{{#each items}}{{name}}{{/each}}`, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{this}}` inside `{{#each items}}` | `{{ item }}` |
| `{{upper name}}`, `{{lower name}}` | `{{ variables.name \| upcase }}`, `{{ variables.name \| downcase }}` |
| The template's subject | The PostHog template's subject, with the same conversions |

Write the `\|` above as a plain `|`. The tables escape it.

- Handlebars `{{name}}` escapes HTML, and so does PostHog's Liquid, so plain values render the same. `{{{name}}}` and `*|HTML:NAME|*` insert HTML as it is: a template that uses either stays.
- A `*|NAME|*` value that can hold HTML, such as markup the code builds, keeps the template on Mailchimp Transactional: PostHog's Liquid escapes it.
- Any other merge tag or helper keeps the template on Mailchimp Transactional: `*|TITLE:|*`, `*|URL:|*`, `*|DATE:|*`, `*|UNSUB:|*`, `*|FNAME|*`, `*|LNAME|*`, `*|EMAIL|*`, `*|CURRENT_YEAR|*`, an `*|IF:|*` with `>`, `<`, `>=`, or `<=`, `{{#with}}`, a comparison in backticks, `title`, `url`, `date`, `striptags`, `unsub`, `{{@index}}`, a block that reads a value outside the loop with `../`, and a section that loops over a name, such as `{{#items}}…{{/items}}`.
- Both merge languages treat an empty string as false in an `if`, and Handlebars also `0` and an empty list. Liquid treats all three as true. Read what the site sends for each value an `if`, `unless`, `IF`, or `IFNOT` tests. A value that is not always a boolean, `null`, or missing keeps the template on Mailchimp Transactional.
- An `*|IF:NAME=value|*` compares text. Liquid's `==` also compares the type, so a value that is not always a string keeps the template on Mailchimp Transactional.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on Mailchimp Transactional.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from_email`, `from_name`, `subject`, or a `Reply-To` header next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc` or `bcc` entries, `bcc_address`, `attachments`, or `images` next to the template stays, and so does a template site that Mailchimp Transactional sent with open or click tracking off, from the send's `track_opens` or `track_clicks` or from the account's Sending Defaults: a template made in PostHog sends with its own settings, and the template form takes none of them, `captureEngagement` included.
- A site that sets `html` or `text` next to the template stays: Mailchimp Transactional sends the site's `html` when the template has none, and the template form takes neither.

## Webhooks

The webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Mailchimp Transactional event | PostHog event |
|---|---|
| `send` | `$workflows_email_sent` |
| `delivered` | `$workflows_email_delivered` |
| `hard_bounce` | `$workflows_email_bounced` |
| `spam` | `$workflows_email_blocked` |
| `open` | `$workflows_email_opened` |
| `click` | `$workflows_email_link_clicked` |
| `reject` | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| `soft_bounce`, `deferral`, `unsub`, and the denylist and allowlist sync events | none |

PostHog's events carry no Mailchimp Transactional `_id` and no `msg.metadata`. A site whose events a handler matches by the `_id` the send answered stays on Mailchimp Transactional, and so does a site that sets `metadata` (see "Fields"). For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'mandrill'` on the client that Step 7 configures, when its client options take it.

**The call.** The Mailchimp Transactional send becomes one PostHog send. Build its fields from the `message` the site built: the object in Node.js, the dict in Python, the hash in Ruby, the array in PHP, the JSON body of an HTTP request, or the struct of a community client. The older clients take the same `message`.

**The fields.**

- `from_email: 'hello@mail.example.com'` with `from_name: 'Example'` becomes `from: 'Example <hello@mail.example.com>'`. A name with a comma, a quote, or another special character goes in double quotes, such as `'"Acme, Inc." <hello@mail.example.com>'`. A `from_email` without `from_name` becomes the bare address.
- The one `to` entry of type `to` becomes `to` as a bare address. The `cc` entries become `cc`, and the `bcc` entries and `bcc_address` become `bcc`, as bare addresses. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `headers: { 'Reply-To': 'support@example.com' }` becomes `replyTo: 'support@example.com'`. Several addresses in one value, separated by commas, become a list.
- An attachment `{ type, name, content }` becomes `{ filename: name, contentType: type, content }`. An image `{ type, name, content }` becomes `{ filename: name, contentType: type, content, contentId: name }`: its `name` is already the bare name the HTML reads as `cid:<name>`. In Node.js and Python, `content` stays the same base64 string. In Go and Elixir, the SDK takes the raw file: decode the base64 string first, as `posthog-sdks.md` says, or the recipient gets the file encoded twice.
- A site that Mailchimp Transactional tracked neither opens nor clicks for, from its own `track_opens` and `track_clicks` or from the account's Sending Defaults, sends `captureEngagement: false`, as "Tracking" says. Without it, the moved send would capture what Mailchimp Transactional didn't track.
- The fields that move as none, such as `async`, `url_strip_qs`, and `preserve_recipients`, are left out.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with one entry per merge var: `{ [name]: content }` from `global_merge_vars`, then the entries of the one recipient's `merge_vars`, which win over a global entry with the same name in any case. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did. Never widen a catch: a catch of one error class or one status becomes a catch of PostHog's error that checks its `code` or status code, and raises or returns every other error as before. A catch of every error around the send, such as a bare `except:`, `except Exception`, `rescue => e`, `rescue StandardError`, or `catch (\Throwable $e)`, stays as it is: it caught network errors before too, so it raises no `network_error` again, whatever the bullets below say for a narrower catch.

- **Node.js.** The official SDK answered the `AxiosError` in place of the list, and `posthog.emails.send` answers `{ data, error }`: neither throws. Where the code checked the answer for an error, or a recipient's `status` for `rejected` or `invalid`, check `error`, and run the same branch. Where that branch threw the answer, throw from the error, `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode, name: error.name, code: error.code })`, so a network failure, which has no status, keeps `err.code` `network_error`, and change each read of the `AxiosError` in its `catch`, such as `err.response.status`, to `err.statusCode`, and `err.response.data` to `err.message`. A check of `ValidationError` in the error body, such as `response.response?.data?.name === 'ValidationError'`, or of a recipient's `status` for `invalid` alone, becomes `error?.name === 'validation_error'`, after `recipient_suppressed`. A check of one other status, such as `response.response?.status === 429`, becomes `error?.statusCode === 429`. Every other error goes the way it went before. A site that never checked the answer never failed on an error: add no check.
- **Node.js, `mandrill-api`.** Replace the callbacks with `const { data, error } = await posthog.emails.send(...)`. The body of `onSuccess` runs when there is no `error`, and the body of `onError` runs with `error` in place of the error body, reading `error.message`. A check of the body's `name` for `ValidationError` in `onError` becomes `error.name === 'validation_error'`, after `recipient_suppressed`. Without `onError`, the old client threw: `if (error) throw new Error(error.message)`.
- **Python.** PostHog's SDK raises too. Replace `except ApiClientError` or `except mandrill.Error` with the PostHog exception `posthog-sdks.md` names. `e.status_code` stays `e.status_code`, and a read of `e.text` becomes `e.message`. Where the code checked a recipient's `status` after the call, move that branch into the `except`. The old `except` saw only answers from the API: a network error raised the HTTP library's own error, which it didn't catch. So the new `except` first raises again an error whose `code` is `network_error`. A catch of `mandrill.ValidationError`, a check of `e.text['name'] == 'ValidationError'`, or a check of a recipient's `status` for `invalid` alone becomes a check of `e.name == 'validation_error'`, after `recipient_suppressed`. A check of one other status, such as `if e.status_code == 429`, stays a check of `e.status_code`. Every other error is raised again as before.
- **Ruby.** Replace `rescue MailchimpTransactional::ApiError` or `rescue Mandrill::Error` with `rescue PostHog::EmailError`. `e.status` becomes `e.status_code`, and `e.response_body` becomes `e.message`. Where the code checked a recipient's `status`, move that branch into the `rescue`. The old `rescue` saw only answers from the API, so the new one first raises again an error whose `code` is `network_error`. A `rescue Mandrill::ValidationError`, or a check of a recipient's `status` for `invalid` alone, becomes a check of `e.name == 'validation_error'`, after `recipient_suppressed`. A check of one other status, such as `e.status == 429`, becomes a check of `e.status_code`. Every other error is raised again as before.
- **PHP.** The official SDK answered a `RequestException` in place of the list, and PostHog's SDK throws `PostHog\EmailError`. Wrap the send in `try`, and run the branch of the old `instanceof RequestException` or `status` check in `catch (\PostHog\EmailError $e)`, with `getStatusCode()` for `getCode()` and `getMessage()` for the body. A check of the body's `name` for `ValidationError`, or of a recipient's `status` for `invalid` alone, becomes a check of `getErrorName() === 'validation_error'`, after `recipient_suppressed`. A check of one other status, such as `getCode() === 429`, becomes `getStatusCode() === 429`. Every other error is handled as before. A site that never checked the answer never failed on an API error: catch `EmailError` and go on, and note the site in the plan. A connection error depends on the Guzzle version in `composer.lock`, as `sdk-reference.md` says. With Guzzle 6 it was answered like an API error, so `network_error` takes the same branch as every other error. With Guzzle 7 it was thrown, so the `catch` first throws an error whose `getErrorCode()` is `network_error` again.
- **Go, .NET, Elixir, and HTTP calls.** Where the code read the HTTP status, or a recipient's `status` in the body, read PostHog's error the way `posthog-sdks.md` says for the language, and keep each branch: a status of 400 or more, or a `rejected` or `invalid` recipient, becomes "there is an error". A branch on the body's `name` for `ValidationError`, or on an `invalid` recipient alone, reads PostHog's error name `validation_error`, after `recipient_suppressed`. A branch on one other status, such as 429, reads PostHog's status code. Every other error is handled as before. Where the code never read the status, the client decided, as "Code around the send" says. A client that threw or raised on a failed status: the moved site throws or raises PostHog's error the same way, in Node.js with the `if (error) throw` line of the Node.js bullet, and a catch of the client's status error, such as axios's `AxiosError` with a `response`, becomes a catch of PostHog's error that lets `network_error` through where a network failure passed it. A client that answered a failed status: the site went on after a refused send, so catch PostHog's error, log it and go on, and raise or return it when its code is `network_error`, as Step 7 says. PHP's `curl_exec` didn't raise on a network failure either: it returned `false`. A site that never checked that went on after a network failure too, so its moved site also logs `network_error` and goes on. Note the site in the plan.
- A branch on `429` that waits and tries again, such as a retry loop or a back-off, also checks that PostHog's error code is not `quota_limited`: PostHog answers a used-up quota with `429` and that code, and a retry doesn't clear a quota. PostHog's SDK already retries a rate limit twice inside each send, so each pass of the loop can make 3 requests. Note both changes in the plan row.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailchimp Transactional answered a `rejected` recipient without an error. When the site throws, retries, or reports a failure on any error, but went on when a recipient was `rejected`, handle `recipient_suppressed` before that branch the way the site handled a rejected recipient: log it and go on. Note each site that got this branch in the report.
- Mailchimp Transactional also answered a malformed address as an `invalid` recipient without an error, and PostHog's SDK reports a send it refuses as an error. When the site fails on any error but went on when a recipient was `invalid`, keep that: check the recipient's address before the send, and log and skip the send when it isn't a valid address, as the site went on. PostHog's `validation_error` also covers other invalid sends, which Mailchimp Transactional answered as errors, so the name alone can't stand for an `invalid` recipient. Note each site that got the check in its plan row and in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged a recipient's `_id`, or stored it for the app's own use, takes PostHog's message id instead.

**The Mailchimp Transactional client.** Keep the Mailchimp Transactional client, its import, and its key while any site or other call still uses them. The package serves more than sends: the same client also calls templates, rejects, webhooks, subaccounts, SMS, and Mailchimp Transactional's other APIs, so a call such as `messages.info` or `rejects.add` keeps it. A call that adds an address to the main account's Rejection Denylist, `rejects.add` or `POST /api/<version>/rejects/add` without a `subaccount`, stops only Mailchimp Transactional's sends: an address it adds after the import still gets the moved sends. List it with the calls that are not sends, and add to the report's "Before cutover" that the person makes that call write to both lists before the deploy: it keeps its Mailchimp Transactional write and also adds the address to PostHog's suppression list. A call that takes an address off that list, `rejects.delete` or `POST /api/<version>/rejects/delete` without a `subaccount`, works the same way, as Step 5 says: it also removes the address from PostHog's suppression list. The Mailchimp Transactional write stays while any main-account send still goes through Mailchimp Transactional, such as a site that stays or a mailer, and goes only once the last of them moves. A framework mailer that serves several providers, such as Anymail, Swoosh, or Bamboo, stays for the app's other mail. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
