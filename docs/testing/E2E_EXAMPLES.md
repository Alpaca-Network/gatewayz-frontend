# E2E Testing Examples

This file shows practical examples of how to use the E2E test fixtures, helpers, and patterns.

## Basic Test Examples

### Example 1: Simple Authentication Test

```typescript
import { test, expect } from './fixtures';

test('user can view profile when authenticated', async ({ authenticatedPage }) => {
  // authenticatedPage is automatically set up with auth data
  await authenticatedPage.goto('/settings/account');

  // Page should load
  await expect(authenticatedPage).toHaveURL(/\/settings\/account/);

  // Auth data should be available
  const authData = await authenticatedPage.evaluate(() => {
    return JSON.parse(localStorage.getItem('gatewayz_user_data') || '{}');
  });

  expect(authData.user_id).toBe(999);
  expect(authData.email).toBe('e2e-test@gatewayz.ai');
});
```

### Example 2: Model Loading with Mock API

```typescript
import { test, expect } from './fixtures';

test('models display correctly when API returns data', async ({ page, mockModelsAPI }) => {
  // Set up mock API
  await mockModelsAPI();

  // Navigate to models page
  await page.goto('/models');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Verify models are displayed
  const content = await page.content();
  expect(content).toContain('Claude');
  expect(content).toContain('GPT');
  expect(content).toContain('Llama');
});
```

### Example 3: Chat Message Flow

```typescript
import { test, expect } from './fixtures';

test('user can send a message', async ({ authenticatedPage, mockChatAPI }) => {
  // Set up authentication and mocks
  await mockChatAPI();

  // Navigate to chat
  await authenticatedPage.goto('/chat');
  await authenticatedPage.waitForLoadState('networkidle');

  // Find message input
  const messageInput = authenticatedPage.locator(
    'textarea[placeholder*="message" i], ' +
    'input[placeholder*="message" i]'
  ).first();

  // Type message
  const testMessage = 'Hello, Gatewayz!';
  await messageInput.fill(testMessage);

  // Verify message was typed
  const inputValue = await messageInput.inputValue();
  expect(inputValue).toBe(testMessage);

  // Click send button
  const sendButton = authenticatedPage.locator(
    'button:has-text("Send"), ' +
    'button:has-text("submit")'
  ).first();

  await sendButton.click();

  // Wait for processing
  await authenticatedPage.waitForTimeout(500);

  // Page should remain interactive
  await expect(authenticatedPage.locator('body')).toBeVisible();
});
```

## Using Helper Functions

### Example 4: Check for Errors and Performance

```typescript
import { test, expect } from './fixtures';
import { checkForErrors, getPerformanceMetrics } from './test-helpers';

test('models page loads without errors and good performance', async ({ page, mockModelsAPI }) => {
  // Mock API
  await mockModelsAPI();

  // Navigate and measure performance
  const startTime = Date.now();
  await page.goto('/models', { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;

  // Check performance
  expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds

  // Get detailed metrics
  const metrics = await getPerformanceMetrics(page);
  console.log('Performance metrics:', metrics);

  if (metrics) {
    expect(metrics.domContentLoaded).toBeLessThan(2000);
    expect(metrics.loadComplete).toBeLessThan(5000);
  }

  // Check for errors
  const errors = await checkForErrors(page);
  const significantErrors = errors.filter(e =>
    !e.includes('DevTools') &&
    !e.includes('cross-origin')
  );

  expect(significantErrors.length).toBeLessThanOrEqual(1);
});
```

### Example 5: Mock LocalStorage Data

```typescript
import { test, expect } from './fixtures';
import { mockLocalStorage, getLocalStorageData } from './test-helpers';

test('app respects saved user preferences', async ({ page }) => {
  // Set up mock user data
  await mockLocalStorage(page, {
    'gatewayz_api_key': 'test-key-123',
    'gatewayz_user_data': {
      user_id: 123,
      email: 'test@example.com',
      credits: 5000,
      tier: 'pro'
    },
    'user_preferences': {
      theme: 'dark',
      language: 'en'
    }
  });

  // Navigate to app
  await page.goto('/');

  // Get stored data
  const stored = await getLocalStorageData(page);

  // Verify data is available
  expect(stored.gatewayz_api_key).toBe('test-key-123');
  expect(stored.user_preferences.theme).toBe('dark');
});
```

### Example 6: Wait for Specific API Call

```typescript
import { test, expect } from './fixtures';
import { waitForApiCall, getApiRequests } from './test-helpers';

test('chat sends request to correct API endpoint', async ({ authenticatedPage, mockChatAPI }) => {
  await mockChatAPI();

  // Start tracking requests
  const requests = getApiRequests(authenticatedPage);

  // Navigate to chat
  await authenticatedPage.goto('/chat');

  // Wait for chat API to be called
  const apiCalled = await waitForApiCall(authenticatedPage, '/api/chat', 5000);
  expect(apiCalled).toBe(true);

  // Check request details
  const chatRequest = requests.find(r => r.url.includes('/api/chat'));
  expect(chatRequest).toBeDefined();
});
```

### Example 7: Test Error Handling

