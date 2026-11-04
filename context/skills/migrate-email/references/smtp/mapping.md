# SMTP to PostHog mapping

This file decides, field by field, whether PostHog can send an SMTP call site. A site moves only when every field it sets moves. Otherwise it stays on SMTP, and the reason names the first field or feature that keeps it there. `api.md` has the PostHog side in full, and `posthog-sdks.md` has PostHog's names in each language.

Fields are written in their Nodemailer names here, such as `replyTo`. A site in another language sets the same part of the message under another name: `msg["Reply-To"]` in Python, `addReplyTo` in PHPMailer, `message.ReplyTo` in MailKit. `sdk-reference.md` lists the part each field sets. PostHog fields are written in their Node.js names: use the name `posthog-sdks.md` gives for the site's language, such as `reply_to` in Python.

Fields set in the transporter's `defaults`, the second argument of `createTransport`, are fields of every site that sends through that transporter. So are the settings of a `Mail.defaults` block or a shared client object.

## Fields

| SMTP | PostHog | A site stays on SMTP when |
|---|---|---|
| `from` | `from` | Never. `{ name, address }` becomes `'Name <address>'`, with the name in double quotes when it holds a comma, a quote, or another special character. It needs a verified sender (Step 4) |
| `to` | `to` | It holds more than one address, including a comma-separated string, or none, such as a message sent only to `bcc` or envelope recipients: PostHog's send needs one `to`. A list with one entry moves as that entry. `{ name, address }` or `'Name <address>'` moves as the bare address: note in the plan row that the To line loses the name |
| `subject` | `subject` | Never |
| `text`, `html` | `text`, `html` | The value is a stream, an `href`, or a `path` that is a URL. A string moves as it is, and a `Buffer` as its UTF-8 string. A `path` to a file in the repository moves as the file's content, read in the moved code |
| `cc`, `bcc` | `cc`, `bcc` | The installed SDK has no `cc` or `bcc` (Step 7 checks), there are more than 10 of either, or the code builds the list at run time and you cannot tell it stays at 10 or fewer. `{ name, address }` moves as the bare address, as for `to` |
| A recipient in the envelope only, such as an address in Python's `sendmail` `to_addrs` that no header names | `bcc` | As for `bcc`. A message with no `To` header has no `to`, and stays, as the `to` row says |
| `replyTo` | `replyTo`, one address or a list | An entry carries a name, there are more than 10, or the code builds the value at run time and you cannot tell that it holds bare addresses only. A value passed in as a parameter is read at its callers, as Step 3 says: when every caller passes one bare address or nothing, it moves |
| `attachments` | `attachments` | The installed SDK has no `attachments`, there are more than 10 files, the files can add up to more than 512 KB, such as an upload of the user's or a PDF of unbounded length, or an entry has anything but a `filename`, a `content`, a `path` to a file, a `contentType`, a `cid`, and an `encoding` of its string content. An `href`, a `path` that is a URL or a `data:` URI, a stream `content`, `raw`, `headers`, and an `inline` disposition without a `cid` keep it. See "Attachments by path" below |
| `headers` | none | Always: no PostHog SDK takes headers yet. This includes every header the code sets on a MIME message, such as `msg["X-Entity-Ref-ID"]` or `addCustomHeader` |
| `list` | none | Always: no PostHog SDK takes headers yet. `List-Unsubscribe` is a header too |
| `priority` | none | Always. PostHog's send doesn't take it yet |
| `sender` | none | Always. PostHog's send doesn't take it yet |
| `inReplyTo`, `references`, `xMailer`, `otp` | none | Always: no PostHog SDK takes headers yet |
| `date`, `messageId` | none | The `date` is not the time of the send, or the code stores or reads the `messageId`, such as for a webhook handler. A `date` of the send time, such as Python's `formatdate()`, and a `messageId` nothing reads, such as one from `make_msgid()` set only on the message, move without it: the moved send gets its own. Note it in the plan row |
| `watchHtml`, `amp`, `alternatives` | none | Always. PostHog's send doesn't take it yet |
| `icalEvent` | none | Always. An `.ics` file sent only as an attachment moves as an attachment |
| `envelope` | none | Its `from` or recipients differ from the `from`, `to`, `cc`, and `bcc` of the message, such as a bounce address of its own. An `envelope` with the same addresses moves without it: note it in the plan row |
| `raw`, a message the code writes by hand, `net/smtp`, `Net::SMTP`, or a `gen_smtp` body that is not `:mimemail.encode` output | none | Always. The fields are in a string the code built, and PostHog takes fields |
| `dsn` | none | Always. PostHog's send doesn't take it yet |
| `dkim` on the message or the transporter | none | Never. The moved send is signed with the DKIM records of the PostHog sender that Step 4 sets up. Note in the plan row that the site moves without it |
| `attachDataUrls` | none | The `html` holds a `data:` image |
| `encoding`, `textEncoding`, `disableFileAccess`, `disableUrlAccess`, `pool`, `secure`, and other connection options | none | Never. They say how Nodemailer writes the message and reaches the server, and the moved site builds no message and opens no connection |
| A `compile` or `stream` plugin on the transporter, `transporter.use(...)` | none | The plugin is not one of the template renderers under "Templates". The moved send would skip it |

