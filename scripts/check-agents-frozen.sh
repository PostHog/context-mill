#!/usr/bin/env bash
#
# Fails when the branch changes an agent prompt under context/agents/ (the README excepted).
# The wizard bundles these prompts; this copy is frozen for wizard versions already in the field.
#
# Usage: bash scripts/check-agents-frozen.sh [base-ref]   (default: origin/main)

set -euo pipefail

BASE_REF="${1:-origin/main}"

CHANGED=$(git diff --name-only "${BASE_REF}...HEAD" -- context/agents | grep -v '^context/agents/README\.md$' || true)

if [ -n "$CHANGED" ]; then
  echo "::error::Agent prompts in context/agents/ are frozen. They now live in the wizard repo at src/programs/<id>/agent/ — make the change there."
  echo "Changed files:"
  echo "$CHANGED" | sed 's/^/  - /'
  exit 1
fi

echo "No changes to frozen agent prompts in context/agents/."
