# Amazon SES to PostHog mapping

This file decides, field by field, whether PostHog can send an Amazon SES call site. A site moves only when every field it sets moves. Otherwise it stays on Amazon SES, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `replyTo`. Use the name the rewrite file gives for the site's language, such as `reply_to` in Python. Amazon SES fields are written in their v2 names, with the v1 name after a slash where it differs. `sdk-reference.md` has both.

## Fields

| Amazon SES | PostHog | A site stays on Amazon SES when |
|---|---|---|
| `FromEmailAddress` / `Source` | `from` | Never. `Name <address>` stays as it is. When the code builds it from a name and an address, put the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `Destination.ToAddresses` | `to` | It holds more than one address, or none. A list with one entry moves as that entry. `Name <address>` moves as the bare address: note in the plan row that the To line loses the name |
| `Destination.CcAddresses`, `BccAddresses` | none | Always. PostHog's send doesn't take it yet |
| `ReplyToAddresses` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A value read from an environment variable or a config file counts as read when `.env.example`, the config file, or the person shows a bare address for it |
| `Subject.Data` | `subject` | Never |
| `Body.Html.Data`, `Body.Text.Data` | `html`, `text` | Never |
| `Charset` on the subject or a body part | none | It is set to anything other than UTF-8. Ignore case, `-`, and `_` when you compare: `utf-8`, `utf8`, and `UTF_8` are UTF-8 and move. Any other charset, such as `ISO-8859-1`, keeps the site |
| `Content.Template` with `TemplateName` or `TemplateArn` and `TemplateData` / `SendTemplatedEmail` with `Template` or `TemplateArn` and `TemplateData` | the template's email, brought into the code and rendered with `TemplateData`, sent as `subject`, `html`, and `text`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `Content.Template.TemplateContent` with `TemplateData` | none: the code renders `TemplateData` into its `Subject`, `Html`, and `Text` before the send | It uses a tag other than `{{name}}` or a path such as `{{contact.firstName}}`, as "Templates" says |
| `Content.Raw` / `SendRawEmail` | none | Always: the code builds the MIME message itself |
| `Attachments` | none | Always. PostHog's send doesn't take it yet |
| `Headers` | none | Always: no PostHog SDK takes headers yet |
| `EmailTags` / `Tags` | none | Always: no PostHog SDK takes tags yet |
| `ConfigurationSetName`, or the sending identity's default configuration set when the send names none | none | A webhook handler matches the set's events by message id or by a tag (see "Webhooks"). Otherwise it moves: note the set's name in the plan row, because its event destinations stop getting events for this site. `account.md` says how to read an identity's default set |
| Open and click tracking: `ConfigurationOverrides.Tracking`, the configuration set's event destinations and VDM options, or the account's VDM settings | none: PostHog adds its open pixel and counts no clicks | Amazon SES sent it with opens untracked, or its open tracking isn't checked. See "Open and click tracking" below. `OpenTrackingEnabled` or `ClickTrackingEnabled` set to `DISABLED` counts as set: it turns that tracking off for the send, whatever the set or the account does |
| `ListManagementOptions` | none | Always: no PostHog SDK takes it |
| `FeedbackForwardingEmailAddress` / `ReturnPath` | none | Always: no PostHog SDK takes it |
| `FromEmailAddressIdentityArn`, `FeedbackForwardingEmailAddressIdentityArn` / `SourceArn`, `ReturnPathArn`, `FromArn` | none | Always: the site sends for an identity another AWS account owns |
| `EndpointId` | none | Always. PostHog's send doesn't take it yet |
| `TenantName` | none | Always. PostHog's send doesn't take it yet |

**Open and click tracking.** PostHog adds its open pixel to every email it sends, to count opens. It never rewrites a code send's links, so it counts no clicks. No field changes this: `captureEngagement` decides only whether the email's events land on the recipient's person, so tracking never maps to it. Amazon SES decides opens and clicks one at a time. When the send's `ConfigurationOverrides.Tracking` sets `OpenTrackingEnabled` or `ClickTrackingEnabled`, that value decides, with one limit: `DISABLED` doesn't track it, and `ENABLED` tracks it when the send's configuration set has an event destination that publishes any event type, VDM engagement metrics are on for the send, or the other one of opens and clicks is tracked for the send. Without any of these, AWS ignores `ENABLED` and the message is sent untracked. Otherwise Amazon SES tracks it when either of these is on for the send:

