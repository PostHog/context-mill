# PostHog SDK {display_name}

This run targets **{display_name}**. Always follow the rules below and spot-search the bundled reference documentation.

## Guidelines

{commandments}

## Bounded reference lookup

The bundled SDK reference page is thousands of lines long. **Never** read `references/*.md` from start to finish in one call.

1. Search headings (`^##` or `^###`) or symbol/method names with `Grep` first.
2. Open only the matching slice with `Read` using `offset` and `limit` (25–40 lines).
3. Check installed package types in `node_modules` or `.venv` when present.

## Reference files

{references}
