# Loops to PostHog mapping

This file decides, field by field, whether PostHog can send a Loops call site. A site moves only when every field it sets moves. Otherwise it stays on Loops, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

PostHog fields are written in their Node.js names here, such as `templateData`. Use the name `posthog-sdks.md` gives for the site's language, such as `template_data` in Python.

Every Loops send renders a transactional email stored at Loops. So every Loops site is a `template` site in the plan, and it moves only to a template the person makes in PostHog from the Loops email (see "Templates"). It moves in PostHog's template form: `templateId` with `templateData`. No Loops site moves to the code form, because its content is not in the code.

## Fields

| Loops | PostHog | A site stays on Loops when |
|---|---|---|
| `email` | `to` | Never. It is always one address |
| `transactionalId` | `templateId`, the ID of the template the person made in PostHog | See "Templates" |
| `dataVariables` | `templateData`, with the same keys and values | A value holds HTML that the email must render, such as a `<br>`-joined list the code builds: PostHog's Liquid escapes it |
| `addToAudience: true` | none | Always. It adds the recipient to the Loops audience, which Loops' campaigns and workflows send to, so moving the send would stop new contacts reaching it. `false` or no value moves. It moves only when the same code path already creates or updates that recipient as a Loops contact before the send, such as with `createContact` or `updateContact`. A contact call elsewhere in the app doesn't count. Otherwise the report tells the person that such a call would let the site move |
| `attachments` | none | Always. A template made in PostHog sends in the template form, which takes no attachments |
| `Idempotency-Key` header (`headers` in Node.js, PHP, and Ruby, `IdempotencyKey` in Go) | `idempotencyKey` | The code can build a key with a space or a character outside visible ASCII. Loops' keys are at most 100 characters, and PostHog takes 1 to 255 visible ASCII characters, so any other Loops key fits. A key built from a value whose characters the code doesn't bound, such as text from a caller, counts as one that can. The report names that value, so the person can bound the key, such as by hashing that part, and move the site |
| Any other request header in `headers` | none | Always: no PostHog SDK takes headers yet |

The Loops email itself sets the rest, in its sending settings. The template check in Step 3 reads them:

| Loops email setting | PostHog | A site stays on Loops when |
|---|---|---|
| Subject | the PostHog template's subject | Never. Its data variables convert as the "Templates" table says |
| Name and From | the PostHog template's sender | Either holds a data variable. The sender must be a verified sender (Step 4) |
| Reply | the PostHog template's reply-to address | It holds a data variable |
| CC, BCC | none | Either one is set. The template form takes no `cc` or `bcc` |
| Preview | none | Never. The person rebuilds the preview text in PostHog, as they rebuild the design. When it holds a data variable, the report gives its Liquid form, as the "Templates" table says |

A site with no idempotency key sends none in PostHog either.

## Calls

| Loops call | A site stays on Loops when |
|---|---|
| `loops.sendTransactionalEmail`, `client.SendTransactional`, `$loops->transactional->send`, `LoopsSdk::Transactional.send`, a community package's send, `POST /api/v1/transactional` | A field above keeps it |
| A send inside a loop over recipients | A field above keeps it. Each call already sends one email to one address, so the loop stays as it is |
| SMTP through `smtp.loops.so`, from Nodemailer or a framework mailer (Django, Rails, Laravel) | Always here. A Nodemailer send through SMTP moves with `wizard migrate smtp`. PostHog has no mailer driver for a framework mailer |
| Auth.js `next-auth/providers/loops` | Always. PostHog has no Auth.js provider |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java | Always |
| `sendEvent` and `POST /api/v1/events/send` | Not a send: it starts a Loops workflow. List it with the other Loops calls |

Loops has no batch send, no send time, and no send to several addresses, so no site uses them.

## Code around the send

