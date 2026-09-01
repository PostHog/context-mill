---
next_step: 6-scouts.md
---

# Step 5 — Connected-tool sources (ask, then connect)

External tools can feed the inbox too: issue trackers (GitHub Issues, Linear, Jira, GitLab, Gitea, Shortcut), error tracking (Sentry, Rollbar, Bugsnag, Honeybadger, Raygun), support desks (Zendesk, Freshdesk, Freshservice, Front, Gorgias, Kustomer, Dixa, Plain), database performance (pganalyze), security scanners (Snyk, SonarQube, Semgrep, Rapid7 InsightVM), product feedback / reviews (Featurebase, Frill, Aha, UserVoice, Productboard, Canny, AskNicely, Retently, Appfigures, AppFollow, Judge.me), and search analytics (Google Search Console — surfaces pages that rank in Google but lose clicks to a weak title or description). Each needs a **data warehouse source** before its signal source produces anything — a source row without the warehouse connection is dormant: harmless, but silent until the source syncs. Never enable one the user hasn't confirmed.

**Say what picking a tool actually does, per tool.** This is the most consequential ask in the run. Connecting a tool means Self-driving reads **everything open in it** — including issues the user filed as future work for themselves — and **each record it judges fixable automatically gets its own draft PR, at $15 per PR**, with nobody asked first. Users have picked a tracker here reading the question as "which tools do you use?" and woken up to a stack of unrequested PRs and a bill.

Phrase that as **"automatically opens a draft PR"** — never "no approval step" or "without approval". Same behaviour, but the negative framing reads to anyone at a larger org as *this bypasses our review process*, when the opposite is true: it opens a **draft**, which still goes through their normal review and CI before anything merges. Lead with the automatic part and keep the word *draft*. What you must never do is soften it into something the user triggers themselves — the surprise being fixed here is exactly that they don't.

So each option names **the record that bills**, in brackets after the tool name. The unit is not a category guess — it is the table that tool's emitter actually reads in posthog (`products/signals/backend/emission/registry.py`, one `register_signal_source(<source>, "<table>", …)` line per tool), which is why Shortcut bills per *story*, Plain per *thread*, and Raygun per *error group* rather than all of them saying "per issue". Adding a source here means reading its unit off that registry line.

The brackets carry the per-tool detail, which is what keeps the **prompt one line**. Don't restate the units in the prompt, don't explain what the brackets mean, and don't move them into a `description` — a dimmed sub-line per row would double the list height, and a prompt that spells all this out is a wall of text above a 36-row picker. Short prompt, unit in the label.

The run can connect **every** one of them, each with at most one click from the user, and it never asks anyone to paste a credential into this chat:

- **GitHub Issues** — reuses the GitHub App the wizard connected before this run started (connector: `5a-github.md`).
- **Linear** — a one-click OAuth link (connector: `5b-linear.md`).
- **Zendesk, pganalyze, Jira** (and any other API-credential source) — a secure PostHog **connect link**. The user enters their credentials on a PostHog page in their own browser, PostHog stores them, and the run creates the live source from that stored credential — no secret ever passes through this chat (connector: `5c-credentials.md`).
- **Google Search Console** — a PostHog **connect link** that runs the Google OAuth grant and property pick in the browser and creates the source there; the run verifies it afterwards (connector: `5d-google-search-console.md`).

A tool falls back to a **dormant responder** (the row is enabled but silent until a warehouse source exists) plus a follow-up **only** when the user skips or can't finish its connect step. That used to be the default for credential sources; it is now the exception.

## Status

Emit:

```
[STATUS] Offering issue-tracker integrations
```

## Tools

Load `wizard_ask` via `ToolSearch select:mcp__wizard-tools__wizard_ask`. Reach `external-data-sources-list` through the PostHog `exec` tool (`info` then `call`); the source-config tools from step 4 are reached the same way. The credential connector (`5c-credentials.md`) additionally uses `data-warehouse-source-connect-link`, `data-warehouse-stored-credentials-list`, and `external-data-sources-create`, and the Google Search Console connector (`5d-google-search-console.md`) uses `data-warehouse-source-connect-link` and `external-data-sources-list`, all through the same `exec` tool.

## Do

