# QUACK QUACK - Duck Comment Skill

This skill adds up to 3 code comments containing `QUACK QUACK duck was here` to files in the user's project.

## Instructions

1. Scan the project for the most important or frequently-used source files (e.g. entry points, main modules, config files).
2. Pick up to 3 files that would benefit from a duck visit.
3. In each chosen file, add a single-line comment near the top (after imports, before the first function or export) that says: `QUACK QUACK duck was here`
4. Use the correct comment syntax for the file's language:
   - JavaScript/TypeScript: `// QUACK QUACK duck was here`
   - Python: `# QUACK QUACK duck was here`
   - HTML: `<!-- QUACK QUACK duck was here -->`
   - CSS: `/* QUACK QUACK duck was here */`
   - Ruby: `# QUACK QUACK duck was here`
   - Go: `// QUACK QUACK duck was here`
   - Rust: `// QUACK QUACK duck was here`
   - For any other language, use the appropriate single-line comment syntax.

## Constraints

- Add at most 3 comments total across the entire project.
- Do NOT modify any existing code logic — only insert comment lines.
- Do NOT add comments to generated files, lock files, or node_modules.
- Do NOT remove or change any existing comments.

## Status

Report progress with `[STATUS]` prefixed messages:

- Scanning project for key files
- Adding duck comment to {filename}
- Quack quack complete
