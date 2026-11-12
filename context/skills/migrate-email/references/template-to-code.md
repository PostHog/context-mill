---
title: Bring a stored template into the code
description: How a send of a template stored at the provider moves to PostHog with its content in the app's code
---

# Bring a stored template into the code

A `template` site sends an email whose content is stored at the provider: the code passes only the template's ID and its variables. Such a site moves by bringing the email into the code. Its content becomes a file next to the send, the code renders the variables itself, and the site sends the rendered email in the code form: a template key, a subject, and HTML, text, or both, with the `from` and reply-to address the provider template set. The email then lives in the repository like the rest of the code, and the person changes it there.

Step 3 reads the "Check" part of this file, and Step 7 reads the rest. The provider's `mapping.md` says under "Templates" what each part of its template language means and how it is written in code, and what keeps a template on the provider.

A template made in PostHog, sent by its template ID, is the other way to move such a site. It is never the default: it is used only for a template the person asks to keep editable in PostHog, as Step 3 says.

## Check

The check needs the content of the version the site sends, because the code has only its ID. The provider's `account.md` says under "Template content" whether its API returns the content, and what the person copies from the dashboard when it doesn't or when they choose the dashboard.

A template moves into the code when every part of it is in the provider's "Templates" table: each variable, fallback, condition, loop, helper, and tag, and each setting such as its subject, sender, and reply-to address. A part the table doesn't place keeps the site on the provider, and the reason names that part. A template moves however it was designed: the design, the layout, and the images come into the code as they are.

These parts keep a template on the provider, unless the provider's table says how the code fills them:

- a tag the provider fills from its own account at send time, such as its unsubscribe link, a view-in-browser link, or a block shared between templates that the content doesn't include;
- a setting the code form has no field for, such as `cc`, `bcc`, an attachment, or a custom header in the template;
- a helper whose result the provider computes in a way the table doesn't describe, such as a date format in a locale the table doesn't name.

Write each API answer and each copy you make to a file in the system's temporary folder, never in the repository or the plan. Keep it until Step 7 has written the email, then delete it. When it is gone by then, ask the person for a copy from the dashboard: the full-access key that an API read needs is deleted at the end of Step 5. Read the person's own copies where they saved them.

## Where the email goes

Write each email next to the module that sends it, in an `emails` folder, or in the folder where the app already keeps its email content. Name the files after the template key that Step 7 gives the send, such as `emails/welcome.html` and `emails/welcome.txt`. Two sites that send the same provider template share one email.

Keep the content where the build ships it. A file that the code reads at run time by its path ships only when the build copies it: a bundler, a compiled binary, or a package that lists its data files can leave it out. So write the content as code, or embed it at build time, as the table below says, unless the app already ships template files the same way, such as a `templates` folder its template engine reads.

## How the code renders it

Pick the first that fits the part of the app that sends:

1. **React Email.** When the app's manifest for that part already has a React Email package, such as `@react-email/components` or `react-email`, write the email as a component: rebuild it with React Email's components (`Html`, `Head`, `Preview`, `Body`, `Container`, `Section`, `Row`, `Column`, `Text`, `Link`, `Button`, `Img`, `Hr`) with inline styles, keeping the provider's text, links, images, colors, and layout. Each variable becomes a prop. Render it with `render` from `@react-email/render` and send the result as `html`.
2. **The app's template engine.** When the app already renders HTML on the server with a template engine in that language, such as Jinja2 or Django templates, ERB or ActionView, Blade or Twig, EEx or HEEx, Handlebars, Nunjucks, or EJS, write the email as a template of that engine, with its auto-escaping on, and render it the way the app renders its other templates.
3. **The language's own way.** Otherwise:

| Language | The email | Escape a value with |
|---|---|---|
| `node` | A module, `emails/<key>.ts` or `.js`, that exports one function per email, which takes the variables and returns `{ subject, html, text }` built with template literals. In TypeScript, give the variables a type | an `escapeHtml` function in the same folder that replaces `&`, `<`, `>`, `"`, and `'`, or the app's own one, such as from `escape-html` or `lodash` |
| `python` | A module, `emails/<key>.py`, with the HTML and the text as string constants with `{{name}}` markers, and a function that replaces each marker | `html.escape(value, quote=True)` |
| `go` | `emails/<key>.html` and `emails/<key>.txt`, embedded with `//go:embed`, rendered with `html/template` and `text/template` | `html/template`, which escapes each value for where it stands |
| `ruby` | `emails/<key>.html.erb` and `emails/<key>.text.erb`, rendered with `ERB` from the standard library | `ERB::Util.html_escape`, as `<%= h(value) %>` |
| `php` | `emails/<key>.html.php` and `emails/<key>.txt.php`, plain PHP templates rendered with `ob_start()`, `include`, and `ob_get_clean()` | `htmlspecialchars($value, ENT_QUOTES \| ENT_HTML5, 'UTF-8')` |
| `dotnet` | A static class, `Emails/<Key>Email.cs`, with the HTML and the text as raw string literals with `{{name}}` markers, and a method that replaces each marker | `System.Net.WebUtility.HtmlEncode` |
| `rust` | `emails/<key>.html` and `emails/<key>.txt`, read with `include_str!`, and a function that replaces each `{{name}}` marker | a small `escape_html` function next to it that replaces `&`, `<`, `>`, `"`, and `'` |
| `elixir` | `emails/<key>.html.eex` and `emails/<key>.text.eex`, compiled with `EEx.function_from_file` | `Phoenix.HTML.html_escape/1` with `Phoenix.HTML.safe_to_string/1` when the app has `phoenix_html`, or `Plug.HTML.html_escape/1` when it has `plug`, otherwise a small `escape_html` function next to it that replaces `&`, `<`, `>`, `"`, and `'` |

