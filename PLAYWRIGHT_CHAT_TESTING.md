# Chat Functionality Testing Guide - Playwright

This guide covers the comprehensive Playwright E2E testing setup for the chat functionality in Gatewayz Beta.

## Overview

Two test suites have been created to ensure chat functionality works correctly:

- **`e2e/chat.spec.ts`** - Core chat functionality tests
- **`e2e/chat-advanced.spec.ts`** - Advanced scenarios and edge cases

## Test Structure

### Core Test Suites (chat.spec.ts)

1. **Chat Page - Basic Functionality**
   - Page loads successfully
   - Essential UI elements present
   - Session history visible
   - Responsive design across viewports

2. **Chat Message Input**
   - User can type messages
   - Input clears after sending
   - Placeholder text present
   - Multiline support (textarea)

3. **Chat Model Selection**
   - Model selector visible
   - Can open model dropdown
   - Available models displayed

4. **Chat Session Management**
   - Create new chat session
   - List sessions in sidebar
   - View chat history
   - Persistence across reloads

5. **Chat Messages Display**
   - Messages display in chat area
   - Scroll chat history
   - Message roles (user/assistant)
   - Semantic structure

6. **Chat Error Handling**
   - Handle missing authentication
   - Display API error messages
   - Handle network timeouts
   - Graceful degradation

7. **Chat Interactions**
   - Input field focusable
   - Keyboard shortcuts
   - Tab navigation

8. **Chat Performance**
   - Page load time
   - Input responsiveness
   - Console error checking
   - Memory usage

9. **Chat Accessibility**
   - Semantic HTML structure
   - Form labels
   - Accessible buttons
   - Keyboard navigation

### Advanced Test Suites (chat-advanced.spec.ts)

1. **Chat Message Sending Flow**
   - Send message with model selection
   - Prevent empty messages
   - Handle whitespace trimming
   - Special characters support

2. **Chat Model Switching**
   - Switch models during chat
   - Display current selection
   - Model filtering

3. **Chat Session Persistence**
   - Persist after reload
   - Survive navigation
   - Session ID preservation
   - localStorage settings

4. **Chat History Management**
   - Create new sessions
   - Delete sessions
   - Empty state handling
   - Multiple session listing

5. **Chat API Integration**
   - Correct API requests
   - Error handling
   - Request retry logic
   - Rate limiting

6. **Chat Edge Cases**
   - Very long messages
   - Rapid message sending
   - Unicode and emoji support
   - Disconnection recovery
   - Model unavailability

7. **Chat User Experience**
   - Loading states
   - Message timestamps
   - Copy to clipboard
   - Input focus management

## Running Tests

### Run All Chat Tests

```bash
# Run all chat tests
pnpm test:e2e -g "Chat"

# Run with UI
pnpm test:e2e:ui -g "Chat"

# Debug mode
pnpm test:e2e:debug -g "Chat"

# Run headed (with browser visible)
pnpm test:e2e:headed -g "Chat"
```

### Run Specific Test Suites

```bash
# Core chat tests only
pnpm test:e2e -g "Chat Page - Basic Functionality"

# Advanced tests only
pnpm test:e2e -g "Advanced"

# Specific test
pnpm test:e2e -g "user can type in message input"
```

### Run All Playwright Tests

```bash
# All E2E tests
pnpm test:e2e

# With UI
pnpm test:e2e:ui

# Debug
pnpm test:e2e:debug

# Headed
pnpm test:e2e:headed
```

## Test Configuration

Tests are configured via `playwright.config.ts`:

```typescript
{
  testDir: './e2e',
  timeout: 30000,                    // 30 second timeout per test
  fullyParallel: true,               // Run tests in parallel
  retries: 0,                        // No retries locally
  workers: undefined,                // Auto worker count
  baseURL: 'http://localhost:3000',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

### CI Configuration (GitHub Actions)

In CI environment:
- Retries: 2 attempts per test
- Workers: 1 (sequential)
- Reporter: HTML + GitHub format
- Base URL: Auto-configured

## Authentication Mocking

Tests use a helper function to mock authentication:

```typescript
async function setupMockAuth(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('gatewayz_api_key', 'test-api-key-123456');
    localStorage.setItem('gatewayz_user_data', JSON.stringify({
      user_id: 123,
      email: 'test@example.com',
      display_name: 'Test User',
      credits: 1000,
      tier: 'pro'
    }));
  });
}
```

This is called in `test.beforeEach()` to set up authenticated state before each test.

## Key Testing Patterns

### 1. Selecting Elements

```typescript
// By text content
page.locator('button').filter({ hasText: /send/i }).first()

