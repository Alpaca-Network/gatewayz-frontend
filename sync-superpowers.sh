#!/bin/bash
set -euo pipefail

# Sync Superpowers Script
# This script clones/updates the superpowers repo and syncs .claude folder

echo "🚀 Starting Superpowers sync..."

# Step 1: Setup tmp directory
if [ ! -d "./tmp" ]; then
    echo "📁 Creating ./tmp directory..."
    mkdir -p ./tmp
fi

# Step 2: Clone or update superpowers repository
if [ -d "./tmp/superpowers" ]; then
    echo "🔄 Updating existing superpowers repository..."
    cd ./tmp/superpowers
    if ! git pull; then
        echo "❌ Error: Failed to update superpowers repository"
        exit 1
    fi
    cd ../..
else
    echo "📥 Cloning superpowers repository..."
    if ! git clone https://github.com/obra/superpowers ./tmp/superpowers; then
        echo "❌ Error: Failed to clone superpowers repository"
        exit 1
    fi
fi

# Step 3: Sync .claude folder using rsync
echo "🔄 Syncing .claude folder..."

# Create .claude directory if it doesn't exist
if [ ! -d "./.claude" ]; then
    echo "📁 Creating ./.claude directory..."
    mkdir -p ./.claude
fi

# Sync from superpowers to current project
if ! rsync -av --delete ./tmp/superpowers/.claude/ ./.claude/; then
    echo "❌ Error: Failed to sync .claude folder"
    exit 1
fi

echo "✅ Superpowers sync completed successfully!"

# TODO: Add merge conflict detection to GitHub Actions CI pipeline
# This check should:
# 1. Run after the .claude sync step
# 2. Detect any merge conflicts in the synced files
# 3. Fail the pipeline if conflicts are detected
# 4. Report which files have conflicts for manual resolution
