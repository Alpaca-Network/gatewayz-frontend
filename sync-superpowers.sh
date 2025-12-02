#!/bin/bash
set -euo pipefail

# Sync superpowers from https://github.com/obra/superpowers

TMP_DIR="./tmp"
SUPERPOWERS_DIR="$TMP_DIR/superpowers"
REPO_URL="https://github.com/obra/superpowers"

echo "=== Syncing Superpowers ==="

# Step 1: Clone or update the superpowers repository
if [ -d "$SUPERPOWERS_DIR" ]; then
    echo "[INFO] Superpowers directory exists. Pulling latest changes..."
    cd "$SUPERPOWERS_DIR"
    if ! git pull; then
        echo "[ERROR] Failed to pull latest changes from superpowers repo"
        exit 1
    fi
    cd - > /dev/null
else
    echo "[INFO] Creating tmp directory and cloning superpowers repo..."
    mkdir -p "$TMP_DIR"
    if ! git clone "$REPO_URL" "$SUPERPOWERS_DIR"; then
        echo "[ERROR] Failed to clone superpowers repository"
        exit 1
    fi
fi

echo "[SUCCESS] Repository is up to date"

# Step 2: Sync .claude folder from superpowers to current project
echo "[INFO] Syncing .claude folder..."

# Create .claude directory if it doesn't exist
mkdir -p ./.claude

if ! rsync -av --delete "$SUPERPOWERS_DIR/.claude/" "./.claude/"; then
    echo "[ERROR] Failed to sync .claude folder"
    exit 1
fi

echo "[SUCCESS] .claude folder synced successfully"

echo ""
echo "=== Sync Complete ==="

# TODO: Add a check for merge conflicts into the GitHub Actions CI pipeline
# TODO: Ensure that this check runs after the .claude sync step and fails the pipeline if conflicts are detected
