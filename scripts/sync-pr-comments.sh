#!/bin/bash
set -euo pipefail

# Sync PR Comments to Terragon Task
# Usage: ./scripts/sync-pr-comments.sh [PR_NUMBER]
#
# If no PR number is provided, uses the current branch's PR.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    log_error "Not authenticated with GitHub CLI. Run 'gh auth login' first."
    exit 1
fi

# Get PR number
PR_NUMBER="${1:-}"

if [ -z "$PR_NUMBER" ]; then
    log_info "No PR number provided, detecting from current branch..."
    PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")

    if [ -z "$PR_NUMBER" ]; then
        log_error "No PR found for current branch. Please provide a PR number."
        echo "Usage: $0 [PR_NUMBER]"
        exit 1
    fi
fi

log_info "Fetching comments for PR #$PR_NUMBER..."

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
log_info "Repository: $REPO"

# Get PR details
log_info "Fetching PR details..."
PR_TITLE=$(gh pr view "$PR_NUMBER" --json title -q '.title')
PR_URL=$(gh pr view "$PR_NUMBER" --json url -q '.url')
PR_AUTHOR=$(gh pr view "$PR_NUMBER" --json author -q '.author.login')
PR_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName -q '.headRefName')

echo ""
echo "=== PR Details ==="
echo "Title:  $PR_TITLE"
echo "URL:    $PR_URL"
echo "Author: @$PR_AUTHOR"
echo "Branch: $PR_BRANCH"
echo ""

# Create output directory
OUTPUT_DIR=".terragon/pending-tasks"
mkdir -p "$OUTPUT_DIR"

# Create task file
TIMESTAMP=$(date +%Y%m%d%H%M%S)
TASK_FILE="$OUTPUT_DIR/pr-${PR_NUMBER}-${TIMESTAMP}.md"

# Start building the task file
cat << EOF > "$TASK_FILE"
---
title: "Address PR #${PR_NUMBER} feedback: ${PR_TITLE}"
pr_number: ${PR_NUMBER}
pr_url: "${PR_URL}"
branch: "${PR_BRANCH}"
created_at: "$(date -Iseconds)"
status: pending
---

# PR Comments Summary

**PR**: [${PR_TITLE}](${PR_URL})
**Author**: @${PR_AUTHOR}
**Branch**: \`${PR_BRANCH}\`

---

EOF

# Collect inline review comments
log_info "Fetching inline code review comments..."
INLINE_COMMENTS=$(gh api "repos/$REPO/pulls/$PR_NUMBER/comments" 2>/dev/null || echo "[]")
INLINE_COUNT=$(echo "$INLINE_COMMENTS" | jq 'length')

echo "## Code Review Comments ($INLINE_COUNT)" >> "$TASK_FILE"
echo "" >> "$TASK_FILE"

if [ "$INLINE_COUNT" -gt 0 ]; then
    echo "$INLINE_COMMENTS" | jq -r '.[] | "### `\(.path)`:\(.line // .original_line // "N/A")\n**@\(.user.login)** at \(.created_at)\n\n> \(.body | gsub("\n"; "\n> "))\n"' >> "$TASK_FILE"
else
    echo "_No inline comments_" >> "$TASK_FILE"
fi
echo "" >> "$TASK_FILE"

# Collect PR reviews
log_info "Fetching PR reviews..."
REVIEWS=$(gh pr view "$PR_NUMBER" --json reviews 2>/dev/null || echo '{"reviews":[]}')
REVIEW_COMMENTS=$(echo "$REVIEWS" | jq '[.reviews[] | select(.body != "")]')
REVIEW_COUNT=$(echo "$REVIEW_COMMENTS" | jq 'length')

echo "## Reviews ($REVIEW_COUNT)" >> "$TASK_FILE"
echo "" >> "$TASK_FILE"

if [ "$REVIEW_COUNT" -gt 0 ]; then
    echo "$REVIEW_COMMENTS" | jq -r '.[] | "### \(.state) by @\(.author.login)\n\n> \(.body | gsub("\n"; "\n> "))\n"' >> "$TASK_FILE"
else
    echo "_No reviews with comments_" >> "$TASK_FILE"
fi
echo "" >> "$TASK_FILE"

# Collect general PR comments
log_info "Fetching discussion comments..."
DISCUSSION_COMMENTS=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" 2>/dev/null || echo "[]")
DISCUSSION_COUNT=$(echo "$DISCUSSION_COMMENTS" | jq 'length')

echo "## Discussion Comments ($DISCUSSION_COUNT)" >> "$TASK_FILE"
echo "" >> "$TASK_FILE"

if [ "$DISCUSSION_COUNT" -gt 0 ]; then
    echo "$DISCUSSION_COMMENTS" | jq -r '.[] | "**@\(.user.login)** at \(.created_at)\n\n> \(.body | gsub("\n"; "\n> "))\n"' >> "$TASK_FILE"
else
    echo "_No discussion comments_" >> "$TASK_FILE"
fi
echo "" >> "$TASK_FILE"

# Add instructions
cat << 'EOF' >> "$TASK_FILE"

---

## Instructions

1. Review each comment above
2. Address code review comments by making the requested changes
3. Respond to questions in the PR
4. Mark resolved comments as resolved in GitHub
5. Request re-review when ready

## Checklist

- [ ] All inline code comments addressed
- [ ] All review feedback addressed
- [ ] All questions answered
- [ ] Tests updated if needed
- [ ] Re-review requested
EOF

# Summary
TOTAL_COUNT=$((INLINE_COUNT + REVIEW_COUNT + DISCUSSION_COUNT))

echo ""
echo "=== Summary ==="
echo "Inline code comments: $INLINE_COUNT"
echo "Reviews with comments: $REVIEW_COUNT"
echo "Discussion comments:   $DISCUSSION_COUNT"
echo "----------------------------"
echo "Total comments:        $TOTAL_COUNT"
echo ""

if [ "$TOTAL_COUNT" -eq 0 ]; then
    log_warn "No comments found on this PR."
    rm "$TASK_FILE"
    exit 0
fi

log_success "Task file created: $TASK_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the task file: cat $TASK_FILE"
echo "  2. Address each comment in the PR"
echo "  3. Use Claude Code to help: claude '$TASK_FILE'"
echo ""

# Optionally output for piping to clipboard
if [ "${COPY_TO_CLIPBOARD:-false}" = "true" ]; then
    if command -v pbcopy &> /dev/null; then
        cat "$TASK_FILE" | pbcopy
        log_success "Task content copied to clipboard!"
    elif command -v xclip &> /dev/null; then
        cat "$TASK_FILE" | xclip -selection clipboard
        log_success "Task content copied to clipboard!"
    fi
fi
