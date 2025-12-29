#!/usr/bin/env bash
set -euo pipefail

# Script to sync .claude folder from superpowers repository
# This ensures we have the latest Claude Code skills and configurations

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Define paths
TMP_DIR="./tmp"
REPO_URL="https://github.com/obra/superpowers"
CLONE_PATH="${TMP_DIR}/superpowers"
SOURCE_CLAUDE_DIR="${CLONE_PATH}/.claude"
TARGET_CLAUDE_DIR="./.claude"

log_info "Starting .claude folder sync from superpowers repository"

# Step 1: Create tmp directory if it doesn't exist
if [ ! -d "${TMP_DIR}" ]; then
    log_info "Creating tmp directory: ${TMP_DIR}"
    mkdir -p "${TMP_DIR}"
fi

# Step 2: Clone or update the superpowers repository
if [ -d "${CLONE_PATH}" ]; then
    log_info "Repository already exists, updating with git pull"
    cd "${CLONE_PATH}"
    if ! git pull; then
        log_error "Failed to update repository"
        exit 1
    fi
    cd - > /dev/null
else
    log_info "Cloning repository: ${REPO_URL}"
    if ! git clone "${REPO_URL}" "${CLONE_PATH}"; then
        log_error "Failed to clone repository"
        exit 1
    fi
fi

# Step 3: Verify source .claude directory exists
if [ ! -d "${SOURCE_CLAUDE_DIR}" ]; then
    log_error "Source .claude directory not found: ${SOURCE_CLAUDE_DIR}"
    exit 1
fi

# Step 4: Create target .claude directory if it doesn't exist
if [ ! -d "${TARGET_CLAUDE_DIR}" ]; then
    log_info "Creating target .claude directory"
    mkdir -p "${TARGET_CLAUDE_DIR}"
fi

# Step 5: Sync using rsync
log_info "Syncing .claude folder using rsync"
log_info "Source: ${SOURCE_CLAUDE_DIR}/"
log_info "Target: ${TARGET_CLAUDE_DIR}/"

if ! rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    "${SOURCE_CLAUDE_DIR}/" "${TARGET_CLAUDE_DIR}/"; then
    log_error "rsync failed"
    exit 1
fi

log_info "✅ Successfully synced .claude folder"

# TODO: Add check for merge conflicts in CI pipeline
# ============================================================================
# IMPORTANT: Add the following to your GitHub Actions CI pipeline:
#
# After running this sync script, add a step to check for merge conflicts:
#
#   - name: Check for merge conflicts
#     run: |
#       if git diff --name-only | grep -q '.claude'; then
#         echo "Detected changes in .claude folder"
#         if git diff .claude | grep -E '^<<<<<<< |^=======$|^>>>>>>> '; then
#           echo "ERROR: Merge conflicts detected in .claude folder"
#           exit 1
#         fi
#       fi
#
# This check should run AFTER the sync step and FAIL the pipeline if
# conflicts are detected.
# ============================================================================

log_info "Script completed successfully"
log_warn "Remember to add merge conflict checking to CI pipeline (see TODO in script)"

exit 0