```typescript
import { test, expect } from './fixtures';

test('app handles API failures gracefully', async ({ authenticatedPage }) => {
  // Mock API failure
  await authenticatedPage.route('**/api/chat/**', route => {
    route.abort('failed');
  });

  // Navigate to chat
  await authenticatedPage.goto('/chat', { waitUntil: 'domcontentloaded' });

  // App should still be functional
  await expect(authenticatedPage.locator('body')).toBeVisible();

  // User can still interact
  const input = authenticatedPage.locator('textarea, input').first();
  if (await input.count() > 0) {
    await input.fill('test');
    const value = await input.inputValue();
    expect(value).toBe('test');
  }
});
```

## Advanced Examples

### Example 8: Test Multiple Viewports

```typescript
import { test, expect } from './fixtures';

test('chat UI works on all device sizes', async ({ authenticatedPage, mockChatAPI }) => {
  await mockChatAPI();

  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 }
  ];

  for (const viewport of viewports) {
    // Set viewport
    await authenticatedPage.setViewportSize(viewport);

    // Navigate
    await authenticatedPage.goto('/chat');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check layout on this viewport
    const mainContent = authenticatedPage.locator('main').first();

    if (await mainContent.count() > 0) {
      await expect(mainContent).toBeVisible();

      // Verify input is accessible
      const input = authenticatedPage.locator('textarea, input').first();
      if (await input.count() > 0) {
        await expect(input).toBeVisible();
      }
    }
  }
});
```

### Example 9: Simulate Slow Network

```typescript
import { test, expect } from './fixtures';
import { simulateNetworkConditions } from './test-helpers';

test('models page handles slow network', async ({ page, mockModelsAPI }) => {
  await mockModelsAPI();

  // Simulate slow 4G
  await simulateNetworkConditions(page, 'slow-4g');

  // Navigate with slow network
  const startTime = Date.now();
  await page.goto('/models', { waitUntil: 'domcontentloaded' });
  const loadTime = Date.now() - startTime;

  // Should eventually load (even if slow)
  await expect(page.locator('body')).toBeVisible();

  // Time will be longer on slow network
  console.log(`Loaded in ${loadTime}ms on slow 4G`);
});
```

### Example 10: Test Accessibility

```typescript
import { test, expect } from './fixtures';

test('chat is keyboard accessible', async ({ authenticatedPage, mockChatAPI }) => {
  await mockChatAPI();
  await authenticatedPage.goto('/chat');

  // Tab through focusable elements
  const maxTabs = 20;
  for (let i = 0; i < maxTabs; i++) {
    await authenticatedPage.keyboard.press('Tab');

    // Get currently focused element
    const focusedElement = await authenticatedPage.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    console.log(`Tab ${i}: ${focusedElement}`);
  }

  // Shift+Tab to go backwards
  await authenticatedPage.keyboard.press('Shift+Tab');

  // Page should remain functional
  await expect(authenticatedPage.locator('body')).toBeVisible();
});
```

## Testing Patterns

### Pattern: Wait for Element

```typescript
// ✅ Good - Explicit wait
const button = authenticatedPage.locator('button:has-text("Send")').first();
await button.waitFor({ state: 'visible', timeout: 5000 });
await button.click();

// ❌ Avoid - Hard coded wait
await authenticatedPage.waitForTimeout(5000);
```

### Pattern: Check If Element Exists

```typescript
// ✅ Good - Check existence first
const element = page.locator('.model-card').first();
if (await element.count() > 0) {
  await expect(element).toBeVisible();
}

// ✅ Also Good - Use try/catch
try {
  const element = page.locator('.model-card').first();
  await expect(element).toBeVisible();
} catch (e) {
  // Element doesn't exist, that's okay
}
```

### Pattern: Mock API Endpoints

```typescript
// ✅ Good - Specific route
await page.route('**/api/models*', (route) => {
  if (route.request().method() === 'GET') {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ data: mockModels })
    });
  }
});

// ✅ Also Good - Abort on error
await page.route('**/api/chat/**', (route) => {
  route.abort('failed');
});
```

### Pattern: Handle Multiple Possible Selectors

```typescript
// ✅ Good - Multiple selectors
const input = page.locator(
  'textarea[placeholder*="message" i], ' +
  'input[placeholder*="message" i], ' +
  '[data-testid="message-input"]'
).first();

// Ensures test works with different implementations
```

## Running These Examples

```bash
# Run all examples (they're part of the test suite)
pnpm test:e2e

# Run specific example test
pnpm test:e2e -g "models page handles slow network"

# Debug a specific example
pnpm test:e2e:debug -g "chat UI works on all device sizes"

# View interactive UI
pnpm test:e2e:ui
```

## Tips

1. **Use `--ui` mode** during development to see what's happening
2. **Use fixtures** to reduce boilerplate
3. **Use helpers** for common operations
4. **Mock APIs** to avoid dependencies
5. **Check element count** before accessing elements
6. **Use semantic selectors** that match UI behavior
7. **Wait for conditions** rather than hard timeouts
8. **Test user flows** not implementation details
9. **Group related tests** with `describe`
10. **Document complex tests** with comments

## More Examples

For more examples, see the actual test files:
- `e2e/auth.spec.ts` - Authentication patterns
- `e2e/models-loading.spec.ts` - Loading patterns
- `e2e/chat-critical.spec.ts` - Interaction patterns

Happy testing! 🎭