Loops' official SDKs throw or raise on an API error, and the Go SDK returns an error value. HTTP code reads the response. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Loops when |
|---|---|
| A `catch` or `rescue` that reads `err.statusCode`, `err.json`, `e.json`, `getStatusCode()`, or `getJson()`, or Go's `apiErr.StatusCode` and `apiErr.Message` | It branches on a Loops error text, such as `Missing required data variable(s)`. A branch on the HTTP status moves: a branch on `400`, Loops' answer to an invalid send, reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code |
| A branch on `RateLimitExceededError` or `LoopsSdk::RateLimitError` | Never. It becomes a branch on PostHog's status code `429`. PostHog's SDK retries rate limits on its own first |
| A branch on status `409`, Loops' answer to a reused idempotency key | Never. Note it in the plan row: PostHog answers a repeat of the same send with the first send's answer and no error, so the branch no longer runs, and it answers a different send with the same key with the code `idempotency_key_reused`. Rewrite the branch to read that code |
| A check of the HTTP answer: `response.status_code`, `response.ok`, `raise_for_status()`, or `success` in the body | Never. Read PostHog's error instead |
| A read of a message id in Loops' answer | Never happens: Loops answers `{ success: true }` only |

An idempotency key that the code sent to Loops and now sends to PostHog can send the email twice when a retry crosses the deploy: the first try went to Loops, the retry goes to PostHog. Note each such key for the report.

## Templates

A Loops site moves only to a template made in PostHog. This skill never makes one: the person makes it from the Loops email, makes it transactional, and gives you its template ID. Until then the site stays on Loops. The check needs the content of the published Loops email, because the code has only its `transactionalId`. `account.md` says how to get it.

Loops' data variables become Liquid in the PostHog template. Values move under `variables`, and each name keeps its case. The editor, MJML, and LMX write a variable three ways:

| Loops | PostHog |
|---|---|
| `{name}` in the editor, `{DATA_VARIABLE:name}` in MJML, `{data.name}` in LMX | `{{ variables.name }}` |
| A variable in the Subject field | The same, in the PostHog template's subject |
| A variable in a button or link URL, or a dynamic image source | `{{ variables.name }}` in the URL or the image source |
| An array block `items`, with `{price}` inside, or MJML `<loops-array variable="items">` with `{DATA_VARIABLE:items[].price}` | `{% for item in variables.items %}…{{ item.price }}…{% endfor %}` |
| `{price}` inside the array block, an array item (the default) | `{{ item.price }}`, never `{{ variables.price }}` |
| A variable inside the array block whose **Array item** option is **No** | `{{ variables.name }}` |
| A section shown when `name` is not empty, LMX `if="{data.name}"` | `{% if variables.name and variables.name != '' %}…{% endif %}` |
| A section shown when `name` is empty, `ifOperation="empty"` | `{% unless variables.name and variables.name != '' %}…{% endunless %}` |
| `ifOperation="equal"` or `"not_equal"` with `ifValue="pro"` | `{% if variables.name == 'pro' %}…{% endif %}`, or `!=` |
| `ifOperation="contains"` or `"not_contains"` with `ifValue="pro"` | `{% if variables.name contains 'pro' %}…{% endif %}`, or `{% unless … %}…{% endunless %}` |
| An optional variable with a fallback value | `{{ variables.name \| default: 'there' }}` |
| An optional variable without a fallback | `{{ variables.name }}` |

Write the `\|` above as a plain `|`. The table escapes it.

