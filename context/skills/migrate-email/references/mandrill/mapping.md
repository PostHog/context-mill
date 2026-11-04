# Mailchimp Transactional to PostHog mapping

This file decides, field by field, whether PostHog can send a Mailchimp Transactional call site. A site moves only when every field it sets moves. Otherwise it stays on Mailchimp Transactional, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

The site's fields are the fields of `message`, plus the top-level `async`, `ip_pool`, and `send_at`. A field set to `null` is not set.

## Fields

| Mailchimp Transactional | PostHog | A site stays on Mailchimp Transactional when |
|---|---|---|
| `from_email` with `from_name` | `from` | Never. `from_email` with `from_name` becomes `'Name <email>'`. It needs a verified sender (Step 4) |
| `to` entries of type `to`, or without a type | `to` | There is more than one. One entry moves as its bare address: note in the plan row when the To line loses its `name` |
| `to` entries of type `cc` | `cc` | The installed SDK has no `cc` (Step 7 checks), there are more than 10, the code builds the list at run time and you cannot tell it stays at 10 or fewer, or the site does not set `preserve_recipients: true`. Without it, the account's default decided whether each recipient saw the other addresses, and the code can't show which |
| `to` entries of type `bcc` | `bcc` | The installed SDK has no `bcc`, there are more than 10, or the code builds the list at run time and you cannot tell it stays at 10 or fewer |
| `bcc_address` | `bcc`, one address | The installed SDK has no `bcc`, or the site sends to more than one recipient |
| `subject` | `subject` | It holds a merge tag (see `merge`) |
| `html`, `text` | `html`, `text` | They hold a merge tag (see `merge`) |
| `headers` with `Reply-To` | `replyTo`, one address or a list | The value carries a name, there are more than 10 addresses, or the code builds the value at run time and you cannot tell that it holds bare addresses only |
| `headers` with any other header | `headers` | The installed SDK has no `headers`, or there are more than 10 |
| `merge`, `merge_language`, `global_merge_vars`, `merge_vars` on a site with `html` or `text` | none | `html`, `text`, `subject`, or `from_name` holds a merge tag, such as `*\|NAME\|*` or `{{name}}`. Without a merge tag in them, the values change nothing, and the site moves without them |
| `merge_vars` with entries for more than one `rcpt` | none | Always: the site sends to several recipients |
| `track_opens` or `track_clicks` set to `false` | `captureEngagement: false` | The installed SDK has no `captureEngagement`. `false` turns off both open and click capture: note it in the plan row |
| `track_opens`, `track_clicks` set to `true` | none | Never. PostHog captures opens and clicks when engagement events are on |
| `auto_text`, `auto_html` set to `true` | none | The site sends no `text` (for `auto_text`) or no `html` (for `auto_html`) |
| `inline_css` set to `true` | none | Always |
| `important` set to `true` | none | Always |
| `view_content_link` set to `false` | none | Always |
| `url_strip_qs`, `preserve_recipients` | none | Never on their own. They change only Mailchimp Transactional's reports, or what several recipients see |
| `async` | none | Never on its own. It changes only when Mailchimp Transactional answers |
| `tags` | `tags`, `{ name: 'tag', value: <tag> }` | The installed SDK has no `tags`, or the site sets more than one tag: PostHog tags are name and value pairs, not a list of labels |
| `metadata`, `recipient_metadata` for the one recipient | `tags`, one `{ name, value }` per entry | The installed SDK has no `tags`, there are more than 10, or a webhook handler reads them back (see "Webhooks") |
| `attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files with `images`, or the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length. PostHog takes at most 10 files and 512 KB in all |
| `images` | `attachments`, each with `contentId` | The same as `attachments`, counted together with them |
| `subaccount` | none | Always. The subaccount has its own reports, quota, and denylist at Mailchimp Transactional |
| `tracking_domain`, `signing_domain`, `return_path_domain` | none | Always |
| `google_analytics_domains`, `google_analytics_campaign` | none | Always |
| `ip_pool` | none | Always |
| `send_at` | none | Always |

A Mailchimp Transactional send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Mailchimp Transactional call | A site stays on Mailchimp Transactional when |
|---|---|
| `messages.send` in every SDK and older client, a community client's send, `POST /api/<version>/messages/send` | A field above keeps it |
| `messages.sendTemplate`, `send_template`, `POST /api/<version>/messages/send-template` | A field above keeps it, or "Templates" does |
| `messages.sendMcTemplate`, `send_mc_template`, `messages/send-mc-template` | Always. The template lives in Mailchimp. It moves once the person makes it in PostHog and the site is checked as a stored template |
| `messages.sendRaw`, `send_raw`, `messages/send-raw` | Always. PostHog takes no MIME document |
| Several entries of type `to`, with or without `preserve_recipients: false` | Always: each sends several emails, or one email to several people, in one call |
| SMTP through `smtp.mandrillapp.com` | Always. PostHog has no SMTP relay |
| A framework mailer (djrill, Anymail, `mandrill_mailer`, Swoosh, Bamboo) | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |

## Code around the send

Mailchimp Transactional's SDKs report an error in two ways. The Python and Ruby SDKs, and every older client, raise. The Node.js and PHP SDKs never throw: they answer the error object in place of the list. HTTP code reads the status. And in every SDK, a recipient that Mailchimp Transactional refused comes back in a successful answer with the status `rejected` or `invalid`. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Mailchimp Transactional when |
|---|---|
| A check of the answer for an error: `Array.isArray(response)`, `response instanceof Error`, `response.isAxiosError`, `response.response.status`, `instanceof RequestException` | Never. Read PostHog's error instead, as the Rewrite section says |
| A `catch`, `except`, or `rescue` of `ApiClientError`, `MailchimpTransactional::ApiError`, `mandrill.Error`, or `Mandrill::Error`, or an `onError` callback | It branches on a Mailchimp Transactional error `name`, such as `Invalid_Key`, or a subclass, such as `mandrill.ValidationError`. A branch on the HTTP status moves: read PostHog's status code |
| A check of a recipient's `status` for `rejected` or `invalid`, or of `sent`, `queued`, and `scheduled` as success | Never. PostHog refuses the send with an error instead |
| A branch on one `reject_reason` | The reason is not `hard-bounce`, `spam`, or `custom`. Those three become PostHog's `recipient_suppressed` |
| A recipient's `_id` stored for a webhook or a status read | Always, when a webhook handler or `messages/info` uses it |
| A recipient's `_id` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A stored template site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Mailchimp Transactional template, makes it transactional, and gives you its template ID. Until then the site stays on Mailchimp Transactional. The check needs the content of the template's published version, because the code has only its slug. `account.md` says how to get it.

- The site's `merge_language` says which merge tags the template uses. When the site doesn't set it, the account's default decides: read the template, `*|NAME|*` is the Mailchimp language and `{{name}}` is Handlebars.
- A site whose `template_content` holds an entry stays: it fills an `mc:edit` region with content, usually HTML, and PostHog's Liquid escapes HTML in a value. An empty `template_content`, such as `[]`, moves.
- Mailchimp Transactional reads merge var names in any case. PostHog's Liquid doesn't: write each variable with the name the code sends, such as `{{ variables.first_name }}` for `{ name: 'first_name' }`, even when the template writes `*|FIRST_NAME|*`.

Merge tags become Liquid in the PostHog template. Values move under `variables`.

| Mailchimp merge language | PostHog |
|---|---|
| `*\|NAME\|*` | `{{ variables.NAME }}` |
| `*\|IF:NAME\|*…*\|ELSE:\|*…*\|END:IF\|*` | `{% if variables.NAME %}…{% else %}…{% endif %}` |
| `*\|IF:NAME=value\|*`, `*\|IF:NAME!=value\|*` | `{% if variables.NAME == 'value' %}`, `{% if variables.NAME != 'value' %}` |
| `*\|ELSEIF:NAME=value\|*` | `{% elsif variables.NAME == 'value' %}` |
| `*\|IFNOT:NAME\|*…*\|END:IF\|*` | `{% unless variables.NAME %}…{% endunless %}` |
| `*\|UPPER:NAME\|*`, `*\|LOWER:NAME\|*` | `{{ variables.NAME \| upcase }}`, `{{ variables.NAME \| downcase }}` |

| Handlebars | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{user.first_name}}` | `{{ variables.user.first_name }}` |
| `{{#if paid}}…{{elseif due}}…{{else}}…{{/if}}` | `{% if variables.paid %}…{% elsif variables.due %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}` | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{this.name}}{{/each}}`, or `{{name}}` inside the block | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{upper name}}`, `{{lower name}}` | `{{ variables.name \| upcase }}`, `{{ variables.name \| downcase }}` |
| The template's subject | The PostHog template's subject, with the same conversions |

