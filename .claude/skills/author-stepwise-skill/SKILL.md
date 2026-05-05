---
name: author-stepwise-skill
description: Scaffold a new context-mill skill that walks an agent through an ordered series of narrowly-scoped reference files. Works for any number of steps. Use when the user wants to add a docs-only skill where the agent must read each step in strict order, one at a time, with each step isolated, with clear endpoints, and no prefetching.
---

This skill scaffolds a multistep skill. A docs-only context-mill skill made of an ordered chain of reference files. The agent reads one file at a time and never sees later files until it finishes the current one.

## When this shape is right

This shape gives you three things:

- **Bounded context per step.** The agent reads one focused file at a time. Token use stays small. Attention stays on the current goal. The shape works the same for two steps or twenty.
- **A clean checkpoint per step.** Each step finishes when its verifiable objective completes. Progress is observable. You can pause, check the run is on track, and resume from the next file.
- **Constrained scope.** The agent acts only on what it has been shown. It does not preload future work, branch, or chase tangents.

Use the multistep pattern when **all** of these are true:

- The work is sequential. Step N depends on step N-1's output.
- Each step has a narrow job. If you can describe step N in one paragraph, it is narrow enough.
- The skill is **docs-only**. There is no example project to bundle.

If the skill is just a bag of related references that the agent can read in any order, **do not use this shape**. Use a flat `docs-only` skill. Extra ceremony hurts.

The mechanics that follow (`references.preamble`, per-file `next_step`, "do not Glob/ls/find", "do not preload", "do not re-read earlier files") make progressive disclosure the path of least resistance. Do not weaken them. A step that says "for context, also read X" defeats the pattern.

## Authoring each step

Keep the scope tight:

- **One job per step.** The step's `# Heading` should name a single goal. If you need "and" or a comma, it is two steps.
- **One verifiable output.** Every step ends with a specific, verifiable artifact. A single tool call. A written file. A returned value. "Investigate X" is not an output. "Write the result of investigating X to `<location>`" is. You should be able to verify that the step has completed and is correct by some condition, test, or tool call.
- **A one-paragraph fence at the top.** State the goal. List what this step does NOT do, naming the later step that owns the deferred work. Do not describe how that step will solve it.
- **Persist anything later steps need.** If step 2 needs a value step 1 produced, step 1 must write it somewhere step 2 can read on its own. The preamble forbids re-reading earlier files.
- **No optional side quests.** Cut "you may also want to…", "if you have time…", "for completeness…". If it matters, it is a step. If it does not, drop it.
- **Stay short.** A step that grows past a screen or two is doing too much. Split it. Long steps invite scan-skimming and tangents.

If you find yourself wanting to add "context" or "background" to help the agent decide, the step is not tight enough. Decide for the agent at authoring time. Do not push the decision into the run.

## Directory layout

```
transformation-config/skills/<group>/
├── config.yaml
├── description.md          # SKILL.md template (entry point)
└── references/
    ├── 1-<step-name>.md    # frontmatter: next_step: 2-<step-name>.md
    ├── 2-<step-name>.md    # frontmatter: next_step: 3-<step-name>.md
    ├── …
    └── N-<step-name>.md    # frontmatter: next_step: null  (terminal)
```

`<group>` is the directory name. With a single `id: all` variant it also becomes the generated skill ID.

## `config.yaml`

```yaml
type: docs-only
template: description.md
description: <one-line description for SKILL.md frontmatter>
tags: [<tag>]
references:
  preamble: "**Read ONLY this file.** Do not read any other reference file until this one tells you to."
shared_docs: []        # optional. PostHog doc URLs every step can rely on.
variants:
  - id: all
    display_name: <human title>
    tags: [<tag>]
    docs_urls: []
```

The build injects `references.preamble` after the first `# Heading` of every reference file that has a `next_step`. It also appends a `**Upon completion, continue with:** [<next>](<next>)` link at the bottom. The terminal file (with `next_step: null`) gets neither.

## Reference file frontmatter

Non-terminal step:

```markdown
---
next_step: 2-<step-name>.md
---

# Step 1: <narrow goal>

<one paragraph: what this step does, what it does NOT do, and what the previous step has already settled.>

…step body…
```

Terminal step:

```markdown
---
next_step: null
---

# Step N: <final goal>

…step body…
```

Notes:

- `next_step` is the **filename** relative to `references/`. Not a path.
- Always declare `next_step`. A file with no frontmatter is treated as a standalone reference (no preamble, no link). Fine for one-off references, wrong for a chain.
- Do not hand-write the "Upon completion, continue with" line. The build appends it.

## `description.md` (SKILL.md template)

The entry point. Keep it short. The real work lives in the reference chain. It must:

- Explain the skill's purpose in one or two paragraphs.
- Tell the agent to **start by reading `references/1-<step-name>.md`** by exact path. Forbid Glob, ls, and find on the skill directory. Forbid preloading future steps.
- Describe any cross-cutting state or conventions every step depends on. Where intermediate values live. What the final output is.
- End with `{commandments}` to inherit the framework guidelines for the skill's tags.

## Build & verify

```bash
npm run build
```

Unzip `dist/skills/<group>.zip` and confirm the chain is intact: non-terminal references have the preamble and continuation link, the terminal has neither.

```bash
npm test
```

Should stay green. The reference-folder test (`scripts/lib/tests/skill-generator-references-folder.test.js`) covers the copy path.

## Anti-patterns

- **Single-file "multistep" skills.** If your reference folder has one file, this is not a chain. It is a flat docs-only skill. See `revenue-analytics/` and `quack/` for shape.
- **Branching chains.** `next_step` is a single filename. If a step has two follow-ups, split into two skills, or have step N enumerate the choices and let step N+1 handle both.
- **Frontmatter on flat (non-chain) groups.** Per-framework groups like `error-tracking/` and `feature-flags/` do not use `references/` chains. Use this shape only when sequencing matters.

## Example: a 2-step skill

A minimal chain has two files: an opener and a terminal step. The shape generalizes to N steps by inserting more files in the middle.

### Layout

```
transformation-config/skills/example-stepwise/
├── config.yaml
├── description.md
└── references/
    ├── 1-discover.md
    └── 2-emit.md
```

### `config.yaml`

```yaml
type: docs-only
template: description.md
description: Two-step example skill. Discover, then emit.
tags: [example]
references:
  preamble: "**Read ONLY this file.** Follow its contents in sequence. Do not read any other reference file until this one tells you to."
shared_docs: []
variants:
  - id: all
    display_name: Example stepwise skill
    tags: [example]
    docs_urls: []
```

### `description.md` (becomes `SKILL.md`)

```markdown
# Example stepwise skill

This skill walks the agent through a two-step task. First discover the target. Then emit the result.

**Start by reading `references/1-discover.md`.** Do not Glob, ls, or find the skill directory. Do not preload `2-emit.md`.

Each step persists its output to `<known-location>` so the next step can read it without re-opening earlier step files.

## Reference files

{references}

## Framework guidelines

{commandments}
```

### `references/1-discover.md`

```markdown
---
next_step: 2-emit.md
---

# Step 1: Discover the target

This step locates the target and writes its identifier to `<known-location>`. It does NOT format, transform, or emit the result. That belongs to step 2.

…step body, ending with a single tool call or write that produces the target identifier…
```

### `references/2-emit.md`

```markdown
---
next_step: null
---

# Step 2: Emit the result

The target identifier is at `<known-location>` (written by step 1 into `targets.json`). This step formats and emits the result into a markdown file. Do not re-read step 1.

…step body, ending with the final emission…
```
