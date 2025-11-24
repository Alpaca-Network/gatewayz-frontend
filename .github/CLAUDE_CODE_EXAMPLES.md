# Claude Code Docker - Practical Examples

Quick reference guide for using Claude Code with Docker in CI/CD pipelines.

## Quick Start

### 1. Manual Workflow Trigger

**Trigger Claude Code to analyze and fix issues:**

```bash
# Using GitHub CLI
gh workflow run claude-code-docker.yml \
  -f task_description="Fix all TypeScript errors in src/components" \
  -f branch="master"

# Check workflow status
gh run list --workflow=claude-code-docker.yml
```

**Or via GitHub UI:**
- Go to: **Actions** → **Claude Code (Docker + Caching)**
- Click: **Run workflow**
- Fill in task description
- Click: **Run workflow** (button)

### 2. Automatic Workflow Integration

Add Claude Code to existing workflows:

```yaml
# .github/workflows/pr-analysis.yml
name: PR Analysis

on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    container:
      image: anthropic/claude-code:latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.17.1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Claude Code analysis
        run: |
          echo "Analyzing PR changes..."
          # Claude Code analysis happens here
```

## Real-World Examples

### Example 1: Fix CI Failures

**Trigger:** When build fails

```bash
gh workflow run claude-code-docker.yml \
  -f task_description="Fix TypeScript compilation errors in src/app/api" \
  -f branch="develop"
```

**What happens:**
1. Docker container spins up
2. Dependencies restore from cache (~5s instead of 60s)
3. Claude Code analyzes code
4. Fixes are applied and committed

### Example 2: Refactor Components

**Trigger:** Proactive refactoring

```bash
gh workflow run claude-code-docker.yml \
  -f task_description="Extract chat message rendering into separate component with proper typing" \
  -f branch="feature/chat-refactor"
```

### Example 3: Add Tests

**Trigger:** Improve test coverage

```bash
gh workflow run claude-code-docker.yml \
  -f task_description="Add unit tests for useAuth hook with 80% coverage minimum" \
  -f branch="master"
```

## Cache Examples

### Example: pnpm Store Cache

```yaml
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

**Cache locations:**
- Linux: `~/.pnpm-store`
- macOS: `~/.pnpm-store`
- Windows: `%LOCALAPPDATA%\pnpm\store`

**Typical size:** 100-150MB

### Example: Build Artifacts Cache

```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: |
      .next
      out
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package.json') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-
```

**Benefits:** Skip rebuild if dependencies unchanged

### Example: Browser Binaries Cache

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package.json') }}
    restore-keys: |
      ${{ runner.os }}-playwright-
```

**Benefits:** E2E tests 2-3x faster, no browser download

## Combining Caches

**Efficient multi-cache strategy:**

```yaml
jobs:
  analyze-and-test:
    runs-on: ubuntu-latest
    container:
      image: anthropic/claude-code:latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup tooling
        uses: pnpm/action-setup@v4
        with:
          version: 10.17.1

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      # Primary cache: pnpm dependencies
      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-

      # Secondary cache: Node modules
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-node-

      # Tertiary cache: Build artifacts
      - name: Cache build
        uses: actions/cache@v4
        with:
          path: .next
          key: ${{ runner.os }}-build-${{ hashFiles('**/package.json') }}
          restore-keys: ${{ runner.os }}-build-

      - name: Install & build
        run: |
          pnpm install --frozen-lockfile
          pnpm build

      - name: Run Claude Code
        run: echo "Analysis complete with caching!"
```

## Performance Comparison

### Before (Without Caching)

```
Job Duration: ~3 minutes 45 seconds
├── Node setup: 10s
├── pnpm install: 2m 30s  ← Bottleneck
├── Build: 45s
├── Claude Code: 30s
└── Cleanup: 10s
```

### After (With Docker + Caching)

```
Job Duration: ~1 minute 15 seconds  (68% faster!)
├── Docker pull: 15s
├── Node setup: 10s
├── Cache restore: 5s  ← Was 2m 30s
├── Build: 20s  ← Build cache hit
├── Claude Code: 30s
└── Cleanup: 5s
```

## Debugging Cache Issues

### Check Cache Status in Logs

```
Run actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: linux-pnpm-store-abc123def456
    restore-keys: linux-pnpm-store-

Cache hit: true  ✅ (using cached dependencies)
```

or

```
Cache hit: false  ❌ (installing fresh)
```

### View All Caches

```bash
# List all caches
gh actions-cache list

# Delete specific cache
gh actions-cache delete "linux-pnpm-store-abc123"

# Delete cache by pattern
gh actions-cache delete --pattern "pnpm" --all
```

### Force Cache Clear

```bash
# Delete all caches for repo
gh actions-cache delete --all
```

## Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| Long install times | Verify pnpm-lock.yaml committed, check cache limits |
| Cache not found | First run creates cache, subsequent runs hit it |
| Docker pull timeout | Retry workflow, check internet |
| Out of disk space | Clear caches in Actions settings |
| Dependencies stale | Update pnpm-lock.yaml and push |

## Environment Variables

Use in Docker workflows:

```yaml
- name: Run Claude Code
  run: |
    # Your task here
    echo "Task complete"
  env:
    CI: true
    NODE_ENV: production
```

## Matrix Builds with Caching

**Run on multiple Node versions:**

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
      cache: 'pnpm'

  - name: Cache by node version
    uses: actions/cache@v4
    with:
      path: ~/.pnpm-store
      key: ${{ runner.os }}-node-${{ matrix.node-version }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
      restore-keys: |
        ${{ runner.os }}-node-${{ matrix.node-version }}-pnpm-
```

## Cost Savings

**Monthly estimate (25 workflows/day):**

Before: 25 workflows × 10 jobs × 3 min = 750 minutes
After: 25 workflows × 10 jobs × 1 min = 250 minutes

**Savings:** 500 minutes/month (~33% reduction)

---

For more details, see [CLAUDE_CODE_SETUP.md](./CLAUDE_CODE_SETUP.md)