- VDM engagement tracking, which tracks both opens and clicks. The send's configuration set decides it when the set's `VdmOptions.DashboardOptions.EngagementMetrics` is set. Otherwise the account's `VdmAttributes.DashboardAttributes.EngagementMetrics` decides, for a send with no set too. Either is on only when it is `ENABLED` and the account's `VdmAttributes.VdmEnabled` is `ENABLED`.
- An enabled event destination of the send's configuration set, the one it names or its identity's default one, whose `MatchingEventTypes` lists `OPEN` for opens or `CLICK` for clicks.

A send with neither gets no tracking pixel, and its links stay as written. Read the account's VDM settings and each set the sites use, as `account.md` says under "Configuration sets", and work out, for opens and for clicks, whether Amazon SES tracked them:

- Opens tracked: the site moves. When Amazon SES tracked its clicks too, note in the plan row that PostHog counts no clicks for it.
- Opens untracked: the site stays, and the reason is `open tracking off`: PostHog would add an open pixel the email never had.

When a site's open tracking depends on a setting the person can't give and the read-only key can't read, the site stays, and the reason is `account tracking not checked` for the account's VDM settings, or `configuration set <name> tracking not checked` for a set's.

An Amazon SES send has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

## Calls

| Amazon SES call | A site stays on Amazon SES when |
|---|---|
| `SendEmail` in any SDK: `SendEmailCommand`, `AWS.SES().sendEmail`, `AWS.SESV2().sendEmail`, `send_email`, `sendEmail`, `SendEmail`, `SendEmailAsync`, `send_email()`, `ExAws.SES.send_email`, `ExAws.SES.send_email_v2`, `POST /v2/email/outbound-emails`, `Action=SendEmail` | A field above keeps it |
| `SendTemplatedEmail` / `send_templated_email` | A field above keeps it, or "Templates" does |
| `SendRawEmail` / `send_raw_email`, and `SendEmail` with `Content.Raw` | Always: the code builds the MIME message itself |
| `SendBulkEmail`, `SendBulkTemplatedEmail`, and their names in each SDK | Always: each sends several emails in one call |
| Nodemailer's `SES` transport | Always: PostHog has no Nodemailer transport |
| SMTP through `email-smtp.<region>.amazonaws.com` | Always here |
| A framework mailer (Django, Rails, Laravel, Symfony, Swoosh, Bamboo) | Always: PostHog has no mailer driver |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |

## Code around the send

Most AWS SDKs throw on an error: Node.js, Python, Ruby, PHP, .NET, and Java. The Go, Rust, and Elixir SDKs return an error value. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Amazon SES when |
|---|---|
| A `catch`, `except`, `rescue`, or error check that only logs the error, returns, or throws it again | Never. Log PostHog's error instead |
| A branch on an Amazon SES error name, such as `err.name === 'MessageRejected'`, `e.response['Error']['Code']`, `e.code`, `getAwsErrorCode()`, `ErrorCode`, `errors.As(err, &mr)` with `*types.MessageRejected`, or a `SendEmailError` variant | The name is anything but `TooManyRequestsException`, the v1 API's `Throttling`, or `BadRequestException`. A branch on `TooManyRequestsException` or `Throttling` moves as a check of PostHog's status code for `429`, and a branch on `BadRequestException` moves as a check of PostHog's error name `validation_error` |
| A branch on the HTTP status, such as `err.$metadata.httpStatusCode`, `e.response['ResponseMetadata']['HTTPStatusCode']`, `getStatusCode()`, `StatusCode`, `HTTPStatusCode()`, or `raw_response()` in Rust | Never. A branch on `400` reads PostHog's error name `validation_error`, and also its status code for `429` when the site sends with the v1 API (see "Errors"). A branch on another status, such as `429`, reads PostHog's status code |
| The `MessageId` stored for a webhook handler or a `GetMessageInsights` read | Always, when a handler or the read uses it |
| The `MessageId` logged or stored for the app's own use | Never. Use PostHog's message id |

## Templates

