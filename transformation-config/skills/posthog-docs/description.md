# PostHog docs authoring

This skill helps you write and edit documentation that lives on posthog.com. It packages PostHog's official docs handbook into a single source of truth so what you produce matches what the docs team expects.

## When to use this skill

Auto-trigger when:

- Editing or creating any file under `contents/docs/` in the posthog.com repo
- Editing or creating files under `docs/onboarding/` or `docs/published/` in the posthog/posthog monorepo
- The user mentions writing or editing PostHog docs, a product doc, an SDK reference, an API spec, an onboarding guide, "docs for X product", or "the PostHog docs"

Do **not** trigger for:

- Blog posts, tutorials, handbook pages, or marketing pages on posthog.com (those follow PostHog's general content style guide, not the docs style guide)
- Internal CLAUDE.md or AGENTS.md files
- Engineering RFCs, READMEs, or code comments

## Universal rules (apply to every PostHog doc)

These are the rules that come up most often. Follow them without needing to load any reference file.

1. **Address the reader as "you".** Never "the user", "developers", or "we".
2. **Active voice, present tense.** "PostHog captures events" – not "events will be captured by PostHog".
3. **Sentence case for headings.** "How to create a feature flag" – not "How To Create A Feature Flag".
4. **American English** with the **Oxford comma**.
5. **British-style en dash with spaces** ( – ), not em dash. On Mac: Option + hyphen.
6. **Use straight quotes and apostrophes**, never curly ones.
7. **Capitalize PostHog product names** as proper nouns (Product Analytics, Session Replay, Feature Flags).
8. **Never** call the project token an "API key". The **project token** (`phs_...`) is public and goes in SDKs. The **personal API key** (`phx_...`) is private and for server-side API access.
9. **Default to "PostHog"**, not "PostHog Cloud" – only specify "Cloud" when contrasting with self-hosted.
10. **Avoid trivializing words**: don't write "simply", "just", "easily", "obviously", "of course", "clearly".
11. **Use relative URLs for internal links** (`/docs/feature-flags`, not `https://posthog.com/docs/feature-flags`).
12. **Bold UI elements** instead of quoting them: Click **New insight**.
13. **`snake_case` for all PostHog event and property names** in code examples. Never camelCase or PascalCase.
14. **Don't use stock Tailwind colors** in any embedded styles – only PostHog tokens.

If you violate any of the above, fix it before considering a doc done.

## Where docs live (orientation)

PostHog docs are split between two repos. Knowing where content lives prevents wasted edits.

- **posthog.com repo (`contents/docs/`)** – most product docs, marketing-adjacent docs, hand-rolled API overviews, blog posts, tutorials, the non-engineering handbook.
- **posthog/posthog monorepo (`docs/published/`)** – engineering handbook pages and product docs that are tightly coupled to monorepo code (e.g., surveys SDK feature support).
- **posthog/posthog monorepo (`docs/onboarding/`)** – the **single source** for in-app installation/onboarding instructions. The website pulls these in automatically. Do not duplicate this content in the website repo. Use the onboarding-docs.md reference for onboarding docs.

## Reference files (load on demand)

The files below are deep references. Load the ones relevant to the current task – don't load all of them up front.

| File | When to load |
|------|--------------|
| [references/style-guide.md](references/style-guide.md) | **Always load** for any docs writing or editing task. Covers voice, grammar, formatting, code conventions, links, screenshots, and word choice. |
| [references/mdx-and-components.md](references/mdx-and-components.md) | Load when working in any `.mdx` file under `contents/docs/`. Covers frontmatter, snippets, magic placeholders like `<ph_project_token>`, and the full component library (`<CalloutBox>`, `<Steps>`, `<ProductScreenshot>`, `<MultiLanguage>`, etc.). |
| [references/product-docs.md](references/product-docs.md) | Load when creating or restructuring a **product's docs section** (Overview, Getting started, Concepts, Guides, PostHog AI, Resources). Use Error Tracking docs as the reference template. |
| [references/onboarding-docs.md](references/onboarding-docs.md) | Load only when creating, migrating, or modifying **shared in-app onboarding/installation content** (the stuff that renders both in-app and on the website). |
| [references/sdk-reference.md](references/sdk-reference.md) | Load only when working on **SDK reference docs** (the auto-generated method/class/type references stored as HogRef JSON in each SDK repo). |
| [references/api-specs.md](references/api-specs.md) | Load only when working on **API specifications** under `/docs/api/` – particularly when figuring out whether a page is hand-rolled or generated, or how to update OpenAPI-driven endpoints. |

## Quick decision tree

- *"Edit a typo or sentence in an existing doc"* – universal rules above are usually enough. Load `style-guide.md` if the change involves rewording.
- *"Add a callout, step list, or screenshot to a doc"* – load `style-guide.md` + `mdx-and-components.md`.
- *"Write a new product doc page"* (e.g., a guide, concept, or troubleshooting page) – load `style-guide.md` + `mdx-and-components.md` + `product-docs.md`.
- *"Add or change an installation page for a product"* – load `onboarding-docs.md` first to confirm whether the product uses the shared rendering pattern. If it does, the source lives in the monorepo, not here.
- *"Add or update an SDK reference"* – load `sdk-reference.md`. The source likely lives in the SDK repo, not posthog.com.
- *"Document a new API endpoint"* – load `api-specs.md`. The source likely lives in the posthog/posthog repo (Django serializers + `@validated_request`), not posthog.com.

## Tooling

PostHog enforces style through three tools, in roughly this order:

1. **Vale** – prose linter that runs in PRs and catches style guide violations.
2. **InKeep docs writer** – AI agent that uses these style guides as context when drafting docs PRs.
3. **This skill** – agent skill for use in Claude Code and similar tools.

Before opening a PR, run:

```bash
pnpm format:docs
```

to auto-fix MDX whitespace issues that commonly break the parser.

## Boundaries

- **Never** invent components. If you're not sure a component exists, check `src/components/` in posthog.com or look at how existing docs use it. If still unsure, ask.
- **Never** move or rename a published doc page without adding a redirect in `vercel.json`.
- **Never** edit the website's installation MDX stubs to change content – change the source in the monorepo.
- **Never** copy patterns from a single page and assume they're the standard. Cross-reference at least two examples or check the relevant reference file.
