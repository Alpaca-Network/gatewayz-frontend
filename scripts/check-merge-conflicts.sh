#!/bin/bash
#
# Check for merge conflict markers in the repository
# Exits with code 0 if no conflicts, 1 if conflicts found
# Outputs conflicted files to stdout

set -e

# Find all files with merge conflict markers
CONFLICT_MARKERS='<<<<<<< HEAD|=======|>>>>>>> '
CONFLICTED_FILES=$(git diff --diff-filter=U --name-only 2>/dev/null || echo "")

# Also search for actual merge markers in files
if [ -z "$CONFLICTED_FILES" ]; then
  # Use grep to find conflict markers in tracked files
  CONFLICTED_FILES=$(git grep -l "$CONFLICT_MARKERS" 2>/dev/null || echo "")
fi

if [ -z "$CONFLICTED_FILES" ]; then
  echo "✅ No merge conflicts detected"
  exit 0
else
  echo "❌ Merge conflicts detected in the following files:"
  echo "$CONFLICTED_FILES" | while read file; do
    echo "  - $file"
  done
  # Output JSON for GitHub Actions
  FILES_JSON=$(echo "$CONFLICTED_FILES" | jq -R -s -c 'split("\n")[:-1]')
  echo "conflicted_files=$FILES_JSON" >> $GITHUB_OUTPUT 2>/dev/null || true
  exit 1
fi
