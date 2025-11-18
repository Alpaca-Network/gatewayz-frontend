# Playwright E2E Testing - CI Integration Guide

This guide explains the Playwright E2E testing setup, CI integration, and how to write tests for the Gatewayz Beta application.

## Overview

Playwright is fully integrated into the CI/CD pipeline and configured to run E2E tests on:
- Pull requests
- Pushes to `main`, `master`, and `develop` branches

### Key Features

✅ **Automated E2E Testing** - Tests run on every PR and main branch push
✅ **Multi-Browser Support** - Currently configured for Chromium (Firefox/Safari available)
✅ **CI Optimization** - Single worker mode, 2 retries, GitHub reporter integration
✅ **Artifact Retention** - Reports stored for 30 days, videos for 7 days
✅ **Visual Debugging** - Screenshots on failure, trace collection, video recording
✅ **Quick Local Testing** - Multiple npm commands for different testing scenarios

---

## Local Development

### Running E2E Tests Locally

```bash
# Run all tests in headless mode
pnpm test:e2e

# Run tests with interactive UI (recommended for development)
pnpm test:e2e:ui

# Run tests in headed mode (visible browser window)
pnpm test:e2e:headed

# Debug mode (step through tests)
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test e2e/auth.spec.ts

# Run tests matching a pattern
pnpm exec playwright test -g "authentication"

# Run with trace viewer
pnpm exec playwright test --trace on

# Run with additional verbosity
pnpm exec playwright test --verbose
```

### Prerequisites

1. **Node.js** (v20+) - Already installed
2. **pnpm** (v10.17+) - Already installed
3. **Dependencies** - Run `pnpm install`
4. **Browsers** - Run `pnpm exec playwright install`

### Local Development Workflow

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run tests in UI mode
pnpm test:e2e:ui
```

The dev server will automatically start when running tests locally (configured in `playwright.config.ts`).

---

## CI/CD Pipeline

### Workflow Jobs

The CI pipeline includes the following stages:

| Job | Purpose | Triggers |
|-----|---------|----------|
| **test** | Jest unit tests | All pushes/PRs |
| **lint** | ESLint checks | All pushes/PRs |
| **typecheck** | TypeScript validation | All pushes/PRs |
| **build** | Next.js build | All pushes/PRs |
| **e2e** | Playwright E2E tests | PRs + main/master/develop |
| **ci-success** | Summary gate | All above (soft-pass for main) |

### E2E Job Details

**Location:** `.github/workflows/ci.yml` (lines 121-186)

**Steps:**
1. Checkout code
2. Setup pnpm (v10.17.1) and Node.js (v20)
3. Install dependencies with frozen lockfile
4. Install Playwright browsers with system dependencies
5. Build application with required env vars
6. Start production server (`pnpm start`)
7. Wait for server to be ready (60s timeout)
8. Run Playwright tests
9. Upload HTML report (always)
10. Upload test videos on failure

**Timeout:** 30 minutes max
**Environment:** ubuntu-latest

### Environment Variables

The E2E job sets these env vars for testing:

```yaml
CI: true
PLAYWRIGHT_BASE_URL: http://localhost:3000
NEXT_PUBLIC_PRIVY_APP_ID: ${{ secrets.NEXT_PUBLIC_PRIVY_APP_ID || 'test-privy-app-id' }}
NEXT_PUBLIC_API_BASE_URL: ${{ secrets.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai' }}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy' }}
```

### Artifacts

#### Playwright Report
- **Uploaded:** Always (even on failure)
- **Path:** `playwright-report/`
- **Retention:** 30 days
- **Use:** Open `index.html` to see detailed test results with screenshots

#### Test Videos
- **Uploaded:** On failure only
- **Path:** `test-results/`
- **Retention:** 7 days
- **Use:** Debug failed tests visually

---

## Test Configuration

### Configuration File

**Location:** `playwright.config.ts`

**Key Settings:**

```typescript
{
  testDir: './e2e',                    // Test files location
  fullyParallel: true,                // Parallel execution
  forbidOnly: !!process.env.CI,       // Fail on test.only in CI
  retries: process.env.CI ? 2 : 0,    // 2 retries in CI, 0 locally
  workers: process.env.CI ? 1 : undefined, // 1 worker in CI
  timeout: 30000,                     // 30 second test timeout
  baseURL: 'http://localhost:3000',   // Default base URL
  trace: 'on-first-retry',           // Collect trace on retry
  screenshot: 'only-on-failure',     // Screenshot on failure
  video: 'retain-on-failure',        // Video on failure
}
```

### Base URL

Tests use the base URL from:
1. `PLAYWRIGHT_BASE_URL` environment variable (if set)
2. `baseURL` in config (default: `http://localhost:3000`)
3. Absolute URLs in tests (e.g., `page.goto('http://example.com')`)

