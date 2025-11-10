# Auto-Merge on CI Success - Implementation Guide

## Overview

This repository now supports **automatic merging of pull requests when all CI tests pass**. This guide explains the implementation, how to use it, and how to troubleshoot issues.

## Architecture

### Workflow Components

```
┌─────────────────────────────────────────────────────────────┐
│ Developer creates PR and pushes code                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub CI Pipeline Runs (ci.yml)                            │
│ • Code Quality Checks (Ruff, Black, isort, MyPy)           │
│ • Security Scan (Bandit, Safety)                           │
│ • Tests (4 shards in parallel via pytest-xdist)            │
│ • Coverage Report (merge + validate)                        │
│ • Build Verification                                        │
│ • Deployment Ready Check                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ All checks passed?   │
              └──────────┬───────────┘
                    YES  │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Auto-Merge Workflow Triggers (auto-merge.yml)               │
│ • Detects workflow success                                  │
│ • Verifies all required checks passed                       │
│ • Enables auto-merge on PR                                  │
│ • Posts confirmation comment                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ PR Approved?         │
              │ (if required)        │
              └──────────┬───────────┘
                    YES  │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Auto-Merge Executes                                         │
│ • Squash commits into single commit                         │
│ • Merge to main branch                                      │
│ • Close PR                                                  │
│ • Delete feature branch                                     │
└─────────────────────────────────────────────────────────────┘
```

## Files Added

### 1. `.github/workflows/auto-merge.yml`
The main auto-merge workflow that:
- Triggers when CI pipeline completes
- Verifies all required checks passed
- Enables auto-merge on the PR
- Posts status comments

**Key Features:**
- Checks CI workflow conclusion
- Validates all required status checks
- Detects merge conflicts
- Posts informative comments
- Logs all actions for debugging

### 2. `docs/BRANCH_PROTECTION_SETUP.md`
Complete guide for configuring branch protection rules in GitHub:
- Step-by-step setup instructions
- Required status checks list
- Merge method recommendations
- Troubleshooting guide
- GitHub API alternative method

### 3. `docs/AUTO_MERGE_IMPLEMENTATION.md`
This file - detailed implementation documentation

### 4. `scripts/validate-auto-merge-setup.sh`
Bash script to validate your auto-merge setup:
- Checks GitHub CLI authentication
- Verifies auto-merge is enabled
- Validates workflow files exist
- Checks branch protection rules
- Reports on recent workflow runs

## How to Use

### Quick Start

1. **Enable Auto-Merge on Repository** (One-time setup)
   ```bash
   # Navigate to Settings → Pull Requests
   # Enable "Allow auto merge"
   ```

2. **Configure Branch Protection** (One-time setup)
   ```bash
   # Navigate to Settings → Branches
   # Create rule for "main" with:
   #   - Require PR reviews (1+ approvals)
   #   - Require status checks (all 9 jobs)
   #   - Allow auto merge (checked)
   ```

