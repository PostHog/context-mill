# Judge drifted symbols and affected claims (`{{product}}`)

The deterministic two-gate refresh already marked every unchanged symbol `fresh` at 0 LLM calls. Inspect ONLY the changed, added, or removed symbols in the worklist below and determine:
1. Whether this is a behavior-preserving refactor (`no_behavior_change`) or a real external behavior change (`behavior_changed` / `reverse_docs_contradiction`).
2. Which existing facts update or retire (`rename`, `delete`, `split`, `merge`, `sunset`) with forward pointers.
3. Which bound docs claims and pages are affected.

{{include:shared/pointing-and-calling.md}}

{{include:shared/verbatim-quote-law.md}}

{{include:shared/source-quarantine.md}}

## Bound deterministic tools available to you

{{boundToolsList}}

## Drifted worklist and blast radius

{{worklistBlock}}
