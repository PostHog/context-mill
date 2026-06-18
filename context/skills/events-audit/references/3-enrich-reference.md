# Step 3 enrichment reference

Lookup tables and rules subagents apply during step 3 enrichment. Read this file **once** at the start of your enrichment run.

This file is supporting material for step 3; it has no `next_step` and is not part of the main step chain. The orchestrator does not read it.

The per-SDK capture call signatures (where `event_name` and `properties` live in each SDK's call shape) are in `2-scan.md` under "Per-SDK call signatures". Read that section once at the start of your enrichment run alongside this file — you'll need it to extract `event_name` and `properties`.

## Identification surfaces

Set `call_kind` according to the call:

- `posthog.identify(distinctId, $set, $set_once)` → `identify`
- `posthog.setPersonProperties({ ... })` → `set`
- `posthog.setPersonPropertiesForFlags` → `set_once`
- `posthog.group(type, key, properties)` → `group`
- `posthog.alias(alias, distinctId)` → `alias`
- `posthog.reset()` → `reset` (no event name; the identity check uses presence to score cross-device hygiene)

## `package` rules

Compute `package` **before** `area`. Match the first prefix below; everything after the package segment is what `area` rules operate on.

| Path prefix | `package` |
|---|---|
| `apps/<name>/...` | `<name>` |
| `packages/<name>/...` | `<name>` |
| `services/<name>/...` | `<name>` |
| `projects/<name>/...` | `<name>` |
| `client/...`, `server/...`, `frontend/...`, `backend/...`, `web/...`, `mobile/...`, `api/...`, `shared/...` | the prefix itself |
| Anything else | `null` |

Examples:
- `apps/web/components/Checkout.tsx` → `package: "web"`, `area` rules see `components/Checkout.tsx`.
- `client/src/components/auth/AuthProvider.tsx` → `package: "client"`, `area` rules see `src/components/auth/AuthProvider.tsx`.
- `src/checkout/Checkout.tsx` → `package: null`, `area` rules see the original path.

Don't fabricate a package from `src/` or `app/` — those are within-package directories.

## `area` rules

After `package` extraction, strip one leading `src/`, `app/`, or `pages/` from the remaining path. Then apply the first matching rule:

| Path shape after stripping | `area` |
|---|---|
| `app/<x>/...` (Next.js app router) | `<x>` |
| `pages/<x>/...` (Next.js pages router) | `<x>` (use `api/<seg>` for `pages/api/<seg>/...`) |
| `components/<x>/...` | `<x>` |
| `features/<x>/...` | `<x>` |
| `screens/<x>/...` | `<x>` (mobile) |
| `routes/<x>/...`, `views/<x>/...`, `controllers/<x>/...` (backend) | `<x>` |
| `hooks/...`, `lib/...`, `utils/...`, `analytics/...`, `services/...`, `helpers/...` | `shared` |
| `app/layout.tsx`, `app/template.tsx`, `_app.tsx`, `_document.tsx`, `app/error.tsx`, `app/not-found.tsx` | `global` |
| Anything else | first path segment after stripping, lowercased |

Strip only the first matching prefix.

## `route` rules (Next.js only)

- `app/foo/page.tsx` → `/foo`
- `app/foo/bar/page.tsx` → `/foo/bar`
- `app/foo/[id]/page.tsx` → `/foo/[id]`
- `app/(group)/foo/page.tsx` → `/foo` (route groups in parens are ignored)
- `pages/foo.tsx` → `/foo`
- `pages/foo/[id].tsx` → `/foo/[id]`
- `pages/api/<rest>` → `/api/<rest>` (without the file extension)

Set `route: null` for any path that isn't router-shaped. Don't fabricate routes for non-Next.js codebases.

## `enclosing` rules

Backward-scan from the capture line. Match these patterns (first match wins above the capture line):

- `function (\w+)\(` (named function)
- `const (\w+) = \(?` / `const (\w+) = async`
- `export (?:default )?function (\w+)\(`
- `export const (\w+) = `
- `class (\w+)`
- `def (\w+)\(` (Python)
- `func (\w+)\(` (Go / Swift)
- `fun (\w+)\(` (Kotlin)
- `def (\w+)` (Ruby)

Take the closest match above the capture line at column 0 or one indent level deeper than the capture's expected wrapper. If nothing matches within ~80 lines above, set `enclosing: null`. Don't read more file context to chase it.

For unnamed default exports (`export default function () { ... }`), use the file's basename without extension as the enclosing name (e.g. `CheckoutPage`).
