# Loops to PostHog mapping

This file decides, field by field, whether PostHog can send a Loops call site. A site moves only when every field it sets moves. Otherwise it stays on Loops, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `templateKey`. Use the name the rewrite file gives for the site's language, such as `template_key` in Python.

Every Loops send renders a transactional email stored at Loops. So every Loops site is a `template` site in the plan. It moves by bringing that email into the code, as "Templates" says, and sends it in the code form: `templateKey`, the rendered `subject` and `html`, and the email's `from` and `replyTo`. A template made in PostHog, sent by `templateId` with `templateData`, is used only when the person asks for one.

## Fields

| Loops | PostHog | A site stays on Loops when |
|---|---|---|
| `email` | `to` | Never. It is always one address |
| `transactionalId` | the Loops email, brought into the code and rendered with `dataVariables`, sent as `subject` and `html`. A template made in PostHog, by its `templateId` with `templateData`, only when the person asks for one | See "Templates" |
| `dataVariables` | the values the code renders into the email, with the same keys | Never in the code: a value that the code builds as HTML goes in as it is, as "Templates" says. For a template made in PostHog, see "Templates made in PostHog" |
| `addToAudience: true` | none | Always. It adds the recipient to the Loops audience, which Loops' campaigns and workflows send to, so moving the send would stop new contacts reaching it. `false` or no value moves. It moves only when the same code path already creates or updates that recipient as a Loops contact before the send, such as with `createContact` or `updateContact`. A contact call elsewhere in the app doesn't count. Otherwise the report tells the person that such a call would let the site move |
| `attachments` | none | Always. PostHog's send doesn't take it yet |
| `Idempotency-Key` header (`headers` in Node.js, PHP, and Ruby, `IdempotencyKey` in Go) | `idempotencyKey` | The code can build a key with a space or a character outside visible ASCII. Loops' keys are at most 100 characters, and PostHog takes 1 to 255 visible ASCII characters, so any other Loops key fits. A key built from a value whose characters the code doesn't bound, such as text a user or another service sends, counts as one that can. An ID the app makes, such as a database row ID or a UUID, is bounded, even when it reaches the site as a parameter and only its name, type, or a comment says what it is. The report names that value, so the person can bound the key, such as by hashing that part, and move the site |
| Any other request header in `headers` | none | Always: no PostHog SDK takes headers yet |

The Loops email itself sets the rest, in its sending settings. The template check in Step 3 reads them, and the code sends them:

| Loops email setting | In the code | A site stays on Loops when |
|---|---|---|
| Subject (`subject`) | `subject`, rendered with the same data variables and never escaped | Never |
| Preview (`previewText`) | The hidden preview block at the start of the HTML, as `template-to-code.md` says, with its values escaped | Never |
| Name and From (`fromName`, `fromEmail`) | `from`, as `'<Name> <From>@<the team's sending domain>'`: `fromEmail` is only the part before the domain, and Loops shows the domain under Settings, then Domain. A data variable in either is rendered. The sender must be a verified sender (Step 4) | From holds a data variable, and Step 3 can't tell every address it takes, as it does for any `from` |
| Reply (`replyToEmail`) | `replyTo`, rendered when it holds a data variable | Never |
| CC, BCC (`ccEmail`, `bccEmail`) | none | Either one is set, with or without a data variable. PostHog's send doesn't take `cc` or `bcc` yet |
| Language (`languageCode`) | `lang` on the `<html>` tag | Never |

A site with no idempotency key sends none in PostHog either.

## Calls

