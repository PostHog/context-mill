# Shakespeare Quote Skill

This skill adds a single code comment containing a line from Shakespeare to
one file in the user's project. It exists to demonstrate how a context-mill
skill is built, packaged, and consumed by a wizard program — not to produce
anything useful.

## Reference files

{references}

## Instructions

1. Read `references/quotes.md` and pick one quote — any one, your choice.
2. Pick the single most prominent source file in the project (e.g. the main
   entry point, or the file the project's README points to first).
3. Insert exactly one comment near the top of that file (after imports,
   before the first function or export) containing the quote text and its
   play in parentheses. Use the correct comment syntax for the file's
   language:
   - JavaScript/TypeScript: `// "..." (Hamlet)`
   - Python: `# "..." (Hamlet)`
   - HTML: `<!-- "..." (Hamlet) -->`
   - CSS: `/* "..." (Hamlet) */`
   - Ruby/Go/Rust: use that language's single-line comment syntax
   - For any other language, use the appropriate single-line comment syntax.

## Constraints

- Add exactly one comment, in exactly one file.
- Do NOT modify any existing code logic — only insert the comment line.
- Do NOT add the comment to generated files, lock files, or node_modules.
- Do NOT remove or change any existing comments.

## Publish the handoff

When the comment is placed, publish a short report with a single
`publish_handoff` call: a markdown doc (H1 heading first) naming the file,
the line, and the quote that was inserted. Do not write a report file — the
tool publishes the report to the wizard session; that one call is the whole
handoff.

## Status

Report progress with `[STATUS]` prefixed messages:

- Reading Shakespeare quotes
- Adding quote comment to {filename}
- Publishing report
- Exeunt
