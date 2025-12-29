# Quick Setup: Cursor CLI Auto-Fix for CI

Get your repository auto-fixing CI failures in 3 steps.

## Step 1: Get Your Cursor API Key

1. Open [Cursor Editor Settings](https://cursor.com/settings)
2. Go to **API Keys** section
3. Create a new API key
4. Copy the key

## Step 2: Add GitHub Secret

1. Go to your GitHub repo → **Settings**
2. **Secrets and variables** → **Actions**
3. **New repository secret**
4. Name: `CURSOR_API_KEY`
5. Value: (paste your key)
6. **Add secret**

## Step 3: You're Done!

The workflow is already in place. Now when CI fails:

- ✅ Cursor CLI automatically runs
- ✅ Fixes are applied automatically
- ✅ Changes committed to your branch/PR
- ✅ CI re-runs with fixes

## What Gets Fixed

| Issue | Fixed By |
|-------|----------|
| TypeScript errors | Cursor CLI |
| ESLint violations | Cursor CLI |
| Test failures | Cursor CLI |
| Build errors | Cursor CLI |

## How It Works

```
Your code push
    ↓
CI pipeline runs
    ↓
Job fails (e.g., typecheck)
    ↓
fix-ci job triggered
    ↓
Cursor CLI analyzes & fixes
    ↓
Changes committed to branch
    ↓
CI re-runs
    ↓
✅ All pass
```

## File Reference

- **Workflow**: `.github/workflows/ci.yml`
- **Docs**: `CI_FIX_WORKFLOW.md`
- **This guide**: `CURSOR_CLI_SETUP.md`

## Troubleshooting

### Secret not working?
- Check Settings → Secrets → `CURSOR_API_KEY` exists
- Verify the secret value is correct
- The workflow job permissions include `contents: write`

### Cursor CLI not installing?
- Check the npm package name (may change)
- Verify internet connection in workflow
- Review GitHub Actions logs for detailed error

### Fixes not committing?
- Check git configuration in workflow
- Ensure no authentication issues
- Review the "Commit and push fixes" step output

## Next Steps

- Review your first auto-fixed PR
- Customize the prompt in the workflow if needed
- Add team documentation about the auto-fix process

---

See `CI_FIX_WORKFLOW.md` for detailed documentation.