1. **Build a short list from the codebase scan, then ask once.** The full catalog is ~36 tools — too many to show at once. The run prompt carries a **"Tools detected in this codebase"** block (a deterministic dependency + env-key scan the wizard ran on this project). Use it to keep the first ask short:

   - **Detected tools first.** From that block, take every tool whose `source_type` matches an entry in the connected-tools catalog (the `source_type` list in step 2 — e.g. detected `Sentry` → Sentry, `Github` → GitHub Issues). Ignore detected sources that are **not** in the catalog (Postgres, Stripe, …) — those belong to step 4, not this ask. List these first, right after "None of these". If the run prompt carries no detected block (older wizard), fall back to any step-2 evidence for ordering.
   - **Then the SaaS basics** — always offer GitHub Issues, Linear, Jira, Sentry, and Zendesk even when the scan didn't flag them; skip any already added above.
   - **Then "Show more (N more hidden)"** — a final `show-more` option that opens the full catalog. Set `N` to the number of catalog tools you did **not** list above (36 minus the detected-plus-basics rows), so the label says how many are behind it instead of leaving the user to guess.

   If the detected block found nothing, the list is just the SaaS basics + "Show more (31 more hidden)" — 36 catalog tools minus the 5 basics. **"None of these" stays the first option** (an accidental `enter` declines). Example shape (detected tools spliced in between "None of these" and the basics):

   Send the prompt and the per-tool unit brackets **exactly** as written — neither is yours to trim or soften, and a tool you splice in from the detected block carries the same bracket the catalog gives it. The `value`s are unchanged, so step 4's enable map still keys off them.

```
{
  id: "connected-tools",
  prompt: "Self-driving reads everything open in these and automatically opens a draft PR for what it can fix — $15 each. Which do you use?",
  kind: "multi",
  options: [
    { label: "None of these", value: "none" },
    { label: "GitHub Issues (per issue)", value: "github-issues" },
    { label: "Linear (per issue)", value: "linear" },
    { label: "Jira (per issue)", value: "jira" },
    { label: "Sentry (per issue)", value: "sentry" },
    { label: "Zendesk (per ticket)", value: "zendesk" },
    { label: "Show more (31 more hidden)", value: "show-more" }
  ]
}
```

1b. **Only if the user picked the "Show more" option**, ask a second multi-select with the full catalog below, minus the tools already shown in the first ask. Merge both answers into one picked set and drop the `show-more` sentinel — it is not a tool. If "Show more" was not picked, skip this step entirely and never render the full catalog.

   Full catalog (for the "Show more" expansion only). Same rule: every row carries its billing unit.

```
{
  id: "connected-tools-all",
  prompt: "Pick any others — same deal, $15 per PR:",
  kind: "multi",
  options: [
    { label: "None of these", value: "none" },
    { label: "GitHub Issues (per issue)", value: "github-issues" },
    { label: "Linear (per issue)", value: "linear" },
    { label: "Jira (per issue)", value: "jira" },
    { label: "GitLab (per issue)", value: "gitlab" },
    { label: "Gitea (per issue)", value: "gitea" },
    { label: "Shortcut (per story)", value: "shortcut" },
    { label: "Sentry (per issue)", value: "sentry" },
    { label: "Rollbar (per item)", value: "rollbar" },
    { label: "Bugsnag (per error)", value: "bugsnag" },
    { label: "Honeybadger (per fault)", value: "honeybadger" },
    { label: "Raygun (per error group)", value: "raygun" },
    { label: "Zendesk (per ticket)", value: "zendesk" },
    { label: "Freshdesk (per ticket)", value: "freshdesk" },
    { label: "Freshservice (per ticket)", value: "freshservice" },
    { label: "Front (per conversation)", value: "front" },
    { label: "Gorgias (per ticket)", value: "gorgias" },
    { label: "Kustomer (per conversation)", value: "kustomer" },
    { label: "Dixa (per conversation)", value: "dixa" },
    { label: "Plain (per thread)", value: "plain" },
    { label: "pganalyze (per issue)", value: "pganalyze" },
    { label: "Snyk (per issue)", value: "snyk" },
    { label: "SonarQube (per issue)", value: "sonarqube" },
    { label: "Semgrep (per SAST finding)", value: "semgrep" },
    { label: "Rapid7 InsightVM (per vulnerability)", value: "rapid7_insightvm" },
    { label: "Featurebase (per post)", value: "featurebase" },
    { label: "Frill (per idea)", value: "frill" },
    { label: "Aha (per idea)", value: "aha" },
    { label: "UserVoice (per suggestion)", value: "uservoice" },
    { label: "Productboard (per note)", value: "productboard" },
    { label: "Canny (per post)", value: "canny" },
    { label: "AskNicely (per response)", value: "asknicely" },
    { label: "Retently (per feedback item)", value: "retently" },
    { label: "Appfigures (per review)", value: "appfigures" },
    { label: "AppFollow (per review)", value: "appfollow" },
    { label: "Judge.me (per review)", value: "judgeme_reviews" },
    { label: "Google Search Console", value: "google_search_console" }
  ]
}
```

**Google Search Console carries no unit on purpose.** It is the one tool in this list with no emitter registered in `registry.py`, so nothing it syncs becomes a signal — and therefore nothing it syncs bills. Don't invent a unit for it; if an emitter lands, give it the bracket its registry line names.

Two things narrow what actually bills, so don't imply every record becomes a PR: each emitter's `where_clause` drops records the tool already closed (Linear, for instance, skips `completed` and `canceled` states — but **not** backlog or todo, which is why future-work tickets are in scope), and most emitters then run an `actionability_prompt` before emitting. The user-facing claim stays "each record it judges fixable" — "judges" is carrying that nuance, so keep the word.

