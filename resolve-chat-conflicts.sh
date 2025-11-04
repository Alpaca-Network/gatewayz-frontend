#!/bin/bash

# Script to resolve chat page merge conflicts
# This merges feat/chat-page-mobile-design with master intelligently

echo "Starting conflict resolution for chat page..."

# Fetch latest from both branches
git fetch origin feat/chat-page-mobile-design
git fetch origin master

# Check out the mobile design branch
git checkout feat/chat-page-mobile-design

# Try to merge master
echo "Attempting to merge master..."
git merge origin/master --no-commit --no-ff || true

# Check if there are conflicts
if git diff --name-only --diff-filter=U | grep -q "src/app/chat/page.tsx"; then
    echo "Conflicts detected in chat page. Resolving..."

    # We'll resolve by taking mobile optimizations + master features
    # The resolution strategy:
    # 1. Keep mobile sidebar with onClose
    # 2. Keep VirtualSessionList from master for performance
    # 3. Keep mobile-optimized header
    # 4. Keep video/audio support from master
    # 5. Merge styling from both

    echo "Please manually review the conflicts in src/app/chat/page.tsx"
    echo "Key conflicts to resolve:"
    echo "  - Line ~673: ChatSidebar signature - ADD onClose parameter"
    echo "  - Line ~875: Use VirtualSessionList from master"
    echo "  - Line ~1053: Keep mobile header layout"
    echo "  - Line ~1196: Merge message rendering styles"
    echo "  - Line ~1364: Keep all upload buttons (image/video/audio)"

    exit 1
else
    echo "No conflicts found or already resolved!"
fi