| Loops call | A site stays on Loops when |
|---|---|
| `loops.sendTransactionalEmail`, `client.SendTransactional`, `$loops->transactional->send`, `LoopsSdk::Transactional.send`, a community package's send, `POST /api/v1/transactional` | A field above keeps it |
| A send inside a loop over recipients | A field above keeps it. Each call already sends one email to one address, so the loop stays as it is |
| A send through `smtp.loops.so` from Nodemailer's `sendMail` | Read it as the API send: its `text` is the JSON of Loops' HTTP body, so the `transactionalId`, `email`, and `dataVariables` of the object the code stringifies go through the tables above, and the site brings that email into the code, as "Templates" says. Loops ignores the message's `to`, `from`, and `subject`: drop them. It stays when the code doesn't build the body from an object you can read, when the message also sets `html`, `cc`, `bcc`, `attachments`, or `headers`, which Loops' docs don't describe for SMTP, or when the code reads the answer's `accepted`, `rejected`, `response`, or `envelope`, which PostHog's answer has no match for. A read of its `messageId` becomes a read of PostHog's message id. It never moves by sending its own `text`: that is the JSON of the body, not the email |
| A send through `smtp.loops.so` from a framework mailer (Django, Rails, Laravel) | Always. PostHog has no mailer driver |
| Auth.js `next-auth/providers/loops` | Always. PostHog has no Auth.js provider |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |
| `sendEvent` and `POST /api/v1/events/send` | Not a send: it starts a Loops workflow. List it with the other Loops calls |
| A send that the code runs after it removes the recipient's Loops suppression: `removeContactSuppression` (Node.js), `RemoveContactSuppression` (Go), `removeSuppression` (PHP), `remove_suppression` (Ruby), or `DELETE /api/v1/contacts/suppression` | Always. The code wants the email to reach an address Loops suppressed, and PostHog refuses a suppressed address with `recipient_suppressed`. The removal call stays too |

Loops has no batch send, no send time, and no send to several addresses, so no site uses them.

## Code around the send

Loops' official SDKs throw or raise on an API error, and the Go SDK returns an error value. HTTP code reads the response. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Loops when |
|---|---|
| A `catch` or `rescue` that reads `err.statusCode`, `err.json`, `e.json`, `getStatusCode()`, or `getJson()`, or Go's `apiErr.StatusCode` and `apiErr.Message` | It branches on a Loops error text, such as `Missing required data variable(s)`, or on another field of Loops' error body, such as `error.path`: PostHog's error has neither. A branch on the HTTP status moves: a branch on `400`, Loops' answer to an invalid send, reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code |
| A branch on `RateLimitExceededError` or `LoopsSdk::RateLimitError` | Never. It becomes a branch on PostHog's status code `429` with a code other than `quota_limited`, as Step 7 says. PostHog's SDK retries rate limits on its own first |
| A branch on status `409`, Loops' answer to a reused idempotency key | Never. Note it in the plan row: PostHog answers a repeat of the same send with the first send's answer and no error, so the branch no longer runs, and it answers a different send with the same key with the code `idempotency_key_reused`. Rewrite the branch to read that code |
| A check of the HTTP answer: `response.status_code`, `response.ok`, `response.success?`, `raise_for_status()`, or `success` in the body | Never. Read PostHog's error instead |
| A `catch` or a `sendMail` callback that reads a Nodemailer error's `code` or `responseCode`, such as `EAUTH` or `550` | Always. They are SMTP codes, and PostHog's error has none of them. A `catch` or callback that handles every error the same way moves |
| A loop around the send that tries again on `429`, such as one that waits for the `Retry-After` header | Never. Keep the loop and the code in it. It now tries again when PostHog's error has the status code `429` and a code other than `quota_limited`: a retry doesn't clear a quota. PostHog's error has no headers, so a wait read from `Retry-After` takes the loop's own fallback, or 1 second when the loop has none. Note both changes in the plan row, and that PostHog's SDK already retries a rate limit twice inside each send, so each pass of the loop can make 3 requests. A loop that tries again on a `5xx` keeps its check, which reads PostHog's status code |
| A read of a message id in Loops' answer | Never happens: Loops answers `{ success: true }` only |

An idempotency key that the code sent to Loops and now sends to PostHog can send the email twice when a retry crosses the deploy: the first try went to Loops, the retry goes to PostHog. Note each such key for the report.

## Templates

Each Loops site moves by bringing its Loops email into the code, as `template-to-code.md` says. The check needs the content of the published version, because the code has only its `transactionalId`. `account.md` says how to get it: the API answers the body in LMX, Loops' markup, with the email's settings next to it, and the dashboard way is a preview send of the email. The code renders the HTML, the subject, and the preview text with the site's `dataVariables`. The send sets the rendered `subject` and `html`, and `from` and `replyTo` from the email's settings.

- A `transactionalId` that the code reads from an env variable or a config file names a Loops email the repository doesn't show. Ask the person which Loops email each such variable holds, with the template question of Step 3. When they can't tell, the site stays, and the reason names the variable.
- A helper whose callers pass the `transactionalId` is one site that sends several Loops emails. It moves only when every email its callers pass moves. Otherwise it stays, and the reason names the email that keeps it.