// By role
page.locator('[role="button"]')

// By placeholder/aria-label
page.locator('textarea[placeholder="Type a message..."]')

// Combined selectors
page.locator('button').filter({ hasText: /model|select/i })
```

### 2. Waiting for Elements

```typescript
// Wait for element to be visible
await expect(input).toBeVisible();

// Wait for element with timeout
await expect(input).toBeVisible({ timeout: 5000 });

// Wait for network idle
await page.waitForLoadState('networkidle');

// Wait for specific time
await page.waitForTimeout(300);
```

### 3. User Interactions

```typescript
// Typing
await input.fill('message');
await input.type('message', { delay: 10 });

// Clicking
await button.click();
await button.click({ position: { x: 10, y: 10 } });

// Focus
await input.focus();

// Keyboard
await page.keyboard.press('Tab');
await page.keyboard.press('Enter');
```

### 4. Assertions

```typescript
// Element visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// Element state
await expect(element).toBeDisabled();
await expect(element).toBeEnabled();

// Text content
await expect(element).toContainText('Send');

// URL
await expect(page).toHaveURL(/\/chat/);

// Custom assertions
expect(value).toBe('expected');
expect(count).toBeGreaterThan(0);
```

### 5. Mocking API Responses

```typescript
// Mock request
await page.route('**/api/models*', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ models: [] })
  });
});

// Abort request
await page.route('**/api/chat/**', route => {
  route.abort('failed');
});

// Continue with headers
await page.route('**/api/**', route => {
  route.continue({
    headers: { 'Authorization': 'Bearer token' }
  });
});
```

### 6. Handling Dialogs & Popups

```typescript
// Listen for alert
page.on('dialog', async dialog => {
  console.log(dialog.message());
  await dialog.accept();
});

// Handle new page
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  element.click()
]);
```

## Best Practices

### 1. Test Independence
- Each test should be independent and not rely on state from other tests
- Use `test.beforeEach()` for setup
- Use `test.afterEach()` for cleanup if needed

### 2. Realistic User Flows
- Test features from user's perspective
- Use actual UI selectors, not implementation details
- Simulate real user interactions

### 3. Stable Selectors
- Prefer semantic selectors: `role`, `testid`, `label`
- Avoid fragile selectors like `nth-child(3)`
- Use `filter()` to narrow down selections

```typescript
// Good
page.locator('button').filter({ hasText: /send/i })

// Fragile
page.locator('div > div > button:nth-child(2)')
```

### 4. Timeouts & Waits
- Set appropriate timeouts (30s is default)
- Use `waitForTimeout()` sparingly
- Prefer waiting for conditions

```typescript
// Good
await expect(element).toBeVisible();

// Avoid
await page.waitForTimeout(1000);
```

### 5. Error Messages
- Make assertions clear with good error messages
- Use meaningful test names
- Add comments for complex logic

```typescript
expect(messages.length, 'Should have at least one message').toBeGreaterThan(0);
```

### 6. Mock Data
- Use realistic test data
- Mock external APIs consistently
- Clean up mocks after tests

### 7. Accessibility
- Test keyboard navigation
- Verify ARIA attributes
- Check color contrast (visual testing)
- Test with screen reader in mind

## Continuous Integration

Tests run in CI on every push:

1. **GitHub Actions** runs on pull requests
2. Tests execute in Chromium browser
3. Failures block PR merge
4. Reports available in Actions tab

### CI Configuration

```yaml
- Run: pnpm test:e2e
  Timeout: 10 minutes
  Retries: 2 per test
  Workers: 1 (sequential)
  Report: HTML + GitHub
```

## Debugging

### Running Tests with UI

```bash
pnpm test:e2e:ui
```

This opens an interactive UI where you can:
- See test steps in real-time
- Step through tests
- Inspect elements
- View network requests

### Debug Mode

```bash
pnpm test:e2e:debug
```

Opens debugger with:
- Browser visible
- Inspector tools available
- Step-by-step execution

### View Test Report

After test run:

```bash
# Open HTML report
npx playwright show-report

