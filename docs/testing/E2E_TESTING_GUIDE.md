# E2E Testing Guide - Gatewayz Beta

This guide covers the comprehensive E2E test suite that ensures critical functionality like auth, chat, and models loading never break.

## Overview

The E2E test suite consists of **70+ tests** organized into three critical areas:

### 1. **Authentication Tests** (`auth.spec.ts`)
- Public page accessibility
- Storage and session persistence
- Protected endpoints
- Cross-tab sync
- Error handling
- Session timeouts
- Context availability

### 2. **Models Loading Tests** (`models-loading.spec.ts`)
- Page loading and performance
- Search and filtering
- Model details pages
- Real-time updates
- Large list handling
- Error recovery
- Accessibility

### 3. **Chat Functionality Tests** (`chat-critical.spec.ts`)
- Page loading with authentication
- Message input and submission
- Model selection
- Message display
- Session management
- Performance metrics
- Accessibility

## Getting Started

### Installation

The test suite uses Playwright v1.56.0, which is already in `package.json`:

```bash
pnpm install
```

### Running Tests

**Run all critical E2E tests:**
```bash
pnpm test:e2e
```

**Run tests by category:**
```bash
# Only authentication tests
pnpm test:e2e -g "Authentication"

# Only models tests
pnpm test:e2e -g "Models"

# Only chat tests
pnpm test:e2e -g "Chat.*Critical"
```

**Run specific test file:**
```bash
pnpm test:e2e auth.spec.ts
pnpm test:e2e models-loading.spec.ts
pnpm test:e2e chat-critical.spec.ts
```

### Interactive Testing

**Run tests with UI (recommended for development):**
```bash
pnpm test:e2e:ui
```

The UI shows:
- Live browser view
- Test execution status
- Network activity
- Console logs and errors
- Trace playback for failures

**Debug mode (slow motion, step through):**
```bash
pnpm test:e2e:debug
```

**Headed mode (visible browser):**
```bash
pnpm test:e2e:headed
```

## Test Architecture

### Test Fixtures (`fixtures.ts`)

Provides reusable test setup:

```typescript
// Automatically authenticated page
test('example', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/chat');
  // Already logged in
});

// Mock chat API
test('example', async ({ mockChatAPI }) => {
  await mockChatAPI();
  // All chat endpoints return mock data
});

// Mock models API
test('example', async ({ mockModelsAPI }) => {
  await mockModelsAPI();
  // All model endpoints return mock data
});
```

### Test Helpers (`test-helpers.ts`)

Utilities for common operations:

```typescript
import {
  waitForApiCall,
  getApiRequests,
  checkForErrors,
  mockLocalStorage,
  getLocalStorageData,
  getPerformanceMetrics,
  waitForElementWithText,
  assertClickable,
} from './test-helpers';

// Usage examples
const isApiCalled = await waitForApiCall(page, '/api/models');
const errors = await checkForErrors(page);
const metrics = await getPerformanceMetrics(page);
await mockLocalStorage(page, { gatewayz_api_key: 'test-key' });
```

## Test Coverage by Feature

### Authentication
- ✅ Public pages (home, models) accessible without auth
- ✅ localStorage persists across reloads
- ✅ sessionStorage for temporary tokens
- ✅ API requests include auth headers
- ✅ Multi-tab synchronization
- ✅ Corrupted auth data recovery
- ✅ Expired token handling

### Models
- ✅ Page loads within reasonable time
- ✅ Models displayed as cards/list
- ✅ Search functionality
- ✅ Filter interactions
- ✅ Large list handling (200+ models)
- ✅ Model details pages
- ✅ Dynamic updates
- ✅ Memory efficiency
- ✅ Responsive design
- ✅ Error recovery

### Chat
- ✅ Page loads for authenticated users
- ✅ Message input visible and focusable
- ✅ Can type messages
- ✅ Multiline support
- ✅ Send button clickable
- ✅ Message submission
- ✅ Model selector exists
- ✅ Model switching
- ✅ Message display area
- ✅ Session persistence
- ✅ New chat creation
- ✅ Performance and accessibility

## Configuration

### Playwright Config (`playwright.config.ts`)

Key settings:

```typescript
// Timeout for each test (important for API calls)
timeout: 45 * 1000  // 45 seconds

// Retry failed tests
retries: process.env.CI ? 3 : 1

// Single worker in CI for stability
workers: process.env.CI ? 1 : 4

// Artifacts on failure
screenshot: 'only-on-failure'
video: 'retain-on-failure'
trace: 'on-first-retry'

// Run tests matching these patterns
testMatch: [
  '**/*auth*.spec.ts',
  '**/*models*.spec.ts',
  '**/*chat*.spec.ts',
]
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Commits to main
- Manual workflow dispatch

Test results available in:
- GitHub Actions summary
- Playwright HTML report
- Artifact downloads

### Report Artifacts

- `playwright-report/` - Interactive HTML report
- `test-results.json` - JSON test results
- Screenshots/videos of failures

### Viewing Reports

After tests complete:

```bash
# View local report
pnpm exec playwright show-report
```

## Debugging Failures

### Step-by-Step Debugging

```bash
pnpm test:e2e:debug -g "specific test name"
```

Use debugger to:
- Step through code
- Inspect page state
- View network activity
- Check console logs

### Check Logs

```bash
# View test logs
cat test-results/test-output.txt