Loops' data variables, fallbacks, conditional sections, and array blocks, in the code:

| Loops | In the code |
|---|---|
| `{data.name}` in LMX, `{name}` in the editor and in some API answers, `{DATA_VARIABLE:name}` in MJML | The value of `name` in `dataVariables`, escaped as the bullets below say. A string as it is, and a number as the code wrote it in the JSON, such as `20` or `20.5`. Each name keeps its case |
| A data variable in a setting, such as the subject | The same value, in that setting, as the settings table above says |
| A variable in a `Button`, `Link`, `Section`, or `Image` `href`, an `Image` `alt`, or an `Image` `dynamicSrc` | The value, escaped as an attribute. Never URL-encode it |
| A data variable that is not optional | A value the render requires. Loops refused a send without it, so the code always passes it |
| An optional variable without a fallback, left out or sent as `""` | Nothing |
| An optional variable with a fallback in `dataVariablesFallbacks` | The value, or the fallback when the value is left out. Loops' docs don't say whether `""` takes the fallback too: use the fallback for `""` as well, and note it in the plan row when the code can pass `""` |
| `<Section if="{data.name}">`, which is `ifOperation="not_empty"` | A branch that shows the section when the value is there and is not `""` |
| `ifOperation="empty"` | A branch that shows it when the value is `""` |
| `ifOperation="equal"` or `"not_equal"` with `ifValue="pro"` | A branch on the value's text being exactly `pro`, or not |
| `ifOperation="contains"` or `"not_contains"` with `ifValue="pro"` | A branch on the value's text holding `pro`, or not |
| `ifOperation` `numeric_equal`, `numeric_not_equal`, `greater_than`, `less_than`, `true`, or `false` | None. They test contact properties of type number or boolean, and a data variable is always text. They keep the template on Loops |
| A condition variable the code leaves out | The section is left out, for every operator: Loops' docs say a missing condition variable hides the section. They don't say it apart for `empty`, `not_equal`, and `not_contains`, where a missing value could match, so note each such section in the plan row when the code can leave its variable out |
| An array block `items`, or MJML `<loops-array variable="items">` | A loop over the list in `items`, in order, one piece per object. Loops shows up to 100 items in a block, and its docs don't say what it does with more: loop over the first 100, and note it in the plan row when the code can pass more |
| `{price}` inside the block, as an array item (the default), or MJML `{DATA_VARIABLE:items[].price}` | The current object's `price`, escaped |
| A variable inside the block whose **Array item** option is **No**, or MJML `{DATA_VARIABLE:userId}` inside `<loops-array>` | `userId` from `dataVariables`, not from the item |
| `{contact.name}` or `{event.name}` | None. A contact property is a value only Loops holds, and an event property belongs to workflow emails. Either keeps the template on Loops |

- Loops' truth test: every data variable is text. A section with no operator shows when the value is there and is not `""`, so `0`, `"0"`, and `"false"` show it. Write that test out, such as `value !== undefined && String(value) !== ''`, never the language's own. `equal` and `contains` compare the value's text, so `20` equals `"20"`. Loops' docs don't say whether they ignore case: compare exactly, and note the section in the plan row when the code can send the value in another case.
- Escaping: Loops' docs don't say whether Loops escapes a value in the HTML. Escape every value, as `template-to-code.md` says. A value the code builds as HTML itself, such as a list it joins with `<br>` or a link it builds, was written for Loops to render: insert that value as it is, under the rule of `template-to-code.md`, and note in the plan row that Loops' docs leave its escaping open, so the person compares one send.
- These keep a template on Loops: a CC or BCC, a contact or event property, a number or boolean operator, a condition on an array variable (Loops' docs don't say how it tests a list), an MJML `{unsubscribe_link}`, which Loops fills from the account, a tag that "From LMX to HTML" doesn't place, and social icons without a preview send.
- Images: an LMX `Image` `src` is always hosted by Loops, on `images.vialoops.com`: LMX takes no other. Loops also hosts the images of an MJML email and the social icons, at addresses only a preview send shows: count any image on a `vialoops.com` or `loops.so` host as Loops'. Keep them, and list them, as `template-to-code.md` says. An image from a `dynamicSrc` is the app's own, and the `src` placeholder next to it never shows: list neither.
- A Loops send sets no subject, sender, reply-to address, or preview text of its own, so the email's settings give them all, as the settings table says.
- Loops' docs don't say whether a send has a text part. Send `html` only, unless the preview send's source has a `text/plain` part: then write that text as `text` too, with each marker as its value, unescaped.

