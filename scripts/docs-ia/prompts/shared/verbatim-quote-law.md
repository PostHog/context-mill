## Verbatim quote law and anti-bloat rules

1. Every `quote` must be a single line (no newlines), at least 10 characters, copied byte-for-byte from the pinned definition without line numbers.
2. Never quote bare 1-token tags or generic handler props (`<LemonButton`, `<LemonSelect`, `onChange={onChange}`, `return`, `else {`). Quote the distinctive field name, label, guard condition, or handler.
3. Combine `if (cond): doAction()` into one fact (`guard`, `branch`, or `error`) instead of splitting the condition and body into duplicate facts.
4. Write every `claim` from the outside in: what a user, API caller, or SDK developer sees, passes, or gets back. Leave internal code provenance to the detached pin and `quote`.
5. Never skip exported public enums, event property schemas, SDK method signatures, or serializer field contracts into `no_behavior`. Emit them as `schema` facts.
