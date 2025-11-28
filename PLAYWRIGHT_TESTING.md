# Playwright E2E Testing Guide

This guide explains how to run Playwright E2E tests reliably, addressing the server readiness issues with Next.js dev server.

## The Problem

Next.js dev server has long cold-start compilation times:
- **Root route (`/`)**: ~74-76 seconds on first compile
- **Chat route (`/chat`)**: ~75 seconds on first compile

During these compilations, the server returns `ERR_EMPTY_RESPONSE` or `ERR_CONNECTION_REFUSED`, causing Playwright tests to fail before they can interact with the page.

## Solutions

We provide three approaches, ordered from **fastest and most reliable** to **slowest but automatic**:

### 🥇 Option 1: Production Mode (Recommended)

**Best for: Reliable, fast tests without compilation delays**

Production builds respond immediately with no compilation time.

```bash
# 1. Build and start production server (in separate terminal)
pnpm build
PORT=3000 pnpm start

# 2. Run tests with production server
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

**Or use the helper scripts:**

```bash
# Terminal 1: Start production server
pnpm test:e2e:prod:start

# Terminal 2: Run tests
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e

# Terminal 1: Stop server when done
pnpm test:e2e:prod:stop
```

**Pros:**
- ✅ Instant response (no compilation)
- ✅ Most stable and reliable
- ✅ Tests match production behavior
- ✅ Fastest test execution

**Cons:**
- ⚠️ Requires rebuild after code changes
- ⚠️ Two-step process (build + test)

---

### 🥈 Option 2: Dev Server with Warmup

**Best for: Testing during development with auto-reloading**

Warm up the dev server before running tests to ensure routes are compiled.

```bash
# 1. Start dev server (in separate terminal)
pnpm dev

# 2. Warm up critical routes + run tests
pnpm test:e2e:warmup
```

**Or warm up manually:**

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Warm up routes
pnpm warmup

# Terminal 2: Run tests (server is warm)
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

**Warmup script details:**

The warmup script (`scripts/warmup-dev-server.ts`) makes requests to critical routes until they respond successfully:
- Default routes: `/`, `/chat`, `/models`, `/rankings`
- Configurable via environment variables
- Max 3 minutes per route
- Retries every 2 seconds

**Pros:**
- ✅ Works with dev server (auto-reload)
- ✅ One-command solution (`pnpm test:e2e:warmup`)
- ✅ No rebuild needed for code changes

**Cons:**
- ⚠️ Slower (74-76s warmup on cold start)
- ⚠️ Extra warmup step

---

### 🥉 Option 3: Extended Timeouts (Automatic but Slow)

**Best for: Quick ad-hoc testing without extra steps**

The Playwright config now has extended timeouts to tolerate cold compilation:

```bash
# Just run tests - Playwright will wait up to 2 minutes for navigation
pnpm test:e2e
```

**Default timeouts:**
- Navigation timeout: **120 seconds** (2 minutes)
- Test timeout: **60 seconds** (1 minute)
- Expect timeout: **15 seconds**
- Web server startup: **180 seconds** (3 minutes)

**Override timeouts if needed:**

```bash
# Increase navigation timeout to 3 minutes
PLAYWRIGHT_NAVIGATION_TIMEOUT=180000 pnpm test:e2e

# Or decrease for faster failures
PLAYWRIGHT_NAVIGATION_TIMEOUT=30000 pnpm test:e2e
```

**Pros:**
- ✅ Zero extra steps
- ✅ Works with dev server
- ✅ Auto-starts server if needed

**Cons:**
- ⚠️ Slowest option (waits for compilation)
- ⚠️ First test may still timeout on very slow machines
- ⚠️ Less deterministic

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLAYWRIGHT_BASE_URL` | Server base URL | `http://localhost:3000` |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Skip starting dev server | `false` |
| `PLAYWRIGHT_NAVIGATION_TIMEOUT` | Navigation timeout (ms) | `120000` (2 min) |
| `WARMUP_BASE_URL` | Warmup script base URL | `http://localhost:3000` |
| `WARMUP_ROUTES` | Routes to warm up (comma-separated) | `/,/chat,/models,/rankings` |
| `WARMUP_MAX_WAIT` | Max wait per route (seconds) | `180` (3 min) |
| `WARMUP_RETRY_INTERVAL` | Retry interval (seconds) | `2` |

---

## Package Scripts

