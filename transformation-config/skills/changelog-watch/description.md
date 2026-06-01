# Changelog watch

Watch a set of named competitors for recent meaningful moves and produce a short internal digest. Generic — works for any company; the user supplies their own positioning and competitor list on first run, and the skill persists the config across runs.

This skill is **read-only against the user's project** — it never edits source files. The only files it writes are the config (on first run) and the optional digest output file.

## Tools used

- **Read / Write** — for `config.json` persistence and (optionally) writing the digest to a markdown file
- **Bash** — to create the config directory (`mkdir -p ~/.posthog/changelog-watch`)
- **WebFetch** — to pull competitor changelog and blog pages
- **WebSearch** — fallback when WebFetch returns a client-rendered shell

## Config file location

Config is stored at **`~/.posthog/changelog-watch/config.json`** (user-level, shared across repos). On every run:

1. Try to read the config.
2. If it exists, summarise it back to the user and ask whether to run as-is or edit.
3. If it does not exist, run the first-run interview below.

Emit a `[STATUS]` line on entry so the Wizard's live spinner reflects the current sub-step:

```
[STATUS] Loading changelog-watch config
```

## Step 1 — Load or build config

### If `~/.posthog/changelog-watch/config.json` exists

Read it, then summarise to the user in one line:

> Loaded config: **{company}** — {N} categories, {M} competitors. Run as-is, or update first?

If they want to edit, ask which part (positioning / categories / competitors / focus list) and apply only that change. Show the proposed JSON diff to the user before writing.

### If the config is missing — first-run interview

Ask these as free-form chat questions, one at a time. **Do not use `AskUserQuestion`** — this skill ships through PostHog's Wizard and MCP, and Wizard surfaces don't support structured prompts.

1. **Company and positioning.** Ask the user for a short paragraph describing what their company does and where it competes hardest. This is used to frame "why this matters for {company}" in every digest entry.
2. **Categories.** Ask the user to list the competitive categories they want to track (e.g. "error tracking, session replay, logs"). Open list, no fixed taxonomy.
3. **Competitors per category.** For each category in turn, ask for competitor names and their changelog or blog URLs. Allow multiple URLs per competitor (e.g. a release-notes page and a blog).
4. **Strategic focus (optional).** Ask which competitors should get extra scrutiny each cycle — the "directionally important" ones whose every move matters.

Emit `[STATUS]` lines between sub-steps (`[STATUS] Capturing company positioning`, `[STATUS] Building category list`, etc.).

Before writing, ensure the directory exists:

```bash
mkdir -p ~/.posthog/changelog-watch
```

Then write the config with this shape:

```json
{
  "company": "Acme",
  "positioning": "One-paragraph description of what the company does and where it competes hardest.",
  "categories": [
    {
      "name": "Error tracking",
      "competitors": [
        { "name": "Sentry", "urls": ["https://sentry.io/changelog/", "https://blog.sentry.io/"] }
      ]
    }
  ],
  "focus": ["Better Stack", "HumanBehavior"]
}
```

## Step 2 — Per-run options

Ask the user two questions in free-form chat:

1. **Time window.** Default 14 days. Offer 7 / 14 / 30 days, or accept a custom number.
2. **Output destination.** Chat only, a markdown file at a path the user supplies, or both.

Emit `[STATUS] Fetching {N} sources` once both are chosen.

## Step 3 — Fetch sources in parallel

Launch all WebFetch calls in parallel — do **not** fetch sequentially. Group in batches of 4–6 URLs to keep payloads manageable.

For each URL, ask WebFetch to return: visible date stamps, item titles, item summaries, and source links.

### Handling failures

- **Client-rendered shell (nav/footer only)**: fall back to `WebSearch` for `"{competitor} changelog {current_year}"`. Search snippets often have what the JS-rendered page hides.
- **404 / unreachable**: note the URL once under "Couldn't reach" at the bottom of the digest. Do **not** retry, do **not** loop.
- **Wrong URL pattern**: try one alternative (`/changelog` → `/release-notes`, `/whats-new`, `/blog`). If that also fails, treat as unreachable.

## Step 4 — Filter and rank

Apply these rules to every item:

- **Keep only** items dated within the chosen time window, using visible date stamps on the page. Do not summarise archive content.
- **Drop noise**: minor bug fixes, hiring posts, regional/legal updates, generic thought-leadership, conference recaps, customer-story marketing posts that don't announce anything new.
- **Keep**: new launches, pricing changes, repositioning, AI/agent features (multi-session summaries, NL search, MCP, autonomous agents), new SDKs/integrations, anything that shifts the competitor's story vs. `{company}`.
- Apply extra scrutiny to anything from competitors in the `focus` array — when in doubt for a focus competitor, keep it.

## Step 5 — Write the digest

Use this exact structure, substituting `{company}`, `{date range}`, and the user's category names:

```
# Changelog watch — {date range}

## Headlines
2–3 bullets naming the biggest moves of the cycle. Skip the section entirely if nothing notable.

## {Category name}

### {Competitor name}
- **What they shipped** — one sentence.
- **Why it matters for {company}** — closes a gap, opens a gap, reframes positioning, validates a direction. Use the positioning from `config.json` to make this specific, not generic.
- **Source** — link.

(repeat per competitor; if a competitor shipped nothing relevant this cycle, write "Nothing notable" on one line and move on)

## What I'd action this cycle
1–3 concrete suggestions: battlecard update, blog response, sales talking point, gap to flag to product. Skip the section if nothing.

## Couldn't reach
(only include if URLs failed)
- {url} — {reason}
```

**Length cap: ~1000 words total.** Be ruthless. Most competitors will be "Nothing notable" most weeks — that is the correct answer, not a failure.

## Step 6 — Deliver

- If the user chose **chat only**, print the digest in the conversation.
- If they chose **markdown file**, Write to the path they supplied. Confirm the path back to them. Default suggestion: `./changelog-watch-{YYYY-MM-DD}.md` in the current working directory.
- If they chose **both**, do both.

End with `[STATUS] Digest complete`.

## Key principles

- **Never edit `config.json` without confirming.** Show the user the proposed change first.
- **Every kept item needs a source URL.** No source = drop the item.
- **Use the current year in fallback WebSearch queries.** Competitor pages move; stale results dominate searches that don't pin the year.
- **"Why it matters for {company}" must reference the positioning from config**, not generic commentary. If you can't write a specific reason, the item probably isn't worth keeping.
- **Do not pad.** A digest with three real items beats one with twelve noisy ones.
- **Never edit the user's project source.** This skill is purely read/write against the config and the optional digest output file.
