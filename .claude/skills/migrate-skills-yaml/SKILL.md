---
name: migrate-skills-yaml
description: Converts the old flat skills.yaml format to the new grouped format with variations. Use when a PR or branch still has a top-level "skills:" array instead of grouped skill objects.
metadata:
  temporary: "true"
---

<!-- TEMPORARY: remove after all PRs are migrated to grouped skills.yaml format -->

## Old format (flat array)

```yaml
shared_docs:
  - https://posthog.com/docs/getting-started/identify-users.md

skills:
  - id: nextjs-app-router
    type: example
    example_path: basics/next-app-router
    display_name: Next.js App Router
    description: PostHog integration for Next.js App Router applications
    tags: [nextjs, react, ssr, app-router, javascript]
    docs_urls:
      - https://posthog.com/docs/libraries/next-js.md
```

## New format (grouped with variations)

```yaml
shared_docs:
  - https://posthog.com/docs/getting-started/identify-users.md

integration-skills:
  type: example
  template: integration-skill-description.md
  variations:
    - id: nextjs-app-router
      example_path: basics/next-app-router
      display_name: Next.js App Router
      description: PostHog integration for Next.js App Router applications
      tags: [nextjs, react, ssr, app-router, javascript]
      docs_urls:
        - https://posthog.com/docs/libraries/next-js.md
```

## Migration steps

1. Keep `shared_docs` at the top level unchanged
2. Remove the top-level `skills:` key
3. Create `integration-skills:` with `type: example` and `template: integration-skill-description.md`
4. Move all former `skills` entries under `integration-skills.variations`
5. Remove `type: example` from each variation (it's inherited from the group)
6. Keep all other fields (`id`, `example_path`, `display_name`, `description`, `tags`, `docs_urls`) on each variation