Write the `\|` above as a plain `|`. The table escapes it.

- The provider's HTML and text go into the template as literal content. Before writing them, escape each sequence the destination reads as its own code, so text from the provider's editor never runs in the app: `<%` as `<%%` in ERB and EEx, `<?` as `<?= '<?' ?>` in a PHP template, `{{` as `{{"{{"}}` in Go's templates, and the delimiters of the app's engine, such as `{{` and `{%` in Jinja2, Twig, Handlebars, and Nunjucks, as that engine documents. Where the content sits in a string literal of the code, as in Node.js, Python, and .NET, write it so nothing in it ends the literal or runs: in a JavaScript template literal, escape each `\`, `` ` ``, and `${`; in Python, use a triple-quoted string only when the content holds no `"""` and no `\`, and otherwise write the string as `repr()` writes it; in C#, use a raw string literal whose quotes outnumber the longest run of `"` in the content, without `$`.
- `html/template` encodes a value that stands in a URL's query again, so `%2F` becomes `%252F`. In Go, pass a value the app already encoded as `template.URL`, which it keeps as it is.
- `html/template` drops HTML comments, and with them Outlook's conditional comments, `<!--[if mso]>…<![endif]-->`, and what they hold. In Go, keep each one as a `template.HTML` constant next to the renderer, pass it in the data, and write it where it stood, such as `{{.OutlookButton}}`. A block that holds a variable becomes a function that takes the value, escapes it with `template.HTMLEscapeString`, and returns the block as `template.HTML`.
- A function that replaces markers first checks that each marker in the template has a value, and raises when one has none, so a misspelled name fails the send instead of mailing the marker. It then replaces every marker in one pass, so a value that itself contains `{{name}}` goes out as written.
- A loop becomes a loop in the code that builds one piece per item and joins them, and a condition becomes a branch, as the provider's "Templates" table says. A piece that repeats is its own small template or function, rendered with the same escaping.
- Add no template engine or other dependency. React Email and the app's engine are already in the app, and the table above needs only the language's standard library.

## Escaping

The rule is the provider's, value by value. Where the provider escaped a value, the code escapes it, and where the provider inserted it as it is, so the email renders the markup, the code inserts it as it is. The provider's "Templates" table says which of its forms does which.

- **HTML.** Escape every value in the HTML part with the escape the table above names, or with the engine's auto-escaping. A value goes in unescaped only where the provider's template inserted it as it is, and only when the code builds that value as HTML itself from text it escapes or controls, such as a list it joins with `<br>` or a link it builds. Mark that value as HTML in the way the renderer expects, such as `Markup` in Jinja2, `raw` in ERB, `{!! !!}` in Blade, `template.HTML` in Go, or `dangerouslySetInnerHTML` in React Email, and name it in the plan row.
- **Text that the code doesn't control.** When the provider inserted a value as it is, but the value carries text from a user, a form, or another service, escape it anyway. The old email rendered any markup in that text. The new one shows it as typed. Note it in the plan row.
- **Text and subject.** Never escape a value in the text part or in the subject: they are not HTML.
- **Attributes and URLs.** A value inside an attribute, such as a link's `href` or an image's `src`, is escaped as HTML too. When the attribute's value has no quotes in the provider's template, such as `href={{{URL}}}`, put it in double quotes in the code: an escaped value can still hold a space, `=`, or a backtick, which ends or changes an unquoted attribute. Never URL-encode a value that the provider didn't encode.

## Variables, fallbacks, conditions, and loops

- Each provider variable becomes a value the code passes to the render: a parameter of the function, a prop, or a key of the engine's context. Keep the names the code passed to the provider.
- A fallback becomes the same default in the code, applied exactly when the provider applied it. Providers differ on an empty string: the table says whether the fallback replaces `""` or only a missing value.
- A condition tests what the provider tested, written out in the code. Never lean on the language's own truth test: `0`, `""`, `[]`, `"false"`, and `null` are true or false differently in each language and template language.
- A loop walks the same list, in the same order, with the same item names.
- A helper, such as a date format or a comparison, becomes code that gives the same result, as the table says.

## Settings of the template

- The template's subject becomes the send's `subject`, rendered with the same variables.
- The template's sender becomes the send's `from`, such as `'Name <hello@example.com>'`. It needs a verified sender, so Step 3 writes it in the site's `from` column. A sender that holds a variable is rendered too, and Step 3 classifies each address it can take, as it does for any `from`.
- The template's reply-to address becomes the send's reply-to address.
- Preview text, such as a preheader, goes into the HTML as a hidden block at the start of the body: `<div style="display:none;max-height:0;overflow:hidden">…</div>`, or `Preview` in React Email.
- When the provider template had a text part, the send has `text` too. When it had none, send `html` only: never write a text part the provider didn't send.

## Images and links

Keep every image and link URL as it is. An image that the provider hosts, on a host the provider's "Templates" part names, keeps working only while the provider account serves it: name each such image in the plan, so the report asks the person to host it themselves before they close the account.

## Write down

Under the sites table, list each email brought into the code: its files, the provider template it came from with its ID or name, its variables, each value inserted unescaped, each value now escaped that the provider inserted as it was, and each image the provider hosts. Never write the email's content into the plan or the report.