Write the `\|` above as a plain `|`. The tables escape it.

- Handlebars `{{name}}` escapes HTML, and so does PostHog's Liquid, so plain values render the same. `{{{name}}}` and `*|HTML:NAME|*` insert HTML as it is: a template that uses either stays.
- A `*|NAME|*` value that can hold HTML, such as markup the code builds, keeps the template on Mailchimp Transactional: PostHog's Liquid escapes it.
- Any other merge tag or helper keeps the template on Mailchimp Transactional: `*|TITLE:|*`, `*|URL:|*`, `*|DATE:|*`, `*|UNSUB:|*`, `*|FNAME|*`, `*|LNAME|*`, `*|EMAIL|*`, `*|CURRENT_YEAR|*`, an `*|IF:|*` with `>`, `<`, `>=`, or `<=`, `{{#with}}`, a comparison in backticks, `title`, `url`, `date`, `striptags`, `unsub`, `{{@index}}`, a block that reads a value outside the loop with `../`, and a section that loops over a name, such as `{{#items}}…{{/items}}`.
- Both merge languages treat an empty string as false in an `if`, and Handlebars also `0` and an empty list. Liquid treats all three as true. When the code can pass an empty string for a value an `if` tests, write `{% if variables.name and variables.name != '' %}`. When it can pass `0` or an empty list, the template stays.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `from_email`, `from_name`, `subject`, or a `Reply-To` header next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A site that sets `cc` or `bcc` entries, `bcc_address`, `attachments`, `images`, other `headers`, `tags`, or `metadata` next to the template stays: a template made in PostHog sends with its own settings.

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