A site that sends a stored template moves by bringing the template into the code, as `template-to-code.md` says. The check needs the template's content, because the code has only its name or ARN. `account.md` says how to get it, from the Region the site sends in. The code renders the template's subject, HTML, and text with the values of the site's `TemplateData`, and the send sets the rendered `subject`, `html`, and `text`.

A site that sends an inline template, `Content.Template.TemplateContent`, already has its content in the code: Amazon SES only filled in the values. It moves the same way, from the content the code passed. Literal strings become the email, as `template-to-code.md` says under "Where the email goes". Content the code reads at run time, such as from a file or a database, stays where it is, and a function next to the send replaces each marker in it. Amazon SES takes only simple substitutions in an inline template, so one that uses anything other than `{{name}}` or a path such as `{{contact.firstName}}` stays: the docs don't say what Amazon SES did with the rest.

`TemplateData` is a JSON string. The code renders from the object it was built from, before `JSON.stringify`, `json.dumps`, `Jason.encode!`, or the language's own encoder. When the code only has the string, such as one read from a queue, parse it first.

Amazon SES templates are Handlebars. In the code:

| Amazon SES | In the code |
|---|---|
| `{{name}}`, `{{ name }}` | The value. Amazon SES inserted it as it is, unescaped, in every part. In the HTML, escape it anyway, except a value the code builds as HTML itself, under the rule of `template-to-code.md` |
| `{{contact.firstName}}` | The nested value, the same way |
| `{{{name}}}` | The same as `{{name}}`: Amazon SES escapes neither |
| A value missing from `TemplateData`, or a missing step of a path | Amazon SES failed the render: it accepted the send, answered a `MessageId`, and never sent it, with a `Rendering Failure` event that says `Attribute '<name>' is not present in the rendering data.` The render in the code raises before the send, so the email still doesn't go out, and the site's error handling now sees it. Note it in the plan row |
| A `null` value, or `""` | The docs name only a missing value. Treat `null` as missing, and render `""` as nothing. Note in the plan row each value the code can pass as `null` or `""` |
| A number or a boolean | As `TemplateData` writes it, such as `10.0`, `3`, or `true`: Python's `True` renders as `true`. The docs don't say how Amazon SES writes a number, so render the text of the JSON |
| `{{#if a}}…{{else if b}}…{{else}}…{{/if}}` | A branch that tests each value for Handlebars truth, in order. With `includeZero=true`, `0` is true |
| `{{#unless a}}…{{else}}…{{/unless}}` | The same branch, with the test turned around |
| `{{#each items}}…{{else}}…{{/each}}` | A loop over the list, or over the values of an object in the order its keys stand in `TemplateData`. The `{{else}}` part shows when there is nothing to walk |
| Inside `{{#each}}`: `{{this}}`, `{{this.name}}`, or a bare `{{name}}` | The current item, or its field. A bare name reads only the item. When an item can lack that field, the template stays: the docs don't say whether Amazon SES failed the render or read the value outside the loop |
| Inside `{{#each}}`: `{{@index}}`, `{{@key}}`, `{{@first}}`, `{{@last}}`, `{{../name}}`, `{{@root.name}}` | The item's position from 0, its key in an object, whether it is the first or the last, and the value one level out or at the top |
| `{{#with contact}}…{{else}}…{{/with}}` | The block, where bare names read the fields of `contact`, or the `{{else}}` part when `contact` is false |
| `{{lookup obj key}}`, `(lookup items 0)` | The entry of `obj` under the value of `key`, or the list's entry at that position. The docs don't say what a missing entry renders: treat it as a missing value |
| `{{#* inline "name"}}…{{/inline}}` with `{{> name}}` | A small function or template next to the email, called where `{{> name}}` stands, with the values in scope there: the item, inside a loop. A partial belongs to the part that defines it, so the HTML and the text each have their own. The newline after `{{/inline}}` renders as nothing |
| `~` in a tag, such as `{{/inline~}}` or `{{~name}}` | The whitespace on that side of the tag is left out |
| `{{! note }}`, `{{!-- note --}}`, `{{log …}}` | Nothing |
| The template's `Subject` / `SubjectPart` | The send's `subject`, rendered with the same conversions and no escaping |
| The template's `Html` / `HtmlPart` | The send's `html`. A template without an HTML part sends `text` only |
| The template's `Text` / `TextPart` | The send's `text`, with no escaping. A template without a text part sends `html` only |