# View API requests
# (Enable in test with getApiRequests helper)
```

### Common Issues

#### Test Timeouts

**Issue:** Test exceeds 45 second timeout
**Solution:**
- Check network is not blocked
- Verify API endpoints are responding
- Increase timeout in config if needed

#### Element Not Found

**Issue:** Selector doesn't match any elements
**Solution:**
- Use browser dev tools to inspect element
- Update selector to be more flexible
- Wait for element to load

#### Flaky Tests

**Issue:** Test passes sometimes, fails others
**Solution:**
- Use `waitFor` instead of hard timeouts
- Avoid racing conditions with proper waits
- Mock external APIs consistently

## Best Practices

### Writing Tests

✅ **DO:**
- Use semantic selectors (`[data-testid]`)
- Wait for elements explicitly
- Mock external APIs
- Test user flows, not implementation
- Include descriptive test names
- Group related tests

❌ **DON'T:**
- Use hardcoded waits (`page.waitForTimeout(5000)`)
- Rely on timing
- Test implementation details
- Skip proper error handling
- Ignore test isolation

### Selector Strategy

1. **Preferred:** `[data-testid="..."]`
2. **Good:** `[aria-label="..."]`
3. **Acceptable:** `button:has-text("Send")`
4. **Last Resort:** Complex CSS/XPath

### Async Patterns

```typescript
// ✅ Proper waits
await page.locator('button').waitFor({ state: 'visible' });
await page.waitForLoadState('networkidle');

// ❌ Avoid
await page.waitForTimeout(5000);
```

## Performance Benchmarks

Target performance metrics:

| Page | Load Time | Memory Usage |
|------|-----------|--------------|
| Home | < 3s | < 50MB |
| Models | < 5s | < 100MB |
| Chat | < 4s | < 80MB |

Monitor with:
```typescript
const metrics = await getPerformanceMetrics(page);
console.log(metrics);
// {
//   domContentLoaded: 1200,
//   loadComplete: 2500,
//   firstContentfulPaint: 800,
//   largestContentfulPaint: 2000
// }
```

## Continuous Monitoring

### Test Reports

Generated after each run:
- `playwright-report/index.html` - Full report
- `test-results.json` - Machine-readable results

### Failure Notifications

- GitHub Actions alerts on failure
- Check PR status before merging

## Advanced Topics

### Custom Fixtures

Add custom fixtures in `fixtures.ts`:

```typescript
export const test = base.extend<MyFixtures>({
  myFixture: async ({ page }, use) => {
    // Setup
    await use(page);
    // Cleanup
  }
});
```

### Network Interception

```typescript
import { simulateNetworkConditions } from './test-helpers';

await simulateNetworkConditions(page, 'slow-4g');
await page.goto('/models');
// Test with slow network
```

### Parallel Execution

Tests run in parallel by default (4 workers locally, 1 in CI).

Control with:
```typescript
test.describe.serial('Sequential tests', () => {
  test('first', async () => {});
  test('second', async () => {});
});
```

## Maintenance

### Regular Tasks

- ✅ Review flaky tests monthly
- ✅ Update selectors when UI changes
- ✅ Add tests for new features
- ✅ Monitor test performance
- ✅ Update Playwright version quarterly

### Adding New Tests

1. Identify feature/flow to test
2. Choose test file (auth/models/chat)
3. Use fixtures for setup
4. Write descriptive test
5. Run locally with `--ui`
6. Verify reports

### Updating Selectors

When UI changes:
1. Inspect new element
2. Find stable identifier
3. Update selector in test
4. Test with `--ui` to verify
5. Commit with clear message

## Troubleshooting

### Tests Won't Run

```bash
# Check Node version (should be 18+)
node --version

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild Playwright
pnpm exec playwright install
```

### Port 3000 Already in Use

```bash
# Kill process on port 3000
lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9

# Or use different port
PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm test:e2e
```

### API Endpoints Unavailable

```bash
# Verify backend is running
curl https://api.gatewayz.ai/v1/models

# Check environment
echo $NEXT_PUBLIC_API_BASE_URL
```

## Resources

- [Playwright Docs](https://playwright.dev)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Reporters](https://playwright.dev/docs/test-reporters)

## Support

For test issues:
1. Check this guide
2. Review test output and traces
3. Check GitHub Issues
4. Ask in team Slack (#testing)

---

## Summary

This E2E test suite provides comprehensive coverage of:
- ✅ Authentication flows
- ✅ Models loading and discovery
- ✅ Chat functionality
- ✅ Performance metrics
- ✅ Error handling
- ✅ Accessibility

**Goal:** Ensure critical functionality never breaks and catch regressions before deployment.

**Run tests before every deployment:**
```bash
pnpm test:e2e
```
