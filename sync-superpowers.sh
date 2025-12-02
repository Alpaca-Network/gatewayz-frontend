#!/bin/bash
set -euo pipefail

echo "🚀 Starting superpowers sync..."

# Step 1: Clone or update superpowers repository
if [ ! -d "./tmp" ]; then
    echo "📁 Creating tmp directory..."
    mkdir -p ./tmp
fi

if [ -d "./tmp/superpowers" ]; then
    echo "🔄 Updating existing superpowers repository..."
    cd ./tmp/superpowers
    if ! git pull; then
        echo "❌ Error: Failed to pull latest changes from superpowers repository"
        exit 1
    fi
    cd ../..
else
    echo "📦 Cloning superpowers repository..."
    if ! git clone https://github.com/obra/superpowers ./tmp/superpowers; then
        echo "❌ Error: Failed to clone superpowers repository"
        exit 1
    fi
fi

# Step 2: Sync .claude folder using rsync
echo "🔄 Syncing .claude folder..."
if [ ! -d "./.claude" ]; then
    echo "📁 Creating .claude directory..."
    mkdir -p ./.claude
fi

if ! rsync -av --delete ./tmp/superpowers/.claude/ ./.claude/; then
    echo "❌ Error: Failed to sync .claude folder"
    exit 1
fi

echo "✅ Superpowers sync completed successfully!"
echo ""
echo "📝 TODO: Remember to add merge conflict check to GitHub Actions CI:"
echo "   1. Add a step in .github/workflows/ci.yml (or similar)"
echo "   2. Run this check after the .claude sync step"
echo "   3. Ensure the pipeline fails if merge conflicts are detected"
echo "   4. Example check command:"
echo "      git diff --check || (echo 'Merge conflicts detected!' && exit 1)"