2. Call `external-data-sources-list` once (step 2's project profile also lists warehouse sources when it exists). For each picked tool whose source already exists, match its warehouse `source_type`: `Github` / `Linear` / `Jira` / `GitLab` / `Gitea` / `Shortcut` / `Sentry` / `Rollbar` / `Bugsnag` / `Honeybadger` / `Raygun` / `Zendesk` / `Freshdesk` / `Freshservice` / `Front` / `Gorgias` / `Kustomer` / `Dixa` / `Plain` / `PgAnalyze` / `Snyk` / `Sonarqube` / `Semgrep` / `Rapid7Insightvm` / `Featurebase` / `Frill` / `Aha` / `Uservoice` / `Productboard` / `Canny` / `Asknicely` / `Retently` / `Appfigures` / `Appfollow` / `JudgeMeReviews` / `GoogleSearchConsole`. Record "already connected" — no connector flow needed, just enable its responder row (step 4 below).

3. Dispatch each picked tool that's still missing:

   - **GitHub Issues** → read `references/5a-github.md` and follow it.
   - **Linear** → read `references/5b-linear.md` and follow it.
   - **Zendesk / pganalyze / Jira** (and any other API-credential source) → read `references/5c-credentials.md` and follow it. It hands the user a secure PostHog connect link, waits for them to store their credentials in the browser, then creates the live source from that stored credential. If they skip or don't finish, it falls back to the dormant responder + follow-up (step 4 below).
   - **Google Search Console** → read `references/5d-google-search-console.md` and follow it. It hands the user a PostHog connect link that runs Google's OAuth grant and property pick in the browser and creates the source there, then verifies it via `external-data-sources-list`. If they skip or don't finish, it falls back to the dormant responder + follow-up (step 4 below).

4. Enable the source row (step 4's write recipe) for every tool the user picked — created, verified, and picked-but-not-connected alike (a dormant row is harmless and saves a later trip):

   - GitHub Issues → `github` / `issue`
   - Linear → `linear` / `issue`
   - Jira → `jira` / `issue`
   - GitLab → `gitlab` / `issue`
   - Gitea → `gitea` / `issue`
   - Shortcut → `shortcut` / `issue`
   - Sentry → `sentry` / `issue`
   - Rollbar → `rollbar` / `issue`
   - Bugsnag → `bugsnag` / `issue`
   - Honeybadger → `honeybadger` / `issue`
   - Raygun → `raygun` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - Freshdesk → `freshdesk` / `ticket`
   - Freshservice → `freshservice` / `ticket`
   - Front → `front` / `ticket`
   - Gorgias → `gorgias` / `ticket`
   - Kustomer → `kustomer` / `ticket`
   - Dixa → `dixa` / `ticket`
   - Plain → `plain` / `ticket`
   - pganalyze → `pganalyze` / `issue`
   - Snyk → `snyk` / `scanner_finding`
   - SonarQube → `sonarqube` / `scanner_finding`
   - Semgrep → `semgrep` / `scanner_finding`
   - Rapid7 InsightVM → `rapid7_insightvm` / `scanner_finding`
   - Featurebase → `featurebase` / `feedback`
   - Frill → `frill` / `feedback`
   - Aha → `aha` / `feedback`
   - UserVoice → `uservoice` / `feedback`
   - Productboard → `productboard` / `feedback`
   - Canny → `canny` / `feedback`
   - AskNicely → `asknicely` / `feedback`
   - Retently → `retently` / `feedback`
   - Appfigures → `appfigures` / `review`
   - AppFollow → `appfollow` / `review`
   - Judge.me → `judgeme_reviews` / `review`
   - Google Search Console → `google_search_console` / `search_opportunity`

5. Record each picked tool's final class honestly — the report consumes these verbatim:

   - **connected by this setup** — the connector flow created the source (you have its id; the first sync starts automatically). This now includes credential sources the user connected through the `5c-credentials.md` link, not just GitHub/Linear.
   - **already connected** / **verified connected** — the source row was seen in `external-data-sources-list`
   - **picked but not connected** — the user picked the tool but skipped or didn't finish its connect step, so no live warehouse source exists: a connect link they didn't complete (Zendesk / pganalyze / Jira), Linear when its integration didn't land, or a GitHub Issues fallback the user skipped. **Enable the dormant responder and add a "Connect <tool>…" follow-up** — this is harmless, because a responder only emits once its warehouse source actually syncs, so a dormant row just saves the user a later trip. Record it honestly — never write that the user "confirmed connecting" and never "not used". Phrase it as "you selected <tool>, but no warehouse source was connected — the responder is enabled and stays dormant until you add the source and it starts syncing", plus the follow-up with the new-warehouse-source URL
   - **not used** — the tool was **not picked** in the connected-tools multi-select. No responder, no follow-up; record "skipped (not used)".