PostHog's `from` takes `'Name <address>'`, with the name in double quotes when it holds a comma, a quote, or another special character, such as `'"Acme, Inc." <hello@mail.example.com>'`. PHPMailer's `setFrom(address, name)`, MailKit's `MailboxAddress(name, address)`, and the other clients' name and address pairs become that form.

A send through SMTP has no idempotency key, so the moved site sends none either. PostHog's SDK makes one for each call and reuses it on its own retries.

**Tracking.** PostHog captures opens and clicks unless the send sets `captureEngagement: false`. An SMTP server tracks neither on its own, but the provider behind the host may, by an account, domain or server setting. Ask the person once, for each host the moved sites use, whether it tracked opens and clicks of these sends:

- Both tracked: the site moves as it is.
- Neither tracked, including a host with no tracking provider behind it, such as the company's own mail server: the site moves with `captureEngagement: false`.
- One tracked and the other not: the site stays, and the reason is `<host> tracks only opens` or `<host> tracks only clicks`. `captureEngagement: false` turns off both.
- The person can't say: the site stays, and the reason is `<host> tracking not checked`.

A site that needs `captureEngagement: false` stays when the installed SDK has no `captureEngagement`.

### Attachments by path

PostHog takes an attachment's content, not a path. An attachment by `path`, or PHPMailer's `addAttachment($path)`, gomail's `Attach(path)`, go-mail's `AttachFile(path)`, or the `mail` gem's `add_file '/path'`, moves when the path names a file on the app's own disk: the moved code reads the file into `content` before the send. It stays when the path is a URL or a `data:` URI, or when you cannot tell that the files stay at 512 KB or less in all, such as a file the user uploaded. A file in the repository has a size you can check. A file the app writes just before the send, such as a rendered PDF, has the size the code gives it: follow the code that writes it.

## Calls

| SMTP call | A site stays on SMTP when |
|---|---|
| Nodemailer `transporter.sendMail(message)`, with a promise or a callback | A field above keeps it |
| Python `send_message(msg)` and `sendmail(from_addr, to_addrs, msg)` with a message built with `EmailMessage` or `email.mime`, and `aiosmtplib.send` | A field above keeps it. A message string the code wrote by hand always stays |
| Ruby `mail` gem `deliver` | A field above keeps it |
| PHPMailer `send()`, and `symfony/mailer` `$mailer->send($email)` used on its own | A field above keeps it |
| Go gomail and go-mail `DialAndSend` | A field above keeps it |
| Go `net/smtp` `SendMail`, Ruby `Net::SMTP` `send_message` | Always: the message is a string the code built |
| MailKit `Send` or `SendAsync`, `System.Net.Mail` `Send` or `SendMailAsync` | A field above keeps it |
| Elixir `:gen_smtp_client.send_blocking` and `send` with a `:mimemail.encode` body | A field above keeps it |
| Rust `lettre` `send` | A field above keeps it |
| A send that names several recipients in `to`, or sends one message to a list in one call | Always. A loop that calls the send once per recipient is one site whose `to` is one address, and it moves |
| A framework mailer: Django `send_mail` or `EmailMessage` with the SMTP backend, Flask-Mail, Flask-Mailman, Rails Action Mailer, Laravel `Mail`, Symfony Mailer through the framework, Swoosh, Bamboo, NestJS `MailerService` | Always. PostHog has no mailer driver |
| A send in a language whose PostHog SDK has no email send (`posthog-sdks.md` lists them), such as Java's Jakarta Mail | Always |