### From LMX to HTML

Write HTML for email clients: tables for the layout, every style inline, and no `<style>` block except the media query for columns on a phone. Each style a tag doesn't set comes from `<Style>`, then from its theme. A style none of them set is left out, so the email client's default applies, unless the person's preview send shows it: then take it from there. LMX text is XML: `&lt;`, `&amp;`, and `&quot;` stand for `<`, `&`, and `"`, and stay escaped in the HTML. Whitespace collapses as in HTML.

| LMX | HTML |
|---|---|
| `emailFormat` `styled` | `<body>` with a full-width `<table role="presentation" width="100%">` in `backgroundColor`, padded by `backgroundYPadding` and `backgroundXPadding`, around a centered table at most 600px wide in `bodyColor`, padded by `bodyYPadding` and `bodyXPadding`, with `borderWidth`, `borderColor`, and `borderRadius`, and `font-family` from `bodyFontFamily`, then `bodyFontCategory` |
| `emailFormat` `plain` | The same blocks at full width, with no outer table, no body container, and no theme. Loops' Plain format is an HTML email that looks written in a mail app, not a text email |
| `<Style themeId="…" … />` | No HTML. Its attributes, over the theme's `styles`, which have the same names, are the defaults of every tag: `textBase*` for paragraphs, quotes, and lists, `heading1*` to `heading3*` for headings, `button*` for buttons, `divider*` for dividers, and `textLinkColor` for links |
| `blockColor`, `blockBorderRadius`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` on any block | A one-cell table around the block, with that `background-color`, and `border-radius` and `padding` in px |
| `<H1>`, `<H2>`, `<H3>` | `<h1>` to `<h3>` with `margin:0`, the heading's styles, and `font-size` in px from `fontSize`, `line-height` in percent from `lineHeight` (`150` is `150%`), and `text-align` from `align` (`left` when not set) |
| `<Paragraph>` | `<p style="margin:0">` with the text styles, and `fontSize`, `lineHeight`, and `align` as for a heading |
| `<Quote>` | `<blockquote style="margin:0">` with the text styles, and `fontSize`, `lineHeight`, and `align` as for a heading. Loops' docs don't show its border or indent: take them from a preview send when there is one |
| `<CodeBlock>` | `<pre style="margin:0;white-space:pre-wrap">` in a monospace font, with its text as written, escaped. Braces in it are text, never a variable |
| `<Button href="…">` | A one-cell table aligned by `align`, in `bgColor` or `buttonBodyColor`, with `borderRadius`, `borderWidth`, and `borderColor` or their `button*` defaults, holding `<a href="…">` with `display:inline-block`, `padding` from `innerYPadding` and `innerXPadding`, `color` from `textColor`, `font-size` from `fontSize`, and `text-decoration:none` |
| `<Image src="…" />` | `<img src="…" alt="…" width="…" style="display:block;max-width:100%">` with `borderRadius`, `borderWidth`, and `borderColor`, in a cell aligned by `align`, inside `<a href="…">` when it has `href`. `width` is in px, 600 when not set. With `dynamicSrc`, its rendered value is the `src` |
| `<Divider />` | A table `width` percent wide, aligned by `align`, whose cell has a `border-top` of `borderWidth` or `dividerBorderWidth` px in `color` or `dividerColor` |
| `<OrderedList start="…">`, `<UnorderedList>`, `<ListItem>` | `<ol start="…">` or `<ul>` with `margin:0` and `text-align` from `align`, and `<li>` with the text styles and its own `fontSize`, `lineHeight`, and block attributes |
| `<Columns>`, `<ColumnItem>` | A table row with one `<td>` per `ColumnItem`, its `width` from `widths` (equal when not set), `valign` from `verticalAlignment`, and `gap` px between them. `stackOnMobile` makes each cell full width under `@media (max-width:479px)`, where Loops stacks them, and `reverseOnMobile` also reverses their order there |
| `<Section>` | A one-cell table with the block attributes, and a border only when both `blockBorderWidth` and `blockBorderColor` are set, holding its blocks. With `href`, its content sits in `<a href="…" style="display:block;text-decoration:none;color:inherit">`. With `if`, the branch the table above says |
| `<Component componentId="…" />` | The component's own LMX, which `account.md` says how to read, written in its place the same way, with this tag's block attributes around it. When the tag holds blocks, write those instead: Loops' docs say they override the component's content |
| `<Icons>`, `<Icon name="…" href="…" />` | A row of `<a href="…"><img src="…" width="…" height="…" alt="…"></a>`, one per icon, `size` px square, `gap` px apart, aligned by `align`. LMX names an icon but not its image, so take each image from a preview send. Without one, the template stays, and the reason is `Loops social icons not read` |
| `<Strong>`, `<Em>`, `<Underline>`, `<Code>`, `<Strike>`, `<Text>` | `<strong>`, `<em>`, `<u>`, `<code>`, `<s>`, and `<span>`, each with `color` from `textColor` |
| `<Link href="…">` | `<a href="…">` in `textLinkColor` |
| `<Br />` | `<br>` |
| `notrack="true"` on any tag | Nothing: Loops tracks no links in a transactional email |

- A theme's line heights, such as `textBaseLineHeight`, are percents in `<Style>`, but the theme API's own example shows `24`, and the docs don't settle it. Write one under 100 in px, and any other in percent.
- `bodyFontFamily` names a Google font. Loops' docs don't say whether the email loads it: write `font-family:'Inter', sans-serif` with its `bodyFontCategory`, and add a font link only when a preview send's source has one.
- Compare the result with a preview send when the person gave one: the report already asks them to compare one send.

### From a preview send

When the content is a preview send instead of the API's LMX, as `account.md` says, its HTML is the one Loops rendered:

- Decode the message's HTML part, from quoted-printable or base64, and write it as the email.
- Replace each marker `[[name]]` with the variable `name`, escaped as above. In a link or an image source, the marker can be URL-encoded, as `%5B%5Bname%5D%5D`: replace that form too.
- Wrap each conditional section the person described in its branch, around the part of the HTML that holds that section's content.
- Write each array block the person described as a loop: the preview shows its piece once per item, so keep one piece, with the item's variables.
- A marker that is left, or a section or block you can't find in the HTML, keeps the template on Loops, and the reason names it.

### Templates made in PostHog

Only for a template the person asks to make in PostHog, as Step 3 says. This skill never makes one: the person makes it from the Loops email, makes it transactional, and gives you its template ID. Until then the site stays on Loops. Loops' data variables become Liquid in the PostHog template. Values move under `variables`, and each name keeps its case. The editor, MJML, and LMX write a variable three ways:

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
- A value in `dataVariables` that holds HTML the email must render, such as a `<br>`-joined list the code builds, keeps the template on Loops: PostHog's Liquid escapes it.
- The design, theme, components, and images of the Loops email do not decide whether it moves. The person rebuilds them in PostHog.
- Name, From, or Reply holding a data variable, or a CC or BCC set, keeps the template on Loops. A fixed Name, From, and Reply move: the person puts them into the PostHog template. So does the Subject, with its data variables written as the table says.
- The person rebuilds the preview text in PostHog, as they rebuild the design. When it holds a data variable, the report gives its Liquid form, as the table says.
- A template that the content check can't place in the table above stays, with what kept it as the reason.

## Webhooks

Loops' webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement capture is on:

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

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'loops'` on the client that Step 7 configures, when its client options take it.