- Handlebars truth: `false`, a missing value, `null`, `""`, `0`, and an empty list are false. Everything else is true, including `"0"`, `"false"`, and an empty object. Write that test out in the code, as `template-to-code.md` says. The docs don't say whether a value missing from `TemplateData` that only an `if`, `unless`, `each`, or `with` reads fails the render: treat it as false, and note it in the plan row.
- Any other helper, a `{{> name}}` whose part defines no such inline partial, and the `{{amazonSESUnsubscribeUrl}}` tag, which Amazon SES fills only for a send with `ListManagementOptions`, keep the template on Amazon SES.
- A template belongs to one Region: a template of the same name in another Region is another template. Read each one in the Region its site sends in, as `account.md` says. A `TemplateArn` names its Region after `arn:aws:ses:` and its name after `template/`. Two sites that send the same name in two Regions share one email only when the two contents are the same.
- An Amazon SES template holds no sender, reply-to address, or preview text, so the send takes the site's own `FromEmailAddress` / `Source` and `ReplyToAddresses`, as the "Fields" table says. Its subject always comes from the template: a templated send has no subject of its own.
- Amazon SES hosts no images, so a template's images sit on the person's own hosts, such as an S3 bucket. Keep every URL, and list none as hosted by the provider.
- A template site follows "Open and click tracking" like any other site: it stays when Amazon SES sent it with opens untracked. Its `ConfigurationSetName` follows the "Fields" table, as for any send.
- `Content.Template.Headers` and `Attachments` keep the site, as the "Fields" table says. `SendBulkTemplatedEmail` and `SendBulkEmail` still stay, as "Calls" says: each sends several emails in one call.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. The person makes it from the Amazon SES template, makes it transactional, and gives you its template ID. Until then the site stays on Amazon SES. An inline template takes the same path when the person asks for one: read its content from the code for the check. Amazon SES's Handlebars becomes Liquid in the PostHog template. Values move under `variables`, and each name keeps its case:

| Amazon SES | PostHog |
|---|---|
| `{{name}}` | `{{ variables.name }}` |
| `{{contact.firstName}}` | `{{ variables.contact.firstName }}` |
| `{{#if paid}}…{{else}}…{{/if}}`, when `paid` is a boolean | `{% if variables.paid %}…{% else %}…{% endif %}` |
| `{{#unless paid}}…{{/unless}}`, when `paid` is a boolean | `{% unless variables.paid %}…{% endunless %}` |
| `{{#each items}}{{name}}{{/each}}`, or `{{this.name}}` in the loop, when `items` is a list | `{% for item in variables.items %}{{ item.name }}{% endfor %}` |
| `{{#each tags}}{{this}}{{/each}}`, when `tags` is a list | `{% for tag in variables.tags %}{{ tag }}{% endfor %}` |
| `{{this}}` inside `{{#each items}}` | `{{ item }}` |
| The template's subject (`Subject` or `SubjectPart`) | The PostHog template's subject, with the same conversions |

- Amazon SES does not escape HTML in values, and PostHog's Liquid does. A value with plain text shows the same text. A value that holds HTML, such as a link or a list the code builds as markup, shows as escaped text in PostHog, so its template stays on Amazon SES. So does a template that uses triple braces, `{{{name}}}`.
- Handlebars treats `0`, an empty string, and an empty list as false, and Liquid treats them as true. Read what the site sends for each `if` and `unless` value. A value that is not always a boolean, `null`, or missing keeps the template on Amazon SES.
- Handlebars `{{#each}}` also walks the values of an object, and Liquid's `for` doesn't. An `each` over a value that is not always a list keeps the template on Amazon SES.
- Inside `{{#each}}`, a bare `{{name}}` reads the current item, as `{{this.name}}` does. It becomes `{{ item.name }}`, never `{{ variables.name }}`. `{{this}}` is the item itself and becomes `{{ item }}`.
- Any other helper, such as `{{#with}}`, `{{lookup}}`, or `{{log}}`, keeps the template on Amazon SES. So does an inline partial (`{{#* inline}}` and `{{> name}}`), `{{@index}}`, `{{@key}}`, and a block inside `{{#each}}` that reads a value outside the loop with `../`.
- `templateData` takes the object `TemplateData` was built from, as above.
- The PostHog template carries its own sender, reply-to address, and subject. A site that sets `FromEmailAddress` / `Source` or `ReplyToAddresses` next to the template moves only when the value is the same in every send, and the person puts it into the PostHog template. Otherwise it stays.
- A template site follows "Open and click tracking" like any other site: it stays when Amazon SES sent it with opens untracked, or its open tracking isn't checked.

