---
next_step: 6-scouts.md
---

# Step 5 — Connected-tool sources (ask, then connect)

External tools can feed the inbox too: issue trackers (GitHub Issues, Linear, Jira, GitLab, Gitea, Shortcut), error tracking (Sentry, Rollbar, Bugsnag, Honeybadger, Raygun), support desks (Zendesk, Freshdesk, Freshservice, Front, Gorgias, Kustomer, Dixa, Plain), database performance (pganalyze), security scanners (Snyk, SonarQube, Semgrep, Rapid7 InsightVM), product feedback / reviews (Featurebase, Frill, Aha, UserVoice, Productboard, Canny, AskNicely, Retently, Appfigures, AppFollow, Judge.me), and search analytics (Google Search Console — surfaces pages that rank in Google but lose clicks to a weak title or description). Each needs a **data warehouse source** before its signal source produces anything — a source row without the warehouse connection is dormant: harmless, but silent until the source syncs. Never enable one the user hasn't confirmed.

The run can connect **every** one of them, each with at most one click from the user, and it never asks anyone to paste a credential into this chat:

- **GitHub Issues** — reuses the GitHub App connected in step 3 (connector: `5a-github.md`).
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

1. Ask **once**, multi-select. **"None of these" is the first option** (the safe default — an accidental `enter` declines); order the *tools* after it, seeding with any step-2 hints so a tool you saw evidence of comes first among them:

```
{
  id: "connected-tools",
  prompt: "Self-driving can also watch your other tools and investigate and fix the problems they surface. Which of these do you use?",
  kind: "multi",
  options: [
    { label: "None of these", value: "none" },
    { label: "GitHub Issues", value: "github-issues" },
    { label: "Linear", value: "linear" },
    { label: "Jira", value: "jira" },
    { label: "GitLab", value: "gitlab" },
    { label: "Gitea", value: "gitea" },
    { label: "Shortcut", value: "shortcut" },
    { label: "Sentry", value: "sentry" },
    { label: "Rollbar", value: "rollbar" },
    { label: "Bugsnag", value: "bugsnag" },
    { label: "Honeybadger", value: "honeybadger" },
    { label: "Raygun", value: "raygun" },
    { label: "Zendesk", value: "zendesk" },
    { label: "Freshdesk", value: "freshdesk" },
    { label: "Freshservice", value: "freshservice" },
    { label: "Front", value: "front" },
    { label: "Gorgias", value: "gorgias" },
    { label: "Kustomer", value: "kustomer" },
    { label: "Dixa", value: "dixa" },
    { label: "Plain", value: "plain" },
    { label: "pganalyze", value: "pganalyze" },
    { label: "Snyk", value: "snyk" },
    { label: "SonarQube", value: "sonarqube" },
    { label: "Semgrep", value: "semgrep" },
    { label: "Rapid7 InsightVM", value: "rapid7_insightvm" },
    { label: "Featurebase", value: "featurebase" },
    { label: "Frill", value: "frill" },
    { label: "Aha", value: "aha" },
    { label: "UserVoice", value: "uservoice" },
    { label: "Productboard", value: "productboard" },
    { label: "Canny", value: "canny" },
    { label: "AskNicely", value: "asknicely" },
    { label: "Retently", value: "retently" },
    { label: "Appfigures", value: "appfigures" },
    { label: "AppFollow", value: "appfollow" },
    { label: "Judge.me", value: "judgeme_reviews" },
    { label: "Google Search Console", value: "google_search_console" }
  ]
}
```

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
