## Source quarantine and feature-flag policy

- **Source quarantine:** Never pin a runtime fact to a documentation file (`contents/docs/`, `contents/tutorials/`, `docs/onboarding/`). Docs cannot prove themselves.
- **Feature-flag rule:** Behavior strictly behind an unreleased feature flag gets no public facts and no docs until the flag is removed. Do not emit unshipped flag-gated behavior as live product truth.
