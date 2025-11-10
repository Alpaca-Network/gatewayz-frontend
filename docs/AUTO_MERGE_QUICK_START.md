# Auto-Merge Quick Start Guide

Get auto-merge working in 5 minutes.

## What is Auto-Merge?

Auto-Merge automatically merges your Pull Requests when all CI tests pass. No more manual merging!

## Quick Setup (5 minutes)

### 1️⃣ Enable Auto-Merge on Repository (1 minute)

1. Go to your GitHub repository
2. Click **Settings**
3. Scroll to **Pull Requests** section
4. Check ✅ **Allow auto merge**
5. Click **Save**

### 2️⃣ Configure Branch Protection (3 minutes)

1. Go to **Settings** → **Branches**
2. Click **Add rule** (or edit existing rule for `main`)
3. Type branch name: `main`
4. Check these boxes:

   ```
   ✅ Require a pull request before merging
      • Required approving reviews: 1
      • Dismiss stale reviews: ✓

   ✅ Require status checks to pass before merging
      • Require branches to be up to date: ✓

   ✅ Allow auto merge
   ```

5. **Important**: Select these required status checks:
   - `Code Quality Checks`
   - `Security Scan`
   - `Run Tests (Shard 1)`
   - `Run Tests (Shard 2)`
   - `Run Tests (Shard 3)`
   - `Run Tests (Shard 4)`
   - `Coverage Report`
   - `Build Verification`
   - `Deployment Ready`

6. Click **Create** or **Save changes**

### 3️⃣ Verify Setup (1 minute)

```bash
python3 scripts/validate_auto_merge_setup.py
```

Expected output:
```
✅ Authenticated as <your-username>
✅ Auto-merge is enabled
✅ auto-merge.yml workflow exists
✅ Branch protection is enabled for 'main'
   ✓ Requires pull request reviews
   ✓ Requires status checks
   ✓ Auto-merge allowed
```

## Now Use It!

### Create a PR

```bash
git checkout -b feature/my-feature
# Make your changes
git add .
git commit -m "feat: add awesome feature"
git push origin feature/my-feature
```

Then create a PR on GitHub.

### Watch Auto-Merge Work

1. **CI runs automatically** (5-10 minutes)
   - Tests run in parallel
   - Code quality checks run
   - All checks appear on the PR

2. **If tests pass** ✅
   - Auto-merge.yml workflow enables auto-merge
   - PR gets comment: "✅ All CI checks passed! Auto-merge enabled."
   - PR merges automatically once approved

3. **If tests fail** ❌
   - No auto-merge
   - Fix the failing tests
   - Push again
   - Auto-merge enables when tests pass

## Common Questions

### Q: Will it merge without my approval?
**A:** No (by default). Branch protection requires 1 approval. Once approved + tests pass, it merges automatically.

### Q: How long does it take?
**A:** Usually 5-15 minutes:
- 1-2 min: CI checks run
- 1-2 min: Auto-merge workflow runs
- Instant: If approved, merges immediately

### Q: What if I don't want a PR to auto-merge?
**A:** On the PR page, click the auto-merge button dropdown and select "Disable auto-merge".

### Q: What merge method is used?
**A:** **Squash merge** (default) - keeps history clean. All commits become one.

### Q: What if tests fail?
**A:** Auto-merge won't enable. Fix the issue and push again.

## Troubleshooting

### "Auto merge is disabled" error
→ Check Settings → Pull requests → "Allow auto merge" is checked

### Status checks not showing
→ Wait for first CI run. Checks appear after workflows complete.

### Auto-merge not triggering despite passing tests
→ Run validation script: `python3 scripts/validate_auto_merge_setup.py`

### Merge conflicts
→ Sync your branch: `git fetch origin && git merge origin/main && git push`

## Next Steps

- Read full docs: [AUTO_MERGE_IMPLEMENTATION.md](./AUTO_MERGE_IMPLEMENTATION.md)
- Branch protection guide: [BRANCH_PROTECTION_SETUP.md](./BRANCH_PROTECTION_SETUP.md)
- View workflow: [.github/workflows/auto-merge.yml](../.github/workflows/auto-merge.yml)

## Getting Help

Run validation script to check your setup:

```bash
python3 scripts/validate_auto_merge_setup.py <owner> <repo>
```

Or check the full documentation in `docs/AUTO_MERGE_IMPLEMENTATION.md`.

---

**That's it!** You now have auto-merge enabled. Create a PR and watch it auto-merge when tests pass! 🚀
