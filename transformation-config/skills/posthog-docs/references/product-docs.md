# How to write PostHog product docs

This file covers how to **structure** product docs on posthog.com. Load it whenever you're creating a new product doc page or restructuring an existing product's docs section.

PostHog has a standard, flexible structure for product docs. Each section serves a different purpose in the developer journey. **Use [Error Tracking docs](/docs/error-tracking) as the reference template** – it's the strongest example of well-structured documentation.

> **Disclaimer**: PostHog's products vary widely (Data Pipelines is integration-heavy; PostHog AI and Workflows are UI-oriented). They require different content emphases, and that's okay. Adapt this structure to your product's needs – but **start with this structure**. It's worked well for other products in both docs-to-product conversion and user feedback.

---

## The six categories

Every product doc page should fit into one of these:

1. [**Overview**](#overview) – landing page for your product docs. The "book cover."
2. [**Getting started**](#getting-started) – the minimum to install and stand up your product.
3. [**Concepts**](#concepts) – core abstractions and building blocks.
4. [**Guides**](#guides) – task-oriented tutorials for features and workflows.
5. [**PostHog AI**](#posthog-ai) – AI workflows specific to your product.
6. [**Resources**](#resources) – pricing, troubleshooting, changelog, references, anything that doesn't fit the other categories.

## Sidebar navigation

The sidebar mirrors the docs structure. The hierarchy drives how users discover and navigate:

```
Docs sidebar
|
├── Your product
|   └── Overview                # Landing page or home page
├── Getting started
|   ├── Start here              # "Syllabus" page
|   ├── Installation
│   │   ├── Framework 1         # Installation quickstart
│   │   └── Framework 2
│   └── Basic config            # Minimal setup quickstart
├── Concepts
|   ├── Concept 1               # In-depth product explainer
|   └── Concept 2
├── Guides
|   ├── Guide 1                 # Tutorial for feature
|   └── Guide 2
├── PostHog AI
|   ├── AI guide 1              # Tutorial for AI feature
|   └── AI guide 2
└── Resources
    ├── Pricing                 # Pricing and usage limits
    ├── Troubleshooting         # Common issues and solutions
    ├── Changelog               # Product updates
    └── References              # Links to SDK and API docs
```

---

## Overview

The Overview is the landing page for your product docs. Think of it like a book cover – people *will* judge your product on a quick glance.

It needs to work like an effective one-pager. Imagine a busy engineering manager evaluating multiple solutions. With a quick scan, they need to confirm:

- What is this product?
- Is it compatible with my tech stack?
- Does it have the essential features I expect or need?

> **Example** – [Error Tracking overview](/docs/error-tracking)

**Your Overview page should include:**

- Description of the product and its value proposition
- List of key features and capabilities
- List of supported languages, frameworks, and integrations
- List of PostHog platform / cross-product features
- CTAs for next steps in the docs
- Visual components and elements to make it scannable and appealing

---

## Getting started

The Getting started section gets new users up and running with your product as quickly as possible – with *just* enough context to understand what's going on. Streamline for minimal setup.

**Avoid** including advanced or complex features here. Those go in [Guides](#guides).

**Your Getting started section should include:**

- A **Start here** page
- Installation quickstarts
- Basic config quickstarts (optional, e.g. "upload source maps")

### Start here

The Start here page shows the product adoption journey at a high level. It's the syllabus or quest log – a high-level view of milestones the user needs to hit to be successful.

Users are more willing to invest time when they can see what they're signing up for. One setback (a missing link, an outdated config) can be enough to lose them if they don't know where they are in the process.

These pages are **high-converting pages for paid ads**, so they matter. Use the `<QuestLog>` component to create a visual roadmap.

> **Example** – [Error Tracking start here page](/docs/error-tracking/start-here)

**Your Start here page should include:**

- `<QuestLogItem>` sections for each milestone in the adoption journey
- Screenshots and media
- Links to deeper docs
- A "Use for free" section at the end

### Installation

The installation pages are quickstarts for your product. Create one installation page per platform, framework, or language using the `<Steps>` component.

Installation pages have a **special architecture**: they render the same content as the in-app onboarding flow from the monorepo. The single source of truth lives in the [posthog/posthog monorepo](https://github.com/PostHog/posthog/tree/master/docs/onboarding); the website pulls the content automatically.

**See [onboarding-docs.md](onboarding-docs.md) for full details on creating or migrating installation guides to the shared rendering architecture.**

> **Example** – [Error Tracking installation docs](/docs/error-tracking/installation)

**Your Installation section should include:**

- An installation index page listing all supported platforms
- Installation quickstarts for each framework or language using `<Steps>`

> The installation index page displays a grid of platform cards (frameworks, languages) generated automatically from the sidebar nav with logos and icons:
>
> 1. The index page imports a snippet that calls `usePlatformList()`.
> 2. The hook reads all MDX files in the installation folder.
> 3. It sorts them based on the order defined in `src/navs/index.js`.
> 4. Each platform's logo comes from the `platformLogo` frontmatter field.

---

## Concepts

The Concepts section explains your product's core abstractions or building blocks in depth. The goal is to explain *why* the product behaves the way it does – not just how to use it.

If your product uses any terminology that carries specific meaning or implies functionality, it probably deserves a concept page. Some concepts are industry-wide; others are PostHog-specific. From Error Tracking:

- **Exceptions** – industry-wide concept
- **Stack traces** – industry-wide concept
- **Issues** – PostHog-specific concept (group of exceptions in the app UI)
- **Fingerprints** – PostHog-specific concept (low-level identifier for exceptions on SDK capture)

Use Mermaid diagrams for data flows and relationships, tables for definitions, and screenshots for in-app UI elements.

> **Examples** – [Fingerprints](/docs/error-tracking/fingerprints), [Issues and exceptions](/docs/error-tracking/issues-and-exceptions), [Stack traces](/docs/error-tracking/stack-traces), [Releases](/docs/error-tracking/releases)

**Your Concepts section should include:**

- In-depth explainers for each product concept
- Mermaid diagrams for data flows and relationships
- Tables for definitions with context

---

## Guides

The Guides section contains tutorials framed around accomplishing specific use cases, jobs-to-be-done, or goals.

**Why "Guides" and not "Features"?** Because it's task-oriented and focuses on outcomes. We don't want a sidebar listing branded feature names – those don't mean anything to the user. What your feature is *called* is secondary to what it *enables*.

In general, one page per major feature or workflow. Each page should include:

- A brief intro explaining what the guide helps you do
- Instructions on how to use the feature in practice
- Screenshots of the UI

> **Examples** – [Capture exceptions](/docs/error-tracking/capture), [Manage and resolve issues](/docs/error-tracking/managing-issues), [Send alerts](/docs/error-tracking/alerts), [Set up integrations](/docs/error-tracking/integrations)

**Your Guides section should include:**

- One guide per major feature or workflow
- Screenshots showing the feature in the UI
- Step-by-step or general instructions
- A use case or jobs-to-be-done framing

---

## PostHog AI

The PostHog AI section showcases your product's AI workflows. This includes integrations with PostHog AI itself, MCP-based workflows, or examples of useful prompts or skills.

Don't be too prescriptive here. The goal is to show off your product's AI capabilities, big or small.

> **Example** – [Error Tracking PostHog AI docs](/docs/error-tracking/debugging-with-mcp)

**Your PostHog AI section should include:**

- Guides for PostHog AI features your product supports
- Guides for AI workflows like MCP
- Guides for AI resources like recommended prompts or skills

---

## Resources

The Resources section is where useful "lookup" content lives – important standalone pages like pricing, changelog, troubleshooting, and API/SDK references.

If something doesn't fit neatly into the other categories, it belongs here.

> **Example** – [Error Tracking resources](/docs/error-tracking/pricing)

**Your Resources section should include:**

- Pricing page
- Troubleshooting page
- Changelog page
- Links to SDK and API references
- Other resources

### Pricing

Explains the product's pricing model, free tier limits, and how usage is calculated. Transparency is a PostHog differentiator – be clear and upfront.

Just as importantly, show users **how to stay in control of costs**. Include advice on how to reduce the bill.

> **Example** – [Error Tracking pricing](/docs/error-tracking/pricing)

**Your Pricing page should include:**

- `<SingleProductPricing>` calculator component
- Breakdown of how usage or costs are calculated
- A section on how to reduce and cut costs

### Troubleshooting

Common issues and solutions that unblock users. Keep this updated based on support tickets and community questions.

Start with the `<AskAIInput>` component to enable AI chat support, then use searchable headings with numbered solutions. Each section should be scannable and actionable.

> **Example** – [Error Tracking troubleshooting](/docs/error-tracking/troubleshooting)

### Changelog

Displays changelog entries for your product using the `<ProductChangelog>` component, which filters entries from the main `/changelog` page.

> **Example** – [Error Tracking changelog](/docs/error-tracking/changelog)

### API and SDK references

Links to SDK reference docs and API documentation filtered by product.

> **Example** – [Error Tracking references](/docs/error-tracking/references)
