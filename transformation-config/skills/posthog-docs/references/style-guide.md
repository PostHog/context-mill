# PostHog docs style guide

This file is the source of truth for how to write PostHog docs – voice, grammar, formatting, code, links, screenshots, word choice. It applies to every doc page on posthog.com under `/docs/`.

These are guidelines, not rigid rules. Good judgement matters more than strict adherence. If something makes the docs clearer, more helpful, or just plain better, do it.

Two assumptions about every reader:

1. **They're busy and have limited time.**
2. **They're not experts and don't know what we know.**

---

## Voice and tone

### Address the reader directly

Use "you" – never "the user", "developers", or "we".

- **Do**: "You can create an insight by clicking **New insight**."
- **Don't**: "Users can create insights."

Use the imperative form (drop the "you") for instructions:

- **Do**: "Create an insight by clicking **New insight**."

### Use active voice

Make it clear who or what performs the action.

- **Do**: "PostHog captures events automatically."
- **Don't**: "Events are captured automatically by PostHog."

Exception: passive voice is fine when the actor is unknown or unimportant. e.g., "The data is encrypted at rest."

### Use present tense

Avoid future tense unless you're explicitly describing future behavior.

- **Do**: "The insight displays your data."
- **Don't**: "The insight will display your data."

### Be concise

Remove unnecessary words. Every clause should add value or clarity.

- **Do**: "Click **Save**."
- **Don't**: "Now you can go ahead and click the **Save** button to save your changes."

### Avoid unexplained jargon

When you introduce a technical term or acronym, explain it on first use or link to a definition.

- **Do**: "Create a [cohort](/docs/data/cohorts) to analyze behavior. A cohort is a group of users who share common properties."
- **Do**: "Create a [cohort](/docs/data/cohorts) – a group of users who share common properties – to analyze behavior."
- **Don't**: "Enable LTV analysis by configuring your CDP and syncing cohort data to the warehouse."

### Use contractions

Maintain a conversational tone.

- **Do**: "That's it. The experiment is running."
- **Don't**: "That is it. The experiment is running."

---

## Product terminology

### Capitalize PostHog product names

Always capitalize PostHog products as proper nouns.

- **Do**: "Use Session Replay to understand user behavior."
- **Don't**: "Use session replay to understand user behavior."

If you're referring to the general industry term – not PostHog's product specifically – use lowercase: "many companies offer product analytics."

### Keys and tokens

| Term | Description |
|------|-------------|
| **Project token** | The public identifier (starts with `phs_`) used in SDKs and the snippet to send events. **This is NOT an API key.** Never call it `project API key`. |
| **Personal API key** | A private key (starts with `phx_`) used for server-side API access. This IS an API key. |
| **Feature flags secure API key** | A separate key used for local evaluation of feature flags. |

- **Do**: "Add your project token to the PostHog initialization code."
- **Don't**: "Add your project API key to the PostHog initialization code."

### PostHog platform

| Term | When to use |
|------|-------------|
| **PostHog** | Default. Refers to our cloud platform. Most users are on cloud, so don't specify "Cloud" unless contrasting with self-hosted. |
| **PostHog Cloud** | Only when explicitly contrasting cloud features with self-hosted. |
| **Self-hosted PostHog** or **hobby deployments** | Self-hosted installations. |

- **Do**: "Go to **Insights** in the PostHog app and click **New insight**."
- **Do**: "This feature is only available on PostHog Cloud."
- **Don't**: "To create an insight on PostHog Cloud, go to the **Insights** tab." (gratuitous "Cloud")

---

## Grammar and mechanics

### American English

PostHog has a global team and global users. Use American English spelling, grammar, date, and time formatting.

- **Do**: color, analyze, behavior, license
- **Don't**: colour, analyse, behaviour, licence

### Sentence case for headings

Capitalize only the first word and proper nouns.

- **Do**: "## How to create a feature flag"
- **Do**: "## Get started with PostHog Feature Flags"
- **Don't**: "## How To Create A Feature Flag"

