---
type: report
flow: spend-audit
label: Write the audit notebook
sink: true
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-5
effort_sdk: high
skills: [spend-audit-findings, spend-audit-notebook, spend-audit-result]
allowedTools: [Read, Glob, Grep, posthog_exec, publish_result]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [measure-volumes]
---

## Goal

Deliver the audit. Read every handoff in the run and fold the findings into
three outputs, in this order:

1. **The notebook**, created through `posthog_exec` with the sections and the
   title the notebook skill fixes. It always exists, even when the audit found
   nothing: a clean audit is a result the user wants to see. Embed the insights
   `value-insights` created, each with one line on the question it answers.
   When your project context names the PostHog account owner, place their card
   where the skill says.
2. **The pull request body**, through one `publish_handoff` call, only when
   `apply-code-fixes` applied at least one change. It explains each change and
   the evidence behind it, so a reviewer can merge without opening the
   notebook. No change applied, no `publish_handoff` call.
3. **The result file**, through one `publish_result` call, always, and last,
   with the notebook's short id, every dashboard and insight id the run
   created, every sized saving, every value item, and every passed check, as
   the result skill shapes them. A finding `apply-code-fixes` skipped moves to
   the notebook as unpriced; it is not a `pr` saving anymore.

Never state a dollar amount. The product prices the volumes from the user's own
billing.

## How you know you succeeded

A user who opens only the notebook knows what the audit created, what to change
in PostHog and why, what the pull request changes, what new insights answer, and
what was checked and found fine. The result file lists everything the run
created and every saving with the query behind it. `publish_result` was called
once, after the notebook existed, so the file carries its short id.
