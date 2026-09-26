# SDK reference docs

This file covers PostHog's **SDK reference docs** – the comprehensive method/class/type references for each SDK. Load this file only when working on SDK reference docs specifically.

SDK references document class signatures, method signatures, and type interfaces for each SDK. They complement the examples in tutorials and guides by providing the comprehensive reference, with all the details. They matter for two audiences:

- **Developers** doing deep integration work who need parameter and return type details.
- **LLM-based tools** that use them as context to write better PostHog code.

Tutorials and guides link out to SDK references for parameter/return type details rather than restating them.

---

## Which SDKs have reference docs

This is an ongoing effort, starting with the most popular SDKs:

| SDK | Status |
|-----|--------|
| JavaScript Web SDK | Completed |
| Python SDK | Completed |
| Node.js SDK | Completed |
| React Native SDK | Completed |
| iOS SDK | In progress |
| Flutter SDK | Not started |
| Android SDK | Not started |
| Go SDK | Not started |
| Java SDK | Not started |
| Rust SDK | Not started |
| PHP SDK | Not started |
| .NET SDK | Not started |

---

## How SDK reference docs work

The flow:

1. SDKs are parsed for basic information – class names, method names, type interfaces.
2. Descriptions, parameters, return types, and examples are extracted from the SDK code or doc comments.
3. The information is rewritten into a standardized JSON format called **HogRef**. HogRef files are stored in each SDK's repository under a `references/` directory. For example, the JavaScript Web SDK reference is stored at [`packages/browser/references/`](https://github.com/PostHog/posthog-js/tree/main/packages/browser/references).
4. When an SDK releases a new version, the reference docs are generated automatically. See an [example workflow](https://github.com/PostHog/posthog-js/blob/main/.github/workflows/generate-references.yml).
5. The Strapi instance behind the website is configured to [fetch the HogRef JSON files](https://github.com/PostHog/squeak-strapi/blob/main/config/cron-tasks.ts) from each SDK's repo on a cron job.
6. The website renders each HogRef JSON file as a table on the SDK reference page.

Each language works slightly differently in step 1, but the overall flow is the same.

---

## How to create a new SDK reference doc

To contribute a reference doc for a new SDK:

1. **Create a script** to parse the SDK's documentation and extract the info into a HogRef JSON file. The script should:
   - Parse for class names, method names, and type interfaces
   - Extract descriptions, parameters, return types, and examples from the SDK code or doc comments
   - Format the information according to the HogRef JSON schema specification
   - Store the HogRef JSON file in a `references/` directory in the SDK's repository
   - See existing SDK repositories for examples – the [JavaScript Web SDK reference](https://github.com/PostHog/posthog-js/tree/main/packages/browser/references) is a good starting point.
2. **Create a workflow** to regenerate the HogRef JSON whenever a new version of the SDK is released. See an [example workflow](https://github.com/PostHog/posthog-js/blob/main/.github/workflows/generate-references.yml).
3. **Update [`cron-tasks.ts`](https://github.com/PostHog/squeak-strapi/blob/main/config/cron-tasks.ts)** to fetch the HogRef JSON file from the SDK's repository so it ingests on the next cron run.
4. **Verify it renders.** Once the HogRef is ingested, a new page should be created automatically on the website. The website renders the HogRef JSON file as a table on the SDK reference page.
5. **Update existing links.** Find existing links that point to the SDK's GitHub source code and update them to point to the new HogRef-backed reference page instead.

---

## Where reference content lives

| Layer | Location |
|-------|----------|
| Source data (per SDK) | The SDK's own repo, under `references/` (e.g., [`posthog-js/packages/browser/references/`](https://github.com/PostHog/posthog-js/tree/main/packages/browser/references)) |
| Generation workflow | The SDK's own repo, under `.github/workflows/` (e.g., `generate-references.yml`) |
| Ingestion config | [`squeak-strapi/config/cron-tasks.ts`](https://github.com/PostHog/squeak-strapi/blob/main/config/cron-tasks.ts) |
| Rendering | The website pulls from Strapi and renders as a table on the SDK reference page |

**You almost never edit reference content directly in posthog.com.** Edit the source comments/types in the SDK repo, let the workflow regenerate the HogRef JSON, and let the cron job sync it into Strapi.
