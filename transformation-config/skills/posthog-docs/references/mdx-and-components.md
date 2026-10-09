# MDX and components for PostHog docs

This file covers the MDX features and components available when writing pages under `contents/docs/` on posthog.com. Load this file whenever you're touching an `.mdx` file in the docs.

The website's core technical architecture is built and maintained by the website team. For deeper detail beyond what's here, see the handbook pages on the website and on MDX components.

---

## Frontmatter

Every `.mdx` page supports frontmatter that Gatsby uses to configure page metadata.

```mdx
---
title: Install PostHog for React
platformLogo: react
showStepsToc: true
---

This guide walks you through installing PostHog for React.
```

Available fields:

| Field | Purpose | Example |
|-------|---------|---------|
| `title` | Page title | `React installation` |
| `platformLogo` | Platform icon key for installation pages | `react`, `python`, `nodejs` |
| `showStepsToc` | Show steps in the right-sidebar TOC | `true` |
| `hideRightSidebar` | Hide the right sidebar TOC (used on start-here and changelog pages) | `true` |
| `contentMaxWidthClass` | Customize the width of the main content column | `max-w-5xl` |
| `tableOfContents` | Override the auto-generated TOC with custom entries | `[{ url: 'section-id', value: 'Section Name', depth: 1 }]` |

---

## Snippets for content reuse

Create snippets in a `_snippets/` directory for content you want to reuse across multiple pages.

**When to create a snippet:**

- Content appears in 2+ pages
- Event schemas or property tables
- Platform-specific code blocks
- Reusable UI components

### MDX snippets

Use for static reusable content like tables, callouts, or text blocks.

```mdx file=_snippets/event-properties.mdx
The error event includes the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `$exception_message` | string | The error message |
| `$exception_type` | string | The error type |
```

Use it in a page:

```mdx
import EventProperties from './_snippets/event-properties.mdx'

<EventProperties />
```

### TSX snippets

Use for dynamic content – lightweight components or React hooks.

```tsx
// _snippets/installation-platforms.tsx
import usePlatformList from 'hooks/docs/usePlatformList'

export default function InstallationPlatforms() {
  const platforms = usePlatformList('docs/[product]/installation', 'installation')
  return <PlatformList items={platforms} />
}
```

Use it in a page:

```mdx
import InstallationPlatforms from './_snippets/installation-platforms.tsx'

<InstallationPlatforms />
```

If a TSX snippet contains substantial logic, create a reusable component or hook in `/src/components/` or `/src/hooks/` instead.

---

## Magic placeholders

Magic placeholder strings get auto-replaced with values from the user's project when they view the docs while logged in. If they're not logged in, the placeholder displays as-is.

| Placeholder | Description | Default |
|-------------|-------------|---------|
| `<ph_project_token>` | Your PostHog project token | n/a |
| `<ph_project_name>` | Your PostHog project name | n/a |
| `<ph_app_host>` | Your PostHog instance URL | n/a |
| `<ph_client_api_host>` | Your PostHog client API host | `https://us.i.posthog.com` |
| `<ph_region>` | Your PostHog region (us/eu) | n/a |
| `<ph_posthog_js_defaults>` | Default values for posthog-js | `2026-01-30` |
| `<ph_proxy_path>` | Your proxy path | `relay-XXXX` (last 4 digits of project token) |

Use them in a code block:

```js
const client = new PostHog('<ph_project_token>', { host: '<ph_client_api_host>' })
```

**Use these whenever you write a code example that includes a token or host.** Hard-coded example values like `phc_abc123` are worse for users.

---

## Components

### Screenshots

For UI screenshots with light and dark variants:

```mdx
<ProductScreenshot
  imageLight="https://..."
  imageDark="https://..."
  alt="Descriptive alt text"
  classes="rounded"
/>
```

### Videos

For `.mp4` or `.mov` files:

```mdx
<ProductVideo
  videoLight="https://..."
  videoDark="https://..."
  alt="Descriptive alt text"
  classes="rounded"
  autoPlay={false}
  muted={true}
  loop={true}
  background={false}
/>
```

### Multi-language code blocks

For code examples in multiple languages:

````mdx
<MultiLanguage>

```js
// JavaScript example
```

```python
# Python example
```

</MultiLanguage>
````

### Callout boxes

Use callouts so skimmers don't miss essential information.

```jsx
<CalloutBox icon="IconInfo" title="Here is some information" type="fyi">
    Here is some information
</CalloutBox>
```

Three styles, by use case:

- **`fyi`** – helpful but not critical info.
- **`action`** – tasks developers should complete and not miss.
- **`caution`** – flags potential misconfiguration, data loss, or other churn vectors.

Valid icons come from PostHog's icon library (e.g., `IconInfo`, `IconWarning`).

**Don't overuse callouts.** If the page has more than 2-3, the signal disappears.

### Steps

Use `<Steps>` for content that walks the reader through a strict sequence (how-to guides, step-by-step tutorials).

```mdx
<Steps>

<Step title="Install the SDK" badge="required">

Steps are automatically numbered.

</Step>

<Step title="Call the capture method" badge="required">

Write the _content_ in **markdown**.

</Step>

<Step checkpoint title="Check for events in PostHog" subtitle="Log in to your PostHog account" badge="optional">

Add checkpoints to help readers verify their progress.

</Step>

</Steps>
```

> **Watch the whitespace.** PostHog's MDX parser does not play nice with certain whitespace. When using `<Steps>`:
>
> - Add a line break after the opening component tags.
> - Avoid using 4-space indents.

### Decision tree

For helping users choose between 2–6 options:

```jsx
<DecisionTree
    questions={[
        {
            id: 'platform',
            question: 'What platform are you using?',
            options: [
                { value: 'web', label: 'Web' },
                { value: 'mobile', label: 'Mobile' },
            ],
        },
    ]}
    getRecommendation={(answers) => {
        // return recommendation based on answers
    }}
/>
```

### PostHog AI components

PostHog AI (formerly known as Max AI) has two components for embedding AI help in docs.

**`<AskMax>`** opens the PostHog AI chat directly on the website. Use it on docs pages where users may need help understanding concepts or troubleshooting. Unlike `<MaxCTA>` (which links to the PostHog app), `<AskMax>` keeps users in the docs context.

```jsx
<AskMax
    quickQuestions={[
        'How do I mask sensitive data?',
        'Can I enable recordings only for certain users?',
        'How can I control costs?',
    ]}
/>
```

**`<AskAIInput>`** is for troubleshooting sections:

```mdx
## Have a question? Ask PostHog AI

<AskAIInput placeholder="Ask about error tracking..." />
```

---

## Platform logos

All platform logos are centralized in `src/constants/logos.ts`. To add a new platform:

1. Upload the SVG to Cloudinary.
2. Add a key to `src/constants/logos.ts` in `camelCase`.
3. Reference it in MDX frontmatter: `platformLogo: myPlatform`.

Use consistent naming: `stripe`, `react`, `nodejs`, etc.

---

## Debugging MDX issues

Common causes of MDX parsing failures:

- Deep indentation – stay at 2 spaces or less.
- Missing line breaks after opening JSX tags or before closing tags.
- Components that aren't imported correctly.
- "Empty" lines that contain spaces (must be completely empty).
- Snippets that share file names.

To auto-fix common issues:

```bash
pnpm format:docs
```

Run this before committing.
