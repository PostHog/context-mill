# SMTP SDK reference

This file says what an SMTP send looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

An SMTP site sends through an SMTP client library to an SMTP server. The server is run by some provider, such as Google Workspace, Microsoft 365, Mailgun, or the person's own mail server. This skill moves the sends of the code. The provider behind the host decides the DNS records and the suppression list: `account.md` says how.

## Key

The SMTP password is the key. Apps keep it in `SMTP_PASSWORD`, `SMTP_PASS`, `MAIL_PASSWORD`, or `EMAIL_HOST_PASSWORD` (Django), or in their own name: take the name the client reads. It sits next to a host and a user variable, such as `SMTP_HOST` and `SMTP_USER`, `MAIL_HOST` and `MAIL_USERNAME`, or `EMAIL_HOST` and `EMAIL_HOST_USER`. A connection URL, such as `SMTP_URL=smtps://user:pass@smtp.example.com` or Symfony's `MAILER_DSN`, holds all three in one variable.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `nodemailer` | `transporter.sendMail(message)` |
| Python | `smtplib` and `email` (standard library), `aiosmtplib` | `smtp.send_message(msg)`, `smtp.sendmail(from_addr, to_addrs, msg)`, `aiosmtplib.send(msg, ...)` |
| Ruby | `mail`, `net-smtp` | `mail.deliver`, `Mail.deliver { ... }`, `smtp.send_message(msgstr, from, to)` |
| PHP | `phpmailer/phpmailer`, `symfony/mailer` used on its own | `$mail->send()`, `$mailer->send($email)` |
| Go | `net/smtp` (standard library), `gopkg.in/mail.v2` (gomail), `github.com/wneessen/go-mail` | `smtp.SendMail(...)`, `d.DialAndSend(m)`, `c.DialAndSend(m)` |
| .NET | `MailKit` with `MimeKit`, `System.Net.Mail` | `await client.SendAsync(message)`, `client.Send(message)`, `client.SendMailAsync(message)` |
| Elixir | `gen_smtp` | `:gen_smtp_client.send_blocking({from, [to], body}, options)` |
| Rust | `lettre` | `mailer.send(&email)` |

## Clients and sends

**Node.js: `nodemailer`.** `nodemailer.createTransport(options, defaults)` makes the transporter. SMTP options are `host`, `port`, `secure`, and `auth: { user, pass }`, or a `service` name, such as `service: 'gmail'`, that sets the host and port, or a URL string, such as `'smtps://user:pass@smtp.example.com'`. `pool: true` keeps connections open. The second argument, `defaults`, sets message fields for every send of that transporter, such as `from` or `headers`.

```js
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
})

const info = await transporter.sendMail({
  from: '"Example" <hello@mail.example.com>',
  to: 'jane@example.com',
  subject: 'Welcome',
  text: 'Welcome',
  html: '<p>Welcome</p>',
})
```

- `sendMail(message)` answers a promise. It rejects when the server refuses the connection, the login, the sender, or every recipient. The error has `code`, such as `EAUTH`, `ECONNECTION`, `ETIMEDOUT`, `EENVELOPE`, or `EMESSAGE`, and `responseCode` (the SMTP code, such as `550`), `response`, `command`, and `rejected`.
- It resolves when the server takes the message for at least one recipient. `info` has `messageId`, `envelope`, `accepted`, `rejected` (the recipients the server refused), and `response`.
- `sendMail(message, (err, info) => { ... })` is the callback form, with the same `err` and `info`.
- `transporter.use('compile', plugin)` adds a plugin that changes each message before it is built, such as `nodemailer-express-handlebars`. `mapping.md` says under "Templates" how those sites move.

**Python: `smtplib`.** The standard library builds the message with `email.message.EmailMessage`, or with `email.mime` classes such as `MIMEMultipart`, `MIMEText`, and `MIMEApplication`, and sends it with `smtplib.SMTP` or `smtplib.SMTP_SSL`.

```python
import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "Example <hello@mail.example.com>"
msg["To"] = "jane@example.com"
msg["Subject"] = "Welcome"
msg.set_content("Welcome")
msg.add_alternative("<p>Welcome</p>", subtype="html")

with smtplib.SMTP(os.environ["SMTP_HOST"], 587) as smtp:
    smtp.starttls()
    smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
    smtp.send_message(msg)
```

