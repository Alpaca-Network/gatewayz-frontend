# Branch Protection Rules Setup Guide

This guide explains how to configure branch protection rules for auto-merge on CI success.

## Overview

Branch protection rules ensure that:
1. All required CI checks must pass before merging
2. Pull requests must be reviewed before merging
3. Commits must be signed (optional, but recommended)
4. Auto-merge can be enabled when all requirements are met

## Setup Instructions

### Step 1: Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Navigate to **Settings** → **Branches**
3. Click **Add rule** (or edit existing rule for `main`)

### Step 2: Configure the Rule

#### Branch Name Pattern
```
main
```
(Repeat for `staging` and `develop` if needed)

#### Protect matching branches
Enable the following checkboxes:

✅ **Require a pull request before merging**
- Required approving reviews: `1` (or more depending on your team)
- Dismiss stale pull request approvals when new commits are pushed: ✓
- Require review from code owners: ✓ (if CODEOWNERS file exists)

✅ **Require status checks to pass before merging**

Select all the following required status checks:
- `Code Quality Checks` (from ci.yml)
- `Security Scan` (from ci.yml)
- `Run Tests (Shard 1)` (from ci.yml)
- `Run Tests (Shard 2)` (from ci.yml)
- `Run Tests (Shard 3)` (from ci.yml)
- `Run Tests (Shard 4)` (from ci.yml)
- `Coverage Report` (from ci.yml)
- `Build Verification` (from ci.yml)
- `Deployment Ready` (from ci.yml)
- `Critical Endpoint Tests` (from test.yml)
- `Endpoint Regression Tests` (from test.yml)

Note: These will appear after the first workflow run completes.

✅ **Require branches to be up to date before merging**
- Ensure the branch is always up-to-date before merging

✅ **Require conversation resolution before merging** (optional)
- Require all conversations on code to be resolved

✅ **Allow auto merge** (Required for auto-merge workflow)
- Enables the auto-merge feature on pull requests

✅ **Require signed commits** (Recommended for security)
- Commits must be signed with a verified signature

✅ **Require deployment to succeed before merging** (optional)
- Add your deployment environment if applicable

### Step 3: Additional Settings

#### Restrict who can push to matching branches (optional)
- Allows you to restrict push access to specific teams/users

#### Allow force pushes (NOT recommended)
- Leave unchecked to prevent force pushing

#### Allow deletions (NOT recommended)
- Leave unchecked to prevent branch deletion

## Using Auto-Merge with Branch Protection

Once branch protection is configured:

### Automatic Merge (via auto-merge.yml workflow)
1. Create a pull request targeting `main`
2. The `ci.yml` workflow runs automatically
3. If all checks pass, the `auto-merge.yml` workflow enables auto-merge
4. Once the PR is approved (if required), it merges automatically
5. A bot comment confirms the status

### Manual Auto-Merge (via GitHub UI)
1. Create and push your PR
2. Once all required checks pass and reviews are approved
3. Click the **"Enable auto-merge"** button on the PR
4. Choose merge method:
   - **Squash and merge** (recommended for clean history)
   - **Rebase and merge**
   - **Create a merge commit**
5. The PR will merge automatically once all requirements are met

## Merge Methods

### Squash and Merge (Recommended)
- Combines all commits into a single commit
- Keeps main branch history clean
- Great for feature branches with many small commits

### Rebase and Merge
- Replays all commits on top of main
- Preserves individual commit history
- Good for maintaining detailed commit history

### Create a Merge Commit
- Creates a merge commit that combines both branches
- Shows the merge in history
- Traditional approach

## Troubleshooting

### "Auto merge is disabled"
**Solution**: Go to **Settings → Pull requests** and enable "Allow auto merge"

### "Head branch is behind base branch"
**Solution**: Sync your branch with main:
```bash
git fetch origin
git merge origin/main
git push origin your-branch
```

### Status checks not appearing
**Solution**: Wait for the first workflow run to complete. Status checks appear after the workflow first runs.

### "Merge conflicts exist"
**Solution**: Resolve conflicts locally and push an update to the PR

### PR won't auto-merge despite all checks passing
**Solution**:
- Ensure PR is approved (if required by branch protection)
- Check that the repository has auto-merge enabled (Settings → Pull requests)
- Verify the branch protection rule allows auto-merge

## GitHub API Alternative (For Automation)

If you prefer to set up branch protection via GitHub API (for IaC):

```bash
gh api repos/{owner}/{repo}/branches/{branch}/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Code Quality Checks",
      "Security Scan",
      "Run Tests (Shard 1)",
      "Run Tests (Shard 2)",
      "Run Tests (Shard 3)",
      "Run Tests (Shard 4)",
      "Coverage Report",
      "Build Verification",
      "Deployment Ready",
      "Critical Endpoint Tests",
      "Endpoint Regression Tests"
    ]
  },
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "enforce_admins": true,
  "allow_auto_merge": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": true
}
EOF
```

## Testing the Setup

### Test 1: Verify Status Checks
1. Create a test branch and PR
2. Confirm all required status checks appear
3. Verify they all show as "Required"

### Test 2: Verify Auto-Merge Enablement
1. Create a PR with passing tests
2. The `auto-merge.yml` workflow should run
3. Check that a comment appears saying "Auto-merge enabled"

### Test 3: Verify Merge Happens
1. If PR requires approval, approve it
2. Wait 1-2 minutes for auto-merge to occur
3. Verify the PR merged with a squash commit

## Disabling Auto-Merge for Specific PRs

If you need to prevent a specific PR from auto-merging:
1. Click the **"Disable auto-merge"** button on the PR
2. Or delete the auto-merge commit before it triggers

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Auto Merge Documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [GitHub API - Branches](https://docs.github.com/en/rest/branches/branch-protection)