---

## Writing Tests

### Test Structure

Create test files in the `e2e/` directory with `.spec.ts` extension:

```typescript
// e2e/example.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await page.click('button[data-testid="submit"]');

    // Assert
    await expect(page).toHaveURL('/result');
    await expect(page.locator('h1')).toContainText('Success');
  });
});
```

### Best Practices

1. **Use data-testid attributes** for reliable selectors:
   ```typescript
   await page.click('[data-testid="nav-models"]');
   ```

2. **Avoid flaky selectors** (index-based, text-based):
   ```typescript
   // ❌ Bad - may break if DOM changes
   await page.click('button:nth-child(2)');

   // ✅ Good - stable identifier
   await page.click('[data-testid="submit-btn"]');
   ```

3. **Use page object models** for complex flows:
   ```typescript
   class LoginPage {
     constructor(private page: Page) {}

     async goto() {
       await this.page.goto('/login');
     }

     async login(email: string, password: string) {
       await this.page.fill('input[name="email"]', email);
       await this.page.fill('input[name="password"]', password);
       await this.page.click('button[type="submit"]');
     }
   }
   ```

4. **Test user flows, not implementation details**:
   ```typescript
   // ✅ Good - tests user intent
   test('user can log in', async ({ page }) => {
     await page.goto('/login');
     await page.fill('[data-testid="email"]', 'user@example.com');
     await page.fill('[data-testid="password"]', 'password123');
     await page.click('[data-testid="submit"]');
     await expect(page).toHaveURL('/dashboard');
   });
   ```

5. **Use meaningful test descriptions**:
   ```typescript
   // ✅ Clear and specific
   test('navigates to model details when clicking on a model', async ({ page }) => {
     // ...
   });

   // ❌ Too vague
   test('test click', async ({ page }) => {
     // ...
   });
   ```

### Common Patterns

#### Authentication
```typescript
test.describe('Authenticated Routes', () => {
  // Use test.beforeEach() to handle auth for multiple tests
  test.beforeEach(async ({ page }) => {
    // Set session token or login before each test
    await page.evaluate(() => {
      localStorage.setItem('gatewayz_api_key', 'test-token');
    });
    await page.goto('/chat');
  });

  test('should load chat interface', async ({ page }) => {
    await expect(page).toHaveTitle(/Gatewayz/);
  });
});
```

#### API Mocking
```typescript
test('handles API errors gracefully', async ({ page }) => {
  // Mock failed API response
  await page.route('/api/models', route => {
    route.abort('failed');
  });

  await page.goto('/models');
  await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
});
```

#### Network Waiting
```typescript
test('waits for network response', async ({ page }) => {
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/chat/completions')
  );

  await page.click('[data-testid="send-message"]');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
});
```

### Example Tests for Gatewayz

See `/root/repo/e2e/example.spec.ts` for template test structure. Here are some key areas to test:

```typescript
// Navigation
test('main navigation works', async ({ page }) => { ... });

// Authentication
test('redirected to login when not authenticated', async ({ page }) => { ... });

// Chat Interface
test('can send message and receive response', async ({ page }) => { ... });

// Model Selection
test('can select and switch models', async ({ page }) => { ... });

// Session Management
test('persists chat session', async ({ page }) => { ... });
```

---

## Debugging Failed Tests

### Local Debugging

```bash
# Run with UI (step through tests)
pnpm test:e2e:ui

# Debug mode (pauses at each action)
pnpm test:e2e:debug

# Run with trace collection
pnpm exec playwright test --trace on

# Run specific failing test
pnpm exec playwright test e2e/chat.spec.ts -g "send message"
```

### Viewing Trace Files

```bash
# Generate and view trace
pnpm exec playwright show-trace test-results/trace.zip
```

### Playwright Inspector

```bash
# Launch inspector (pause at each action)
PWDEBUG=1 pnpm test:e2e
```

### CI Artifacts

When tests fail in CI:
1. Download `playwright-report` artifact
2. Extract and open `index.html` in browser
3. View screenshots and detailed failure info
4. (On failure) Download `playwright-test-videos` to see test execution

---

## Troubleshooting

### Common Issues

#### "page.goto() timed out"
**Cause:** App not running or taking too long to load
**Solution:**
```bash
# Ensure server is running and accessible
curl http://localhost:3000

# Increase timeout in config
timeout: 60000 // 60 seconds
```