3. **Create a PR** (Per development cycle)
   ```bash
   git checkout -b feature/my-feature
   # Make changes and commit
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

4. **CI Runs Automatically**
   - All tests run in parallel (4 shards)
   - Code quality checks run
   - Security scans run
   - Results appear on PR within 5-10 minutes

5. **Auto-Merge Workflow Triggers**
   - If all checks pass: auto-merge.yml enables auto-merge
   - PR gets comment: "✅ All CI checks passed! Auto-merge enabled."
   - Once approved (if required), PR merges automatically

### Monitoring Auto-Merge Status

**On the PR Page:**
- Green checkmarks indicate passing checks
- "Auto-merge enabled" label appears when ready
- Merge button shows "Auto-merge enabled" status
- Bot comments track progress

**In Actions Tab:**
- View `Auto-Merge on CI Success` workflow runs
- Check logs for details on each step
- See any errors or warnings

## Requirements

### Repository Settings Required

1. **Auto-merge Enabled**
   - Settings → Pull requests → "Allow auto merge" ✓

2. **Branch Protection Rules** (for main)
   - Require pull request reviews: 1+ approval
   - Require status checks to pass:
     - Code Quality Checks
     - Security Scan
     - Run Tests (Shard 1, 2, 3, 4)
     - Coverage Report
     - Build Verification
     - Deployment Ready
   - Allow auto merge: ✓
   - Require branches to be up to date: ✓

### Permissions

The auto-merge workflow needs:
- `contents: write` - To check repository state
- `pull-requests: write` - To enable auto-merge

These are defined in the workflow file.

## Status Checks Explained

### Code Quality Checks
- **Purpose**: Validates code style and formatting
- **Tools**: Ruff, Black, isort, MyPy
- **Time**: ~30 seconds
- **Failure Causes**: Code formatting issues, linting errors, type errors

### Security Scan
- **Purpose**: Checks for known vulnerabilities
- **Tools**: Bandit (code security), Safety (dependency vulnerabilities)
- **Time**: ~1 minute
- **Failure Causes**: Security vulnerabilities found in code or dependencies

### Run Tests (Shards 1-4)
- **Purpose**: Executes test suite in parallel (25% coverage minimum)
- **Tool**: Pytest with 4-way sharding
- **Time**: ~5-10 minutes per shard (parallel)
- **Failure Causes**: Test failures, coverage below 25%

### Coverage Report
- **Purpose**: Merges coverage from all shards and validates
- **Tool**: Coverage + Codecov
- **Time**: ~2 minutes
- **Failure Causes**: Coverage below 25% threshold

### Build Verification
- **Purpose**: Verifies application can start and dependencies are correct
- **Time**: ~30 seconds
- **Failure Causes**: Import errors, missing dependencies, config issues

### Deployment Ready
- **Purpose**: Final check that all other checks passed
- **Time**: <10 seconds
- **Notes**: This is a gate - only runs if previous checks pass

## Troubleshooting

### Auto-Merge Not Triggering

**Symptom**: CI passes but auto-merge doesn't enable

**Solutions**:
1. Check Settings → Pull requests → "Allow auto merge" is enabled
2. Verify branch protection rule has "Allow auto merge" checked
3. Check auto-merge.yml workflow runs (should appear in Actions tab)
4. Look at workflow logs for error messages

**Debug**: Run validation script:
```bash
bash scripts/validate-auto-merge-setup.sh <owner> <repo>
```

### "Auto merge is disabled" Error

**Cause**: Repository setting not enabled

**Fix**:
1. Go to Settings → Pull requests
2. Check "Allow auto merge"
3. Save changes
4. Re-run auto-merge workflow or create new PR

### Status Checks Not Appearing

**Cause**: Workflows haven't run yet

**Fix**:
1. Wait for first CI run to complete
2. Status checks will appear after workflows run
3. Add them to branch protection once they appear

### Merge Conflicts Preventing Auto-Merge

**Symptom**: "Head branch is behind base branch" or merge conflicts

**Fix**:
1. Sync your branch locally:
   ```bash
   git fetch origin
   git merge origin/main
   git push origin your-branch
   ```
2. Or use GitHub UI: "Update branch" button on PR
3. Re-run CI
4. Auto-merge will trigger once conflicts resolved

### Specific Check Failing

1. Click on the failing check in the PR
2. Read the error message and logs
3. Common fixes:
   - **Code Quality**: Run `black --line-length=100 src/` to format
   - **Type Errors**: Fix type hints or add type annotations
   - **Test Failures**: Run `pytest tests/` locally and fix failures
   - **Security Issues**: Review Bandit report and remediate

## Manual Merge if Auto-Merge Fails

If auto-merge doesn't work for some reason:

1. **Via GitHub UI**:
   - Click "Merge pull request" button
   - Choose "Squash and merge"
   - Confirm

2. **Via GitHub CLI**:
   ```bash
   gh pr merge <number> --squash --auto
   ```

## Customizing Auto-Merge

### Change Merge Method

Edit `.github/workflows/auto-merge.yml`, line with `merge_method`:

```yaml
# Current (recommended)
merge_method: 'squash'

