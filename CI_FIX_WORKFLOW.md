# Automatic CI Fix Workflow with Cursor CLI

This document explains how the automatic CI fix workflow works and how to set it up.

## Overview

The CI fix workflow automatically detects CI failures and uses Cursor CLI to fix them, committing the fixes directly to the same branch/PR. This eliminates the need for manual fixes when CI fails.

## How It Works

1. **CI Pipeline Runs**: The main CI workflow (test, lint, typecheck, build) runs on every push/PR
2. **Failure Detected**: If any job fails, the `fix-ci` job is triggered
3. **Cursor CLI Invoked**: Cursor CLI analyzes the failures and automatically fixes them
4. **Changes Committed**: Fixed changes are committed and pushed to the same branch
5. **Re-run Triggered**: GitHub Actions automatically re-runs the CI pipeline with the fixes
6. **Success**: If fixes resolve all issues, CI passes

## Setup Instructions

### 1. Create Cursor API Key

1. Go to [Cursor Editor Settings](https://cursor.com/settings)
2. Navigate to the **API Keys** section
3. Create a new API key for your project
4. Copy the API key

### 2. Add GitHub Secret

1. Go to your GitHub repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CURSOR_API_KEY`
5. Value: Paste your Cursor API key from step 1
6. Click **Add secret**

### 3. Verify Workflow File

The workflow file is already in place at `.github/workflows/ci.yml`. It includes:

- **Trigger**: Runs when `test`, `lint`, `typecheck`, or `build` jobs fail
- **Setup**: Installs Node.js, pnpm, and Cursor CLI
- **Detection**: Identifies which jobs failed
- **Fixing**: Runs Cursor CLI with appropriate commands
- **Commit**: Commits and pushes fixes to the same branch
- **Re-run**: GitHub Actions automatically re-runs CI

## Workflow Configuration

### Failing Jobs Handled

The workflow automatically detects and fixes:

- ✅ **typecheck**: TypeScript type errors
- ✅ **lint**: ESLint violations
- ✅ **test**: Test failures
- ✅ **build**: Build errors

### Cursor CLI Command

The workflow dynamically builds a command like:

```
cursor fix "Fix the following CI failures: TypeScript type errors, ESLint violations. Make only minimal changes necessary to fix the issues. Do not refactor code or make unnecessary changes."
```

## Example Workflow

### Scenario: TypeScript Error in PR

1. You push code with a type error
2. CI pipeline runs, `typecheck` job fails
3. `fix-ci` job is automatically triggered
4. Cursor CLI:
   - Analyzes the type error
   - Fixes the issue (minimal change only)
   - Returns the fixed code
5. Workflow commits the fix:
   ```
   fix: resolve CI failures

   Fixes automatically applied by Cursor CLI for:
     - type errors

   🤖 Co-authored-by: Cursor CLI <cursor@github.com>
   ```
6. Changes are pushed to your branch
7. GitHub Actions re-runs CI
8. TypeScript check now passes ✅

## Customization

### Modifying the Cursor Command

Edit `.github/workflows/ci.yml` in the **"Run Cursor CLI to fix issues"** step:

```bash
CURSOR_COMMAND="Your custom prompt here"
cursor fix "$CURSOR_COMMAND"
```

### Limiting Jobs

If you want to exclude certain jobs, modify the `needs` and `if` conditions in the `fix-ci` job definition.

### Changing Commit Message

Edit the commit message in the **"Commit and push fixes"** step:

```bash
git commit -m "Your custom message here"
```

## Best Practices

### ✅ DO

- Keep Cursor prompts clear and specific
- Make fixes minimal and focused
- Review automated commits in PRs
- Update documentation with new patterns

### ❌ DON'T

- Ignore repeated CI failures (indicates real issues)
- Leave fixes uncommitted in hot fixes
- Override automated commits without understanding them
- Silence CI failures without addressing root causes

## Troubleshooting

### Cursor CLI Not Installing

**Error**: `npm ERR! 404 Not Found - GET https://registry.npmjs.org/@cursor.so/cli`

**Solution**: The CLI package name may vary. Check [Cursor CLI documentation](https://cursor.com/docs/cli) for the latest package name.

### API Key Not Found

**Error**: `CURSOR_API_KEY not set`

**Solution**:
1. Verify the secret is added to GitHub (Settings → Secrets)
2. Verify the secret name is exactly `CURSOR_API_KEY`
3. Check that your repository has access to the secret

### Fixes Not Committing

**Check**:
1. Verify git config is correct in the workflow
2. Check that `GITHUB_TOKEN` has write access
3. Review the "Commit and push fixes" step output

### CI Still Failing After Fixes

**Possible Causes**:
- Cursor CLI didn't fully understand the issue
- Multiple interdependent failures need fixing
- Build cache issues

**Solution**: Manual review and fix may be needed. Review the PR comments for details.

## Advanced Configuration

### Skip Auto-Fix for Certain Branches

Add condition to `fix-ci` job:

```yaml
if: failure() && github.ref != 'refs/heads/master'
```

### Require Approval Before Committing

Use GitHub's workflow dispatch or approval mechanisms before pushing.

### Notify on Failure

Add a step to notify Slack/Discord of auto-fix attempts:

```yaml
- name: Notify on CI fix attempt
  if: always()
  run: |
    # Send notification to your channel
```

## Security Considerations

- **API Key**: The `CURSOR_API_KEY` is stored as a GitHub secret
- **Commits**: Commits are made in the workflow bot's name
- **Scope**: Only makes changes to fix CI issues
- **Review**: All changes appear in PR for review

## Related Documentation

- [Cursor CLI Docs](https://cursor.com/docs/cli)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cursor Settings](https://cursor.com/settings)

## Support

If you encounter issues:

1. Check the workflow run logs in **Actions** tab
2. Review the error message in the specific step
3. Verify all setup steps are complete
4. Check that your repository has the necessary permissions

---

**Last Updated**: November 24, 2024
