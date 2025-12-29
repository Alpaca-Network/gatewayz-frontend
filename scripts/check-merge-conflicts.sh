#!/bin/bash
#
# Check for merge conflict markers in the repository
# Exits with code 0 if no conflicts, 1 if conflicts found
# Outputs conflicted files to stdout

set -e

# Primary method: Check git diff for unmerged files (most reliable during merge)
CONFLICTED_FILES=$(git diff --diff-filter=U --name-only 2>/dev/null || echo "")

# Secondary method: Search for actual conflict markers in files
# Exclude common files that document conflict markers (like this script)
if [ -z "$CONFLICTED_FILES" ]; then
  # Use grep to find conflict markers, excluding documentation and this script
  CONFLICTED_FILES=$(git grep -l '^<<<<<<< HEAD' 2>/dev/null | \
    grep -v "scripts/check-merge-conflicts.sh" | \
    grep -v "MERGE_CONFLICT" | \
    grep -v "\.md$" || echo "")
fi

if [ -z "$CONFLICTED_FILES" ]; then
  echo "✅ No merge conflicts detected"
  exit 0
else
  echo "❌ Merge conflicts detected in the following files:"
  echo "$CONFLICTED_FILES" | while read file; do
    [ -n "$file" ] && echo "  - $file"
  done
  # Output JSON for GitHub Actions
  FILES_JSON=$(echo "$CONFLICTED_FILES" | grep -v '^$' | jq -R -s -c 'split("\n")[:-1]' 2>/dev/null || echo '[]')
  echo "conflicted_files=$FILES_JSON" >> $GITHUB_OUTPUT 2>/dev/null || true
  exit 1
fi