| Script | Description |
|--------|-------------|
| `pnpm test:e2e` | Run all E2E tests (auto-starts dev server) |
| `pnpm test:e2e:ui` | Run tests with Playwright UI |
| `pnpm test:e2e:debug` | Run tests in debug mode |
| `pnpm test:e2e:headed` | Run tests in headed browser |
| `pnpm test:e2e:warmup` | Warm up server + run tests |
| `pnpm test:e2e:prod` | Run tests (expects server already running) |
| `pnpm test:e2e:prod:start` | Start production server for testing |
| `pnpm test:e2e:prod:stop` | Stop production server |
| `pnpm warmup` | Warm up dev server (standalone) |

---

## CI/CD Recommendations

### GitHub Actions / CI Environment

```yaml
- name: Build Next.js
  run: pnpm build

- name: Start production server
  run: pnpm start &
  env:
    PORT: 3000

- name: Wait for server
  run: npx wait-on http://localhost:3000/api/health -t 30000

- name: Run Playwright tests
  run: PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

### Why Production Mode for CI?

1. **Deterministic**: No compilation race conditions
2. **Fast**: Instant responses, no warmup needed
3. **Realistic**: Tests production bundle
4. **Reliable**: Fewer flakes and timeouts

---

## Debugging Test Failures

### Server not responding

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check server logs
tail -f /tmp/nextjs-production.log  # Production
# or
tail -f .next/trace                 # Dev server
```

### Tests timing out on navigation

```bash
# Run with debug mode to see what's happening
DEBUG=pw:webserver pnpm test:e2e:debug

# Increase timeouts temporarily
PLAYWRIGHT_NAVIGATION_TIMEOUT=240000 pnpm test:e2e
```

### Server already running error

```bash
# Stop production server
pnpm test:e2e:prod:stop

# Or kill manually
pkill -f "next start"

# Clean PID file
rm .next-server.pid
```

### Compilation taking too long

```bash
# Use production mode instead
pnpm test:e2e:prod:start
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
```

---

## Best Practices

### ✅ DO

- **Use production mode in CI/CD** for reliability
- **Warm up dev server** when testing locally during development
- **Run specific test files** instead of full suite during iteration
- **Keep server running** between test runs (with `reuseExistingServer`)
- **Use health endpoint** (`/api/health`) to verify server readiness

### ❌ DON'T

- **Don't rely on auto-start** for critical test runs (too slow)
- **Don't run tests immediately** after starting dev server (wait for warmup)
- **Don't ignore timeout errors** - they indicate real server issues
- **Don't use tiny timeouts** in config - Next.js needs time to compile
- **Don't test on cold dev server** without warmup (tests will fail)

---

## Health Check Endpoint

A `/api/health` endpoint is available for monitoring server readiness:

```bash
# Simple health check
curl http://localhost:3000/api/health

# Response
{
  "status": "ok",
  "timestamp": "2025-11-28T10:30:00.000Z",
  "uptime": 42.5,
  "env": "development"
}

# HEAD request for lightweight check
curl -I http://localhost:3000/api/health
```

Use this in warmup scripts, health checks, and monitoring tools.

---

## Quick Reference

### Fastest: Production Mode

```bash
pnpm build && pnpm start          # Terminal 1
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e  # Terminal 2
```

### Development: Warmup

```bash
pnpm dev                          # Terminal 1
pnpm test:e2e:warmup             # Terminal 2
```

### Automatic: Extended Timeouts

```bash
pnpm test:e2e                     # Single command
```

---

## Troubleshooting

### Issue: "ERR_EMPTY_RESPONSE on page.goto('/chat')"

**Root cause**: Next.js is compiling the route. Server can't respond yet.

**Solution**: Use production mode or warmup script.

---

### Issue: "Server did not start within 180 seconds"

**Root cause**: Build is taking too long or server crashed.

**Solutions**:
- Check build logs for errors: `pnpm build`
- Increase timeout: `PLAYWRIGHT_WEBSERVER_TIMEOUT=300000 pnpm test:e2e`
- Use production mode: faster and more reliable

---

### Issue: "Tests pass on second run but fail on first run"

**Root cause**: Routes are warm on second run, cold on first run.

**Solution**: This is expected with dev server. Use warmup or production mode.

---

### Issue: "Port 3000 already in use"

**Solutions**:
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm start
PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm test:e2e
```

---

## Summary

**For reliable tests**: Use production mode
**For active development**: Use warmup script
**For quick checks**: Use extended timeouts (automatic)

Choose the approach that best fits your workflow. When in doubt, production mode is the most reliable option.