**The call.** The Loops send becomes one PostHog send:

- `email` becomes `to`.
- An `Idempotency-Key` header becomes `idempotencyKey`, with the same value.
- Add `distinctId`, as Step 7 says. When a helper has only the address, find it through the helper's callers.

**Templates brought into the code.** The site renders the Loops email from `dataVariables`, as "Templates" says, and sends `templateKey`, the rendered `subject` and `html`, `from` from the email's Name and From, and `replyTo` from its Reply when it has one. It sends no `templateId` and no `templateData`. When the code builds `dataVariables` in a variable, pass that variable to the render. In a helper whose callers pass the `transactionalId`, keep the callers as they are. Add one object in the helper that maps each Loops ID to its email's render and template key, keyed by the Loops ID. When an ID is missing from the map, fail the way the helper failed on a Loops error, with a message that names the ID.

**Templates made in PostHog.** The site sends `templateId` with the template ID the person gave in Step 3, never the Loops ID, and `templateData` with the site's `dataVariables`, the same object. It sends no `templateKey`, `subject`, `html`, `text`, `from`, or `replyTo`: the template holds them. In a helper whose callers pass the `transactionalId`, the object maps each Loops ID to its PostHog template ID instead.

By source:

- Node.js `loops.sendTransactionalEmail({ transactionalId, email, dataVariables, headers })`: the fields of that object.
- Go `client.SendTransactional(loops.SendTransactionalRequest{...})`: `posthog.CodeEmail{To, TemplateKey, Subject, HTML, From, ReplyTo, DistinctID, IdempotencyKey}`, or `posthog.TemplateEmail{To, TemplateID, TemplateData, DistinctID, IdempotencyKey}` for a template made in PostHog, sent with `client.Emails().Send(ctx, ...)`. Pass the function's `context.Context` when it has one, or `context.Background()`.
- PHP `$loops->transactional->send(transactional_id:, email:, data_variables:, headers:)` and Ruby `LoopsSdk::Transactional.send(transactional_id:, email:, data_variables:, headers:)`: `to`, `template_key`, `subject`, `html`, `from`, `reply_to`, and `idempotency_key`, or `template_id` and `template_data` for a template made in PostHog.
- A raw HTTP body or a community package's call: the same fields of its body.
- Nodemailer `transporter.sendMail({ to, from, subject, text: JSON.stringify(body) })` through `smtp.loops.so`: the fields of `body`, never the message's own `to`, `from`, `subject`, or `text`, which Loops ignored or read as its body. Where `sendMail` returned a promise, throw from PostHog's error as the Node.js bullet below says. Where it took a callback, call the same callback with that error, or with `null` and PostHog's answer. Where the code reads `info.messageId`, from the promise or the callback, it reads PostHog's message id: `data.id`.

