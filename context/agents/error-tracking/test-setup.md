---
type: test-setup
flow: error-tracking
label: Offer to test the local setup
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, Bash, load_skill_menu, install_skill, wizard_ask]
disallowedTools: [enqueue_task]
dependsOn: [wire-ci]
---

## Goal

Offer the user a one-time, end-to-end check that errors reach PostHog with
readable stack traces. Install the skill your task input names (`install_skill`
with the `skillId`) and follow its **"Test the local setup"** step for the
platform-appropriate affordance, the `captureException` shape, the placement,
and the read-before-edit / always-revert rules.

First ask with `wizard_ask`:
`{ id: "test-affordance", prompt: "Want me to help you test your local setup? I'll add a temporary test button (or route) to your app so you can confirm errors show up in Error Tracking with readable stack traces after your next build. I'll remove it once you've confirmed it works.", kind: "single", options: [{ label: "Yes, help me test it", value: "yes" }, { label: "No, I'll test on my own later", value: "no" }] }`

- **"no"** (or `wizard_ask` unavailable): do nothing to the code and report this
  task done, noting the test was offered and declined.
- **"yes"**: add the affordance per the skill, then pause with a second
  `wizard_ask` (id `"test-done"`, a single `Continue (revert test code)`
  option) whose prompt gives the build, run, and Error-Tracking-check as
  literal numbered steps (build first — it uploads the maps — then trigger the
  affordance, then confirm the error resolves to real source in Error
  Tracking). After the user continues, REVERT every test edit per the skill's
  rules. Never leave the affordance in place, even if the user says it didn't
  work — revert first, then carry the failure into your handoff.

## How you know you succeeded

Either the user declined and no code changed, or the affordance was added,
tested, and fully reverted. Your handoff says which, and carries any failure
the user reported for the report to surface.