## Webhooks

The handlers stop getting events for a site that moves: Amazon SES no longer sends it. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

| Amazon SES event | PostHog event |
|---|---|
| `Send` | `$workflows_email_sent` |
| `Delivery` | `$workflows_email_delivered` |
| `Bounce` | `$workflows_email_bounced` |
| `Complaint` | `$workflows_email_blocked` |
| `Open` | `$workflows_email_opened` |
| `Click` | none: PostHog never rewrites the links of these sends, so it counts no clicks |
| `Reject`, `Rendering Failure`, `DeliveryDelay`, `Subscription` | none |

A bounce to an address on the account-level suppression list comes as a `Bounce` with `bounceSubType` `OnAccountSuppressionList`. PostHog refuses that send instead, with `recipient_suppressed`.

PostHog's events carry no Amazon SES `mail.messageId` and no `mail.tags`. A site whose events a handler matches by message id or by a tag stays on Amazon SES. A handler fed by an identity's default configuration set gets the events of every send from that identity that names no set: a send that names a set uses that set instead. A handler fed by the identity's SNS notifications (`SetIdentityNotificationTopic`) gets the events of every send from that identity, whatever its set. When either matches by message id or by a tag, every site whose sends it gets stays. A handler that finds the user by the recipient's address, such as `bouncedRecipients[].emailAddress`, keeps no site. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

## Calls that change the suppression list