### Oxford comma

Always use it.

- **Do**: "PostHog offers analytics, session replay, and feature flags."
- **Don't**: "PostHog offers analytics, session replay and feature flags."

### Numbers

- Spell out numbers zero through nine.
- Use numerals for 10 and above.
- Use numerals for percentages, measurements, and technical values.

Examples: "You can create three dashboards." / "You can create 15 dashboards." / "Set the timeout to 30 seconds."

### Straight apostrophes and quote marks

Many writing tools (Google Docs, Notion, Word) auto-insert curly quotes. Turn that off. We use straight quotes.

### British-style en dashes

Use en dash with a space on either side ( – ), not the longer em dash with no spaces (—).

On Mac: Option + hyphen.

Don't use a hyphen in place of an en dash.

- **Do**: "Don't up vote your own content, and don't ask other people to – post it and pray."
- **Don't**: "Don't up vote your own content, and don't ask other people to—post it and pray."

---

## Word choice

### Acronyms

ALL CAPS for acronyms and initialisms.

- **Do**: SQL, API, HTML, CSS, JSON, REST, HTTP, URL, SDK, CLI, UI, UX
- **Don't**: Sql, Api, Html

Follow the official capitalization for branded technologies: GraphQL, WebSocket, PostgreSQL.

### Choose simple words

| Instead of | Use |
|------------|-----|
| utilize | use |
| facilitate | help |
| commence | start, begin |
| subsequent | next |
| prior to | before |

### Use precise verbs

| Vague | Specific |
|-------|----------|
| use the API | call the API |
| work with data | query data, analyze data |
| handle errors | catch errors, log errors |
| manage users | add users, remove users, assign roles |

### Inclusive language

| Instead of | Use |
|------------|-----|
| blacklist/whitelist | denylist/allowlist |
| sanity check | validation, verification |
| master/slave | primary/secondary |

### Avoid trivializing words

Don't write "simply", "just", "easily", "obviously", "of course", "clearly". They sound dismissive and minimize the reader's effort.

- **Do**: "Add the SDK to your project."
- **Don't**: "Simply add the SDK to your project."

---

## Formatting and structure

### Use descriptive headings

Headings should clearly describe what's in the section. Prefer action-oriented titles over nouns and gerunds.

- **Do**: "## How to create a feature flag"
- **Don't**: "## Feature flag creation"
- **Do**: "## Customize styles and layouts"
- **Don't**: "## Customization"

### Use short paragraphs

Avoid paragraphs longer than 3-4 lines. Break up longer content with line breaks, subheadings, lists, or visual elements.

### Bulleted lists

Use bullets for unordered items of equal importance. Default to prose when 1-2 items would read better as a sentence.

**Do**:

> PostHog offers several products:
>
> - Product Analytics
> - Session Replay
> - Feature Flags
> - Experiments

**Don't** (single-item list):

> Feature flags let you:
>
> - Control feature rollouts

### Numbered lists

Use them when ordering, ranking, or hierarchy matters.

```
1. Click **New insight**
2. Select your event
3. Click **Save**
```

### Definition-style lists

Separate the item from its description with a dash, not a colon.

- **Do**: `- **Product Analytics** - Track user behavior and measure conversions`
- **Don't**: `- **Product Analytics:** Track user behavior and measure conversions`

### Punctuation in lists

Use periods when each item is a complete, standalone sentence (subject + verb + independent thought).

Don't use periods when items are phrases or fragments completing an introductory phrase.

Be consistent within a single list – if one item is a partial sentence, all items should be.

### Tables

Use tables for listing multiple items across multiple attributes. If a bulleted list isn't easy to scan, try a table.

```
| Plan | Events | Team members | Price |
|------|--------|--------------|-------|
| Free | 1M     | Unlimited    | $0    |
| Paid | 2M+    | Unlimited    | $0.00031/event |
```

### Bold text

Use bold for structured information and visual formatting:

