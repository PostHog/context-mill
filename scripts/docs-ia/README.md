# Docs IA Workflows (`scripts/docs-ia`)

Workflow-centered implementation of the claims-based Docs IA tool in `context-mill`.

## Architecture

Everything revolves around a single entry point, declarative top-level workflows, shared Markdown prompt fragments, cohesive data models, and a single deterministic tool catalog exposed both to scripts and to agents via a step-scoped MCP server:

```text
facts/
├── repos.yml                        # Pinned repo commits
├── registries.yml                   # Closed product, surface, and tag registries
└── products/<slug>.yml              # Per-product scope, surface rules, exclusions

scripts/docs-ia/
├── cli.mjs                          # Single entry point (`pnpm docs-ia <list|inspect|run|query|mcp-serve>`)
├── workflows/                       # Top-level workflow DAGs (script -> agent -> script)
│   ├── index.mjs                    # Registry of all workflows
│   ├── build-ia.workflow.mjs        # Build pipeline: AST pins -> facts -> ports -> seams -> procedures -> Dewey v3
│   ├── map-docs.workflow.mjs        # Docs mapping: MDX split -> candidates -> bind -> 2nd-pass judge -> coverage
│   ├── refresh-drift.workflow.mjs   # Drift & lifecycle: 2-gate hash refresh -> MDX reconcile -> blast radius -> judge -> retire
│   └── compile-skills.workflow.mjs  # Downstream: surface-sliced UC-* skills -> anchor check
├── prompts/                         # Shared Markdown prompts (`{{include:shared/...}}` + strict `{{var}}`)
│   ├── loader.mjs
│   ├── shared/                      # Verbatim quote law, source quarantine, port taxonomy, pointing-and-calling
│   └── *.md                         # One prompt per agent step
├── models/                          # Cohesive data models + JSON Schemas for structured agent output
│   ├── pin.mjs                      # Detached `{ commit, code_hash, own_runs }` + 2-gate refresh
│   ├── fact.mjs                     # Closed fact/port taxonomy, quote gates, source quarantine, commit-free stable keys
│   ├── claim.mjs                    # Canonical claim & fact lifecycle state machines
│   ├── register.mjs                 # Product-agnostic Dewey v3 append-only register + tombstones + audit trail
│   ├── workflow.mjs                 # `scriptStep`, `agentStep`, `defineWorkflow`, pre-flight binding validator
│   └── schemas/*.schema.json
├── tools/                           # Deterministic actions callable by scripts OR by agents over MCP
│   ├── catalog.mjs                  # Single deterministic tool registry
│   ├── mcp-server.mjs               # Step-scoped stdio JSON-RPC 2.0 MCP server (exposes ONLY bound tools)
│   ├── ast-pins.mjs                 # Symbol/YAML pin indexer + pluggable Tree-sitter hook
│   ├── port-linker.mjs              # 0-LLM port wiring + versioned platform PortContracts
│   ├── mdx-splitter.mjs             # Source-first MDX splitter + 3-tier human soft-drift reconciler
│   ├── blast-radius.mjs             # `symbol -> F -> PR -> UC -> C -> page` walk + thin lookup queries
│   └── skill-compiler.mjs           # Surface-sliced UC-* compiler + anchor verifier
├── runtime/                         # Execution engine & co-located config binding
│   ├── runner.mjs                   # Validates bindings before step 1, executes scripts & agents
│   ├── agent-adapter.mjs            # Spawns `agy --print` with the step's exact model, schema, and scoped MCP config
│   └── git.mjs                      # Zero-network `--no-lazy-fetch` git reader + disk cache
└── tests/                           # Vitest suite (0 LLM calls)
```

## Quick commands

```bash
pnpm docs-ia list                                # Show all workflows, step order, and tool/MCP bindings
pnpm docs-ia inspect refresh-drift               # Inspect one workflow's config bindings
pnpm docs-ia run build-ia --product mcp-analytics --dry-run
pnpm test:docs-ia                                # Run the deterministic Vitest suite
```