**Errors.** Keep the site failing the same way it did, and never widen a catch. Loops' SDKs raise three kinds of error apart: an answer from Loops (`APIError`), a rate limit (`RateLimitExceededError` in Node.js and PHP, `LoopsSdk::RateLimitError` in Ruby), and a network error, which is the HTTP client's own error. PostHog answers all three as its one email error, with the code `network_error` for a network error that is left after its retries. So a branch that handled one kind checks PostHog's `code` or status code, and every other error is thrown, raised, or returned as before. Where a later, broader handler of the same `try`, such as `rescue StandardError` or `catch (\Exception $e)`, took the network error, the merged handler runs that handler's code for `network_error` instead of raising it, as Step 7 says: a raise inside one handler skips the handlers after it. Loops answers an invalid send with `400`. A branch on that status becomes a branch on PostHog's error name `validation_error`, never on a status code, as Step 7 says: PostHog's statuses for invalid sends differ from Loops'. Status checks for other statuses, such as `429` or `401`, stay status checks:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sendTransactionalEmail` threw into a `catch`, throw from the error so the same `catch` runs, and keep the property the `catch` reads: `if (error) throw Object.assign(new Error(error.message), { posthogEmailError: true, name: error.name, code: error.code, statusCode: error.statusCode })`. An `instanceof APIError` check becomes `err.posthogEmailError && err.code !== 'network_error' && (err.statusCode !== 429 || err.code === 'quota_limited')`, and a read of `err.json` becomes a read of `err.message`. An `instanceof RateLimitExceededError` check becomes `err.posthogEmailError && err.statusCode === 429 && err.code !== 'quota_limited'`: a used-up quota takes the API error's path, and a read of its `limit` or `remaining` has no PostHog value: log `err.statusCode` instead. A check of `err.statusCode === 400` becomes `err.name === 'validation_error'`. A `catch` that handled every error the same way needs none of these checks.
- **Python.** `except EmailError` takes the place of the Loops error, and a branch that handled one kind checks `e.code` or `e.status_code` first and raises every other error again, as the HTTP bullet shows. A check of `e.status_code == 400` becomes `e.name == "validation_error"`. When the site has two handlers that both become `except EmailError`, such as `except requests.HTTPError` and then `except requests.RequestException`, keep one `except EmailError as e:`: a second `except` of the same class never runs. Inside it, run the first handler's branch for the errors it took, such as Loops' answers (`e.code != "network_error"`), and the second handler's branch for the rest.
- **Go.** Loops' `SendTransactional` returned an `error`, and so does PostHog's `Send`. Keep `if err != nil`. Loops' Go SDK returned a network error as a plain error, not a `*loops.APIError`. Replace `errors.As(err, &apiErr)` on `*loops.APIError` with `errors.As(err, &emailErr) && emailErr.Code != "network_error"` on `*posthog.EmailError`, and `apiErr.StatusCode` and `apiErr.Message` with its `StatusCode` and `Message`. A check of `apiErr.StatusCode == 400` becomes `emailErr.Name == "validation_error"`. Every other error goes on as before, such as `return err`.
- **PHP.** PostHog's SDK throws too. A `catch (APIError $e)` becomes `catch (\PostHog\EmailError $e)` that throws `$e` again first when `$e->getErrorCode()` is `network_error`, or when `$e->getStatusCode()` is `429` and the code is not `quota_limited`. A `catch (RateLimitExceededError $e)` becomes `catch (\PostHog\EmailError $e)` that throws `$e` again first unless the status code is `429` and the code is not `quota_limited`. A used-up quota, `429` with `quota_limited`, takes the API error's path. When the site has both catches, keep one `catch` with both branches. A check of `$e->getStatusCode() === 400` becomes `$e->getErrorName() === 'validation_error'`. Loops' `getStatusCode()` and `getCode()` become PostHog's `getStatusCode()`, and `getJson()` becomes `getMessage()`. A read of `getLimit()` or `getRemaining()` on the rate limit error has no PostHog value: log the status code instead.
- **Ruby.** A `rescue LoopsSdk::APIError => e` becomes `rescue PostHog::EmailError => e` that raises `e` again first when `e.code` is `network_error`, or when `e.status_code` is `429` and `e.code` is not `quota_limited`. A `rescue LoopsSdk::RateLimitError` becomes `rescue PostHog::EmailError => e` that raises `e` again first unless `e.status_code` is `429` and `e.code` is not `quota_limited`. When the site has both rescues, keep one `rescue PostHog::EmailError => e`: a second rescue of the same class never runs. Inside it, run the rate limit branch when `e.status_code` is `429` and `e.code` is not `quota_limited`, the API error branch for every other code but `network_error`, and raise `e` again for `network_error`. Loops' `e.statusCode` becomes PostHog's `e.status_code`, and `e.json` becomes `e.message`. A check of `e.statusCode == 400` becomes `e.name == 'validation_error'`. A read of `e.limit` or `e.remaining` on the rate limit error has no PostHog value: log the status code instead.
- **HTTP.** The code read Loops' answer, and the HTTP client raised a network error on its own. Read PostHog's error the way the rewrite file for the language says under "The answer", and keep each branch: a status other than `200`, `ok` false, or `success` false becomes "there is an error" whose code is not `network_error`, a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code, where `429` also needs a code other than `quota_limited`. A `network_error` goes where the client's network error went before. In Python, a status check, `raise_for_status()`, and `except requests.HTTPError` become `except EmailError as e:` whose first line is `if e.code == "network_error": raise`, because those only handled Loops' answer. `except requests.RequestException` handled both, so it becomes a plain `except EmailError`.
- **A branch on `409`.** Rewrite it to read PostHog's code `idempotency_key_reused`, as "Code around the send" says, and note the change in the plan row.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Loops took it and counted it as a hard bounce. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** Loops' API answered no message id, so no API site reads one. A Nodemailer send through `smtp.loops.so` answered Nodemailer's `info.messageId`: a read of it becomes a read of PostHog's message id, as the Nodemailer bullet says. A moved send answers PostHog's message id: keep it unused unless the code logs the answer.

**The Loops client.** Keep the Loops client, its import, and its configuration while any site or other call still uses them, such as a send that stays, `sendEvent`, or a contact call, or while other code imports or re-exports the client. Loops' own packages (`loops`, `nuxt-loops`, `loops-go`, `loops-so/loops`, `loops_sdk`) serve only Loops, but one client also runs its contact, event, and list calls. The packages an SMTP or Auth.js site uses serve more than Loops: Nodemailer, a framework mailer, and `next-auth`. Never remove them; only their Loops settings belong to Loops. When nothing uses them, remove the import and the client, such as a Nodemailer transporter to `smtp.loops.so`, and keep the package and its key: the person removes them after the cutover.