- `send_message(msg)` and `sendmail(from_addr, to_addrs, msg)` raise a subclass of `smtplib.SMTPException` on an error: `SMTPRecipientsRefused` when every recipient was refused, `SMTPSenderRefused`, `SMTPDataError`, `SMTPAuthenticationError` from `login`, or `SMTPServerDisconnected`. `SMTPException` is a subclass of `OSError`. A response error has `smtp_code` and `smtp_error`.
- They answer a dict of the recipients the server refused, empty when it took every one.
- `msg.add_attachment(data, maintype=..., subtype=..., filename=...)`, or a `MIMEApplication` part with a `Content-Disposition` header, adds an attachment.
- `sendmail(from_addr, to_addrs, msg)` takes the envelope apart from the message: `to_addrs` can hold recipients that no header names, which is how such code sends a bcc.
- `aiosmtplib.send(msg, hostname=..., port=..., username=..., password=...)` is the async client, with the same message classes. Its errors are its own: `aiosmtplib.SMTPException` is not an `OSError`, and covers every failure of the send. Its connection and timeout errors, such as `SMTPConnectError`, `SMTPServerDisconnected`, and `SMTPTimeoutError`, are also `OSError`s, and its refusals, such as `SMTPRecipientRefused`, `SMTPSenderRefused`, and `SMTPDataError`, are not.
- The refusal classes of both clients carry any reply code: a temporary `4xx` refusal raises `SMTPDataError` or `SMTPSenderRefused` too.
- smtplib sets no Message-ID. The code sets one with `email.utils.make_msgid()` when it needs it.

**Ruby: `mail` and `net-smtp`.** The `mail` gem builds and sends the message. `delivery_method :smtp, address:, port:, user_name:, password:, authentication:, enable_starttls_auto:` sets the server, in `Mail.defaults` or on one message.

```ruby
Mail.defaults do
  delivery_method :smtp, address: ENV['SMTP_HOST'], port: 587,
    user_name: ENV['SMTP_USER'], password: ENV['SMTP_PASSWORD'], authentication: 'plain'
end

Mail.deliver do
  from    'Example <hello@mail.example.com>'
  to      'jane@example.com'
  subject 'Welcome'
  text_part { body 'Welcome' }
  html_part do
    content_type 'text/html; charset=UTF-8'
    body '<p>Welcome</p>'
  end
end
```

- `deliver` raises the `Net::SMTP` error on a failure, such as `Net::SMTPAuthenticationError`, `Net::SMTPServerBusy`, `Net::SMTPSyntaxError`, `Net::SMTPFatalError`, or `Net::SMTPUnknownError`, unless the message or its `delivery_method` sets `raise_delivery_errors` to `false`: then it raises no error at all.
- `Mail.register_interceptor(obj)` runs `obj.delivering_email(message)` on every message before `deliver` sends it, and can change it, such as the recipients of staging mail. `Mail.register_observer(obj)` runs `obj.delivered_email(message)` after each send.
- `add_file filename:, content:`, `add_file '/path'`, and `attachments['name.pdf'] = data` add attachments.
- `message_id` is the Message-ID, which the gem sets when the code doesn't.
- `Net::SMTP.start(host, port, user:, secret:, authtype:) { |smtp| smtp.send_message(msgstr, from, to) }` sends a message string the code wrote itself.

**PHP: PHPMailer and Symfony Mailer.** PHPMailer:

```php
$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host = getenv('SMTP_HOST');
$mail->SMTPAuth = true;
$mail->Username = getenv('SMTP_USER');
$mail->Password = getenv('SMTP_PASSWORD');
$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
$mail->Port = 587;
$mail->setFrom('hello@mail.example.com', 'Example');
$mail->addAddress('jane@example.com');
$mail->isHTML(true);
$mail->Subject = 'Welcome';
$mail->Body = '<p>Welcome</p>';
$mail->AltBody = 'Welcome';
$mail->send();
```

- `new PHPMailer(true)` throws `PHPMailer\PHPMailer\Exception` on an error. `new PHPMailer()` without `true` throws nothing: `send()` answers `false`, and `$mail->ErrorInfo` holds the error.
- `Body` is HTML after `isHTML(true)`, and text otherwise. `AltBody` is the text part.
- `addCC`, `addBCC`, `addReplyTo`, `addAttachment($path, $name)`, `addStringAttachment($content, $filename)`, `addEmbeddedImage`, `addStringEmbeddedImage`, `addCustomHeader`, `Priority`, `Ical`, and `Sender` set the rest. `getLastMessageID()` is the Message-ID.

`symfony/mailer` used on its own, without the Symfony framework: `new Mailer(Transport::fromDsn(getenv('MAILER_DSN')))`, and `$mailer->send($email)` with a `Symfony\Component\Mime\Email` built with `from`, `to`, `cc`, `bcc`, `replyTo`, `priority`, `subject`, `text`, `html`, `attach`, `attachFromPath`, and `addPart`. `send` answers nothing and throws a `TransportExceptionInterface` on an error. A `MailerInterface` that the framework injects is a framework mailer: see "Frameworks".

