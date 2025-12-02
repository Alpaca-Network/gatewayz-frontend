#!/bin/bash
set -euo pipefail

# Configuration
TMP_DIR="./tmp"
REPO_DIR="$TMP_DIR/superpowers"
REPO_URL="https://github.com/obra/superpowers"
CLAUDE_DIR="./.claude"

echo "=== Superpowers Sync Script ==="

# Step 1: Clone or update the repository
if [ -d "$REPO_DIR" ]; then
    echo "📥 Repository exists, pulling latest changes..."
    if ! git -C "$REPO_DIR" pull; then
        echo "❌ Error: Failed to pull repository updates"
        exit 1
    fi
    echo "✅ Repository updated successfully"
else
    echo "📦 Creating tmp directory if needed..."
    mkdir -p "$TMP_DIR"
    
    echo "📥 Cloning repository..."
    if ! git clone "$REPO_URL" "$REPO_DIR"; then
        echo "❌ Error: Failed to clone repository"
        exit 1
    fi
    echo "✅ Repository cloned successfully"
fi

# Step 2: Sync .claude folder
echo "📁 Creating .claude directory if needed..."
mkdir -p "$CLAUDE_DIR"

echo "🔄 Syncing .claude folder from superpowers..."
if ! rsync -av --preserve-permissions "$REPO_DIR/.claude/" "$CLAUDE_DIR/"; then
    echo "❌ Error: Failed to sync .claude folder"
    exit 1
fi
echo "✅ .claude folder synced successfully"

echo ""
echo "=== Sync Complete ==="
echo "The .claude folder has been updated with the latest superpowers content."

# TODO: Add a check for merge conflicts into the GitHub Actions CI pipeline
# Ensure that this check runs after the .claude sync step and fails the pipeline if conflicts are detected
# Example implementation:
#   - Add a step in .github/workflows/ci.yml that runs after this sync script
#   - Use `git diff --check` to detect conflict markers
#   - Fail the pipeline if any conflicts are found
