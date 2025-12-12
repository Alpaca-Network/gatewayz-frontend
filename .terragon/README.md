# Terragon PR Comments Sync

This directory contains pending tasks created by the PR Comments Sync workflow.

## Overview

When PR comments are added to pull requests, they are automatically synced to Terragon tasks via:

1. **GitHub Action** (`.github/workflows/sync-pr-comments-to-terragon.yml`) - Manual workflow dispatch to sync PR comments
2. **Slash Command** (`.claude/commands/sync-pr-comments.md`) - Manual sync via `/sync-pr-comments [PR_NUMBER]`

## How It Works

### Manual Sync (GitHub Action)

The workflow is triggered via manual dispatch (`workflow_dispatch`) with a PR number.

When triggered, it:
1. Collects all comments from the PR
2. Creates a task file in `.terragon/pending-tasks/`
3. Commits the file to the PR branch
4. Adds a summary comment to the PR

### Manual Sync (Slash Command)

Use `/sync-pr-comments [PR_NUMBER]` in Claude Code to:
1. Fetch all comments from a specific PR
2. Analyze and categorize the feedback
3. Create a follow-up Terragon task via `SuggestFollowupTask`

## Directory Structure

```
.terragon/
├── README.md                    # This file
└── pending-tasks/               # Task files waiting to be processed
    └── pr-{number}-{timestamp}.md
```

## Task File Format

```yaml
---
title: "Address PR #123 feedback: Feature Title"
pr_number: 123
pr_url: "https://github.com/owner/repo/pull/123"
branch: "feature/branch-name"
created_at: "2024-01-15T10:30:00Z"
status: pending
---

## Task: Address PR Feedback

... task content ...
```

## Configuration

### Required Secrets

For the GitHub Action to work, ensure these secrets are set:

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `ANTHROPIC_API_KEY` (optional) - For Claude Code integration

### Customization

To customize the workflow behavior, edit:
- `.github/workflows/sync-pr-comments-to-terragon.yml`

To customize the slash command behavior, edit:
- `.claude/commands/sync-pr-comments.md`

## Processing Tasks

Tasks in `pending-tasks/` can be processed by:

1. **Terry Agent**: Spin up a new Terry agent with the task content
2. **Claude Code**: Read the task file and address each item
3. **Manual Review**: Review the file and address comments directly

## Workflow Integration

After addressing feedback:

1. Mark items as resolved in GitHub PR
2. Move/delete the task file from `pending-tasks/`
3. Request re-review on the PR
