---
type: product-signals
flow: integration-v2
label: Look for product signals
model_pi: openai/gpt-5.6-luna
effort_pi: medium
model_sdk: claude-haiku-4-5-20251001
effort_sdk: medium
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: []
---

## Goal

Read this repo for evidence about which PostHog products would actually earn their
place here, and hand that evidence forward. You change nothing and enable nothing —
the steps after you decide what to do with what you find.

Evidence, not opinions. Every line you report names the file it came from, and a
claim you could not read out of a file is an assumption, not a finding. Look for:

- what the app is for — routes, pages, entry points, and whether any of them already
  call an analytics library
- an LLM client or framework, and the call sites that use it
- a structured logger, and where it writes
- a payments or billing SDK, and the webhook or checkout path it serves
- an existing error reporter already shipping exceptions somewhere
- tenancy: an organizations/teams/workspaces table, or a foreign key on users that
  implies one
- a database or third-party service the warehouse could ingest
- public marketing routes, as distinct from the authenticated app

Read broadly and cheaply: the manifests first, then the schema, then the entry
points, then the specific files those point at. Do not read the whole tree, and do
not open a dependency's own source.

## How you know you succeeded

Your handoff's `forNextAgent` is one line per product, in this exact shape, with
every product present — a reader has to be able to tell "looked, found nothing" from
"did not look":

```
<product>: yes|no|partial — <reason> (<files>)
```

Use `partial` when PostHog would overlap something the project already runs; that is
the case the later steps handle differently from a plain `yes`. Cover exactly these
products, in this order: `product-analytics`, `session-replay`, `error-tracking`,
`logs`, `ai-observability`, `revenue`, `groups`, `data-sources`, `web-analytics`.

For example:

```
product-analytics: yes — 14 routes under app/, no analytics calls anywhere (app/, package.json)
error-tracking: partial — @sentry/nextjs 8.x already reporting (package.json, sentry.client.config.ts)
groups: no — single-tenant, no org or team table (prisma/schema.prisma)
```

`did` says where you looked and what you read. `evidence` names the greps and reads
you actually ran. `assumptions` carries anything inferred from a name rather than
read — an `organizations` table taken to mean tenancy. Leave `filesTouched` out; you
touch nothing.
