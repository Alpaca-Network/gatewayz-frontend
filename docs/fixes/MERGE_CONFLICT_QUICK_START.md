# Merge Conflict Handling - Quick Start

## What Changed

The CI/CD pipeline now automatically:
1. **Detects** merge conflicts when they occur
2. **Skips tests** to save CI time during conflict resolution
3. **Spawns Cursor agent** to automatically resolve conflicts
4. **Verifies** all conflicts are properly resolved
5. **Commits** and **pushes** the fixes

## How It Works

```
Merge Creates Conflict
         ↓
GitHub Actions starts CI
         ↓
check-merge-conflicts job runs
         ↓
    ┌────┴────┐
    │          │
Conflicts? NO   YES
    │          │
    ✓          resolve-conflicts job
   Tests      Uses Cursor agent to fix
              Verifies & commits
              Re-triggers CI
              ↓
             Tests run ✓
```

## For Users

### During Normal Workflows (No Conflicts)
- Nothing changes - tests run as before
- CI/CD works exactly the same

### When Merge Conflicts Occur
1. **Automatic Detection**: CI detects conflicts immediately
2. **Smart Skipping**: Tests are automatically skipped
3. **Auto-Resolution**: Cursor agent attempts to resolve
4. **Verification**: Confirms all conflicts are fixed
5. **Auto-Commit**: Resolution is committed and pushed
6. **Re-trigger**: CI runs again with clean code

## Manual Testing

Test the merge conflict detection script:

```bash
# Check for conflicts (clean repo)
bash scripts/check-merge-conflicts.sh

# Should output: ✅ No merge conflicts detected

# Create a test conflict
echo "<<<<<<< HEAD" >> test.txt
echo "content" >> test.txt
echo "=======" >> test.txt
echo "other" >> test.txt
echo ">>>>>>> branch" >> test.txt

# Check detection
bash scripts/check-merge-conflicts.sh

# Should output: ❌ Merge conflicts detected...
```

## What Gets Skipped on Conflicts

When merge conflicts are detected, these jobs are **skipped**:
- ✗ Test (Jest unit tests)
- ✗ Lint (ESLint)
- ✗ Type Check (TypeScript)
- ✗ Build (Next.js build)
- ✗ E2E Tests (Playwright)
- ✗ Fix CI (auto-fix of other failures)

These jobs **always run**:
- ✓ Check Merge Conflicts (detection)
- ✓ Resolve Conflicts (if conflicts found)
- ✓ CI Success (final status)

## Configuration

The system uses the existing `CURSOR_API_KEY` secret already configured for the `fix-ci` job. No additional setup needed.

## Files Involved

| File | Purpose |
|------|---------|
| `scripts/check-merge-conflicts.sh` | Detects merge markers |
| `.github/workflows/ci.yml` | CI workflow with new jobs |
| `MERGE_CONFLICT_HANDLING.md` | Full documentation |

## Troubleshooting

### If Cursor Agent Fails
The `resolve-conflicts` job will fail and show the error. You'll need to manually resolve conflicts using:

```bash
git status  # See conflicted files
# Edit files to resolve conflicts
git add .
git commit -m "Resolve merge conflicts manually"
git push
```

### If Tests Still Fail After Resolution
The CI will re-trigger after Cursor resolves conflicts. If tests then fail, the normal `fix-ci` job will attempt to fix them.

### To Disable Automatic Conflict Resolution
Edit `.github/workflows/ci.yml` and change the `resolve-conflicts` job condition:
```yaml
if: needs.check-merge-conflicts.outputs.has-conflicts == 'true' && false
```

## Performance Impact

- **Without conflicts**: ~1 second added (detection only)
- **With conflicts**: Tests are skipped entirely (saves 5-15 minutes)
- **Cursor resolution**: ~2-5 minutes (depends on complexity)

## Security Notes

- Cursor agent only runs when merge conflicts exist
- Automatic commits are credited to GitHub Actions
- No code changes are made beyond conflict resolution
- Verification ensures all markers are removed

## See Also

- Full Documentation: `MERGE_CONFLICT_HANDLING.md`
- CI Workflow: `.github/workflows/ci.yml`
- Detection Script: `scripts/check-merge-conflicts.sh`
