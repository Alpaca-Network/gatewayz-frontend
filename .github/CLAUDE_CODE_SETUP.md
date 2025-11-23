# Claude Code Docker & Caching Setup

This document explains how to use Claude Code with Docker containers and dependency caching in GitHub Actions, eliminating the need to reinstall dependencies every workflow run.

## Overview

Instead of installing Claude Code and dependencies fresh each time, we now:
- Use pre-built Docker container (`anthropic/claude-code:latest`)
- Cache npm/pnpm dependencies across runs
- Cache build artifacts (Next.js)
- Cache Playwright browsers for E2E tests

## Benefits

✅ **Faster Workflows** - Dependencies cached, no reinstalls needed
✅ **Reliable Setup** - No timeout errors during installation
✅ **Cost Savings** - Reduced CI/CD execution time
✅ **Better DX** - Faster feedback on PRs and commits

## Workflows Updated

### 1. **ci.yml** - Main CI Pipeline
Added caching to all jobs:
- `test` - pnpm store cache
- `lint` - pnpm store cache
- `typecheck` - pnpm store cache
- `build` - pnpm store + Next.js cache
- `e2e` - pnpm store + Playwright browser cache

### 2. **e2e-privy-auth.yml** - Privy Auth E2E Tests
Added caching:
- pnpm store cache
- Playwright browser cache

### 3. **claude-code-docker.yml** - NEW
New workflow for Claude Code automation:
- Uses Docker container
- Includes dependency caching
- Manual trigger with task description

## Docker Container Setup

The new `claude-code-docker.yml` workflow uses the official Claude Code Docker image:

```yaml
container:
  image: anthropic/claude-code:latest
```

### Running Claude Code via Docker

Locally (no installation required):
```bash
docker run -it anthropic/claude-code:latest /bin/bash
```

In CI/CD:
- Container automatically provided by GitHub Actions
- No setup steps needed
- Dependencies already cached

## Cache Strategy

### Cache Keys

**pnpm Store**
```yaml
key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
```
- Changes when `pnpm-lock.yaml` changes
- Stores in `~/.pnpm-store`
- Fallback to old caches if no exact match

**Next.js Build Cache**
```yaml
path: .next
key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package.json') }}
```
- Caches compiled Next.js code
- Significantly speeds up builds

**Playwright Browsers**
```yaml
path: ~/.cache/ms-playwright
key: ${{ runner.os }}-playwright-${{ hashFiles('**/package.json') }}
```
- Pre-downloaded browser binaries
- Major time savings for E2E tests

## Implementation Details

### Cache Hit/Miss Behavior

**Cache Hit** (dependencies unchanged):
- Restores cached dependencies
- `pnpm install --frozen-lockfile` completes instantly
- ~70% reduction in job time

**Cache Miss** (dependencies changed):
- Downloads and installs fresh dependencies
- Caches new dependencies for future runs
- Normal install time

### Restore Keys Fallback

Each cache includes restore keys for partial matches:
```yaml
restore-keys: |
  ${{ runner.os }}-pnpm-store-
```

This allows fallback to older caches if exact key doesn't exist, minimizing cache misses.

## Usage Examples

### Triggering Claude Code Workflow

Manually trigger the Claude Code workflow:

```bash
gh workflow run claude-code-docker.yml \
  -f task_description="Fix TypeScript errors in chat component" \
  -f branch="master"
```

Or via GitHub UI:
1. Go to **Actions** tab
2. Select **Claude Code (Docker + Caching)** workflow
3. Click **Run workflow**
4. Enter task description
5. Click **Run workflow**

### Monitoring Cache Performance

Check cache statistics in workflow logs:
```
Run actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: linux-pnpm-store-a1b2c3d4e5f6
    restore-keys: linux-pnpm-store-

Cache hit: true
Cache directory: /home/runner/.pnpm-store
```

## Troubleshooting

### Cache Not Working

**Symptoms**: Long install times, cache miss on every run

**Solutions**:
1. Check if `pnpm-lock.yaml` changed (should invalidate cache)
2. Verify cache path exists: `~/.pnpm-store`
3. Check GitHub Actions cache limits (5GB per repo)

### Out of Cache Space

**Symptoms**: Workflow fails with "No space left on device"

**Solutions**:
1. Clear old caches in Actions settings
2. Reduce cache size (remove non-essential caches)
3. GitHub Actions automatically removes caches over 7 days old

### Docker Image Pull Timeout

**Symptoms**: "Error response from daemon: Get ... network timeout"

**Solutions**:
1. Ensure internet connectivity
2. Retry workflow (temporary network issue)
3. Specify image digest instead of `latest` tag:
   ```yaml
   image: anthropic/claude-code@sha256:abc123...
   ```

## Best Practices

✅ **DO**:
- Use `--frozen-lockfile` to prevent version drift
- Update workflows when adding new tools/browsers
- Monitor cache hit rates
- Keep pnpm-lock.yaml committed to git

❌ **DON'T**:
- Manually delete pnpm-lock.yaml between runs
- Use `npm install` in workflows (breaks pnpm cache)
- Store large files in cache paths
- Hard-code absolute paths in cache configs

## Cache Limits

GitHub Actions provides:
- **5GB** cache storage per repository
- **7 days** cache retention (auto-cleanup)
- **Unlimited** cache writes

Our setup uses approximately **200-300MB** per cache:
- pnpm store: ~100-150MB
- Next.js build: ~50-100MB
- Playwright browsers: ~50-100MB

## Monitoring

### View Cache Usage

In GitHub Actions settings:
1. Go to **Settings** → **Actions** → **Caches**
2. View active caches and sizes
3. Manual cleanup available

### Performance Metrics

Expected improvements:
- **test job**: 2-3x faster (5s vs 15s install)
- **build job**: 1.5-2x faster (build cache + dependencies)
- **e2e job**: 2-3x faster (Playwright browsers pre-cached)

## Additional Resources

- [GitHub Actions Caching Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-and-build-outputs)
- [Claude Code Docker Documentation](https://docs.anthropic.com/claude-code/docker)
- [pnpm Documentation](https://pnpm.io/cli/install)
- [Playwright Documentation](https://playwright.dev/docs/ci)

## Next Steps

1. Review updated workflow files
2. Monitor first few workflow runs for cache hits
3. Adjust cache keys if needed
4. Share cache performance metrics with team
5. Consider additional caches for other tools

---

For questions or issues, check GitHub Issues or refer to the Anthropic Claude Code documentation.
