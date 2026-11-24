# Loops to PostHog mapping

This file decides, field by field, whether PostHog can send a Loops call site. A site moves only when every field it sets moves. Otherwise it stays on Loops, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and the rewrite file for the site's language, which Step 7 names, has PostHog's names in that language.

PostHog fields are written in their Node.js names here, such as `templateKey`. Use the name the rewrite file gives for the site's language, such as `template_key` in Python.

Every Loops send renders a transactional email stored at Loops. So every Loops site is a `template` site in the plan. It moves by bringing that email into the code, as "Templates" says, and sends it in the code form: `templateKey`, the rendered `subject` and `html`, and the email's `from` and `replyTo`. It never moves to a template made in PostHog, as "Tracking" says.

## Fields

| Loops | PostHog | A site stays on Loops when |
|---|---|---|
| `email` | `to` | Never. It is always one address |
| `transactionalId` | the Loops email, brought into the code and rendered with `dataVariables`, sent as `subject` and `html` | See "Templates" |
| `dataVariables` | the values the code renders into the email, with the same keys | Never in the code: a value that the code builds as HTML goes in as it is, as "Templates" says |
| `addToAudience: true` | none | Always. It adds the recipient to the Loops audience, which Loops' campaigns and workflows send to, so moving the send would stop new contacts reaching it. `false` or no value moves |
| `attachments` | `attachments` | Step 3 says so under "Files". See "Attachments" |
| `Idempotency-Key` header (`headers` in Node.js, PHP, and Ruby, the request's idempotency key field in Go) | `idempotencyKey` | The code can build a key with a space or a character outside visible ASCII. Loops' keys are at most 100 characters, and PostHog takes 1 to 255 visible ASCII characters, so any other Loops key fits. A key built from a value whose characters the code doesn't bound, such as text a user or another service sends, counts as one that can. An ID the app makes, such as a database row ID or a UUID, is bounded, even when it reaches the site as a parameter and only its name, type, or a comment says what it is |
| Any other request header: in an SDK's `headers` option, or in an HTTP send any header but `Authorization`, `Content-Type`, `Accept`, and `User-Agent`, which only carry the request and which PostHog's SDK sets itself | none | Always: no PostHog SDK takes headers yet |

The Loops email itself sets the rest, in its sending settings. The template check in Step 3 reads them, and the code sends them:

| Loops email setting | In the code | A site stays on Loops when |
|---|---|---|
| Subject (`subject`) | `subject`, rendered with the same data variables and never escaped | Never |
| Preview (`previewText`) | The hidden preview block at the start of the HTML, as `template-to-code.md` says, with its values escaped | Never |
| Name and From (`fromName`, `fromEmail`) | `from`, as `fromName` in double quotes, with each `\` and `"` in it escaped with a `\`, then `fromEmail`, `@` and the team's sending domain in angle brackets, such as `'"Acme, Inc." <hello@mail.example.com>'`. When the name holds a data variable, the code quotes and escapes the rendered name the same way. `fromEmail` is only the part before the domain, and Loops shows the domain under Settings, then Domain. A data variable in either is rendered. The sender must be a verified sender (Step 4) | From holds a data variable, and Step 3 can't tell every address it takes, as it does for any `from` |
| Reply (`replyToEmail`) | `replyTo`, rendered when it holds a data variable | Never |
| CC, BCC (`ccEmail`, `bccEmail`) | none | Either one is set, with or without a data variable. PostHog's send doesn't take `cc` or `bcc` yet |
| Language (`languageCode`) | `lang` on the `<html>` tag | Never |

A site with no idempotency key sends none in PostHog either.

**Tracking.** Loops tracks no opens or clicks on a transactional email, as `account.md` says. So every Loops site moves with opens off, as Step 3 says under "Opens the provider didn't track": write `opens off: Loops didn't track its opens` in its note. That keeps every Loops site in the code form, even when the person asks for a template made in PostHog: a send by template ID can't turn opens off. Step 7 marks the code send sensitive and never turns `clicks` on, so PostHog counts no clicks, as Loops counted none.

## Attachments

Each file of a site that moves keeps its fields, under the PostHog SDK's names, as its rewrite file gives them:

| Loops | PostHog |
|---|---|
| `filename` | The filename. Loops requires one on every file |
| `contentType` | The content type, as it is. Loops requires one. Keep its parameters, such as `method=REQUEST` on a calendar invite, as Step 3 says |
| `data`, a Base64 string | The content: the same Base64 string where the rewrite file says the SDK reads a string as Base64, otherwise its bytes, decoded as the rewrite file says |
| none | No content ID. A Loops file has none and no disposition, so every file shows as an attachment: set no content ID, and the moved email shows the same |

- Loops takes a file only as Base64 `data`: it fetches none from a URL or a path, and stores none with the email, so the send's list holds every file.
- Loops takes a request body under 4 MB, Base64 included, so a Loops send's files fit PostHog's 40 MB. Loops' docs name no limit on the count and no refused file type: Step 3's checks of both still apply.
- Loops sends files only for a team whose attachments Loops support turned on, and answered a send with files from any other team with a `400`. When a site sends files, ask in Step 3, with the template question, whether the team has them on. When it doesn't, or the person can't tell, write it in the site's plan row: those sends failed at Loops, and a moved send delivers its files, so the report asks the person to confirm the files should go out.

## Calls

| Loops call | A site stays on Loops when |
|---|---|
| `loops.sendTransactionalEmail`, the Go client's transactional send from `github.com/loops-so/loops-go`, `$loops->transactional->send`, `LoopsSdk::Transactional.send`, a community package's send, `POST /api/v1/transactional` | A field above keeps it |
| A send inside a loop over recipients | A field above keeps it. Each call already sends one email to one address, so the loop stays as it is |
| A send through `smtp.loops.so`, from Nodemailer or a framework mailer (Django, Rails, Laravel) | Always. PostHog has no mailer driver |
| Auth.js `next-auth/providers/loops` | Always. PostHog has no Auth.js provider |
| A send in a language without a PostHog SDK that sends email, such as Java or Kotlin | Always. Step 7 lists the languages PostHog's SDKs cover |
| `sendEvent` and `POST /api/v1/events/send` | Not a send: it starts a Loops workflow. List it with the other Loops calls |
| A send that the code runs after it removes the recipient's Loops suppression: `DELETE /api/v1/contacts/suppression`, or the SDK call that the installed client sends as that request | Always. The code wants the email to reach an address Loops suppressed, and PostHog refuses a suppressed address with `recipient_suppressed`. The removal call stays too |

## Code around the send

Loops' official SDKs throw or raise on an API error, and the Go SDK returns an error value. HTTP code reads the response. The rewrite file says under "The answer" how PostHog's SDK reports an error in its language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on Loops when |
|---|---|
| A `catch` or `rescue` that reads `err.statusCode`, `err.json`, `e.json`, `getStatusCode()`, or `getJson()`, or Go's `apiErr.StatusCode` and `apiErr.Message` | It branches on a Loops error text, such as `Missing required data variable(s)`, or on another field of Loops' error body, such as `error.path`: PostHog's error has neither. A branch on the HTTP status moves: a branch on `400`, Loops' answer to an invalid send, reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code |
| A branch on Loops' rate limit error: `RateLimitExceededError` in Node.js and PHP, or in Ruby the class the installed gem raises on a `429`, which Loops' Ruby docs page doesn't name | Never. Its retry, wait, re-queue, or rate-limit answer to its caller goes, and any other work in it stays as a branch on PostHog's status code `429` with a code other than `quota_limited`, as Step 7 says. The error then takes the path of every other error |
| A branch on status `409`, Loops' answer to a reused idempotency key | Never. Note it in the plan row: PostHog answers a repeat of the same send with the first send's answer and no error, so the branch no longer runs, and it answers a different send with the same key with the code `idempotency_key_reused`. Rewrite the branch to read that code |
| A check of the HTTP answer: `response.status_code`, `response.ok`, `response.success?`, `raise_for_status()`, or `success` in the body | Never. Read PostHog's error instead |
| A send the code can cancel, such as a `fetch` or axios request with a `signal` a caller passes in or an `AbortController` it aborts, or a Go request built with `http.NewRequestWithContext` and a context a caller can cancel | Unless the PostHog send in that language takes the same cancellation, as Go's `Send(ctx, ...)` does: pass it there. Otherwise always, as in Node.js, whose send takes no signal: an email the old code cancelled would go out. A fixed deadline moves, as "HTTP" says |

An idempotency key that the code sent to Loops and now sends to PostHog can send the email twice when a retry crosses the deploy: the first try went to Loops, the retry goes to PostHog. Note each such key for the report.

## Templates

Each Loops site moves by bringing its Loops email into the code, as `template-to-code.md` says. The check needs the content of the published version, because the code has only its `transactionalId`. `account.md` says how to get it: the API answers the body in LMX, Loops' markup, with the email's settings next to it, and the dashboard way is a preview send of the email. The code renders the HTML, the subject, and the preview text with the site's `dataVariables`. The send sets the rendered `subject` and `html`, and `from` and `replyTo` from the email's settings.

- A `transactionalId` that the code reads from an env variable or a config file names a Loops email the repository doesn't show. Ask the person which Loops email each such variable holds, with the template question of Step 3. When they can't tell, the site stays, and the reason names the variable.
- A helper whose callers pass the `transactionalId` is one site that sends several Loops emails. It moves only when every email its callers pass moves. Otherwise it stays, and the reason names the email that keeps it.

Loops' data variables, fallbacks, conditional sections, and array blocks, in the code. Each plan-row note below that asks the person to check or compare a site's send is a `before cutover:` note, as Step 3 says under "Write the plan file":

| Loops | In the code |
|---|---|
| `{data.name}` in LMX, `{name}` in the editor and in some API answers, `{DATA_VARIABLE:name}` in MJML | The value of `name` in `dataVariables`, escaped as the bullets below say. A string as it is, and a number as the code wrote it in the JSON, such as `20` or `20.5`. Each name keeps its case |
| A data variable in a setting, such as the subject | The same value, in that setting, as the settings table above says |
| A variable in a `Button`, `Link`, `Section`, or `Image` `href`, an `Image` `alt`, or an `Image` `dynamicSrc` | The value, escaped as an attribute. Never URL-encode it |
| A data variable that is not optional | A value the render requires where it shows. Loops refused a send without it with a `400`, but it drops a hidden section entirely, with the variables in it: a variable that appears only inside sections hidden for the site's values is not needed. Loops' docs don't say whether its `400` check skipped such a variable, so note each one in the plan row when the code can leave it out, so the person checks that site's send. When the code can leave the variable out or pass `null`, such as from a nullable field, decide the sections' conditions from the site's values first, then check it before the render only when it appears in content that shows, and when it is missing, run what the site ran for Loops' `400` instead of sending: its branch on `400` when it had one, else the handler that took Loops' API errors, else throw or return an error the way the send did |
| An optional variable without a fallback, left out, sent as `null`, or sent as `""` | Nothing. Loops' docs take only strings and numbers as values, let an optional variable be left out or sent as `""`, and say that a `null` will not work, without saying whether Loops then refused the send or left the value out. Treat a `null` as left out, and note in the plan row when the code can pass one, so the person checks that site's send |
| An optional variable with a fallback in `dataVariablesFallbacks` | The value, or the fallback when the value is left out or `null`. Loops' docs don't say whether `""` takes the fallback too, and say a `null` will not work: use the fallback for `""` and `null` as well, and note it in the plan row when the code can pass either |
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

- Loops' truth test: every data variable is text. A section with no operator shows when the value is there, is not `null`, and is not `""`, so `0`, `"0"`, and `"false"` show it. A `null` counts as left out for every operator. Write that test out, such as `value != null && String(value) !== ''`, never the language's own. `equal` and `contains` compare the value's text, so `20` equals `"20"`. Loops' docs don't say whether they ignore case: compare exactly, and note the section in the plan row when the code can send the value in another case.
- Escaping: Loops' docs don't say whether Loops escapes a value in the HTML. Escape every value, as `template-to-code.md` says. A value the code builds as HTML itself, such as a list it joins with `<br>` or a link it builds, was written for Loops to render: insert that value as it is, under the rule of `template-to-code.md`, and note in the plan row that Loops' docs leave its escaping open, so the person compares one send.
- These keep a template on Loops: a CC or BCC, a contact or event property, a number or boolean operator, a condition on an array variable (Loops' docs don't say how it tests a list), an MJML `{unsubscribe_link}`, which Loops fills from the account, a tag that "From LMX to HTML" doesn't place, and social icons without a preview send.
- Images: an LMX `Image` `src` is always hosted by Loops, on `images.vialoops.com`: LMX takes no other. Loops also hosts the images of an MJML email and the social icons, at addresses only a preview send shows: count any image on a `vialoops.com` or `loops.so` host as Loops'. Keep them, and list them, as `template-to-code.md` says. An image from a `dynamicSrc` is the app's own, and the `src` placeholder next to it never shows: list neither.
- Loops' docs don't say whether a send has a text part. Send `html` only, unless the preview send's source has a `text/plain` part: then write that text as `text` too, with each marker as its value, unescaped, and each conditional section and array block written in it the way "From a preview send" writes them in the HTML. A section or block you can't find in the text keeps the template on Loops, and the reason names it.

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

### From a preview send

When the content is a preview send instead of the API's LMX, as `account.md` says, its HTML is the one Loops rendered:

- Decode the message's HTML part, from quoted-printable or base64, and write it as the email.
- Replace each marker `[[name]]` with the variable `name`, escaped as above. In a link or an image source, the marker can be URL-encoded, as `%5B%5Bname%5D%5D`: replace that form too.
- A section that shows only for another value than its variable's marker, such as `pro` for an `equal` or `contains` section, a value without `pro` for a `not_contains` one whose marker holds `pro`, or `""` for an `empty` one, comes from the second preview that `account.md` asks for. Take the email from the preview where the variable held its marker, and from the second preview only the sections whose condition reads that variable. Inside an `equal` or `empty` section the variable can hold only that value, so its text there is right. Inside any other section that only the second preview shows, such as a `contains` or `not_contains` one, it can hold more: when the value shows in such a section, it can't be told from fixed text, and the template stays on Loops. A difference between the two previews anywhere else, apart from that variable's markers, also keeps it there. The reason names the variable.
- Wrap each conditional section the person described in its branch, around the part of the HTML that holds that section's content.
- Write each array block the person described as a loop: the preview shows its piece once per item, so keep one piece, with the item's variables.
- A marker that is left, or a section or block you can't find in the HTML, keeps the template on Loops, and the reason names it.

## Webhooks

Loops' webhook stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when the project's **Capture email engagement events** setting is on and the send's tracking doesn't turn engagement off, as Step 7 says under "Sensitive emails and tracking":

| Loops event | PostHog event |
|---|---|
| `transactional.email.sent` | `$workflows_email_sent` |
| `email.delivered` | `$workflows_email_delivered` |
| `email.hardBounced` | `$workflows_email_bounced` with `$bounce_type` `hard`. The same event fires on a soft bounce, so the report tells the person to filter on `$bounce_type` before a handler that acts on a hard bounce, such as one that disables the address |
| `email.spamReported` | `$workflows_email_blocked` |
| `email.softBounced` | `$workflows_email_bounced` with `$bounce_type` `soft` |
| `email.opened`, `email.clicked` | none. Loops sends them for campaign and workflow emails only. A moved send has opens off, so PostHog sends no `$workflows_email_opened` or `$workflows_email_link_clicked` for it either |
| `email.unsubscribed`, `email.resubscribed`, `campaign.email.sent`, `loop.email.sent`, `contact.*` | none. They are about campaigns, workflows, and contacts, which stay on Loops |

Every event Loops sends for a transactional email has a PostHog event in the table. A site whose events a handler reads or matches by any field but the event name, `transactionalId`, and the recipient's address, such as `email.subject`, `email.id`, or `contactIdentity.userId`, stays, and the reason is `its <field> feeds a webhook handler`: PostHog's events carry none of Loops' ids, and Step 7 marks every code send sensitive, which keeps the subject off them. No other handler keeps a site on Loops. The handler keeps working for the sites that stay, and for campaign and workflow events. Never change it.

## Calls that change the suppression list

Step 3 and Step 5 say what to do with each of these calls. They are not sends, and they stay on Loops. Each removes an address from Loops' suppression list: `DELETE /api/v1/contacts/suppression`, or the SDK call that the installed client sends as that request. Loops' docs show the removal only over HTTP and in its CLI, so read the installed client, as `sdk-reference.md` says, for each SDK call the code makes that could be one. Loops has no call that adds one: it suppresses an address only after a hard bounce or a spam complaint.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and the rewrite file for the site's language has the client and the send.

**The PostHog client.** Set `migratedFrom: 'loops'` on the client that Step 7 configures, when its client options take it.

**The call.** The Loops send becomes one PostHog send:

- `email` becomes `to`.
- An `Idempotency-Key` header becomes `idempotencyKey`, with the same value.
- `attachments` keeps its list, each file rewritten as "Attachments" says.
- Add `distinctId`, as Step 7 says. When a helper has only the address, find it through the helper's callers.
- Turn off the `opens` switch of tracking, as Step 7 says for a site whose plan note says `opens off`, which every Loops site's does.

**Templates brought into the code.** The site renders the Loops email from `dataVariables`, as "Templates" says, and sends `templateKey`, the rendered `subject` and `html`, `from` from the email's Name and From, and `replyTo` from its Reply when it has one. It sends no `templateId` and no `templateData`. When the code builds `dataVariables` in a variable, pass that variable to the render. In a helper whose callers pass the `transactionalId`, keep the callers as they are. Add one object in the helper that maps each Loops ID to its email's render and template key, keyed by the Loops ID. When an ID is missing from the map, fail the way the helper failed on a Loops error, with a message that names the ID.

By source:

- Node.js `loops.sendTransactionalEmail({ transactionalId, email, dataVariables, headers })`: the fields of that object.
- Go, the client's transactional send: the fields of its request. Loops' docs don't show whether the call takes a `context.Context`. When the site passed one, pass the same context. When it passed none, its send never stopped when a request ended: pass `context.Background()`, as `rewrite-go.md` says for a site without one, never the function's own context.
- PHP `$loops->transactional->send(transactional_id:, email:, data_variables:, headers:)` and Ruby `LoopsSdk::Transactional.send(transactional_id:, email:, data_variables:, headers:)`: `to`, `template_key`, `subject`, `html`, `from`, `reply_to`, and `idempotency_key`.
- A raw HTTP body or a community package's call: the same fields of its body.

**HTTP.** A request to `https://app.loops.so/api/v1/transactional`, or to the base URL the client sets, becomes the SDK's send in that language. A request with its own deadline keeps it, as Step 7 says under "Set up the client". A deadline is a fixed time limit the site set on its request: `signal: AbortSignal.timeout(5000)`, `requests.post(..., timeout=5)` or `httpx` with one `timeout=5`, Faraday's `timeout` on its default `net_http` adapter, Guzzle's `timeout`, a Go `http.Client{Timeout: ...}` or a context from `context.WithTimeout`. A limit on connecting alone, or connect and read limits apart, an axios `timeout`, and Faraday's `timeout` on another adapter are limits Step 7 says the SDK can't keep. Two SDK sites can have a deadline too:

- PHP: a Guzzle client with `timeout` that the code gives the Loops client. A `connect_timeout` on it is a connect limit, as Step 7 says.
- Go: an `http.Client` with a `Timeout` that the code gives the Loops client. It limits each request. Loops' docs don't say whether its client retries: the send gets a client of its own with `EmailRequestTimeout` set to it, as `rewrite-go.md` says under "A deadline", and keeps PostHog's retries. A Loops client's own default timeout is not the site's, so a site that gives the Loops client no `http.Client` sends through the first client. A limit on that `http.Client`'s `Transport` is kept as `rewrite-go.md` says under "A deadline".

A retry setting alone, such as urllib3's `Retry` on a `requests` session, is not a deadline. Nor is a signal or context a caller can cancel: see "Code around the send".

**Errors.** Keep the site failing the same way it did, and never widen a catch. A site can handle three kinds of error apart: an answer from Loops (`APIError`, as Loops' SDK pages name it), a rate limit (`RateLimitExceededError` in Node.js and PHP, as their pages name it, and in Ruby the class the installed gem raises on a `429`), and a network error. Loops' docs don't say what an SDK raises for a network error: read the installed client, as `sdk-reference.md` says, for what its send raises when the request fails, such as its own class or the HTTP client's, and match it to the site's `catch` or `rescue`. In Go it is any error that is not a `*loops.APIError`. A branch on one of these kinds and not the others falls under Step 7's rule on network failures. PostHog answers all three as its one email error, with the code `network_error` for a network error that is left after its retries. So a branch that handled one kind checks PostHog's `code` or status code, and every other error is thrown, raised, or returned as before. Where a later, broader handler of the same `try`, such as `rescue StandardError` or `catch (\Exception $e)`, took the network error, the merged handler runs that handler's code for `network_error` instead of raising it, as Step 7 says: a raise inside one handler skips the handlers after it. Loops answers an invalid send with `400`. A branch on that status becomes a branch on PostHog's error name `validation_error`, never on a status code, as Step 7 says: PostHog's statuses for invalid sends differ from Loops'. Status checks for other statuses, such as `429` or `401`, stay status checks. When the same `try`, `rescue`, or error check also covers a Loops call that stays, such as a contact call or `sendEvent`, keep its Loops handling for that call next to PostHog's: a second `catch (APIError $e)` in PHP, a second `rescue LoopsSdk::APIError` in Ruby, `err instanceof APIError ||` before the PostHog check in Node.js, or a second `errors.As` on `*loops.APIError` in Go:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where `sendTransactionalEmail` threw into a `catch`, throw from the error so the same `catch` runs, and keep the property the `catch` reads: `if (error) throw Object.assign(new Error(error.message), { posthogEmailError: true, name: error.name, code: error.code, statusCode: error.statusCode })`. An `instanceof APIError` check becomes `err.posthogEmailError && err.code !== 'network_error'`, and a read of `err.json` becomes a read of `err.message`. A branch on `instanceof RateLimitExceededError` goes unless it does other work, as "Code around the send" says. When it keeps work, its check becomes `err.posthogEmailError && err.statusCode === 429 && err.code !== 'quota_limited'` and runs before the API error's check, and after that work the error takes the path of every other error, as Step 7 says. A read of its other properties, which the installed package defines, such as its limit or the requests left, has no PostHog value. Where the code only logs it, log `err.statusCode` instead. Where it uses it for more, such as to pace retries or requeue work, the site stays, and the reason is `reads Loops' rate limit headroom`. A check of `err.statusCode === 400` becomes `err.name === 'validation_error'`. A `catch` that handled every error the same way needs none of these checks.
- **Python.** `except EmailError` takes the place of the Loops error, and a branch that handled one kind checks `e.code` or `e.status_code` first and raises every other error again, as the HTTP bullet shows. A check of `e.status_code == 400` becomes `e.name == "validation_error"`. When the site has two handlers that both become `except EmailError`, such as `except requests.HTTPError` and then `except requests.RequestException`, keep one `except EmailError as e:`: a second `except` of the same class never runs. Inside it, run the first handler's branch for the errors it took, such as Loops' answers (`e.code != "network_error"`), and the second handler's branch for the rest.
- **Go.** Loops' Go send returned an `error`, and so does PostHog's `Send`. Keep `if err != nil`. Loops' Go docs return an API error as a `*loops.APIError`, so a network error was another error. Replace `errors.As(err, &apiErr)` on `*loops.APIError` with `errors.As(err, &emailErr) && emailErr.Code != "network_error"` on `*posthog.EmailError`, and `apiErr.StatusCode` and `apiErr.Message` with its `StatusCode` and `Message`. A check of `apiErr.StatusCode == 400` becomes `emailErr.Name == "validation_error"`. Every other error goes on as before, such as `return err`. When the installed client, read as `sdk-reference.md` says, tried a `5xx` again on its own, keep the site's error path as it is, and note in the plan row that a server error is no longer tried again: PostHog's SDK retries network errors, rate limits, and `503`, as Step 7 says, not every `5xx`, so another server error can now come back after one try.
- **PHP.** PostHog's SDK throws too. A `catch (APIError $e)` becomes `catch (\PostHog\EmailError $e)` that throws `$e` again first when `$e->getErrorCode()` is `network_error`. A `catch (RateLimitExceededError $e)` goes unless it does other work, as "Code around the send" says. When it keeps work, the `catch (\PostHog\EmailError $e)` runs that work first when `$e->getStatusCode()` is `429` and the code is not `quota_limited`, and the error then takes the path of every other error, as Step 7 says: the code of the `APIError` catch, or of a later, broader catch of the same `try`, or a throw of `$e` again when no catch took an API error. Keep one `catch` for both: a second `catch` of the same class never runs. A check of `$e->getStatusCode() === 400` becomes `$e->getErrorName() === 'validation_error'`. Loops' `getStatusCode()` becomes PostHog's `getStatusCode()`, and `getJson()` becomes `getMessage()`. A read of the rate limit error's own values, which the installed package defines, such as its limit or the requests left, has no PostHog value. Where the code only logs it, log the status code instead. Where it uses it for more, the site stays, as the Node.js bullet says.
- **Ruby.** A `rescue LoopsSdk::APIError => e` becomes `rescue PostHog::EmailError => e` that raises `e` again first when `e.code` is `network_error`. A rescue of the class the installed gem raises on a `429`, which Loops' Ruby docs page doesn't name, goes unless it does other work, as "Code around the send" says. When it keeps work, the `rescue PostHog::EmailError => e` runs that work first when `e.status_code` is `429` and `e.code` is not `quota_limited`, and the error then takes the path of every other error, as Step 7 says: the code of the `APIError` rescue, or of a later, broader rescue of the same `begin`, or a raise of `e` again when no rescue took an API error. Keep one `rescue` for both: a second rescue of the same class never runs. Loops' `e.statusCode` becomes PostHog's `e.status_code`, and `e.json` becomes `e.message`. A check of `e.statusCode == 400` becomes `e.name == 'validation_error'`. A read of the rate limit error's other values, which the installed gem defines, such as its limit or the requests left, has no PostHog value. Where the code only logs it, log the status code instead. Where it uses it for more, the site stays, as the Node.js bullet says.
- **HTTP.** The code read Loops' answer, and the HTTP client raised a network error on its own. Read PostHog's error the way the rewrite file for the language says under "The answer", and keep each branch: a status other than `200`, `ok` false, or `success` false becomes "there is an error" whose code is not `network_error`, a branch on `400` reads PostHog's error name `validation_error`, and a branch on another status reads PostHog's status code, where `429` also needs a code other than `quota_limited`. A `network_error` goes where the client's network error went before. In Python, a status check, `raise_for_status()`, and `except requests.HTTPError` become `except EmailError as e:` whose first line is `if e.code == "network_error": raise`, because those only handled Loops' answer. `except requests.RequestException` handled both, so it becomes a plain `except EmailError`.
- **A branch on `409`.** Rewrite it to read PostHog's code `idempotency_key_reused`, as "Code around the send" says, and note the change in the plan row.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where Loops took it and counted it as a hard bounce. When the site throws or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. Note each site that got this branch in the report.

**The answer.** Loops' API answered no message id, so no site reads one. A moved send answers PostHog's message id: keep it unused unless the code logs the answer.

**The Loops client.** Keep the Loops client, its import, and its configuration while any site or other call still uses them, such as a send that stays, `sendEvent`, or a contact call, or while other code imports or re-exports the client. Loops' own packages (`loops`, `nuxt-loops`, `loops-go`, `loops-so/loops`, `loops_sdk`) serve only Loops, but one client also runs its contact, event, and list calls. The packages an SMTP or Auth.js site uses serve more than Loops: Nodemailer, a framework mailer, and `next-auth`. Never remove them; only their Loops settings belong to Loops. When nothing uses them, remove the import and the client, and keep the package and its key: the person removes them after the cutover.