A Nodemailer transporter with a non-SMTP or third-party transport is not an SMTP site: `sdk-reference.md` says so under "Not SMTP". List its sends among the other calls.

## Code around the send

SMTP clients report an error in two ways. Node.js, Python, Ruby, PHPMailer with exceptions on, Symfony Mailer, and .NET throw. PHPMailer with exceptions off answers `false`, and Go, Elixir, and Rust answer an error value. `posthog-sdks.md` says how PostHog's SDK reports an error in each language. Keep the site failing the same way it did, as the Rewrite section says.

| Code | A site stays on SMTP when |
|---|---|
| A `catch`, `except`, or `rescue` of the client's error, or a check of its error value, with no branch on one kind of error | Never. A branch on any error moves |
| A branch on an invalid send: an error class or code that means the server refused the sender, a recipient, or the message. See the list below | Never. It becomes a branch on PostHog's error name `validation_error`, never on a status code, as the Rewrite section says |
| A branch on any other kind of SMTP error: a failed login (`EAUTH`, `SMTPAuthenticationError`, `AuthenticationException`, reply `535`), a connection or timeout error (`ECONNECTION`, `ETIMEDOUT`, `SMTPServerDisconnected`), or a temporary refusal (`Net::SMTPServerBusy`, `err.permanent === false`, a `4xx` reply such as `421` or `451` that the code retries) | Always. These SMTP failures have no PostHog counterpart, and a catch of every PostHog error would widen the branch. This holds for a branch in a caller the site's error reaches, too: follow a thrown or returned error up to the code that handles it, and check its branches on `code`, `responseCode`, `permanent`, or the error class |
| A check of `info.rejected`, `info.accepted`, or Python's dict of refused recipients | Never, when the site sends to one recipient. The check becomes a check of PostHog's error, as the Rewrite section says |
| `info.messageId`, `getLastMessageID()`, `message.MessageId`, or the Message-ID stored for a webhook handler of the provider behind the host, or a status read | Always |
| The Message-ID logged or stored for the app's own use | Never. Use PostHog's message id |
| A check that skips the send when the SMTP settings are missing, such as `if (!process.env.SMTP_HOST) return`, `smtp_configured?`, or a `None` client | Never. The moved site checks the PostHog secret key variable from Step 6 instead, and skips the same way, with the same log line or answer: the person removes the SMTP variables after the cutover, and a check left on them would skip every send. Keep the SMTP check for the sites that stay |
| The connection code: `createTransport`, `smtplib.SMTP(...)`, `starttls`, `login`, `ConnectAsync`, `AuthenticateAsync`, `Disconnect` | Never. A moved site needs no connection. When the code picks a local catcher, such as Mailpit, MailHog, or an Ethereal account, or a `jsonTransport` by environment, keep that branch: the moved code sends through PostHog only where the old code reached the real host, and keeps the catcher elsewhere. When the catcher comes from an env file alone, such as `SMTP_HOST=localhost` in `.env.development`, note in the report that development sends go through PostHog wherever its secret key is set |

An invalid send, the server refusing the sender, a recipient, or the message, shows as:

- Node.js: `err.code === 'EENVELOPE'` or `err.code === 'EMESSAGE'`.
- Python: `SMTPRecipientsRefused`, `SMTPSenderRefused`, or `SMTPDataError`.
- Ruby: `Net::SMTPFatalError` or `Net::SMTPSyntaxError`.
- .NET: MailKit's `SmtpCommandException` whose `ErrorCode` is `SenderNotAccepted`, `RecipientNotAccepted`, or `MessageNotAccepted`, and `System.Net.Mail`'s `SmtpFailedRecipientException` or `SmtpFailedRecipientsException`.
- Every language: a check of a `5xx` reply code to the sender, a recipient, or the message, such as `550`, `553`, or `554`, in `err.responseCode`, `e.smtp_code`, lettre's `error.status()`, or the error text.