**Go.** `net/smtp` sends bytes the code writes itself. It answers an `error`.

```go
auth := smtp.PlainAuth("", os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASSWORD"), host)
err := smtp.SendMail(host+":587", auth, from, []string{to}, msg)
```

`gopkg.in/mail.v2` (gomail, package `mail`) builds the message:

```go
m := mail.NewMessage()
m.SetHeader("From", "hello@mail.example.com")
m.SetHeader("To", "jane@example.com")
m.SetHeader("Subject", "Welcome")
m.SetBody("text/plain", "Welcome")
m.AddAlternative("text/html", "<p>Welcome</p>")
err := mail.NewDialer(host, 587, user, password).DialAndSend(m)
```

`SetAddressHeader("Cc", address, name)`, `Attach(path)`, and `Embed(path)` set the rest. The older import `gopkg.in/gomail.v2` has the same API in package `gomail`.

`github.com/wneessen/go-mail` builds it with `m := mail.NewMsg()`, `m.From(...)`, `m.To(...)`, `m.Cc(...)`, `m.Bcc(...)`, `m.ReplyTo(...)`, `m.Subject(...)`, `m.SetBodyString(mail.TypeTextPlain, ...)`, `m.AddAlternativeString(mail.TypeTextHTML, ...)`, `m.AttachFile(path)`, and `m.AttachReader(name, reader)`, and sends with `c, err := mail.NewClient(host, mail.WithPort(587), mail.WithSMTPAuth(mail.SMTPAuthPlain), mail.WithUsername(user), mail.WithPassword(password))` and `c.DialAndSend(m)`.

Every Go client answers an `error` and never panics on an SMTP refusal.

**.NET: MailKit and System.Net.Mail.** MailKit sends a MimeKit `MimeMessage`:

```csharp
var message = new MimeMessage();
message.From.Add(new MailboxAddress("Example", "hello@mail.example.com"));
message.To.Add(MailboxAddress.Parse("jane@example.com"));
message.Subject = "Welcome";
message.Body = new BodyBuilder { TextBody = "Welcome", HtmlBody = "<p>Welcome</p>" }.ToMessageBody();

using var client = new SmtpClient();
await client.ConnectAsync(host, 587, SecureSocketOptions.StartTls);
await client.AuthenticateAsync(user, password);
await client.SendAsync(message);
await client.DisconnectAsync(true);
```

- It throws on an error: `SmtpCommandException` (with `StatusCode`, `ErrorCode`, and `Mailbox`), `SmtpProtocolException`, or `AuthenticationException`.
- `message.Cc`, `Bcc`, `ReplyTo`, `builder.Attachments.Add(...)`, `builder.LinkedResources`, and `message.Headers` set the rest. `message.MessageId` is the Message-ID.

`System.Net.Mail.SmtpClient` sends a `MailMessage` with `From`, `To`, `CC`, `Bcc`, `ReplyToList`, `Subject`, `Body`, `IsBodyHtml`, `AlternateViews`, `Attachments`, `Headers`, and `Priority`. `Send` and `SendMailAsync` throw `SmtpException` (with `StatusCode`), `SmtpFailedRecipientException`, or `SmtpFailedRecipientsException`.

**Elixir: `gen_smtp`.** `:gen_smtp_client.send_blocking({from, [to], body}, relay: host, port: 587, username: user, password: password, tls: :always)` sends a message body. The body is a string the code wrote, or the output of `:mimemail.encode({type, subtype, headers, params, parts})`. It answers the server's receipt as a binary on success, and an `{:error, ...}` tuple on a failure. `:gen_smtp_client.send/2` and `send/3` send in a spawned process and answer `{:ok, pid}` at once, and `send/3` calls a callback with the result.

**Rust: `lettre`.**

```rust
let email = Message::builder()
    .from("Example <hello@mail.example.com>".parse()?)
    .to("jane@example.com".parse()?)
    .subject("Welcome")
    .multipart(MultiPart::alternative_plain_html(String::from("Welcome"), String::from("<p>Welcome</p>")))?;

let mailer = SmtpTransport::relay(&host)?
    .credentials(Credentials::new(user, password))
    .build();
mailer.send(&email)?;
```