# Alternative options:
merge_method: 'merge'    # Creates merge commit
merge_method: 'rebase'   # Rebases commits
```

### Require Approval Before Auto-Merge

This is controlled by branch protection:
- `Require pull request reviews`: Set to 1 or more
- Without this, auto-merge happens after CI passes (no approval needed)

### Exclude Branches from Auto-Merge

Edit `.github/workflows/auto-merge.yml`, line 5:

```yaml
on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types: [completed]
    branches: [main, staging, develop]  # Add/remove branches here
```

### Add Additional Status Checks

Edit `.github/workflows/auto-merge.yml`, around line 56:

```yaml
const requiredChecks = [
  'Code Quality Checks',
  'Security Scan',
  'Run Tests (Shard 1)',
  'Run Tests (Shard 2)',
  'Run Tests (Shard 3)',
  'Run Tests (Shard 4)',
  'Coverage Report',
  'Build Verification',
  'Deployment Ready',
  'Your New Check Here'  # Add your check
];
```

## Disabling Auto-Merge

### For Specific PR

On the PR page:
1. Click "Auto-merge enabled" dropdown
2. Select "Disable auto-merge"
3. Changes won't be auto-merged

### For Entire Repository

1. Go to Settings → Pull requests
2. Uncheck "Allow auto merge"
3. No PRs will auto-merge

### For Specific Branch

1. Remove branch from `branches:` list in auto-merge.yml
2. Or remove from branch protection rule

## Monitoring & Analytics

### Check Auto-Merge Success Rate

1. Go to Actions tab
2. Click "Auto-Merge on CI Success" workflow
3. View all runs and their conclusions
4. Look for patterns in failures

### GitHub Insights

1. Go to Insights → Pulse
2. See PR metrics and merge trends
3. Monitor CI pass rates

## Best Practices

### 1. Keep PRs Small
- Easier to review
- Faster CI execution
- Fewer conflicts

### 2. Require Approval
- Set branch protection to require 1+ reviews
- Maintain code quality
- Catch issues before merge

### 3. Monitor CI Regularly
- Check action logs for patterns
- Fix flaky tests
- Keep dependencies updated

### 4. Use Descriptive Commit Messages
- Since we squash, make PR title/description clear
- Helps track changes in git history

### 5. Sync with Main Frequently
- Reduces merge conflicts
- Keeps branch up-to-date
- Faster CI execution

## FAQ

**Q: Will auto-merge merge without approval?**
A: Only if branch protection doesn't require reviews. Configure branch protection to require 1+ approval for safety.

**Q: What if CI fails after auto-merge enables?**
A: Auto-merge only enables if CI passes. If a later check fails, auto-merge is cancelled.

**Q: Can I disable auto-merge for one PR?**
A: Yes, click "Auto-merge enabled" on PR and select "Disable auto-merge".

**Q: What merge method is used?**
A: Squash by default (clean history). Can change in auto-merge.yml workflow.

**Q: How long does merge take after approval?**
A: Usually 1-2 minutes. GitHub checks once more before merging.

**Q: What if there are merge conflicts?**
A: Auto-merge won't trigger. Update your branch and push again.

**Q: Can I require specific checks?**
A: Yes, via branch protection rules. Add checks to "Require status checks" list.

**Q: Does auto-merge work on all branches?**
A: Only branches listed in auto-merge.yml (main, staging, develop by default).

## Related Documentation

- [BRANCH_PROTECTION_SETUP.md](./BRANCH_PROTECTION_SETUP.md) - Detailed branch protection guide
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) - CI pipeline configuration
- [.github/workflows/auto-merge.yml](../.github/workflows/auto-merge.yml) - Auto-merge workflow

## Support

If you encounter issues:

1. Check troubleshooting section above
2. Run validation script: `bash scripts/validate-auto-merge-setup.sh`
3. View workflow logs in Actions tab
4. Check branch protection settings
5. Read GitHub docs on auto-merge and branch protection

## References

- [GitHub Auto Merge Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Actions Workflows](https://docs.github.com/en/actions/using-workflows)
- [GitHub API - Auto Merge](https://docs.github.com/en/rest/pulls/pulls#enable-auto-merge-for-a-pull-request)