#### "Locator not found"
**Cause:** Selector doesn't exist on page
**Solution:**
```typescript
// Use browser DevTools to find correct selector
await page.pause(); // Pauses test, allows inspection

// Or use Playwright Inspector
PWDEBUG=1 pnpm test:e2e
```

#### "Test hangs or times out"
**Cause:** Waiting for element that never appears
**Solution:**
```typescript
// Always set explicit timeout
await expect(page.locator('[data-testid="element"]')).toBeVisible({
  timeout: 5000 // 5 second timeout
});
```

#### "Tests pass locally but fail in CI"
**Causes:** Environment differences, timing issues, missing dependencies
**Solutions:**
```bash
# Use same Node version as CI
nvm use 20

# Run in headed mode to see what's happening
pnpm test:e2e:headed

# Check CI logs for full error output
# Download artifacts for screenshots/videos
```

---

## Performance Optimization

### CI Optimization Settings

Current config optimizes for CI:

```typescript
// Single worker in CI (no parallelization overhead)
workers: process.env.CI ? 1 : undefined

// 2 retries for flaky tests
retries: process.env.CI ? 2 : 0

// Avoid test.only in CI (strict mode)
forbidOnly: !!process.env.CI
```

### Reducing Test Execution Time

1. **Skip non-critical tests on some branches:**
   ```yaml
   if: github.event_name == 'pull_request' ||
       github.ref == 'refs/heads/main'
   ```

2. **Use test.skip() for known issues:**
   ```typescript
   test.skip('flaky test - TODO: fix', async ({ page }) => {
     // ...
   });
   ```

3. **Mark slow tests with .slow():**
   ```typescript
   test.slow()('upload large file', async ({ page }) => {
     // ...
   }, 60000); // 60s timeout
   ```

4. **Parallel execution locally:**
   ```bash
   # Runs in parallel on local machine
   pnpm test:e2e

   # Sequential in CI (already configured)
   # (WORKERS=1 in CI for reliability)
   ```

---

## Integration with GitHub

### Branch Protection Rules

Configure branch protection to require E2E tests:

1. Go to repo Settings → Branches
2. Add rule for `main`/`master` branch
3. Require status check: **CI Success**

This ensures:
- All jobs (including E2E) must pass before merge
- No bypassing failed tests
- High quality baseline

### Pull Request Checks

When you open a PR:
1. **E2E job** appears in checks
2. Tests run automatically
3. Pass/fail status shown
4. Click "Details" to see full output

### GitHub Annotations

Test failures appear as annotations in PR:
- Failed test name
- Error message
- Line number reference

---

## Advanced Topics

### Cross-Browser Testing

Uncomment in `playwright.config.ts` to test multiple browsers:

```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
],
```

Run with: `pnpm test:e2e`

### Custom Test Reporter

Create custom test reporter in `e2e/custom-reporter.ts`:

```typescript
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class MyReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`${test.title}: ${result.status}`);
  }
}
```

Update config:
```typescript
reporter: [
  ['github'],
  ['html'],
  ['./e2e/custom-reporter.ts'],
],
```

### Visual Regression Testing

Install `@playwright/test`:
```bash
pnpm add -D @playwright/test
```

Example:
```typescript
test('visual appearance', async ({ page }) => {
  await page.goto('/models');
  await expect(page).toHaveScreenshot('models-page.png');
});
```

---

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Inspector](https://playwright.dev/docs/inspector)
- [Selectors](https://playwright.dev/docs/locators)
- [Test Configuration](https://playwright.dev/docs/test-configuration)
- [CI/CD Guides](https://playwright.dev/docs/ci)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

## Quick Reference

### npm Commands
```bash
pnpm test:e2e              # Run all tests
pnpm test:e2e:ui          # Interactive UI mode
pnpm test:e2e:headed      # Visible browser
pnpm test:e2e:debug       # Debugger mode
```

### Configuration
- **Config file:** `playwright.config.ts`
- **Test directory:** `e2e/`
- **CI workflow:** `.github/workflows/ci.yml`

### Key Files
- Example test: `e2e/example.spec.ts`
- Configuration: `playwright.config.ts`
- Workflow: `.github/workflows/ci.yml`

### Useful Flags
```bash
--ui              # UI mode
--headed          # Show browser
--debug           # Debugger
-g "pattern"      # Run tests matching pattern
--trace on        # Collect trace
--verbose         # Verbose output
```

---

## Support

For issues or questions:
1. Check Playwright docs: https://playwright.dev
2. Review test examples in `e2e/`
3. Check CI logs in GitHub Actions
4. Open issue on GitHub repo