- **Callout labels** – `**Note:**`, `**Important:**`, `**Warning:**`, `**Tip:**`
- **Definition lists** – `**Term** - Description` patterns
- **Problem/Solution labels** – `**Problem:**` / `**Solution:**` in troubleshooting docs

Avoid bold for general emphasis in prose. If something is important enough to need emphasis, use a callout box.

- **Don't**: "This is a **really important** step in the process."
- **Don't**: "Make sure you **always** configure this setting **before** deploying."

### Bold UI elements

Bold UI elements (buttons, menu items, labels, text fields). Don't use quotes.

- **Do**: Click **New insight** in the **Insights** tab.
- **Don't**: Click the "New insight" button.

For nested UI navigation, use `>` to connect:

- **Do**: Navigate to **Settings** > **API keys** > **Personal API key**.
- **Don't**: "In PostHog, navigate to **Settings**, look under **API keys**, and then click **Personal API key**."

### Avoid excessive formatting

Don't use:

- Multiple header levels in short sections
- Bold text for general emphasis
- Lists when prose is clearer
- Too many callout boxes

---

## Links

### Wikipedia-style internal links

Link the **first mention** of a PostHog term, feature, or SDK on a page to its docs page.

> **Example**: "To create an [insight](/docs/product-analytics/insights), first [capture events](/docs/product-analytics/capture-events). Then, select the data you want to see."

### Link to the PostHog app

Link to the app via `https://app.posthog.com/`. Users are redirected automatically to their correct US or EU subdomain.

- **Do**: "Go to the [**Insights** tab](https://app.posthog.com/insights) and click **New insight**."
- **Don't**: Use `https://us.posthog.com/...` or `https://eu.posthog.com/...`

### Link text

Link text should describe the destination. Avoid "click here" or "this page."

- **Do**: "See our [installation guide](/docs/getting-started/install) for instructions."
- **Don't**: "Click [this link](/docs/getting-started/install) for installation instructions."

### Internal links use relative URLs

Always use relative URLs for posthog.com links: `/docs/feature-flags`, not `https://posthog.com/docs/feature-flags`.

---

## Code

### Backticks

- **Inline code** – single backticks for code elements or values in prose: `posthog.capture()`.
- **Code blocks** – triple backticks for multi-line code.

### Follow language conventions

- **JavaScript/TypeScript** – `PascalCase` for classes, `camelCase` for functions and variables, ES modules (`import`/`export`) instead of CommonJS (`require`).
- **Python** – `PascalCase` for classes, `snake_case` for functions and variables.
- **HTML** – lowercase for elements and attributes.

### PostHog event and property naming

**Always use `snake_case` for PostHog event and property names** – never `camelCase` or `PascalCase`.

```js
posthog.capture('user_signed_up', {
    user_id: '123',
    username: 'Jane Doe',
})
```

### Show real-world examples

Use realistic examples that demonstrate actual use cases.

**Do**:

```js
posthog.capture('purchase_completed', {
    product_id: 'prod_12345',
    revenue: 49.99,
    currency: 'USD'
})
```

**Don't**:

```js
posthog.capture('event', {
    property: 'value'
})
```

### Comment sparingly

Only add comments when the code isn't self-explanatory:

```js
// Don't show the survey if user dismissed it in the last 30 days
if (lastDismissed > Date.now() - 30 * 24 * 60 * 60 * 1000) {
    return
}
```

---

## Screenshots and media

> **Important**: Make sure no personal or sensitive information (emails, phone numbers, identifying details) is visible in any screenshot or video.

### Screenshot requirements

- **Focus on the relevant UI** – exclude sidebars and unrelated interface elements.
- **Use a standard viewport** – set device width to 1000–1400px in devtools.
- **Use annotations** – add arrows, text, or other visual elements to highlight specific UI elements.

### When to use videos

- Multi-step workflows
- Complex interactions
- Demonstrating UI behavior

Use Screen Studio with these settings:

- Use the preset
- Remove zoom-in for clicks
- Export: MP4, 1080p, 60 fps, "web" quality