- Quote every string in the Liquid with single quotes, as the table does. PostHog's email builder saves the template as JSON, which escapes double quotes, and the template then fails with a Liquid `TokenizationError`. A fallback or an `ifValue` that holds a `'`, or holds HTML such as a link, keeps the template on Loops.

- Loops reads every data variable as text, so a conditional section shows when the value is not an empty string, and Liquid treats `""`, `0`, and `[]` as true. The Liquid for `if` and `empty` above checks for `''` itself, so it converts when the code always sends a string or a number, or leaves the value out. A condition on an array variable keeps the template on Loops.
- `equal`, `not_equal`, `contains`, and `not_contains` compare the value as text at Loops. Convert them only when the code always sends a string for that value. A number keeps the template on Loops.
- An array block walks a list. Loops takes only a list of objects for it, so it always converts as the table says.
- Inside an array block, a variable reads the current item unless its **Array item** option in the editor is set to **No**. Such an item variable becomes `{{ item.price }}`, never `{{ variables.price }}`. Loops has no variable for the whole item, only its fields.
- Liquid's `default` also replaces an empty string. When the code can pass an empty string for such a value, the email shows the fallback. Note it in the report.
- The design, theme, components, and images of the Loops email do not decide whether it moves. The person rebuilds them in PostHog.
- Name, From, or Reply holding a data variable, or a CC or BCC set, keeps the template on Loops, as the settings table says. A fixed Name, From, and Reply move: the person puts them into the PostHog template.
- A template that the content check can't place in the table above stays, with what kept it as the reason.

## Webhooks

Loops' webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Loops event | PostHog event |
|---|---|
| `transactional.email.sent` | `$workflows_email_sent` |
| `email.delivered` | `$workflows_email_delivered` |
| `email.hardBounced` | `$workflows_email_bounced` |
| `email.spamReported` | `$workflows_email_blocked` |
| `email.softBounced` | none |
| `email.opened`, `email.clicked` | none. Loops sends them for campaign and workflow emails only. A moved send gets `$workflows_email_opened` and `$workflows_email_link_clicked`, which it never had at Loops |
| `email.unsubscribed`, `email.resubscribed`, `campaign.email.sent`, `loop.email.sent`, `contact.*` | none. They are about campaigns, workflows, and contacts, which stay on Loops |

A Loops send sets nothing that comes back in an event apart from its `transactionalId` and the recipient, so no handler keeps a site on Loops. For every handler that reads events with `sourceType` `transactional`, or that does not check `sourceType`, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler keeps working for the sites that stay, and for campaign and workflow events. Never change it.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'loops'` on the client that Step 7 configures, when its client options take it.

**The call.** The Loops send becomes one PostHog send in the template form:

- `email` becomes `to`.
- `transactionalId` becomes `templateId`, with the template ID the person gave in Step 3. Never reuse the Loops ID.
- `dataVariables` becomes `templateData`, with the same object. When the code builds `dataVariables` in a variable, pass that variable.
- An `Idempotency-Key` header becomes `idempotencyKey`, with the same value.
- Add `distinctId`, as Step 7 says. The send has no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

By source:

- Node.js `loops.sendTransactionalEmail({ transactionalId, email, dataVariables, headers })`: the fields of that object.
- Go `client.SendTransactional(loops.SendTransactionalRequest{...})`: `posthog.TemplateEmail{To, TemplateID, TemplateData, DistinctID, IdempotencyKey}`, sent with `client.Emails().Send(ctx, ...)`. Pass the function's `context.Context` when it has one, or `context.Background()`.
- PHP `$loops->transactional->send(transactional_id:, email:, data_variables:, headers:)` and Ruby `LoopsSdk::Transactional.send(transactional_id:, email:, data_variables:, headers:)`: `template_id`, `to`, `template_data`, and `idempotency_key`.
- A raw HTTP body or a community package's call: the same fields of its body.

