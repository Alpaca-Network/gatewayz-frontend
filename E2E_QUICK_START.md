# Playwright E2E Testing - Quick Start

Get up and running with E2E tests in 5 minutes.

## Install & Setup

```bash
# Dependencies already installed
# Just make sure Playwright browsers are installed:
pnpm exec playwright install

# Or run any test command (auto-installs)
pnpm test:e2e
```

## Run Tests

```bash
# All tests (headless)
pnpm test:e2e

# Interactive UI (best for development)
pnpm test:e2e:ui

# Visible browser window
pnpm test:e2e:headed

# Step-through debugger
pnpm test:e2e:debug

# Specific test file
pnpm exec playwright test e2e/auth-examples.spec.ts

# Tests matching pattern
pnpm exec playwright test -g "homepage"
```

## Write a Test

Create file: `e2e/my-test.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    // Navigate
    await page.goto('/');

    // Interact
    await page.click('[data-testid="button"]');

    // Assert
    await expect(page).toHaveURL('/result');
  });
});
```

Run it:
```bash
pnpm test:e2e -g "My Feature"
```

## Key Commands

| Command | What it does |
|---------|-------------|
| `pnpm test:e2e` | Run all tests headless |
| `pnpm test:e2e:ui` | Interactive test explorer |
| `pnpm test:e2e:headed` | Tests with visible browser |
| `pnpm test:e2e:debug` | Step debugger |
| `pnpm test:e2e:e2e/file.spec.ts` | Run specific file |
| `pnpm test:e2e -g "pattern"` | Tests matching pattern |

## Tips

✅ Use `data-testid` attributes for selectors:
```typescript
await page.click('[data-testid="submit-button"]');
```

✅ Test user flows, not implementation:
```typescript
// Good: What user sees
await expect(page).toHaveURL('/dashboard');

// Bad: Internal state
await expect(store.isAuthenticated).toBe(true);
```

✅ Use UI mode for development:
```bash
pnpm test:e2e:ui
# Step through, set breakpoints, inspect elements
```

❌ Don't use `test.only()` (breaks in CI)

❌ Don't hardcode waits:
```typescript
// Bad
await page.waitForTimeout(1000);

// Good - waits for element
await page.locator('[data-testid="result"]').waitFor();
```

## Debugging

### Pause test and inspect
```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Test pauses here, open DevTools
  // Inspect DOM, run commands in console
});
```

Run with `pnpm test:e2e:debug` or `pnpm test:e2e:headed`

### View test execution
```bash
# With visible browser
pnpm test:e2e:headed

# Interactive UI
pnpm test:e2e:ui

# Slow motion (see what's happening)
pnpm exec playwright test --headed --slow-mo=1000
```

### Check what failed
1. Tests in CI fail? Download `playwright-report` artifact
2. Open `playwright-report/index.html` in browser
3. See screenshots and error details

## Examples

See real examples in:
- `e2e/example.spec.ts` - Template structure
- `e2e/auth-examples.spec.ts` - Various patterns

## CI Pipeline

Tests run automatically on:
- ✅ Pull requests
- ✅ Pushes to `main`, `master`, `develop`

Reports available in GitHub Actions artifacts for 30 days.

## Need Help?

- Full guide: `PLAYWRIGHT_CI_GUIDE.md`
- Examples: `e2e/auth-examples.spec.ts`
- Playwright docs: https://playwright.dev
- Config: `playwright.config.ts`
- CI workflow: `.github/workflows/ci.yml`

---

**Start writing tests now:**
```bash
# Copy example
cp e2e/example.spec.ts e2e/my-feature.spec.ts

# Edit and run
pnpm test:e2e:ui
```
