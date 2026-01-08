# Cursor CLI Auto-Fix - Quick Start (5 Minutes)

Get your CI failures automatically fixed in 3 simple steps.

## What You'll Get

When CI fails, Cursor CLI will **automatically**:
- Fix TypeScript errors
- Fix ESLint violations
- Fix test failures
- Fix build errors
- Commit changes directly to your PR branch
- Trigger CI to re-run with fixes

## 3-Step Setup

### Step 1: Get Cursor API Key (1 min)

1. Go to: https://cursor.com/settings
2. Click **Create new API key**
3. Copy the generated key

### Step 2: Add GitHub Secret (1 min)

1. Go to your repo → **Settings**
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CURSOR_API_KEY`
5. Value: (paste your key from Step 1)
6. Click **Add secret**

### Step 3: Done! (0 min)

The workflow is already implemented and ready to use.

---

## Test It!

Make a small change that will cause a CI failure:

```typescript
// This causes a TypeScript error
let x: string = 123;
```

Push to any branch or PR. Watch GitHub Actions:
1. Workflow runs
2. TypeScript check fails
3. `fix-ci` job triggers
4. Cursor CLI analyzes and fixes the error
5. Changes are committed to your branch
6. CI re-runs automatically
7. ✅ All tests pass!

---

## Files Created

The following documentation files are available:

- **CURSOR_CLI_SETUP.md** - Quick setup guide (this file)
- **CI_FIX_WORKFLOW.md** - Complete guide with troubleshooting
- **IMPLEMENTATION_SUMMARY.md** - Technical implementation details

---

## How It Works

```
Your Push
  ↓
CI Runs (test, lint, typecheck, build)
  ↓
Job Fails?
  ├─ No: ✅ All pass
  └─ Yes: fix-ci triggered
        ├─ Cursor CLI analyzes error
        ├─ Applies minimal fix
        ├─ Commits to same branch
        └─ CI re-runs
           ↓
         ✅ All pass or ❌ Review needed
```

---

## What Gets Fixed

| Issue Type | How |
|-----------|-----|
| TypeScript errors | Cursor CLI fixes type issues |
| ESLint violations | Cursor CLI fixes lint errors |
| Test failures | Cursor CLI fixes test code |
| Build errors | Cursor CLI fixes build issues |

---

## Example Auto-Fix

### Your Code Has a Type Error
```typescript
// src/lib/utils.ts
export function getValue(): string {
  return 123;  // ❌ Error: Type 'number' is not assignable to type 'string'
}
```

### CI Fails
- `typecheck` job fails with error

### GitHub Actions Auto-Fixes It
- `fix-ci` job triggers
- Cursor CLI reads the error
- Fix is applied automatically:

```typescript
// src/lib/utils.ts
export function getValue(): string {
  return "123";  // ✅ Fixed
}
```

### Commit Created
```
fix: resolve CI failures

Fixes automatically applied by Cursor CLI for:
  - type errors

🤖 Co-authored-by: Cursor CLI <cursor@github.com>
```

### Your PR Gets Updated
- Changes are pushed to your branch
- You see the commit in your PR
- You can review and merge with confidence

---

## FAQs

### Q: What if the fix isn't correct?
**A:** All fixes are visible in your PR before merging. You can review and modify or revert if needed.

### Q: Does it work for PRs?
**A:** Yes! Works for both PRs and regular pushes to any branch.

### Q: Can I customize the behavior?
**A:** Yes! See `CI_FIX_WORKFLOW.md` for customization options.

### Q: What about security?
**A:** Your API key is stored as a GitHub Secret (encrypted). All changes are visible in PRs for review.

### Q: What if CI still fails after the fix?
**A:** The commit is still made, but the fixes may not have resolved all issues. You'll need to review and manually fix remaining problems.

---

## Troubleshooting

### Secret not working?
Check that `CURSOR_API_KEY` exists in Settings → Secrets and variables → Actions

### Cursor CLI not found?
Check GitHub Actions logs. The workflow attempts to install from npm.

### Changes not committing?
Verify the GitHub workflow has write access (it should by default).

---

## Next Steps

1. ✅ Complete the 3-step setup above
2. ✅ Test with an intentional error
3. ✅ Watch it auto-fix!
4. ✅ Start pushing with confidence

---

## Need More Help?

- **Full guide**: See `CI_FIX_WORKFLOW.md`
- **Technical details**: See `IMPLEMENTATION_SUMMARY.md`
- **GitHub Actions docs**: https://docs.github.com/en/actions
- **Cursor CLI docs**: https://cursor.com/docs/cli

---

**That's it!** You now have automatic CI fixing. Happy coding! 🎉
