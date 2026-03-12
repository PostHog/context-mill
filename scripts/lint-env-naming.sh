#!/usr/bin/env bash
#
# Lints example apps for deprecated environment variable naming patterns.
# Emits GitHub Actions warnings but never fails the build (always exits 0).
#
# Usage: bash scripts/lint-env-naming.sh [basics-directory]

set -euo pipefail

BASICS_DIR="${1:-basics}"
WARNINGS=0

if [ ! -d "$BASICS_DIR" ]; then
  echo "::warning::Basics directory not found: $BASICS_DIR"
  exit 0
fi

# Deprecated patterns: env var name on left, replacement on right
DEPRECATED_PATTERNS=(
  "POSTHOG_API_KEY:POSTHOG_PROJECT_TOKEN"
  "_POSTHOG_KEY:_POSTHOG_PROJECT_TOKEN"
)

# Files/patterns to skip (SDK interface names, not env vars)
SKIP_PATTERNS=(
  "posthog\.api_key"
  "config\.api_key"
  "api_key:"
  "api_key ="
  "'api_key'"
  "\"api_key\""
  "PERSONAL_API_KEY"
)

check_file() {
  local file="$1" pattern="$2" replacement="$3"
  local rel_path="${file#./}"

  while IFS=: read -r line_num line_content; do
    # Check if this line matches any skip pattern
    local skip=false
    for skip_pat in "${SKIP_PATTERNS[@]}"; do
      if echo "$line_content" | grep -qiP "$skip_pat" 2>/dev/null || \
         echo "$line_content" | grep -qi "$skip_pat" 2>/dev/null; then
        skip=true
        break
      fi
    done

    if [ "$skip" = false ]; then
      echo "::warning file=${rel_path},line=${line_num}::Deprecated env var pattern '${pattern}' found. Use '${replacement}' instead."
      WARNINGS=$((WARNINGS + 1))
    fi
  done < <(grep -n "$pattern" "$file" 2>/dev/null || true)
}

echo "Scanning example apps for deprecated env var naming patterns..."

for entry in "${DEPRECATED_PATTERNS[@]}"; do
  pattern="${entry%%:*}"
  replacement="${entry#*:}"

  while IFS= read -r -d '' file; do
    check_file "$file" "$pattern" "$replacement"
  done < <(find "$BASICS_DIR" -type f \( \
    -name '*.env*' -o -name '*.md' -o -name '*.js' -o -name '*.ts' \
    -o -name '*.tsx' -o -name '*.jsx' -o -name '*.py' -o -name '*.rb' \
    -o -name '*.php' -o -name '*.yaml' -o -name '*.yml' -o -name '*.erb' \
    -o -name '*.swift' -o -name '*.kt' -o -name '*.kts' -o -name '*.gradle' \
    -o -name '*.xcscheme' -o -name '*.d.ts' -o -name '*.svelte' -o -name '*.vue' \
    -o -name '*.astro' \
  \) -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/build/*' -print0)
done

echo "---"
if [ "$WARNINGS" -gt 0 ]; then
  echo "Found $WARNINGS deprecated env var naming pattern(s). Please update to the new naming convention."
else
  echo "PASSED: No deprecated env var naming patterns found."
fi

exit 0