`PutSuppressedDestination` adds an address to the account-level suppression list of one Region, with a reason of `BOUNCE` or `COMPLAINT`, `DeleteSuppressedDestination` removes one, and `CreateImportJob` with a `SuppressionListDestination` adds or removes the addresses of a file in Amazon S3. Each is a call that Step 5 names under "Calls that change the provider's list", such as an unsubscribe handler or a reactivation, in any SDK's spelling, such as `PutSuppressedDestinationCommand` or `delete_suppressed_destination`. It counts only for the entries the import takes: an address in a Region where a moved site sends, with a reason that applies to at least one moved site there, as `account.md` says under "Map each entry".

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'amazon-ses'` on the client that Step 7 configures, when its client options take it.

**The call.** The Amazon SES send becomes one PostHog send. Build its fields from the input the site built:

- v2 `SendEmail` in any SDK: `FromEmailAddress`, `Destination`, `ReplyToAddresses`, and `Content.Simple` or `Content.Template`.
- v1 `SendEmail` in any SDK: `Source`, `Destination`, `ReplyToAddresses`, and `Message`. v1 `SendTemplatedEmail`: `Source`, `Destination`, `ReplyToAddresses`, `Template` or `TemplateArn`, and `TemplateData`.
- Elixir `ExAws.SES.send_email_v2(destination, content, from, opts)`: the same v2 fields, with `opts[:reply_addresses]` as `ReplyToAddresses`. `ExAws.SES.send_email(dst, msg, from, opts)`: `dst.to`, the `html`, `text`, and `subject` of `build_message`, and `opts[:reply_to]`. `ExAws.SES.send_templated_email(dst, src, template, template_data, opts)`: `dst.to`, `src`, the template's name, the map encoded into `template_data`, and `opts[:reply_to]`.
- A raw HTTP request: the fields of its JSON body or its form parameters.

**The fields.**

- `FromEmailAddress` / `Source` becomes `from` as it is, with its name.
- The one entry of `ToAddresses` becomes `to`, as a bare address. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- `Subject.Data`, `Body.Html.Data`, and `Body.Text.Data` become `subject`, `html`, and `text`.
- `ConfigurationOverrides.Tracking` is dropped, and the send gets no `captureEngagement` for it, as "Open and click tracking" says.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Templates brought into the code.** The site renders the email from the object of its `TemplateData`, as "Templates" says, and sends `templateKey`, the rendered `subject`, `html`, and `text`, and the site's own `from` and `replyTo`. It sends no `templateId` and no `templateData`. An inline template is sent the same way. Remove the encode of `TemplateData` when nothing else uses the string.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave, and `templateData` with the object of the site's `TemplateData`. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the Amazon SES send threw into a `catch`, throw from the error so the same `catch` runs: `if (error) throw Object.assign(new Error(error.message), { code: error.code, name: error.name, statusCode: error.statusCode })`. In that `catch`, a read of `err.name` for logging becomes `err.code`, and a read of `err.$metadata.httpStatusCode` becomes `err.statusCode`. A check of `err.name === 'BadRequestException'` or of the status `400` becomes a check of `err.name === 'validation_error'`.
- **Python.** PostHog's SDK raises too. Replace `except ClientError` with the PostHog exception the rewrite file names, `e.response['Error']['Code']` with its code, `e.response['Error']['Message']` with its message, and `e.response['ResponseMetadata']['HTTPStatusCode']` with its status code. A check of the code `BadRequestException` or the status `400` becomes a check of its name `validation_error`. `ClientError` covered only Amazon SES's answers: a network failure raised `EndpointConnectionError` or another `BotoCoreError` past it. PostHog's exception covers both, so raise it again first when its code is `network_error`. When the same `try` also guards other AWS calls, keep their `except` as well.
- **Ruby, PHP, and .NET.** PostHog's SDK throws too. Replace the rescued or caught Amazon SES exception (`Aws::SESV2::Errors::ServiceError`, `Aws\SesV2\Exception\SesV2Exception`, `AmazonSimpleEmailServiceV2Exception`, and their v1 names) with the PostHog exception the rewrite file names, and the error code and status code reads with its own. A check of the code `BadRequestException` or the status `400` becomes a check of PostHog's error name `validation_error`. In Ruby and .NET the service exception covered only Amazon SES's answers, and a network failure (`Seahorse::Client::NetworkingError`, `HttpRequestException`) passed it: raise PostHog's exception again first when its code is `network_error`, before the handler logs or does anything else. In .NET, put a `when (e.Code != "network_error")` filter on each `catch` of PostHog's exception that replaces the service exception, so a network failure passes it untouched, as before. When the handler catches the AWS SDK's base exception (`Aws::Errors::ServiceError`, `Aws\Exception\AwsException`, `Amazon.Runtime.AmazonServiceException`), or its `try` also guards other AWS calls, keep that handler for those calls and add PostHog's next to it.
- **A raw HTTP request.** It failed the way its client does. `axios` (unless its `validateStatus` accepts a failed status), `got` and `ky` (unless `throwHttpErrors: false`), Guzzle (unless `'http_errors' => false`), Faraday with `raise_error`, `raise_for_status()`, and `EnsureSuccessStatusCode()` threw on a refused send: the moved site raises PostHog's error the same way, as the language's bullet says, and a read of the client's status in the `catch` reads PostHog's status code. `fetch`, `aws4fetch`'s `AwsClient.fetch`, `requests`, `httpx`, Ruby's `Net::HTTP`, Go's `net/http`, and .NET `HttpClient` without `EnsureSuccessStatusCode()` answered it as a response: a check of that answer's status becomes a check of PostHog's error, and when the code never read the answer, Step 7's rule for an answer the code never read applies.
- **Go, Rust, and Elixir.** The site checked an error value. Check PostHog's error value the way the rewrite file says under "The answer". A plain `if err != nil`, `?`, or `{:error, _}` branch stays as it is. A branch on the status, such as `{:error, {:http_error, 429, _}}`, `HTTPStatusCode()`, or Rust's `raw_response()` status, reads PostHog's status code, except a branch on `400`, Go's `*types.BadRequestException`, or Rust's `SendEmailError::BadRequestException`, which reads PostHog's error name `validation_error`. In Rust, PostHog's `EmailError` has `status()` for the status code, an `Option<u16>` such as `Some(429)`, and `kind().as_str()` for the error name. A branch that matched only Amazon SES's answers let a network failure pass to the site's next check: Go's `errors.As` with `smithy.APIError`, `*awshttp.ResponseError`, or a `*types.*` error, Rust's `SdkError::ServiceError`, or Elixir's `{:error, {:http_error, _, _}}`. PostHog returns a network failure as the same error, with the code `network_error`, so give such a branch a check that skips it, such as `emailErr.Code != "network_error"` in Go, `error.code() != "network_error"` in Rust, or a `{:error, %PostHog.Emails.Error{code: "network_error"}}` clause before it in Elixir that takes the path a network failure took before.
- A branch on `TooManyRequestsException` becomes a check of PostHog's status code for `429`. So does a branch on the v1 API's `Throttling`: the v1 API answers a send over the sending rate or the daily quota with the code `Throttling` and status `400`, where v2 answers too many requests with `TooManyRequestsException` and `429`.
- PostHog answers a used-up quota with status `429` and the code `quota_limited`, which no retry clears. When a `429` branch tries the send again or waits before it, it also checks for a code other than `quota_limited`, and `quota_limited` takes the path of every other error. Note it in the plan row.
- In a site that sends with the v1 API, a branch on the status `400` also took throttling. It becomes a branch on PostHog's error name `validation_error` or its status code `429`, so a throttled send still takes it.
- A branch on Amazon SES's answer to an invalid send, `BadRequestException` or the status `400`, becomes a branch on PostHog's error name `validation_error`, never on a status code: PostHog's statuses for invalid sends differ from Amazon SES's, and `recipient_suppressed` is a `validation_error` with status `422`, handled first, as below.
- Never widen a catch. When the old code caught only `TooManyRequestsException`, catch PostHog's error, check its status code for `429`, and raise or return every other error as before. When it caught only `BadRequestException`, check PostHog's error name for `validation_error` in the same way, with `e.name`, `#name`, `getErrorName()`, `Name`, or `:name` (`:validation_error` in Elixir):
  - **Node.js:** a `catch` that tested `err.name === 'TooManyRequestsException'` tests `err.statusCode === 429` on the error thrown above, and throws every other error again.
  - **Python:** `except client.exceptions.TooManyRequestsException` becomes `except EmailError as e:` with `if e.status_code != 429: raise` first.
  - **Ruby:** `rescue Aws::SESV2::Errors::TooManyRequestsException` becomes `rescue PostHog::EmailError => e` with `raise unless e.status_code == 429` first.
  - **PHP:** a catch that tested `getAwsErrorCode() === 'TooManyRequestsException'` catches `PostHog\EmailError`, tests `getStatusCode() === 429`, and throws every other error again.
  - **.NET:** `catch (TooManyRequestsException)` becomes `catch (EmailException e) when (e.StatusCode == 429)`.
  - **Go:** `errors.As(err, &throttled)` with `*types.TooManyRequestsException` becomes `errors.As(err, &emailErr) && emailErr.StatusCode == 429`. Every other error goes on to the site's next check as before.
  - **Rust:** a match on `SendEmailError::TooManyRequestsException` becomes `Err(error) if error.status() == Some(429)`, and one on `SendEmailError::BadRequestException` becomes `Err(error) if error.kind().as_str() == "validation_error"`. Every other error goes on to the site's next arm as before.
  - **Elixir:** `{:error, {:http_error, 429, _}}` becomes `{:error, %PostHog.Emails.Error{status_code: 429}}`. Every other `{:error, _}` goes on as before.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Amazon SES took it and didn't send it. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged `MessageId`, or stored it for the app's own use, takes PostHog's message id instead.

**The Amazon SES client.** Keep the Amazon SES client and its import while any site or other call still uses them. When nothing uses them, remove the import and the client. Keep the package and the AWS credentials for other uses: the AWS SDK package, such as `@aws-sdk/client-sesv2`, `aws-sdk`, `boto3`, `aws-sdk-go-v2`, or `ex_aws`, and the credentials often serve other AWS services in the same app, and `boto3` and `aws-sdk` cover every AWS service in one package. Remove the package only when no code uses it for anything else. The person removes the Amazon SES permissions after the cutover.
