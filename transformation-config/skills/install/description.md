# Add the PostHog SDK to the manifest

Declare PostHog in the project's package manifest directly. Do not run the package
manager, and do not build — the build task installs and verifies at the end.
Adding it to the manifest now keeps this step fast and batches the real install
into one place.

- For a web or JavaScript framework app, add `posthog-js` to `dependencies`.
- If the app has server-side code that should send events, also add
  `posthog-node`.
- Use a current, valid version range (e.g. `^1.x` for posthog-js). Match the
  style of the other dependencies already in the manifest.

Read the manifest first. If the dependency is already declared, leave it as is and
say so. Edit only the manifest — no lockfile, no install command.

## Reference

{references}
