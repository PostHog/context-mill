# Judge merged pull request for Docs IA and `.mdx` impact (`{{product}}` / `{{productCode}}`)

The deterministic two-gate pin refresh and blast-radius walk already skipped unchanged symbols at 0 LLM calls. Evaluate this merged pull request to decide BOTH whether public `.mdx` prose needs an edit AND which outside-in behavioral facts seat into the `{{productCode}}` IA registry:

1. `needs_docs`: set `true` ONLY when a customer reading the live `.mdx` pages would now find a statement factually contradicted or stale (for example: SDK support matrix cells, `$mcp_unknown_tool` SDK coverage, `"anonymous"` vs `ses_...` `distinct_id` fallback order, `$mcp_client_user_agent` vs `$mcp_client_name` harness precedence, deleted dashboard charts, beta-to-stable SDK promotions, or `get_more_tools`-only claims), OR when the PR ships a new REST resource, Settings page, SDK `instrument()` option, HogQL virtual property capability, or app-directory review disclosure workflow.
   Set `needs_docs: false` for internal plumbing, AI gateway routing, clustering tuning, query window/perf bounds, CSS layout fixes, bug fixes restoring documented behavior, internal tool-string rewordings, and granular UI drill-downs or standard `filterTestAccounts` toggles when summary-level `.mdx` pages stay accurate.
2. `change_kind`: `"update"` when existing listed pages cover the topic, `"create"` when a new dedicated guide plus cross-links are warranted, `"remove"` when a documented feature is gone, or `null` when `needs_docs` is `false`.
3. `affected_pages`: list ONLY exact paths from **Live Docs Pages** whose text is contradicted, stale, or directly missing the new option or section.
4. `new_facts`: 0 to 5 outside-in behavioral facts to seat into `{{productCode}}` (you may seat code facts even when `needs_docs` is `false` on granular UI/clustering PRs, and seat 0 facts on pure perf/refactor PRs).

{{include:shared/pointing-and-calling.md}}

{{include:shared/verbatim-quote-law.md}}

{{include:shared/source-quarantine.md}}

## Bound deterministic tools available to you

{{boundToolsList}}

## Live Docs Pages

{{editablePagesBlock}}

## IA Capability Sections & Exclusion Decisions

{{sectionsAndDecisionsBlock}}

## Bound Live Docs Claims (Page-Diversified Blast Radius)

{{boundClaimsBlock}}

## Section-Windowed Candidate Page Excerpts

{{candidatePageExcerptsBlock}}

## Pull Request Metadata & AST Symbol Delta

Commit: {{commitTitle}}
PR Body:
{{prBody}}

Changed / New / Deleted AST & Manifest Definitions:
{{astDeltaBlock}}

```diff
{{diffText}}
```
