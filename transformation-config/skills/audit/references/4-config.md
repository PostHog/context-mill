# Step 4 — Read the bounded config set

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly one action: read a fixed, short list of config files. This list is the complete remaining evidence base for the installation phase.

## TodoWrite

Update the in-progress task's `activeForm` to `Reading framework config`. Status and content stay the same.

## Action

`Read` whichever of these exist (skip the rest — do not search elsewhere):

1. `.env`, `.env.example`, `.env.local` — for the API-key location.
2. The framework's main config file, by exact name:
   - Next.js: `next.config.js` / `next.config.ts` / `next.config.mjs`
   - Vite: `vite.config.ts`
   - Astro: `astro.config.mjs`
   - Nuxt: `nuxt.config.ts`
   - Angular: `app.module.ts`
   - Django: `settings.py`
   - Rails: `config/initializers/posthog.rb`
   - (Other frameworks: the equivalent single config file.)

If a file from this list isn't in the project, skip it. Do not Glob, Grep, or Bash to find alternatives. The set above + the manifests from Step 2 + the init-site files from Step 3 is the complete installation-phase evidence base.

## Status

Status to report in this phase:

- Reading bounded config set

---

**Upon completion, continue with:** [5-resolve.md](5-resolve.md)
