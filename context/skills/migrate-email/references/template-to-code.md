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

In a marketing email, the provider's unsubscribe link becomes `{{ unsubscribe_url }}`, which PostHog fills with the recipient's preferences link, so it keeps no template on the provider. Step 3 says which emails are marketing.

Write each API answer and each copy you make to a file in the system's temporary folder, never in the repository or the plan. Keep it until Step 7 has written the email, then delete it. When it is gone by then, read it again the same way. Read the person's own copies where they saved them.

## Where the email goes

Write each email next to the module that sends it, in an `emails` folder, or in the folder where the app already keeps its email content. Name the files after the template key that Step 7 gives the send, such as `emails/welcome.html` and `emails/welcome.txt`, or `emails/WelcomeMail.tsx` for a React Email component. Two sites that send the same provider template share one email.

Keep the content where the build ships it. A file that the code reads at run time by its path ships only when the build copies it: a bundler, a compiled binary, or a package that lists its data files can leave it out. So write the content as code, or embed it at build time, as the table below says, unless the app already ships template files the same way, such as a `templates` folder its template engine reads.

## How the code renders it

Pick the first that fits the part of the app that sends:

1. **React Email**, for JavaScript or TypeScript. It is the default there, also when the app has no React Email package yet: write the email as a component, as "React Email" below says. A component reads like the email it renders, gives the HTML and the text part from one source, and shows in a preview before anyone is sent it.
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
| `elixir` | `emails/<key>.html.eex` and `emails/<key>.text.eex`, compiled with `EEx.function_from_file` | `Phoenix.HTML.html_escape/1` with `Phoenix.HTML.safe_to_string/1` when the app has `phoenix_html`, or `Plug.HTML.html_escape/1` when it has `plug` |

Write the `\|` above as a plain `|`. The table escapes it.

- A function that replaces markers raises when a marker is left after the replace, so a misspelled name fails the send instead of mailing the marker.
- A function that replaces markers leaves `{{ unsubscribe_url }}` as it is, and so does every renderer. In an engine that reads `{{ }}` itself, such as Jinja2, Handlebars, or Go's templates, write it as a literal the engine prints unchanged, and check that the rendered HTML and text hold it exactly: an escape for URLs, such as Go's `html/template` in an `href`, changes it.
- A loop becomes a loop in the code that builds one piece per item and joins them, and a condition becomes a branch, as the provider's "Templates" table says. A piece that repeats is its own small template or function, rendered with the same escaping.
- Add no dependency other than the React Email packages that "React Email" names. The app's engine is already in the app, and the table above needs only the language's standard library.

Use the string-built `node` row only when the part that sends can't take React Email: Node.js runs its source as it is, as plain JavaScript or TypeScript with its type stripping, or `tsc` emits it with `"jsx": "preserve"` and nothing compiles the JSX after. A part that a bundler builds, that `tsc` emits with `"jsx": "react-jsx"`, or that Bun, `tsx`, or a framework such as Next.js runs, takes it. Write the reason in the plan row.

## React Email

- **Packages.** Add `react-email` as a dependency, with `react` and `react-dom`, its peers, when the app lacks them. It holds the components and `render` from version 6 on. Never add `@react-email/components`: it is deprecated. An app that already has `@react-email/components` keeps it, and its emails import from it. When the part that sends is TypeScript, its `tsconfig.json` sets `jsx`, such as `"jsx": "react-jsx"`.
- **Preview.** Add the preview only with `react-email` 6 or later: add `@react-email/ui` as a dev dependency, in the same version as `react-email`, and a script that runs `email dev --dir emails`, with the folder's path from the project root, such as `"email:preview": "email dev --dir src/emails"`. The preview lists a `.tsx`, `.jsx`, or `.js` file in that folder only when it has a default export, and skips every folder whose name starts with `_`. So each email's file default-exports its component, and every other file exports by name or sits in a folder such as `emails/_shared/`. An app that keeps an older React Email package gets no preview script, and the plan row says so.
- **Layout.** Put what the emails share, such as the page, the card, the logo, and the footer, in one layout component, such as `MailLayout`, which takes the preview text and the body. Rebuild the provider's design with React Email's components (`Html`, `Head`, `Preview`, `Body`, `Container`, `Section`, `Row`, `Column`, `Text`, `Link`, `Button`, `Img`, `Hr`) with inline styles, keeping the provider's text, links, images, colors, and layout.
- **Each email.** One file, `emails/<Name>Mail.tsx` in TypeScript, or `emails/<Name>Mail.jsx` in JavaScript, default-exports the email's component. Each variable becomes a prop, typed in TypeScript, and so does the recipient's name, as "Variables" says. Set `PreviewProps` on the component with made-up values, so the preview shows the email filled in. Write no real person's name or address there.
- **Render.** The file also exports a function that takes the props and returns `{ subject, html, text }`. One shared helper renders both parts: the HTML with `render(element)` and the text with `toPlainText(html)`, from that HTML, so the two can't drift. A React Email package without `toPlainText`, such as `@react-email/render` before 1.2, renders the text with `render(element, { plainText: true })`. `render` is async. The site sends `html` and `text`. When the provider template had its own text part, compare it with the rendered one, and name in the plan row each line or link that only the provider's text had, so the person decides whether the email needs it.
- **Escaping.** React escapes each value it renders, in text and in attributes, so pass each value as it is. A value the provider inserted as HTML goes in through `dangerouslySetInnerHTML`, under the rule of "Escaping".

### Before and after

