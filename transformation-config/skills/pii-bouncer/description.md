# PII Bouncer

This skill hardens a frontend project against **PII leaking into session
replay and autocapture**. It edits project source: it adds the
`ph-no-capture` class to sensitive elements and tightens the masking options
on `posthog.init`. The only file it *creates* is the final report.

This is the prevention layer that complements PostHog's other PII defenses:
the security scanner stops PII being **sent as event properties**; this skill
stops PII being **recorded in the DOM** (replay) or **read by autocapture**.

## What posthog-js already does (don't undo it)

Read the bundled reference docs — `references/privacy.md` and
`references/config.md` — for the authoritative API and defaults. The two facts
that shape this skill:

- **`maskAllInputs` defaults to `true`.** Every `<input>` value is already
  masked in replay out of the box. Your job is **not** to "turn on input
  masking" — it's to (a) confirm nobody disabled it, and (b) cover the
  surfaces defaults miss.
- **General text is NOT masked by default.** Sensitive content rendered as
  text (an SSN on a profile page, an order total, an account balance) is
  recorded verbatim unless you mask it. This is the main gap to close.

So the value this skill adds is: masking sensitive **text**, blocking
sensitive **non-input elements**, and verifying the input default is intact —
not restating defaults.

## The two mechanisms

1. **`ph-no-capture` (CSS class)** — add it to an element and that element is
   replaced by a same-size placeholder block in replay, **and** autocapture is
   disabled for it. Use for discrete sensitive elements (a card-number field,
   a div showing an SSN, a billing summary). This is a class, not an
   attribute — in JSX use `className="ph-no-capture"`, everywhere else
   `class="ph-no-capture"`. **Merge** it into any existing class list; never
   clobber existing classes.
   - Do **not** confuse this with the `data-ph-no-capture` *attribute*, which
     is a separate, autocapture-only opt-out. For replay masking, use the
     **class**.

2. **Init mask config** (`posthog.init(token, { session_recording: { … } })`)
   — project-wide masking. The high-value option here is `maskTextSelector`
   (e.g. `"*"` to mask all text, or a scoped selector for sensitive regions).
   Confirm `maskAllInputs` is not set to `false`. Use the exact option names
   and defaults from `references/config.md` — do not guess them.

## Workflow

Emit a `[STATUS]` line (see below) as you enter each phase. Before phase 1,
read `references/privacy.md` and `references/config.md` — they are the source
of truth for the masking option names and defaults.

1. **Confirm prerequisites.** If `posthog-js` is not a dependency anywhere,
   emit `[ABORT] no-posthog-js`. Find the `posthog.init(...)` call; if there
   is none, emit `[ABORT] no-init-call`. Enumerate frontend templates
   (`.jsx` / `.tsx` / `.vue` / `.svelte` / `.astro` / `.html`); if none exist,
   emit `[ABORT] no-frontend-templates`.
2. **Scan templates** for sensitive elements using the heuristic below.
3. **Mask elements.** Add the `ph-no-capture` class (framework-correct
   attribute) to each sensitive element. Minimal diffs — touch only the
   class attribute, merge don't clobber, skip anything already marked.
4. **Tighten init.** In the `session_recording` options, confirm
   `maskAllInputs` is not `false`, and add `maskTextSelector` covering
   sensitive text (prefer a scoped selector; use `"*"` when sensitive text is
   widespread). Do not duplicate an option that is already set.
5. **Write the report** to `./posthog-pii-bouncer-report.md`.

## Sensitive-element heuristic

Conservative bias: **when a signal matches, mask it.** Over-masking only
over-protects; under-masking leaks PII. Treat an element as sensitive when
any of these hold:

| Signal | Matches |
|---|---|
| `type` | `password`, `email`, `tel` |
| `autocomplete` | `current-password`, `new-password`, `cc-number`, `cc-csc`, `cc-exp`, `email`, `tel`, `one-time-code`, `ssn` |
| `name` / `id` | matches `/pass(word)?\|pwd\|card\|cc[-_]?(num\|number)\|cvv\|cvc\|csc\|ssn\|sin\|nin\|pin\|dob\|birth\|tax\|passport\|iban\|account[-_]?(num\|number)/i` |
| label / `aria-label` | text contains "password", "credit card", "card number", "CVV/CVC", "SSN", "social security", "date of birth", "bank account", "routing" |
| placeholder | matches the same terms as label |
| rendered text | an element whose static text obviously prints PII (SSN, full card number, bank account) — mask via `ph-no-capture` or a scoped `maskTextSelector` |

When unsure whether a field is sensitive, mask it.

## Idempotency

This skill must be safe to run repeatedly. Before editing, check whether an
element already has `ph-no-capture` (or sits inside a blocked ancestor) and
whether the init already sets the option — if so, skip it. A second run must
produce **zero** changes.

## Live activity — `[STATUS]`

The wizard's "Working on …" banner reads `[STATUS]` lines you emit in plain
text. Emit one as you enter each phase, e.g.:

```
[STATUS] Scanning templates for sensitive inputs
[STATUS] Masking 4 sensitive elements
[STATUS] Tightening session_recording config
[STATUS] Writing report
```

## Abort statuses

Emit these `[ABORT]` lines verbatim when the condition holds, then stop. The
wizard catches them and renders the outro — do not halt yourself otherwise.

- `[ABORT] no-posthog-js` — `posthog-js` is not installed anywhere.
- `[ABORT] no-init-call` — no `posthog.init(...)` call found.
- `[ABORT] no-frontend-templates` — no `.jsx` / `.tsx` / `.vue` / `.svelte` /
  `.astro` / `.html` files found.

These strings are a contract with the wizard, which routes each one to a
specific outro. Keep them in sync with the consuming side — see (in the
PostHog/wizard repo) `src/lib/programs/pii-bouncer/abort-cases.ts`.

## Report

Write `./posthog-pii-bouncer-report.md` covering:

- **Elements masked** — for each, the `file:line`, the element, and which
  heuristic signal matched.
- **Init changes** — the exact `session_recording` options added or confirmed.
- **Reviewed but skipped** — elements you considered and deliberately left
  alone, with a one-line rationale (so a human can spot a wrong call).
- **Manual follow-ups** — anything needing human judgment (e.g. a dynamic
  list that may render PII, a third-party iframe replay can't reach).

## Key principles

- **Minimal diffs.** Touch only the class attribute and the init options.
  Never reformat surrounding code.
- **Merge, don't clobber.** Append `ph-no-capture` to existing class lists.
- **Evidence in the report.** Every masked element cites `file:line` and the
  signal that matched.
- **Authoritative API.** Use the bundled `references/privacy.md` and
  `references/config.md` for exact option names and defaults; never invent
  option names.

## Framework guidelines

{commandments}