- `send` answers a `Result`: the error is a value, not a panic. `AsyncSmtpTransport::<Tokio1Executor>` sends with `.send(email).await`.
- `.cc()`, `.bcc()`, `.reply_to()`, `.header()`, and `Attachment::new(filename).body(content, content_type)` set the rest.

## SMTP host

Look for the host in transport options, `host` and `service` settings, connection URLs, `SMTP_HOST`, `MAIL_HOST`, `EMAIL_HOST`, `MAIL_SERVER`, and `MAILER_DSN` in example env files and config, and in framework mail config. The host names the provider behind it. A host under the same domain, such as a regional one, is the same provider.

| Host | Provider behind it |
|---|---|
| `smtp.gmail.com`, `smtp-relay.gmail.com`, Nodemailer `service: 'gmail'` | Gmail or Google Workspace |
| `smtp.office365.com`, `smtp-mail.outlook.com` | Microsoft 365, or Outlook.com |
| `email-smtp.<region>.amazonaws.com` | Amazon SES |
| `smtp.sendgrid.net` | SendGrid |
| `smtp.mailgun.org` | Mailgun |
| `smtp.postmarkapp.com` | Postmark |
| `smtp.resend.com` | Resend |
| `smtp.loops.so` | Loops. Its SMTP body is the JSON of a Loops template send, not the email: such a site stays here, and the reason is `Loops SMTP send: run wizard migrate loops, or wizard skill migrate-email-loops on a wizard whose migrate takes no provider` |
| `smtp-relay.brevo.com` | Brevo |
| `in-v3.mailjet.com`, `in.mailjet.com` | Mailjet |
| `smtp.sparkpostmail.com` | SparkPost |
| `smtp.mandrillapp.com` | Mandrill (Mailchimp Transactional) |
| `smtp.zoho.com` | Zoho Mail |
| Another host on the person's own domain, such as `mail.example.com` | A server the person or their host runs |

- A Nodemailer `service` name, such as `'SendGrid'`, `'Mailgun'`, or `'SES-EU-WEST-1'`, stands for that provider's host.
- **Region.** The host, or the Nodemailer `service` name, sets the provider's region in code. Amazon SES has one host per region, `email-smtp.<region>.amazonaws.com`. Nodemailer's `service: 'SES-EU-WEST-1'` is `email-smtp.eu-west-1.amazonaws.com`, the other `SES-<REGION>` names follow the same pattern, and `service: 'SES'` is `us-east-1`. Name the region in the plan next to the host, such as `SMTP host: email-smtp.eu-west-1.amazonaws.com (Amazon SES, eu-west-1)`. When another provider's host has a region in its name, name that region too.
- A host such as `localhost`, `127.0.0.1`, `mailhog`, or `mailpit` in an example env file is a local catcher for development. The deployed host comes from the deployed environment: ask the person which provider it is.
- When the host comes from a variable with no value in the repository, ask the person which provider runs it.

## Frameworks

Framework mailers that send through SMTP: Django's `send_mail`, `EmailMessage`, and `EmailMultiAlternatives` with `EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'` (the default) and `EMAIL_HOST`; `Flask-Mail` and `Flask-Mailman` with `MAIL_SERVER`; Rails Action Mailer with `delivery_method = :smtp` and `smtp_settings`; Laravel `Mail` with `MAIL_MAILER=smtp` and `MAIL_HOST`; Symfony Mailer through the framework, with `MAILER_DSN=smtp://...` and an injected `MailerInterface`; Phoenix and Elixir apps with Swoosh's `Swoosh.Adapters.SMTP` or Bamboo's SMTP adapter; and NestJS's `@nestjs-modules/mailer`, which wraps Nodemailer behind `MailerService.sendMail`. Each mailable or mailer that sends is a site.

## Send fields

Nodemailer names, with the part of the MIME message that each one sets. Other clients set the same parts with their own names: a `From` header, a `text/html` part, a `Content-Disposition: attachment` part.

