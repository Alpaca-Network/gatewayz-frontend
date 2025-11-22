# E2E Testing Guide - Gatewayz Beta

This guide documents the end-to-end (E2E) testing setup for Gatewayz Beta, including automated testing with real Privy authentication credentials.

## Table of Contents

- [Overview](#overview)
- [Privy Test Account](#privy-test-account)
- [Local Setup](#local-setup)
- [Running Tests Locally](#running-tests-locally)
- [Test Fixtures](#test-fixtures)
- [Test Suites](#test-suites)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Environment Variables](#environment-variables)
- [Debugging Tests](#debugging-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The E2E testing infrastructure uses **Playwright** with several test fixtures:

1. **Mock Authentication** - `authenticatedPage` fixture with fake credentials
2. **Real Privy Authentication** - `realAuthPage` fixture with actual Privy test account
3. **Mock APIs** - `mockModelsAPI` and `mockChatAPI` fixtures for network interception

### Test Coverage

- **Authentication Tests** (`e2e/auth.spec.ts`) - Public pages, localStorage, session persistence
- **Real Privy Auth Tests** (`e2e/auth-privy-real.spec.ts`) - Real login flow with actual credentials
- **Models Tests** (`e2e/models-loading.spec.ts`) - Model discovery and loading
- **Chat Tests** (`e2e/chat*.spec.ts`) - Chat functionality (currently many skipped)

---

## Privy Test Account

A dedicated Privy test account has been configured for E2E testing:

### Credentials

| Field | Value |
|-------|-------|
| **Email** | `test-1049@privy.io` |
| **OTP** | `362762` |
| **Phone** | `+1 555 555 6196` (alternative) |
| **Platform** | Privy Test Account System |

### Important Notes

- ⚠️ **OTP Expiration**: The OTP expires 10 hours after creation. For Privy test accounts, it regenerates automatically
- ✅ **Dedicated for Testing**: This account is specifically created for CI/CD automation
- 🔒 **Security**: Credentials are stored in GitHub Secrets for CI/CD environments
- 📌 **Default Values**: Fixtures default to these credentials if env vars aren't set

### Account Status

The account was created via Privy's test account management panel with:
- **Email verification enabled**
- **OTP support enabled**
- **Test account flag enabled**
- **10-hour session expiry**

---

## Local Setup

### 1. Prerequisites

```bash
# Node.js 20+, pnpm 10.17.1+
node --version  # v20+
pnpm --version  # 10.17.1+
```

### 2. Install Dependencies

```bash
# Install project dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Add or verify these variables in `.env.local`:

```env
# Required for Privy integration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai

# E2E Test Credentials (optional - defaults are provided)
PRIVY_TEST_EMAIL=test-1049@privy.io
PRIVY_TEST_OTP=362762
```

### 4. Build Application

```bash
# For production build
pnpm build

# Or use dev server
pnpm dev
```

---

## Running Tests Locally

### Basic Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run in debug mode (step-through debugging)
pnpm test:e2e:debug

# Run with visible browser (headed mode)
pnpm test:e2e:headed
```

### Run Specific Test Suites

```bash
# Run only authentication tests
pnpm test:e2e -g "Authentication"

# Run only real Privy tests
pnpm test:e2e -g "Real Privy Authentication"

# Run only models tests
pnpm test:e2e -g "Models"

# Run only chat tests
pnpm test:e2e -g "Chat"
```

### Run Single Test File

```bash
# Run specific test file
pnpm exec playwright test e2e/auth-privy-real.spec.ts

# Run with detailed output
pnpm exec playwright test e2e/auth-privy-real.spec.ts --reporter=list

# Run with custom reporter
pnpm exec playwright test e2e/auth-privy-real.spec.ts --reporter=html
```

### Advanced Options

```bash
# Run with specific project (browser)
pnpm exec playwright test --project=chromium

# Run with custom timeout (in ms)
pnpm exec playwright test --timeout=60000

# Run with retries
pnpm exec playwright test --retries=2

# Run failing tests only
pnpm exec playwright test --last-failed

# Run tests matching pattern
pnpm exec playwright test -g "can log in"

# Generate and open report
pnpm test:e2e
pnpm exec playwright show-report
```

---

## Test Fixtures

### authenticatedPage

Mock authentication using fake credentials stored in localStorage:

```typescript
test('example with mock auth', async ({ authenticatedPage: page }) => {
  await page.goto('/');

  // Auth is already set up:
  const apiKey = await page.evaluate(() =>
    localStorage.getItem('gatewayz_api_key')
  );
  expect(apiKey).toBe('test-api-key-e2e-12345');
});
```

**Pre-set Values:**
- API Key: `test-api-key-e2e-12345`
- User ID: `999`
- Email: `e2e-test@gatewayz.ai`
- Tier: `pro`
- Credits: `10000`

### realAuthPage

Real authentication using actual Privy test account:

```typescript
test('example with real auth', async ({ realAuthPage: page }) => {
  // Fixture automatically logs in via Privy
  await page.goto('/');

  // Session should be established
  const url = page.url();
  expect(url).toMatch(/chat|models|settings/i);
});
```

**What This Does:**
1. Navigates to app homepage
2. Finds and clicks login button
3. Enters email: `test-1049@privy.io`
4. Enters OTP: `362762`
5. Waits for authentication to complete
6. Returns authenticated page instance

**Environment Variables:**
```env
PRIVY_TEST_EMAIL=test-1049@privy.io
PRIVY_TEST_OTP=362762
```

### mockModelsAPI

Mock the models API endpoint:

```typescript
test('example with mocked models', async ({ page, mockModelsAPI }) => {
  await mockModelsAPI();

  await page.goto('/models');
  // Models are now mocked
});
```

### mockChatAPI

Mock chat completions and sessions endpoints:

```typescript
test('example with mocked chat', async ({ page, mockChatAPI }) => {
  await mockChatAPI();

  // Chat API calls are now mocked
});
```

---

## Test Suites

### 1. Authentication Tests (`e2e/auth.spec.ts`)

Tests mock authentication and basic auth flows:

- ✅ Public page accessibility (homepage, models)
- ✅ Storage and session management
- ✅ Protected endpoints
- ✅ Multiple tabs
- ✅ Error handling
- ✅ Session timeouts
- ✅ Context availability

```bash
pnpm test:e2e -g "Authentication"
```

### 2. Real Privy Authentication Tests (`e2e/auth-privy-real.spec.ts`)

Tests real Privy login flow with actual credentials:

- ✅ Real login with valid email and OTP
- ✅ Protected route access (chat, models, settings)
- ✅ Session persistence across navigation
- ✅ Session persistence after reload
- ✅ API request integration
- ✅ Model fetching after auth
- ✅ Network error handling
- ✅ Network reconnection

```bash
pnpm test:e2e -g "Real Privy Authentication"
```

### 3. Models Loading Tests (`e2e/models-loading.spec.ts`)

Tests model discovery and loading:

- ✅ Models page loads
- ✅ Models list displays
- ✅ Search functionality
- ✅ Filtering
- ✅ Pagination

```bash
pnpm test:e2e -g "Models"
```

### 4. Chat Tests (`e2e/chat*.spec.ts`)

Tests chat functionality (many currently skipped):

- 🚧 Chat page loads
- 🚧 Message sending
- 🚧 Model selection
- 🚧 Session management

```bash
pnpm test:e2e -g "Chat"
```

---

## GitHub Actions Workflows

### 1. Standard CI Workflow (`ci.yml`)

Runs on: push to main/develop, pull requests

Includes:
- Unit tests
- Linting
- Type checking
- Build
- E2E tests with mock auth

```yaml
# E2E tests with mock authentication
run: pnpm exec playwright test
env:
  CI: true
  PLAYWRIGHT_BASE_URL: http://localhost:3000
```

### 2. Real Privy Auth Workflow (`e2e-privy-auth.yml`)

**Schedule:** Daily at 2 AM UTC (or manually via `workflow_dispatch`)

**Features:**
- Real Privy authentication tests
- Test scope selection (all, auth-only, models-only, chat-only, privy-real-only)
- Comprehensive reporting
- Failure notifications
- Test artifacts (reports, videos, logs)

**Manual Trigger:**
```bash
# Use GitHub CLI to trigger manually
gh workflow run e2e-privy-auth.yml --ref main
```

**Environment Setup:**
- Credentials from GitHub Secrets: `PRIVY_TEST_EMAIL`, `PRIVY_TEST_OTP`
- Falls back to defaults if not set

**Reports Generated:**
- HTML Playwright report
- JSON test results
- Video recordings (on failure)
- Server logs (on failure)

---

## Environment Variables

### Required for Development

```env
# Privy App Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.gatewayz.ai

# Stripe (for billing features)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### E2E Test Credentials

```env
# Privy test account (optional - defaults provided)
PRIVY_TEST_EMAIL=test-1049@privy.io
PRIVY_TEST_OTP=362762
```

### GitHub Actions Secrets

```bash
# Set these in GitHub repo settings → Secrets and variables → Actions
NEXT_PUBLIC_PRIVY_APP_ID          # Privy app ID
NEXT_PUBLIC_API_BASE_URL          # Backend API URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # Stripe public key
PRIVY_TEST_EMAIL                  # Test account email
PRIVY_TEST_OTP                    # Test account OTP
```

**To set GitHub Secrets:**
```bash
gh secret set PRIVY_TEST_EMAIL -b "test-1049@privy.io"
gh secret set PRIVY_TEST_OTP -b "362762"
```

---

## Debugging Tests

### 1. UI Mode (Interactive)

```bash
pnpm test:e2e:ui
```

Opens an interactive browser where you can:
- Step through each test line-by-line
- Inspect elements
- Watch network requests
- View console logs

### 2. Debug Mode

```bash
pnpm test:e2e:debug
```

Launches Playwright Inspector with:
- Code stepping
- Breakpoints
- Console evaluation
- Element inspection

### 3. Headed Mode (Visible Browser)

```bash
pnpm test:e2e:headed
```

Runs tests in a visible browser window so you can watch execution.

### 4. Single Test with Logging

```bash
pnpm exec playwright test e2e/auth-privy-real.spec.ts --reporter=verbose
```

### 5. View Test Report

```bash
# After tests complete
pnpm exec playwright show-report
```

Opens HTML report with:
- Test timings
- Screenshots
- Videos (if captured)
- Failure details

### 6. View Server Logs

During local dev:
```bash
# Terminal 1: Start dev server with logs
pnpm dev

# Terminal 2: Run tests
pnpm test:e2e
```

### 7. Network Request Inspection

Add to test:
```typescript
test('debug network requests', async ({ page }) => {
  page.on('request', request => {
    console.log(`>> ${request.method()} ${request.url()}`);
  });

  page.on('response', response => {
    console.log(`<< ${response.status()} ${response.url()}`);
  });

  await page.goto('/');
});
```

### 8. Screenshot on Failure

Screenshots are automatically captured on test failure:
```bash
# View failures
ls test-results/
```

---

## Best Practices

### 1. Test Isolation

Each test should be independent:
```typescript
test('test one thing', async ({ page }) => {
  // Setup
  await page.goto('/');

  // Test single behavior
  const button = page.locator('button');
  await expect(button).toBeVisible();

  // Cleanup happens automatically
});
```

### 2. Use Appropriate Fixtures

```typescript
// For testing public pages
test('public page', async ({ page }) => { ... });

// For testing authenticated features with mock auth
test('authenticated page', async ({ authenticatedPage: page }) => { ... });

// For testing real Privy login flow
test('real auth flow', async ({ realAuthPage: page }) => { ... });
```

### 3. Waits vs Timeouts

```typescript
// Good: Wait for specific element
await page.waitForSelector('button:has-text("Send")');

// Good: Wait for network activity
await page.waitForLoadState('networkidle');

// Acceptable: Short fixed wait (rarely)
await page.waitForTimeout(500);

// Avoid: Long fixed waits
// await page.waitForTimeout(10000); // ❌
```

### 4. Element Selection

```typescript
// Prefer test IDs
await page.click('[data-testid="send-button"]');

// Then text matching
await page.click('button:has-text("Send")');

// Then role-based
await page.click('button[role="submit"]');

// Avoid: Index-based (brittle)
// await page.click('button:nth-of-type(3)'); // ❌
```

### 5. Error Messages

```typescript
// Good: Descriptive assertion messages
expect(response.status(), 'API should return 200').toBe(200);

// Good: Context in test names
test('should redirect to /chat after successful login', async () => {
  // ...
});
```

### 6. Cleanup

Tests auto-cleanup but for explicit cleanup:
```typescript
test('with cleanup', async ({ page }) => {
  // Setup
  await page.goto('/');

  // Test

  // Cleanup (if needed)
  await page.close();
});
```

---

## Troubleshooting

### Issue: Tests timeout

**Solution:**
```bash
# Increase timeout
pnpm exec playwright test --timeout=120000

# Or in test:
test('slow test', async ({ page }) => {
  page.setDefaultTimeout(120000);
  // ...
}, { timeout: 120000 });
```

### Issue: "Connection refused" errors

**Solutions:**
```bash
# 1. Ensure dev server is running
pnpm dev

# 2. Build first if using production build
pnpm build
pnpm start

# 3. Check port 3000 is available
lsof -i :3000
```

### Issue: Privy login not working in tests

**Check:**
1. Is `NEXT_PUBLIC_PRIVY_APP_ID` set correctly?
2. Are credentials correct: `test-1049@privy.io` / `362762`?
3. Try headed mode to see what's happening:
   ```bash
   pnpm test:e2e:headed -g "Real Privy"
   ```
4. Check Privy modal is appearing:
   ```typescript
   await page.screenshot({ path: 'debug-privy.png' });
   ```

### Issue: "Timed out waiting for element"

**Solutions:**
1. **Element doesn't exist**: Check page rendering
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   const content = await page.content();
   console.log(content);
   ```

2. **Element hidden**: Use `isVisible({ timeout: 0 })`
   ```typescript
   if (await element.isVisible({ timeout: 0 }).catch(() => false)) {
     await element.click();
   }
   ```

3. **Timing issue**: Add waits
   ```typescript
   await page.waitForLoadState('networkidle');
   await page.waitForTimeout(1000);
   ```

### Issue: Tests pass locally but fail in CI

**Common causes:**
1. **Missing env vars**: Set GitHub Secrets
2. **Timing differences**: CI is slower - increase waits
3. **Network issues**: Use mock APIs for CI
4. **Browser differences**: Test on chromium in CI

**Solution:**
```yaml
# In workflow:
env:
  CI: true
  PLAYWRIGHT_BASE_URL: http://localhost:3000
  DEBUG: pw:api
```

### Issue: Flaky tests (pass sometimes, fail sometimes)

**Solutions:**
1. **Improve waits:**
   ```typescript
   await page.waitForLoadState('networkidle'); // Instead of fixed timeout
   ```

2. **Retry logic:**
   ```bash
   pnpm exec playwright test --retries=2
   ```

3. **In test config:**
   ```typescript
   // playwright.config.ts
   retries: 2,
   ```

### Issue: "Page crashed"

**Causes:**
- Out of memory
- JavaScript error
- Network issue

**Solutions:**
```bash
# Run fewer tests in parallel
pnpm exec playwright test --workers=1

# Or in config:
fullyParallel: false
workers: 1
```

### Issue: Can't find Privy modal or input fields

**Debug:**
```typescript
test('debug privy modal', async ({ realAuthPage: page }) => {
  // Take screenshot to see what's visible
  await page.screenshot({ path: 'privy-modal.png' });

  // List all visible inputs
  const inputs = await page.locator('input').count();
  console.log(`Found ${inputs} input fields`);

  // List input placeholders
  const placeholders = await page.locator('input').evaluateAll((els: any[]) =>
    els.map(el => el.placeholder)
  );
  console.log('Placeholders:', placeholders);
});
```

---

## Contributing

When adding new E2E tests:

1. **Use appropriate fixtures:**
   - Mock auth for testing features
   - Real auth for testing login flows
   - Mock APIs for testing UI independently

2. **Follow naming conventions:**
   - Use descriptive test names
   - Group related tests with `test.describe()`
   - Use spec file names: `feature.spec.ts`

3. **Add to correct file:**
   - `auth*.spec.ts` - Authentication tests
   - `models*.spec.ts` - Models feature tests
   - `chat*.spec.ts` - Chat feature tests

4. **Document complex tests:**
   ```typescript
   test('complex flow', async ({ page }) => {
     // Step 1: Login
     // Step 2: Navigate to feature
     // Step 3: Perform action
     // Step 4: Verify result
   });
   ```

5. **Keep tests fast:**
   - Skip unnecessary waits
   - Use mock APIs when possible
   - Parallelize tests

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Privy Documentation](https://docs.privy.io)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Support

For issues or questions:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Run in UI mode: `pnpm test:e2e:ui`
3. Check GitHub Actions logs
4. Review Playwright reports in `playwright-report/`
5. Create an issue with test failure logs