PostHog's events carry no Mailchimp Transactional `_id` and no `msg.metadata`. A site whose events a handler matches by the `_id` the send answered, or by a `metadata` value the send set, stays on Mailchimp Transactional. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'mandrill'` on the client that Step 7 configures, when its client options take it.

**The call.** The Mailchimp Transactional send becomes one PostHog send. Build its fields from the `message` the site built: the object in Node.js, the dict in Python, the hash in Ruby, the array in PHP, the JSON body of an HTTP request, or the struct of a community client. The older clients take the same `message`.

**The fields.**

- `from_email: 'hello@mail.example.com'` with `from_name: 'Example'` becomes `from: 'Example <hello@mail.example.com>'`. A `from_email` without `from_name` becomes the bare address.
- The one `to` entry of type `to` becomes `to` as a bare address. The `cc` entries become `cc`, and the `bcc` entries and `bcc_address` become `bcc`, as bare addresses. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `headers: { 'Reply-To': 'support@example.com' }` becomes `replyTo: 'support@example.com'`. Several addresses in one value, separated by commas, become a list.
- An attachment `{ type, name, content }` becomes `{ filename: name, contentType: type, content }`. An image `{ type, name, content }` becomes `{ filename: name, contentType: type, content, contentId: name }`, so the HTML's `cid:<name>` still finds it. `content` stays the same base64 string.
- `metadata: { orderId: '123' }` becomes `tags: [{ name: 'orderId', value: '123' }]`, and `tags: ['receipt']` becomes `tags: [{ name: 'tag', value: 'receipt' }]`. A value that isn't a string becomes its string.
- `track_opens: false` or `track_clicks: false` becomes `captureEngagement: false`.
- The fields that move as none, such as `async`, `url_strip_qs`, and `preserve_recipients`, are left out.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with one entry per merge var: `{ [name]: content }` from `global_merge_vars`, then the entries of the one recipient's `merge_vars`, which win over the global ones. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** The official SDK answered the `AxiosError` in place of the list, and `posthog.emails.send` answers `{ data, error }`: neither throws. Where the code checked the answer for an error, or a recipient's `status` for `rejected` or `invalid`, check `error`, and run the same branch. Where that branch threw the answer, throw from the error, `if (error) throw Object.assign(new Error(error.message), { statusCode: error.statusCode })`, and change each read of the `AxiosError` in its `catch`, such as `err.response.status`, to `err.statusCode`, and `err.response.data` to `err.message`. A site that never checked the answer never failed on an error: add no check.
- **Node.js, `mandrill-api`.** Replace the callbacks with `const { data, error } = await posthog.emails.send(...)`. The body of `onSuccess` runs when there is no `error`, and the body of `onError` runs with `error` in place of the error body, reading `error.message`. Without `onError`, the old client threw: `if (error) throw new Error(error.message)`.
- **Python.** PostHog's SDK raises too. Replace `except ApiClientError` or `except mandrill.Error` with the PostHog exception `posthog-sdks.md` names. `e.status_code` stays `e.status_code`, and a read of `e.text` becomes `e.message`. Where the code checked a recipient's `status` after the call, move that branch into the `except`.
- **Ruby.** Replace `rescue MailchimpTransactional::ApiError` or `rescue Mandrill::Error` with `rescue PostHog::EmailError`. `e.status` becomes `e.status_code`, and `e.response_body` becomes `e.message`. Where the code checked a recipient's `status`, move that branch into the `rescue`.
- **PHP.** The official SDK answered a `RequestException` in place of the list, and PostHog's SDK throws `PostHog\EmailError`. Wrap the send in `try`, and run the branch of the old `instanceof RequestException` or `status` check in `catch (\PostHog\EmailError $e)`, with `getStatusCode()` for `getCode()` and `getMessage()` for the body. A site that never checked the answer never failed on an error: catch `EmailError` and go on, and note the site in the plan.
- **Go, .NET, Elixir, and HTTP calls.** The code read the HTTP status, or a recipient's `status` in the body. Read PostHog's error the way `posthog-sdks.md` says for the language, and keep each branch: a status of 400 or more, or a `rejected` or `invalid` recipient, becomes "there is an error", and a branch on one status, such as 429, reads PostHog's status code.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Mailchimp Transactional answered a `rejected` recipient without an error. When the site throws, retries, or reports a failure on any error, but went on when a recipient was `rejected`, handle `recipient_suppressed` before that branch the way the site handled a rejected recipient: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged a recipient's `_id`, or stored it for the app's own use, takes PostHog's message id instead.

**The Mailchimp Transactional client.** Keep the Mailchimp Transactional client, its import, and its key while any site or other call still uses them. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
