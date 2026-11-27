# Bind live docs pieces to code-pinned facts (`{{product}}`)

Map each checkable Markdown/MDX piece from `posthog.com` to the code-pinned facts that support or contradict it.

{{include:shared/pointing-and-calling.md}}

{{include:shared/source-quarantine.md}}

## Bound deterministic tools available to you

{{boundToolsList}}

## Rules

- Mark `fresh` only when pinned production code facts directly verify the doc statement.
- Mark `prose-backed` if only quarantined spec prose backs it (never report `prose-backed` as `fresh`).
- Mark `contradicted` when a pinned code fact explicitly conflicts with the doc claim (will be escalated to the second-pass judge).
- Mark `unbound` when no candidate fact covers the statement.
- Preserve recorded editorial decisions (`{{productCode}}-ALL-D-*`) when sections intentionally group surfaces or hide plumbing.

## Docs pieces and candidate facts

{{piecesBlock}}