A welcome email built from strings, with a text part written by hand beside it:

```ts
export function welcomeEmail({ firstName, dashboardUrl }: { firstName?: string; dashboardUrl: string }) {
  return {
    subject: 'Welcome to Acme',
    html: `<div style="font-family:sans-serif"><p>Hi ${escapeHtml(firstName ?? 'there')},</p>
<p><a href="${escapeHtml(dashboardUrl)}" style="background:#1d4ed8;color:#fff;padding:12px 20px">Open your dashboard</a></p></div>`,
    text: `Hi ${firstName ?? 'there'},\n\nOpen your dashboard: ${dashboardUrl}`,
  }
}
```

The same email in React Email, in `emails/WelcomeMail.tsx`, with `MailLayout` beside it:

```tsx
import { Button, Text } from 'react-email'
import { MailLayout } from './MailLayout'
import { renderMail } from './renderMail'

type WelcomeMailProps = { firstName?: string; dashboardUrl: string }

export const welcomeMail = (props: WelcomeMailProps) => renderMail('Welcome to Acme', <WelcomeMail {...props} />)

export default function WelcomeMail({ firstName, dashboardUrl }: WelcomeMailProps) {
  return (
    <MailLayout preview="Your Acme account is ready.">
      <Text>{`Hi ${firstName ?? 'there'},`}</Text>
      <Button href={dashboardUrl} style={{ backgroundColor: '#1d4ed8', color: '#fff', padding: '12px 20px' }}>
        Open your dashboard
      </Button>
    </MailLayout>
  )
}

WelcomeMail.PreviewProps = { firstName: 'Ada', dashboardUrl: 'https://example.com/dashboard' } satisfies WelcomeMailProps
```

And the helper every email shares, in `emails/renderMail.ts`:

```ts
import type { ReactElement } from 'react'
import { render, toPlainText } from 'react-email'

export async function renderMail(subject: string, element: ReactElement) {
  const html = await render(element)
  return { subject, html, text: toPlainText(html) }
}
```

## Escaping

The rule is the provider's, value by value. Where the provider escaped a value, the code escapes it, and where the provider inserted it as it is, so the email renders the markup, the code inserts it as it is. The provider's "Templates" table says which of its forms does which.

- **HTML.** Escape every value in the HTML part with the escape the table above names, or with React's or the engine's auto-escaping. A value goes in unescaped only where the provider's template inserted it as it is, and only when the code builds that value as HTML itself from text it escapes or controls, such as a list it joins with `<br>` or a link it builds. Mark that value as HTML in the way the renderer expects, such as `Markup` in Jinja2, `raw` in ERB, `{!! !!}` in Blade, `template.HTML` in Go, or `dangerouslySetInnerHTML` in React Email, and name it in the plan row.
- **Text that the code doesn't control.** When the provider inserted a value as it is, but the value carries text from a user, a form, or another service, escape it anyway. The old email rendered any markup in that text. The new one shows it as typed. Note it in the plan row.
- **Text and subject.** Never escape a value in the text part or in the subject: they are not HTML.
- **Attributes and URLs.** A value inside an attribute, such as a link's `href` or an image's `src`, is escaped as HTML too. Never URL-encode a value that the provider didn't encode.

## Variables, fallbacks, conditions, and loops

- Each provider variable becomes a value the code passes to the render: a parameter of the function, a prop, or a key of the engine's context. Keep the names the code passed to the provider.
- A fallback becomes the same default in the code, applied exactly when the provider applied it. Providers differ on an empty string: the table says whether the fallback replaces `""` or only a missing value.
- A condition tests what the provider tested, written out in the code. Never lean on the language's own truth test: `0`, `""`, `[]`, `"false"`, and `null` are true or false differently in each language and template language.
- A loop walks the same list, in the same order, with the same item names.
- A helper, such as a date format or a comparison, becomes code that gives the same result, as the table says.
- Greet the recipient by the name the app knows them by at the site, also when the provider's greeting named no one: the user's first name, or the name the recipient has in the place the email is about, such as their name in a group. Look for it at the site and in the record the site loads for the recipient. Pass it as a variable, and keep the provider's greeting, such as `Hi there`, for a recipient without one. The name is a value the render takes, not a field of the send.

## Settings of the template

- The template's subject becomes the send's `subject`, rendered with the same variables.
- The template's sender becomes the send's `from`, such as `'Name <hello@example.com>'`. It needs a verified sender, so Step 3 writes it in the site's `from` column. A sender that holds a variable is rendered too, and Step 3 classifies each address it can take, as it does for any `from`.
- The template's reply-to address becomes the send's reply-to address.
- Preview text, such as a preheader, goes into the HTML as a hidden block at the start of the body: `<div style="display:none;max-height:0;overflow:hidden">…</div>`, or `Preview` in React Email.
- A React Email component gives the send its `text`, whether or not the provider template had a text part. Otherwise, when the provider template had a text part, the send has `text` too, and when it had none, the send has `html` only.

## Images and links

Keep every image and link URL as it is. An image that the provider hosts, on a host the provider's "Templates" part names, keeps working only while the provider account serves it: name each such image in the plan, so the report asks the person to host it themselves before they close the account.

## Write down

Under the sites table, list each email brought into the code: its files, its preview script, the provider template it came from with its ID or name, its variables, each email's greeting: the name it uses, or why it has none, each line only the provider's text part had, each value inserted unescaped, each value now escaped that the provider inserted as it was, and each image the provider hosts. Never write the email's content into the plan or the report.