| Nodemailer field | In the message | Value |
|---|---|---|
| `from` | `From` header | An address, `'Name <address>'`, or `{ name, address }` |
| `sender` | `Sender` header | An address |
| `to`, `cc`, `bcc` | `To`, `Cc` headers, and the envelope. `Bcc` is in the envelope only | An address, a comma-separated string, `{ name, address }`, or a list of them |
| `replyTo` | `Reply-To` header | Same as `to` |
| `inReplyTo`, `references` | `In-Reply-To`, `References` headers | Message-IDs |
| `subject` | `Subject` header | String |
| `text`, `html` | The `text/plain` and `text/html` parts | A string, a `Buffer`, a stream, or `{ path }` or `{ href }` to read it from |
| `watchHtml`, `amp` | An Apple Watch HTML part, an AMP for Email part | Same as `html` |
| `alternatives` | More parts of the alternative | A list of `{ content, contentType }` |
| `icalEvent` | A calendar part and an `.ics` attachment | `{ method, content }`, `{ path }`, or `{ href }` |
| `attachments` | `Content-Disposition: attachment` parts, or inline parts with `Content-ID` | A list of `{ filename, content, path, href, encoding, contentType, contentDisposition, cid, headers, raw }` |
| `headers` | Any header | Object of header names and values |
| `list` | `List-*` headers, such as `List-Unsubscribe` | Object keyed by `help`, `unsubscribe`, `subscribe`, `post`, `owner`, `archive`, `id` |
| `priority` | `X-Priority`, `Importance` headers | `'high'`, `'normal'`, or `'low'` |
| `messageId`, `date`, `xMailer`, `otp` | `Message-ID`, `Date`, `X-Mailer`, `OTP-Token` headers | Strings |
| `envelope` | The SMTP `MAIL FROM` and `RCPT TO`, in place of the ones from the headers | `{ from, to, cc, bcc }` |
| `raw` | The whole message, as the code built it | A string, `Buffer`, or stream |
| `dsn` | Delivery status notification options | `{ id, return, notify, recipient }` |
| `dkim` | DKIM signature of this message | Keys and selector |
| `attachDataUrls` | Turns `data:` images in `html` into inline attachments | Boolean |
| `encoding`, `textEncoding`, `disableFileAccess`, `disableUrlAccess` | How Nodemailer writes the message, and which sources it may read | Strings, booleans |
| `template`, `context`, `text_template` | Read by the `nodemailer-express-handlebars` plugin, not by Nodemailer | View names and values |

## Templates

SMTP has no stored templates. The app renders its HTML before the send, with Handlebars, EJS, Pug, MJML, React Email, Jinja, ERB, Blade, Twig, or string formatting, so the content is in the code. Two Node.js packages render inside the send:

- `nodemailer-express-handlebars`: `transporter.use('compile', hbs({ viewEngine, viewPath, extName }))`, then `sendMail({ template: 'welcome', context: { ... } })`. The plugin renders `<viewPath>/<template><extName>` (`.handlebars` by default) with `context` into `html`, unless the message already has `html`, and `text_template` into `text`. `viewEngine` is an `express-handlebars` instance, or the options to create one.
- `email-templates`: `new Email({ message, transport, send, preview, views })`, then `email.send({ template, message, locals })`. It renders `subject`, `html`, and `text` from the template's folder, such as `emails/welcome/html.pug`, with `email.renderAll(template, locals, message)`, merges `message` over the config's `message`, and sends through `transport`. `send` defaults to `false` in the `development` and `test` environments, where it builds the message without sending it, and `preview` opens the message in a browser in `development`.

Some providers render a template they store when an SMTP header names it, such as SendGrid's `X-SMTPAPI` header. Such a template is behind a header, and `mapping.md` covers headers.

## Status reads

SMTP has no status read. The server's answer to the send is all the client gets. The provider behind the host may have an API that reads a message's state: code that calls it calls that provider's API, which the "Other APIs" section covers.

## Webhooks

SMTP has no webhooks. The provider behind the host may post delivery events to an endpoint of the app, such as SendGrid's Event Webhook, Mailgun's webhooks, Amazon SES notifications through SNS, or Postmark's webhooks. Look for a route that receives that provider's events: its name, such as `/webhooks/mailgun`, its signature check, and the fields it reads, such as an event type, a recipient address, a message id, or the Message-ID header. List each such route as a webhook handler.

## Other APIs

Calls to the API of the provider behind the host, such as its contacts, lists, suppressions, stats, or a message's status, are not SMTP sends. They stay with that provider. A send through that provider's HTTP API or its own SDK is not an SMTP send either: this skill doesn't move it. List it among the other calls, and say which provider's API it uses.

## Not SMTP

These send or handle mail but not through an SMTP client:

- Nodemailer's other transports: `SES: { ... }` sends through the Amazon SES API, `sendmail: true` hands the message to the local `sendmail` binary, `streamTransport: true` and `jsonTransport: true` only build the message, often in tests.
- Third-party Nodemailer transports passed to `createTransport`, such as `nodemailer-sendgrid` and `nodemailer-mailgun-transport`, send through the provider's HTTP API.
- `smtp-server` and `aiosmtpd` run an SMTP server that receives mail, and `mailparser` reads mail. Neither sends.

A transporter of one of these kinds is not an SMTP site. List its sends among the other calls, with the transport it uses.
