---
next_step: 3b-enable-products.md
---

# Step 3 — Connect GitHub (required)

The GitHub integration gives Signals code access: it is how findings get researched against the actual repository and how Self-driving opens fixes. **Setup cannot finish without it.** This is the GitHub App *integration* — distinct from the optional "GitHub Issues" warehouse source in step 5.

## Status

Emit:

```
[STATUS] Checking GitHub connection
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__integrations-list,mcp__wizard-tools__wizard_ask`.

## Do

1. Call `integrations-list`. If any integration has `kind: "github"`, the team is already connected — record it and continue to the next step. (If step 2's project profile already showed a GitHub integration, this call just confirms it.)

2. If absent, build the **one-click install link** from the run prompt's project URLs — same host, project id as a path segment (the same pattern Linear uses in step 5b):

```
<posthog host>/api/environments/<project id>/integrations/authorize?kind=github
```

   Opening it in the user's logged-in browser runs the GitHub App install flow directly — no settings-page hunting. Then ask:

```
{
  id: "github-connect",
  prompt: "Self-driving needs GitHub access to investigate findings in your code and open fixes — setup can't finish without it.\n\nOpen this link to install the PostHog GitHub App in one click, then approve access. Grant it the repos you want Self-driving to work with — include this project's repo so step 5 can also watch its issues:\n\n<github authorize URL>\n\nThen come back here.",
  kind: "single",
  options: [
    { label: "Done — I've installed it", value: "done" },
    { label: "I can't connect right now", value: "cant" }
  ]
}
```

3. On **done**: call `integrations-list` again.
   - GitHub present → continue to the next step.
   - Still absent → tell the user it hasn't appeared yet (the install may take a few seconds to land) and re-ask with the same two options. Verify after each "done". Give this **at most 3 rounds**; on the third miss, ask one final time whether to keep waiting or exit.

4. On **cant** (at any point): emit exactly:

   ```
   [ABORT] github connection declined
   ```

   and stop. Never continue setup without GitHub, and never leave it "half-finished" — the abort happens before this step makes any writes, and the source/scout writes only happen after GitHub is verified.
