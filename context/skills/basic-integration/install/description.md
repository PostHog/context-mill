# Add the PostHog SDK to the manifest

Declare PostHog in the project's package manifest directly. Do not run the package
manager, and do not build — the build task installs and verifies at the end.
Adding it to the manifest now keeps this step fast and batches the real install
into one place.

Add the PostHog library appropriate for the app — the client library, plus the
server library if the app has server-side code that should send events. Use the
docs and the reference example to pick the right package and a current version
range, and match the style of the dependencies already in the manifest.

Read the manifest first. If the dependency is already declared, leave it as is and
say so. Edit only the manifest — no lockfile, no install command.