**Errors.** Keep the site failing the same way it did, and never widen a catch. Loops' SDKs raise three kinds of error apart: an answer from Loops (`APIError`), a rate limit (`RateLimitExceededError` in Node.js and PHP, `LoopsSdk::RateLimitError` in Ruby), and a network error, which is the HTTP client's own error. PostHog answers all three as its one email error, with the code `network_error` for a network error that is left after its retries. So a branch that handled one kind checks PostHog's `code` or status code, and every other error is thrown, raised, or returned as before. Loops answers an invalid send with `400`. A branch on that status becomes a branch on PostHog's error name `validation_error`, never on a status code, as Step 7 says: PostHog's statuses for invalid sends differ from Loops'. Status checks for other statuses, such as `429` or `401`, stay status checks:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sendTransactionalEmail` threw into a `catch`, throw from the error so the same `catch` runs, and keep the property the `catch` reads: `if (error) throw Object.assign(new Error(error.message), { posthogEmailError: true, name: error.name, code: error.code, statusCode: error.statusCode })`. An `instanceof APIError` check becomes `err.posthogEmailError && err.code !== 'network_error' && err.statusCode !== 429`, and a read of `err.json` becomes a read of `err.message`. An `instanceof RateLimitExceededError` check becomes `err.posthogEmailError && err.statusCode === 429`, and a read of its `limit` or `remaining` has no PostHog value: log `err.statusCode` instead. A check of `err.statusCode === 400` becomes `err.name === 'validation_error'`. A `catch` that handled every error the same way needs none of these checks.
- **Python.** `except EmailError` takes the place of the Loops error, and a branch that handled one kind checks `e.code` or `e.status_code` first and raises every other error again, as the HTTP bullet shows. A check of `e.status_code == 400` becomes `e.name == "validation_error"`. When the site has two handlers that both become `except EmailError`, such as `except requests.HTTPError` and then `except requests.RequestException`, keep one `except EmailError as e:`: a second `except` of the same class never runs. Inside it, run the first handler's branch for the errors it took, such as Loops' answers (`e.code != "network_error"`), and the second handler's branch for the rest.
- **Go.** Loops' `SendTransactional` returned an `error`, and so does PostHog's `Send`. Keep `if err != nil`. Loops' Go SDK returned a network error as a plain error, not a `*loops.APIError`. Replace `errors.As(err, &apiErr)` on `*loops.APIError` with `errors.As(err, &emailErr) && emailErr.Code != "network_error"` on `*posthog.EmailError`, and `apiErr.StatusCode` and `apiErr.Message` with its `StatusCode` and `Message`. A check of `apiErr.StatusCode == 400` becomes `emailErr.Name == "validation_error"`. Every other error goes on as before, such as `return err`.
- **PHP.** PostHog's SDK throws too. A `catch (APIError $e)` becomes `catch (\PostHog\EmailError $e)` that throws `$e` again first when `$e->getErrorCode()` is `network_error` or `$e->getStatusCode()` is `429`. A `catch (RateLimitExceededError $e)` becomes `catch (\PostHog\EmailError $e)` that throws `$e` again first unless the status code is `429`. When the site has both catches, keep one `catch` with both branches. A check of `$e->getStatusCode() === 400` becomes `$e->getErrorName() === 'validation_error'`. Loops' `getStatusCode()` and `getCode()` become PostHog's `getStatusCode()`, and `getJson()` becomes `getMessage()`. A read of `getLimit()` or `getRemaining()` on the rate limit error has no PostHog value: log the status code instead.
- **Ruby.** A `rescue LoopsSdk::APIError => e` becomes `rescue PostHog::EmailError => e` that raises `e` again first when `e.code` is `network_error` or `e.status_code` is `429`. A `rescue LoopsSdk::RateLimitError` becomes `rescue PostHog::EmailError => e` that raises `e` again first unless `e.status_code` is `429`. When the site has both rescues, keep one `rescue PostHog::EmailError => e`: a second rescue of the same class never runs. Inside it, run the rate limit branch when `e.status_code` is `429`, the API error branch for every other code but `network_error`, and raise `e` again for `network_error`. Loops' `e.statusCode` becomes PostHog's `e.status_code`, and `e.json` becomes `e.message`. A check of `e.statusCode == 400` becomes `e.name == 'validation_error'`. A read of `e.limit` or `e.remaining` on the rate limit error has no PostHog value: log the status code instead.
- **HTTP.** The code read Loops' answer, and the HTTP client raised a network error on its own. Read PostHog's error the way `posthog-sdks.md` says for the language, and keep each branch: a status other than `200`, `ok` false, or `success` false becomes "there is an error" whose code is not `network_error`, a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status, such as `429`, reads PostHog's status code. A `network_error` goes where the client's network error went before. In Python, a status check, `raise_for_status()`, and `except requests.HTTPError` become `except EmailError as e:` whose first line is `if e.code == "network_error": raise`, because those only handled Loops' answer. `except requests.RequestException` handled both, so it becomes a plain `except EmailError`.
- **A branch on `409`.** Rewrite it to read PostHog's code `idempotency_key_reused`, as "Code around the send" says, and note the change in the plan row.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Loops took it and counted it as a hard bounce. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** Loops answered no message id, so no code reads one. A moved send answers PostHog's message id: keep it unused unless the code logs the answer.

**The Loops client.** Keep the Loops client, its import, and its configuration while any site or other call still uses them, such as a send that stays, `sendEvent`, or a contact call, or while other code imports or re-exports the client. Loops' own packages (`loops`, `nuxt-loops`, `loops-go`, `loops-so/loops`, `loops_sdk`) serve only Loops, but one client also runs its contact, event, and list calls. The packages an SMTP or Auth.js site uses serve more than Loops: Nodemailer, a framework mailer, and `next-auth`. Never remove them; only their Loops settings belong to Loops. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
