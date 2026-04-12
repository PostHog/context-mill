# PostHog Revenue Analytics — Stripe Setup

This skill connects Stripe revenue data to PostHog by adding `posthog_person_distinct_id` metadata to Stripe objects. This enables the Top Customers dashboard, `persons_revenue_analytics` table, and `groups_revenue_analytics` table in PostHog.

## Reference files

{references}

Consult the PostHog revenue analytics documentation for the full setup guide, and the Stripe API docs for language-specific code examples.

## Guiding tenets

Follow these tenets for every decision:

1. **Never fabricate the value.** If the PostHog distinct_id is not available in the current scope, do NOT substitute another identifier (Stripe customer ID, internal user ID, org ID, etc.). A wrong value is worse than no value — it corrupts metadata and blocks correct identification downstream.

2. **Thread the value, don't invent it.** If a function needs the distinct_id but doesn't have it, add it as an optional parameter propagated from a caller that does. If no caller in the chain has it, skip that call site entirely and leave a TODO comment.

3. **No extra API calls.** Never add new Stripe API calls (like `Customer.update`) just to set metadata. Instead, add `posthog_person_distinct_id` to the `metadata` parameter of Stripe objects that are already being created.

4. **Follow existing Stripe abstraction patterns.** If the codebase wraps Stripe calls behind a utility/service layer, modify that layer. Don't call the Stripe API directly from business logic just to set metadata.

5. **Never refactor unrelated existing code.** The only parts of the codebase that should be changed are the ones immediately related to getting PostHog distinct_id into Stripe calls. All remaining code should be left as is regardless.

## How to find the PostHog distinct_id

Before writing any code, determine what this project uses as the PostHog distinct_id:

1. Search for `posthog.identify(` — the **first argument** is the distinct_id. This is the most reliable source.
   - Example: `posthog.identify(email, { ... })` → the distinct_id is `email`
   - Example: `posthog.identify(user.id, { ... })` → the distinct_id is `user.id`
2. Search for `posthog.capture(` or `client.capture(` — look for `distinctId` or `distinct_id` in the arguments.
3. Search for `posthog.get_distinct_id()` — the variable it's assigned to tells you what holds the distinct_id.

Once you know WHAT value is the distinct_id, determine HOW to access that same value at each Stripe call site. The variable name may differ between files — trace the data flow.

**Watch out!** Stripe's Checkout Sessions have a field called `client_reference_id`. This field **MAY NOT** be the same as PostHog distinct_id, so do not use it as a way to figure out what the distinc_id should be.

## What to modify

### Step 1: Add metadata to Stripe Customer creation

For each `Customer.create` call, add `posthog_person_distinct_id` to the `metadata` parameter.

- If the call already has a metadata object, ADD the `posthog_person_distinct_id` key. Do NOT overwrite existing metadata.
- If the distinct_id is not in scope, thread it as an optional parameter (Tenet 2). If no caller has it, skip this site with a TODO.
- Check if the codebase wraps Stripe calls behind a utility layer — if so, modify the wrapper (Tenet 4).

### Step 2: Add metadata to Stripe payment/charge objects (REQUIRED)

This step is **required**. The following Stripe objects support a `metadata` parameter: **Charge, PaymentIntent, Subscription, Invoice, Refund, Transfer**. Search the codebase for creation calls for any of these objects and add `posthog_person_distinct_id` to their `metadata`.

This does NOT require any new API calls — just add the metadata field to the existing create calls that the app already makes. Same pattern as Step 1: add `posthog_person_distinct_id` to the `metadata` parameter.

- If the distinct_id is not in scope at a call site, thread it as an optional parameter (Tenet 2).
- If the codebase wraps these calls behind a utility layer, modify the wrapper (Tenet 4).

### Stripe Checkout special case

If the project uses `checkout.Session.create`, add `posthog_person_distinct_id` to the session's `metadata` parameter. Also set `client_reference_id` to the user's distinct_id so it can be retrieved in webhooks.

If the project has a `checkout.session.completed` webhook handler and Stripe auto-creates customers there, add the metadata to the customer in the webhook handler.

### Step 3: Verify

Read each modified file to verify:

- No syntax errors
- Existing code logic is preserved
- The metadata uses the correct distinct_id value — not a fabricated property
- No new Stripe API calls were added (Tenet 3) — only existing calls were modified
- Changes respect existing abstraction patterns (Tenet 4)

## Constraints

- Do NOT add new Stripe API calls — only add metadata to existing create calls.
- Do NOT modify charge/payment logic — only add the metadata field.
- Do NOT remove any existing code.
- Do NOT add new packages or dependencies.
- Do NOT invent properties or values. Use only values that already exist in the codebase.
- Preserve all imports and error handling.
- If you truly cannot determine the distinct_id after searching, use `"TODO_POSTHOG_DISTINCT_ID"` as a string placeholder.

## Status

Report progress with `[STATUS]` prefixed messages:

- Searching for PostHog distinct_id usage
- Identified distinct_id — updating Stripe Customer creation
- Adding metadata to payment/charge objects
- Verifying changes
- Revenue analytics setup complete

## Framework guidelines

{commandments}