# Reports available at:
# ./playwright-report/index.html
```

### Check Screenshots/Videos

Failed tests automatically capture:
- Screenshots: `test-results/**/test-failed-1.png`
- Videos: `test-results/**/test-failed-1.webm`
- Traces: `test-results/**/trace.zip`

## Adding New Tests

### 1. Choose Right File
- **chat.spec.ts** - Core/basic functionality
- **chat-advanced.spec.ts** - Advanced/complex scenarios
- Create new file for major features (e.g., `e2e/chat-streaming.spec.ts`)

### 2. Use Test Template

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');
  });

  test('user can do something', async ({ page }) => {
    // Arrange
    const element = page.locator('selector');

    // Act
    await element.click();

    // Assert
    await expect(page).toHaveURL(/expected-url/);
  });
});
```

### 3. Test Naming
- Use descriptive names
- Start with user action
- Should read like documentation

```typescript
// Good
test('user can type in message input')
test('displays error message on API failure')
test('retries failed requests')

// Avoid
test('test 1')
test('check input')
test('error handling')
```

### 4. Selectors

Use this priority order:
1. `data-testid` (if available)
2. Role + text filter
3. Placeholder/aria-label
4. Last resort: CSS selectors

```typescript
// Best
page.locator('[data-testid="chat-input"]')

// Good
page.locator('textarea').filter({ hasText: /message/ })

// Okay
page.locator('[role="button"]').filter({ hasText: /send/i })

// Last resort
page.locator('div.chat-container > textarea')
```

## Common Issues & Solutions

### Issue: Tests timeout waiting for element

```typescript
// Solution 1: Increase timeout
await expect(element).toBeVisible({ timeout: 10000 });

// Solution 2: Check if element exists
if (await element.count() > 0) {
  await expect(element).toBeVisible();
}

// Solution 3: Navigate and retry
await page.goto('/chat');
await page.waitForLoadState('networkidle');
```

### Issue: Flaky tests on CI but not locally

```typescript
// Add proper waits
await page.waitForLoadState('networkidle');
await expect(element).toBeStable();

// Increase timeout for CI
const timeout = process.env.CI ? 10000 : 5000;
await expect(element).toBeVisible({ timeout });
```

### Issue: Tests fail due to auth

```typescript
// Ensure auth is set up in beforeEach
test.beforeEach(async ({ page, context }) => {
  await setupMockAuth(context);
  await page.goto('/chat');
});
```

### Issue: API mocking not working

```typescript
// Route must be set BEFORE navigation
await page.route('**/api/chat/**', route => { ... });
await page.goto('/chat');

// Use wildcard patterns
'**/api/**'       // All API calls
'**/api/chat**'   // Chat endpoints
'**/*'            // All requests
```

## Performance Considerations

### Load Times
- Target: Chat page loads in < 3 seconds
- API responses: < 2 seconds
- Message updates: < 500ms

### Test Execution
- Individual tests: 5-30 seconds
- Full suite: ~5-10 minutes locally
- Parallel execution speeds up CI

### Memory & Resources
- Run with limited workers on CI
- Monitor memory usage
- Clean up resources after tests

## Maintenance

### Regular Updates

1. **Update Selectors**
   - When UI changes
   - When classes/IDs change
   - Use more robust selectors

2. **Update Expectations**
   - When features change
   - When behavior changes
   - Keep tests aligned with spec

3. **Update Mocks**
   - When API contracts change
   - When new endpoints added
   - When response format changes

4. **Review Test Coverage**
   - Add tests for new features
   - Remove tests for deprecated features
   - Keep test suite maintainable

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-test)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Summary

This comprehensive test suite ensures chat functionality remains stable and user-friendly. Tests cover:

✅ Core functionality (message sending, model selection, sessions)
✅ Error handling and edge cases
✅ User experience and performance
✅ Accessibility and keyboard navigation
✅ API integration and mocking
✅ Session persistence and data management

Run tests regularly during development and integrate into CI/CD pipeline for continuous quality assurance.
