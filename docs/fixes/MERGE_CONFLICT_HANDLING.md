# Merge Conflict Detection and Automatic Resolution

## Overview

This document describes the automated merge conflict detection and resolution system implemented in the CI/CD pipeline. When merge conflicts are detected, tests are automatically skipped and the Cursor agent is spawned to automatically resolve them.

## Architecture

### Components

1. **Merge Conflict Detection Job** (`check-merge-conflicts`)
   - First job to run in the CI pipeline
   - Detects merge conflict markers in the repository
   - Sets output flags used by subsequent jobs

2. **Test Jobs** (`test`, `lint`, `typecheck`, `build`, `e2e`)
   - Conditionally skip when merge conflicts are detected
   - Run normally when no conflicts exist

3. **Merge Conflict Resolution Job** (`resolve-conflicts`)
   - Only runs when conflicts are detected
   - Uses Cursor agent to automatically resolve conflicts
   - Verifies all conflicts are resolved
   - Commits and pushes the resolution

4. **CI Failure Fix Job** (`fix-ci`)
   - Skips when merge conflicts exist
   - Handles other CI failures after conflicts are resolved

## Workflow

```
┌─────────────────────────┐
│ check-merge-conflicts   │
└────────────┬────────────┘
             │
     ┌───────┴───────┐
     │               │
  NO CONFLICTS    CONFLICTS EXIST
     │               │
     │          ┌────────────────┐
     │          │resolve-conflicts│
     │          └────────────────┘
     │               │
     └───────┬───────┘
             │
    ┌────────▼────────┐
    │ test, lint, etc │
    └────────────────┘
             │
    ┌────────▼────────┐
    │  ci-success     │
    └─────────────────┘
```

### Behavior

**When NO conflicts exist:**
1. `check-merge-conflicts` - passes, outputs `has-conflicts=false`
2. All test jobs - run normally
3. `resolve-conflicts` - skipped
4. `fix-ci` - runs only if tests fail

**When conflicts exist:**
1. `check-merge-conflicts` - passes, outputs `has-conflicts=true`
2. `resolve-conflicts` - runs and attempts to resolve all conflicts
3. All test jobs - skipped
4. `fix-ci` - skipped
5. After resolution, tests run on the re-triggered workflow

## Implementation Details

### Merge Conflict Detection (`scripts/check-merge-conflicts.sh`)

The script detects merge conflicts by:
1. Checking `git diff --diff-filter=U` (unmerged files)
2. Searching for merge markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Returning exit code 0 if no conflicts, 1 if conflicts exist

```bash
bash scripts/check-merge-conflicts.sh
```

### CI Workflow Integration (`.github/workflows/ci.yml`)

The workflow uses job conditions to control execution:

```yaml
check-merge-conflicts:
  name: Check Merge Conflicts
  runs-on: ubuntu-latest
  outputs:
    has-conflicts: ${{ steps.check.outputs.has-conflicts }}
    conflicted-files: ${{ steps.check.outputs.conflicted-files }}

test:
  needs: [check-merge-conflicts]
  if: needs.check-merge-conflicts.outputs.has-conflicts == 'false'
  # ... test job

resolve-conflicts:
  needs: [check-merge-conflicts]
  if: needs.check-merge-conflicts.outputs.has-conflicts == 'true'
  # ... resolution job
```

### Cursor Agent Integration

The `resolve-conflicts` job uses Cursor CLI to automatically resolve conflicts:

```bash
cursor fix "Resolve all merge conflicts in this repository. The following files have merge conflicts: [files]. Carefully review the conflicting sections marked with <<<<<<<, =======, and >>>>>>>. Choose the correct version for each conflict or combine them if both are needed. Ensure all merge markers are removed and the code is valid. Do not make any other changes beyond resolving the conflicts."
```

**Requirements:**
- `@cursor.so/cli` installed globally
- `CURSOR_API_KEY` secret configured in GitHub

### Verification Step

After Cursor resolves conflicts, the script re-runs to verify all markers are removed:

```bash
if bash scripts/check-merge-conflicts.sh; then
  echo "✅ All merge conflicts resolved"
else
  echo "❌ Some merge conflicts remain"
  exit 1
fi
```

## Configuration

### GitHub Secrets Required

- `CURSOR_API_KEY` - API key for Cursor agent authentication

### Script Locations

- **Detection Script**: `scripts/check-merge-conflicts.sh`
- **CI Workflow**: `.github/workflows/ci.yml`
- **This Documentation**: `MERGE_CONFLICT_HANDLING.md`

## Testing

### Manual Testing

To test the merge conflict detection locally:

```bash
# Test with no conflicts
bash scripts/check-merge-conflicts.sh
# Output: ✅ No merge conflicts detected
# Exit code: 0

# Create a simulated conflict
echo "<<<<<<< HEAD" >> test-file.txt
echo "content" >> test-file.txt
echo "=======" >> test-file.txt
echo "other content" >> test-file.txt
echo ">>>>>>> branch" >> test-file.txt
git add test-file.txt

# Test detection
bash scripts/check-merge-conflicts.sh
# Output: ❌ Merge conflicts detected...
# Exit code: 1
```

### GitHub Actions Testing

1. Create a pull request that results in merge conflicts
2. Merge the conflicting branches
3. Observe GitHub Actions workflow:
   - `check-merge-conflicts` job detects conflicts
   - `resolve-conflicts` job runs automatically
   - Tests are skipped until conflicts are resolved
   - Cursor agent resolves conflicts and commits

## Error Handling

### If Cursor Agent Fails

If the `resolve-conflicts` job fails:
1. The job logs will show the error
2. The workflow will fail at the "Verify conflicts are resolved" step
3. Manual intervention required via GitHub UI or local merge resolution

### If Verification Fails

If conflicts remain after Cursor resolution:
1. The verification step fails
2. Job exits with code 1
3. Subsequent jobs are skipped
4. Manual review and resolution required

## Best Practices

1. **Conflict Prevention**: Keep branches up-to-date to minimize conflicts
2. **Code Review**: Review merged code even with automatic resolution
3. **Verification**: Check the automatically resolved conflicts are correct
4. **Documentation**: Update this file if workflow changes

## Future Enhancements

- Add notification to PR when conflicts are detected
- Support for additional conflict resolution strategies
- Integration with GitHub checks API for better visibility
- Fallback to manual conflict markers if automatic resolution fails

## References

- [GitHub Actions: Conditional Job Execution](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idif)
- [Git Merge Conflicts Documentation](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
- [Cursor CLI Documentation](https://docs.cursor.com/cli)
