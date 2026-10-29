#!/usr/bin/env bash
#
# Fails when the branch changes an agent prompt under context/agents/ (the README excepted).
# The wizard bundles its own copy; this one is frozen for wizard versions that fetch their prompts.
# With AGENTS_FREEZE_OVERRIDE=true (CI sets it from the agents-freeze-override label) it passes with a warning.
#
# Usage: bash scripts/check-agents-frozen.sh [base-ref]   (default: origin/main)

set -euo pipefail

BASE_REF="${1:-origin/main}"

CHANGED=$(git diff --name-only "${BASE_REF}...HEAD" -- context/agents | grep -v '^context/agents/README\.md$' || true)

if [ -z "$CHANGED" ]; then
  echo "No changes to frozen agent prompts in context/agents/."
  exit 0
fi

if [ "${AGENTS_FREEZE_OVERRIDE:-}" = "true" ]; then
  echo "::warning::Frozen agent prompts changed under the agents-freeze-override label. Make the same fix in the wizard repo, at src/programs/<id>/agent/."
  echo "Changed files:"
  echo "$CHANGED" | sed 's/^/  - /'
  exit 0
fi

echo "::error::Agent prompts in context/agents/ are frozen. Make the change in the wizard repo, at src/programs/<id>/agent/. An urgent fix for wizard versions that fetch these prompts can land here with the agents-freeze-override label, plus the same fix in the wizard."
echo "Changed files:"
echo "$CHANGED" | sed 's/^/  - /'
exit 1