## Templates

SMTP stores no templates, so no site here has `template` content. The app renders its HTML in its own code, and the site sends it as `html` or `text`: the code form fits. Classify such a site by its other fields. Step 3's question about templates stored at the provider has nothing to ask for SMTP.

A site whose send names a template stored at the provider behind the host through a header, such as SendGrid's `X-SMTPAPI` with a template id, stays for its header.

Two Node.js packages render inside the send. Their sites move when the moved code renders the same content first:

- **`nodemailer-express-handlebars`.** A site that sends `template` and `context` moves. When the message also sets `html`, the plugin renders nothing and the message goes out as it is: send its own `html` and `text`, and render nothing. Otherwise the moved code renders the view with the plugin's own options, `viewEngine`, `viewPath`, and `extName` (`.handlebars` when unset), and sends the result as `html`, as the Rewrite section shows. A `text_template` renders into `text` the same way. Keep the plugin on the transporter while any site that stays uses it.
- **`email-templates`.** A site moves when the `Email` config sets `send: true` and `preview: false`. The moved code prepares `locals` and the message as `send` does, calls `email.renderAll(template, locals, message)`, and sends its `subject`, `html`, and `text`, as the Rewrite section shows. The config's `message` fields, such as `from` and `attachments`, are fields of the site too. When the config leaves `send` or `preview` to their defaults, the site stays, with the reason `email-templates sends only outside development and test`: the moved send would send from every environment.

Rendered content is classified the same way as any `html`: it moves as it is.

## Webhooks

SMTP has no webhooks, so moving a site stops no SMTP event. The provider behind the host may post delivery events to a handler of the app (`sdk-reference.md`, "Webhooks"). That handler stops getting events for a site that moves. PostHog records the events of a moved send on the person it names with `distinctId`, when engagement events are on for the project:

| Event of the provider behind the host | PostHog event |
|---|---|
| Sent, processed, or accepted | `$workflows_email_sent` |
| Delivered | `$workflows_email_delivered` |
| Bounced, hard or permanent | `$workflows_email_bounced` |
| Spam complaint | `$workflows_email_blocked` |
| Opened | `$workflows_email_opened` |
| Clicked | `$workflows_email_link_clicked` |
| Dropped or suppressed | none. PostHog refuses the send instead, such as with `recipient_suppressed` |
| Deferred, soft bounce, unsubscribe, and other events | none |

PostHog's events carry no Message-ID of the SMTP message, no id of the provider behind the host, and no header the send set. A site whose events a handler matches by the Message-ID, by that provider's message id, or by a header stays on SMTP. For every other handler, the report tells the person which events it handles, which PostHog events take their place, and that a webhook destination in PostHog (Data pipelines, then Destinations) can post them to an endpoint. The handler itself keeps working for the sites that stay. Never change it.

When the app has no such handler, the report says that SMTP sends no delivery events, and that the moved sends get PostHog's events on the person.

## Rewrite

How a site that moves is written with PostHog's SDK. Step 7 says when to use each part, and `posthog-sdks.md` has the client and the send in each language.

**The PostHog client.** Set `migratedFrom: 'smtp'` on the client that Step 7 configures, when its client options take it.

**The call.** The SMTP send and its connection become one PostHog send. Build its fields from the message the site built:

