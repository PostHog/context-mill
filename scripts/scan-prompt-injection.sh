#!/usr/bin/env bash
#
# Scans skill ZIP archives for prompt injection patterns and malicious content.
# Usage: bash scripts/scan-prompt-injection.sh [skills-directory]
#
# Exits 0 if clean, 1 if any matches found.

set -euo pipefail

SKILLS_DIR="${1:-dist/skills}"
TMPDIR_BASE=$(mktemp -d)
MATCHES_FILE=$(mktemp)

trap 'rm -rf "$TMPDIR_BASE" "$MATCHES_FILE"' EXIT

if [ ! -d "$SKILLS_DIR" ]; then
  echo "::error::Skills directory not found: $SKILLS_DIR"
  exit 1
fi

ZIP_COUNT=0
for _ in "$SKILLS_DIR"/*.zip; do
  ZIP_COUNT=$((ZIP_COUNT + 1))
done

if [ "$ZIP_COUNT" -eq 0 ]; then
  echo "::warning::No ZIP files found in $SKILLS_DIR"
  exit 0
fi

echo "Scanning $ZIP_COUNT skill archives for prompt injection patterns..."
echo ""

# Fixed-string patterns (case insensitive): "category|pattern"
FIXED_PATTERNS=(
  "direct-instruction-override|ignore previous instructions"
  "direct-instruction-override|forget your instructions"
  "direct-instruction-override|override your rules"
  "role-manipulation|act as a different"
  "role-manipulation|new instructions:"
  "wizard-specific-manipulation|do not install posthog"
  "wizard-specific-manipulation|uninstall posthog"
  "wizard-specific-manipulation|delete the posthog"
  "tool-abuse|run the following command"
  "tool-abuse|execute this shell command"
)

# Regex patterns (case insensitive, extended grep): "category|label|regex"
# These need word boundaries or context to avoid false positives on normal prose.
REGEX_PATTERNS=(
  "direct-instruction-override|disregard all|disregard all (previous|prior|above|system)"
  "role-manipulation|you are now|you are now (a|an|my) "
  "wizard-specific-manipulation|skip posthog|skip posthog[^_ a-z]"
  "wizard-specific-manipulation|remove posthog|remove posthog([^_ a-z]|$)"
  "obfuscated-injection|Base64 block (100+ chars) in comment|(//|#|/\\*)[[:space:]]*[A-Za-z0-9+/=]{100,}"
)

report_match() {
  local zip_name="$1" rel_path="$2" line_num="$3" category="$4" pattern="$5" content="$6"
  echo "::error file=${rel_path},line=${line_num}::PROMPT INJECTION DETECTED"
  echo "  Archive:  $zip_name"
  echo "  File:     $rel_path"
  echo "  Line:     $line_num"
  echo "  Category: $category"
  echo "  Pattern:  $pattern"
  echo "  Content:  ${content:0:200}"
  echo ""
  echo "1" >> "$MATCHES_FILE"
}

for zip_file in "$SKILLS_DIR"/*.zip; do
  [ -e "$zip_file" ] || continue
  zip_name=$(basename "$zip_file")
  extract_dir="$TMPDIR_BASE/${zip_name%.zip}"
  mkdir -p "$extract_dir"

  unzip -q -o "$zip_file" -d "$extract_dir" 2>/dev/null || {
    echo "::warning::Failed to extract $zip_name, skipping"
    continue
  }

  while IFS= read -r -d '' file; do
    rel_path="${file#"$extract_dir"/}"

    # Check fixed-string patterns (case insensitive)
    for entry in "${FIXED_PATTERNS[@]}"; do
      category="${entry%%|*}"
      pattern="${entry#*|}"

      grep -inF "$pattern" "$file" 2>/dev/null | head -5 | while IFS=: read -r line_num line_content; do
        report_match "$zip_name" "$rel_path" "$line_num" "$category" "\"$pattern\"" "$line_content"
      done || true
    done

    # Check regex patterns (case insensitive)
    for entry in "${REGEX_PATTERNS[@]}"; do
      category="${entry%%|*}"
      rest="${entry#*|}"
      label="${rest%%|*}"
      regex="${rest#*|}"

      grep -inE "$regex" "$file" 2>/dev/null | head -5 | while IFS=: read -r line_num line_content; do
        report_match "$zip_name" "$rel_path" "$line_num" "$category" "\"$label\"" "$line_content"
      done || true
    done

  done < <(find "$extract_dir" -type f \( \
    -name '*.md' -o -name '*.txt' -o -name '*.yaml' -o -name '*.yml' \
    -o -name '*.json' -o -name '*.js' -o -name '*.ts' -o -name '*.py' \
    -o -name '*.rb' -o -name '*.sh' \
  \) -print0)
done

echo "---"
MATCH_COUNT=$(wc -l < "$MATCHES_FILE" | tr -d ' ')
if [ "$MATCH_COUNT" -gt 0 ]; then
  echo "FAILED: $MATCH_COUNT prompt injection pattern(s) detected in skill archives."
  echo "Fix the flagged content before releasing."
  exit 1
else
  echo "PASSED: No prompt injection patterns found in $ZIP_COUNT skill archives."
  exit 0
fi
