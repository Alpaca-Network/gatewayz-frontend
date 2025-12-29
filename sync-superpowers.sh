#!/usr/bin/env bash

set -euo pipefail

echo "Starting superpowers sync..."

# Step 1: Create tmp directory if it does not exist
if [ ! -d "./tmp" ]; then
    echo "Creating ./tmp directory..."
    mkdir -p ./tmp
fi

# Step 2: Clone or update superpowers repository
if [ -d "./tmp/superpowers" ]; then
    echo "Updating existing superpowers repository with git pull..."
    cd ./tmp/superpowers
    if ! git pull; then
        echo "Error: Failed to pull latest changes from superpowers repository"
        exit 1
    fi
    cd ../..
    echo "Successfully updated superpowers repository"
else
    echo "Cloning superpowers repository into ./tmp/superpowers..."
    if ! git clone https://github.com/obra/superpowers ./tmp/superpowers; then
        echo "Error: Failed to clone superpowers repository"
        exit 1
    fi
    echo "Successfully cloned superpowers repository"
fi

# Step 3: Synchronize .claude folder using rsync or cp fallback
echo "Syncing .claude folder from ./tmp/superpowers/.claude/ to ./.claude/..."

# Create .claude directory if it does not exist
if [ ! -d "./.claude" ]; then
    echo "Creating .claude directory..."
    mkdir -p ./.claude
fi

# Try rsync first (preferred), fallback to cp if not available
if command -v rsync &> /dev/null; then
    echo "Using rsync for synchronization..."
    if ! rsync -av ./tmp/superpowers/.claude/ ./.claude/; then
        echo "Error: rsync failed to sync .claude folder"
        exit 1
    fi
else
    echo "rsync not found, using cp fallback..."
    # Remove existing .claude contents to ensure clean sync
    rm -rf ./.claude/*
    # Copy with -r (recursive) and -p (preserve permissions)
    if ! cp -rp ./tmp/superpowers/.claude/* ./.claude/; then
        echo "Error: cp failed to sync .claude folder"
        exit 1
    fi
fi

echo "Successfully synchronized .claude folder"
echo "Superpowers sync completed successfully!"

# TODO: Add a check for merge conflicts into the GitHub Actions CI pipeline
# This check must run AFTER the .claude sync step and FAIL the pipeline if conflicts are detected
#
# Suggested implementation for .github/workflows/ci.yml:
#
# - name: Sync superpowers .claude folder
#   run: ./sync-superpowers.sh
#
# - name: Check for merge conflicts after sync
#   run: |
#     if git diff --name-only --diff-filter=U | grep -q .; then
#       echo "ERROR: Merge conflicts detected in .claude folder after sync!"
#       echo "Conflicted files:"
#       git diff --name-only --diff-filter=U
#       exit 1
#     fi
#     echo "No merge conflicts detected"