- Nodemailer `sendMail(message)`: the fields of `message`, with the transporter's `defaults`.
- Python `EmailMessage`: `msg["From"]`, `msg["To"]`, `msg["Cc"]`, `msg["Bcc"]`, `msg["Reply-To"]`, and `msg["Subject"]`; `set_content(text)` is `text`, `add_alternative(html, subtype="html")` is `html`, and each `add_attachment(data, maintype, subtype, filename=)` is an attachment. With `MIMEMultipart`, each `MIMEText(body, "plain")` and `MIMEText(body, "html")` part is `text` and `html`, and each part with a `Content-Disposition` header is an attachment. Recipients in `sendmail`'s `to_addrs` that no header names are `bcc`.
- Ruby `mail`: `from`, `to`, `cc`, `bcc`, `reply_to`, `subject`, `text_part`, `html_part`, and `body`, which is `text` unless its content type is `text/html`.
- PHPMailer: `setFrom`, `addAddress`, `addReplyTo`, `Subject`, `Body` (`html` after `isHTML(true)`, else `text`), and `AltBody` (`text`). Symfony `Email`: `from`, `to`, `replyTo`, `subject`, `html`, and `text`.
- Go gomail: `SetHeader("From")`, `SetHeader("To")`, `SetHeader("Subject")`, `SetHeader("Cc")`, `SetBody`, and `AddAlternative`, by content type. go-mail: `From`, `To`, `Cc`, `Bcc`, `ReplyTo`, `Subject`, `SetBodyString`, and `AddAlternativeString`.
- MailKit: `From`, `To`, `ReplyTo`, `Subject`, and the `BodyBuilder`'s `TextBody` and `HtmlBody`. `System.Net.Mail`: `From`, `To`, `ReplyToList`, `Subject`, and `Body` (`html` when `IsBodyHtml`, else `text`), with a `text/html` or `text/plain` `AlternateView` as the other one.
- Elixir `gen_smtp`: the `From`, `To`, and `Subject` headers and the `text/plain` and `text/html` parts of the `:mimemail.encode` tuple.
- Rust `lettre`: `from`, `to`, `reply_to`, `subject`, and the body, or the plain and HTML bodies of `MultiPart::alternative_plain_html`.

**The fields.**

- `{ name: 'Example', address: 'hello@mail.example.com' }` and every other name and address pair in `from` becomes `'Example <hello@mail.example.com>'`. Put the name in double quotes when it holds a comma, a quote, or another special character: `'"Acme, Inc." <hello@mail.example.com>'`. A quoted name that is already in a `from` string, such as `'"Acme" <hello@mail.example.com>'`, keeps its quotes. A `from` without a name becomes the bare address.
- `to`, `cc`, and `bcc` become bare addresses. A list with one entry in `to` becomes that entry. When a helper takes a list of recipients and every caller passes one address, change the parameter to one address and update the callers. Never send one email per address in a loop.
- A `Buffer` in `text` or `html` becomes its string. A `path` to a file becomes the file's content, read with the same encoding.
- An attachment `{ filename, content, contentType, cid }` becomes `{ filename, content, contentType, contentId: cid }`. A `Buffer` content stays a `Buffer`. PostHog's SDK reads a string content as base64, so only a base64 string moves as a string. In Node.js, a string content with `encoding: 'base64'` stays the same string, one with another `encoding`, such as `'hex'`, becomes `Buffer.from(content, encoding)`, and one without `encoding` is text and becomes `Buffer.from(content)`, as Nodemailer reads it. In Python, `bytes` stay `bytes`, and a `str` passed to `add_attachment` or a `MIMEText` part is text: send `content.encode()` with the part's charset, `utf-8` when it sets none. In Go and Elixir, the SDK takes the raw file: decode a base64 string first, as `posthog-sdks.md` says, or the recipient gets the file encoded twice. Nodemailer's `cid` is already a bare name, such as `logo`, and moves as it is. A `Content-ID` set on a MIME part, such as Python's `cid="<logo>"` or `cid=make_msgid()`, carries angle brackets: drop them, as the `cid:` link in the HTML does. Drop `contentDisposition: 'attachment'`: `contentId` makes a file inline.
- An attachment by `path` becomes `{ filename, content: await readFile(path), contentType }`, with `readFile` from `node:fs/promises`, and `filename` the path's base name when the entry has none. In Python, `content` is the file's bytes, read with `open(path, "rb")`. In Go, `Content` is `os.ReadFile(path)`. In Python and Go, name the content type the client guessed from the file name, such as `application/pdf`.
- A send with rendered content gets a `templateKey`, as Step 7 says.

**Template renderers.**

- `nodemailer-express-handlebars`: create the view engine once next to the PostHog client, as the plugin does, and render the view before the send:

  ```js
  import { create } from 'express-handlebars'
  import path from 'node:path'

  const viewEngine = create(hbsOptions.viewEngine)
  const html = await viewEngine.renderView(path.join(hbsOptions.viewPath, 'welcome' + (hbsOptions.extName ?? '.handlebars')), context)
  ```

  `hbsOptions` is the object the code passed to the plugin. When its `viewEngine` is already an engine with `renderView`, use it as it is. Share that object between the plugin and the moved code rather than copying it.
- `email-templates`: `send` merges the config's `views.locals` under the site's `locals` and the config's `message` under the site's `message`, and `renderAll` does neither by itself. Do the same, with `siteMessage` set to `{}` when the site passes no message, as `send` does, then render: `const message = _.defaultsDeep({}, _.omit(siteMessage, 'attachments'), _.omit(email.config.message, 'attachments'))`, then `message.attachments = siteMessage.attachments || email.config.message.attachments || []`, because `send` takes the site's attachments or else the config's and never merges the two lists, and `const { subject, html, text } = await email.renderAll(template, _.defaultsDeep({}, email.config.views.locals, locals), message)`, with lodash's `defaultsDeep` and `omit`, which `email-templates` uses. When the app doesn't list `lodash` in its own dependencies, add it with the project's package manager: pnpm, for one, doesn't resolve a dependency of a dependency from the app's code. `renderAll` renders only the parts the message doesn't already hold. Then one PostHog send with those and the other `message` fields.

**Errors.** Keep the site failing the same way it did:

- **Node.js.** `posthog.emails.send` never throws on an API error: it answers `{ data, error }`. Where the awaited `sendMail` threw into a `catch`, or the promise rejected to its caller, throw from the error so the same path runs: `if (error) throw Object.assign(new Error(error.message), { name: error.name, code: error.code, statusCode: error.statusCode })`. Never put PostHog's HTTP status in `responseCode`: SMTP code reads it as an SMTP reply, where `4xx` is temporary and `5xx` is permanent. A log line that read `err.responseCode` reads `err.statusCode`. A check of an invalid send, such as `err.code === 'EENVELOPE'` or `err.responseCode === 550`, becomes `err.name === 'validation_error'`. A callback `(err, info) => { ... }` becomes the same code run with `err` from `error` and `info` from `data`. `info.messageId` becomes `data.id`. PostHog's answer holds only the id, so a site whose code reads a field of `info` that "Code around the send" doesn't convert, such as `info.envelope` or `info.response`, stays on SMTP, and the reason names the field.
- **Python.** PostHog's SDK raises too. Replace `except smtplib.SMTPException`, the base class of every SMTP error, with the PostHog exception `posthog-sdks.md` names, and a read of `e.smtp_code` or `e.smtp_error` in a log line with its status code or message. `smtplib.SMTPException` covers a connection that drops after it opened, as `SMTPServerDisconnected`, but not one that never opens, such as a refused connection or a timeout at connect, which raises an `OSError` past it. PostHog's `network_error` doesn't tell the two apart, so the site moves only when both failures ran the same code before: the `except SMTPException` handler is a bare `raise` and nothing else, and no later handler of the same `try` catches an `OSError`, such as `except OSError` or `except Exception`, so both reached the caller unchanged; or an `except OSError` on the same `try` runs the same code as the `except SMTPException`. Then `network_error` takes that code. Otherwise the site stays, and the reason is `PostHog can't tell a refused connection from a lost one`. A branch on `SMTPServerDisconnected` alone keeps the site, as the table above says. `except OSError` around the send also catches connection errors and other I/O in the same `try`: make it `except (EmailError, OSError)`, so it catches what it caught before. Leave a broader catch, such as `except Exception`, as it is. A check of the dict of refused recipients becomes the `except` branch. A catch of an invalid-send class, such as `except smtplib.SMTPRecipientsRefused`, becomes `except EmailError as e:` that checks `e.name == "validation_error"` and raises every other error again.
- **Ruby.** Replace `rescue` of the `Net::SMTP` errors as a group, such as `rescue Net::SMTPError` or a list of all of them, with `rescue PostHog::EmailError`, and raise it again first when its code is `network_error`: the `Net::SMTP` errors don't cover a refused or timed-out connection, which raised past them. Leave a broader `rescue`, such as `rescue StandardError`, as it is: it catches PostHog's error too. A `rescue Net::SMTPFatalError` or `Net::SMTPSyntaxError` becomes `rescue PostHog::EmailError => e` that checks `e.name == 'validation_error'` and raises every other error again.
- **PHP.** With PHPMailer exceptions on, replace `catch (PHPMailer\PHPMailer\Exception $e)` with `catch (PostHog\EmailError $e)`. With exceptions off, the `if (!$mail->send())` branch runs in a `catch (PostHog\EmailError $e)`, and `$mail->ErrorInfo` becomes `$e->getMessage()`. For Symfony Mailer, replace `catch (TransportExceptionInterface $e)` with `catch (PostHog\EmailError $e)`. Leave a broader catch, such as `catch (\Throwable $e)`, as it is. A branch on a `5xx` reply in `$e->getMessage()` or `$mail->ErrorInfo` becomes a check of `$e->getErrorName() === 'validation_error'`.
- **Go.** `if err := d.DialAndSend(m); err != nil` becomes `if _, err := client.Emails().Send(ctx, ...); err != nil`, with the same branch. A branch on an invalid send, such as a `5xx` reply code in the error, becomes `errors.As(err, &emailErr) && emailErr.Name == "validation_error"` with `var emailErr *posthog.EmailError`, and returns every other error as before. A branch on another kind of SMTP error keeps the site, as the table above says.
- **.NET.** Replace `catch (SmtpException)` or `catch (MailKit.Net.Smtp.SmtpCommandException)` with no `when` filter and no read of `StatusCode` beyond a log line, and the client's other exceptions caught together with it, with `catch (PostHog.Emails.EmailException)`. MailKit's `SmtpCommandException` is only the server's answer to a command: a network failure throws `IOException`, `SocketException`, or `SmtpProtocolException` past it. So when the old catch took `SmtpCommandException` without those, throw again first when `e.Code == "network_error"`. `System.Net.Mail`'s `SmtpException` also covers a failed connection and a timeout, so it needs no such check. Leave a broader catch, such as `catch (Exception)`, as it is. A catch of an invalid send, such as `catch (SmtpCommandException e) when (e.ErrorCode == SmtpErrorCode.RecipientNotAccepted)` or `catch (SmtpFailedRecipientException)`, becomes `catch (PostHog.Emails.EmailException e) when (e.Name == "validation_error")`.
- **Elixir.** A `case` on the receipt binary and `{:error, ...}` becomes a `case` on `{:ok, result}` and `{:error, error}`, with the same branches. A branch on an invalid send becomes a match on `{:error, %PostHog.Emails.Error{name: :validation_error}}`.
- **Rust.** `mailer.send(&email)?` becomes `posthog.emails().send(...).await?` where the function's error type takes `EmailError`, or a `match` with the same branches. A branch on an invalid send, such as a `5xx` `error.status()`, becomes a check of the PostHog error's `kind()` for a validation error, with the variant the installed crate defines for `validation_error`.
- PostHog refuses a send to a suppressed address with `recipient_suppressed`, where an SMTP server took it and the provider behind it dropped it later. When the site throws, retries, or reports a failure on any error, handle `recipient_suppressed` before that branch the way the site handled a send that went out: log it and go on. `recipient_suppressed` is a `validation_error`, so it comes before a branch on `validation_error` too. Note each site that got this branch in the report.

**The answer.** The message id of a moved send is PostHog's. Code that logged the Message-ID, or stored it for the app's own use, takes PostHog's message id instead.

**The SMTP client.** Keep the transporter, the SMTP connection code, its import, and the template plugin while any site or other call still uses them. When nothing uses them, remove the import, the transporter or client, and its connection code, and keep the package and the SMTP variables: the person removes them after the cutover.

The SMTP packages often serve more than these sends. Keep each one for its other uses, and say so in the report:

- `nodemailer` also runs its non-SMTP transports, such as a `jsonTransport` preview or the `SES` transport, and `email-templates`, `nodemailer-express-handlebars`, and `@nestjs-modules/mailer` depend on it.
- The `mail` gem is the mail library of Rails' Action Mailer, and `symfony/mailer` is the mailer of the Symfony framework, and framework mailers stay.
- MailKit also reads mail over IMAP and POP3.
- `smtplib`, `email`, `net/smtp`, and `System.Net.Mail` are part of the language's standard library: there is no package to remove.
