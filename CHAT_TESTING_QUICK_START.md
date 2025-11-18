# Chat Testing - Quick Start Guide

Fast reference for running and developing chat tests in Playwright.

## Quick Commands

```bash
# Run all chat tests
pnpm test:e2e -g "Chat"

# Run chat tests with UI (interactive)
pnpm test:e2e:ui -g "Chat"

# Debug chat tests
pnpm test:e2e:debug -g "Chat"

# Run specific test
pnpm test:e2e -g "user can type in message input"

# Run all E2E tests
pnpm test:e2e

# View test report
npx playwright show-report
```

## Test Files

| File | Purpose | Tests Count |
|------|---------|------------|
| `e2e/chat.spec.ts` | Core chat functionality | 30+ |
| `e2e/chat-advanced.spec.ts` | Advanced scenarios & edge cases | 25+ |

## Key Test Categories

### Core Functionality
- Page loads and renders
- Message input and sending
- Model selection and switching
- Session management
- Message display

### User Experience
- Keyboard navigation
- Accessibility features
- Error handling
- Loading states
- Input validation

### Reliability
- API error recovery
- Network disconnection handling
- Rate limiting
- Edge cases (long messages, special chars, emoji)

### Performance
- Page load times
- Input responsiveness
- Memory usage
- Console errors

## Adding a New Test

1. **Choose the right file:**
   - Core features → `chat.spec.ts`
   - Advanced/edge cases → `chat-advanced.spec.ts`

2. **Use this template:**

```typescript
test('user can do something', async ({ page, context }) => {
  // Setup
  await setupMockAuth(context);
  await page.goto('/chat');

  // Find element
  const element = page.locator('selector');

  // Act
  await element.click();

  // Assert
  await expect(page).toHaveURL(/expected/);
});
```

3. **Run your test:**

```bash
pnpm test:e2e -g "user can do something"
```

## Common Selectors

```typescript
// By text
page.locator('button').filter({ hasText: /send/i })

// By role
page.locator('[role="button"]')
page.locator('textarea')

// By placeholder
page.locator('[placeholder*="message"]')

// By aria-label
page.locator('[aria-label="Send message"]')

// Combined
page.locator('button').filter({ hasText: /send/i }).first()
```

## Common Assertions

```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).toBeHidden();

// State
await expect(element).toBeDisabled();
await expect(element).toBeEnabled();

// Content
await expect(element).toContainText('Text');

// URL
await expect(page).toHaveURL(/\/chat/);

// Values
expect(value).toBe('expected');
expect(count).toBeGreaterThan(0);
```

## Debugging Tips

### 1. Use UI Mode for Development

```bash
pnpm test:e2e:ui -g "your test name"
```

- See test steps in real-time
- Inspect elements easily
- Check network requests

### 2. Add Debug Statements

```typescript
await page.pause(); // Pause execution
console.log(await element.textContent());
```

### 3. Check Selectors

```typescript
// List matching elements
const elements = page.locator('selector');
console.log(await elements.count());
for (let i = 0; i < await elements.count(); i++) {
  console.log(await elements.nth(i).textContent());
}
```

### 4. Inspect Network Requests

```typescript
page.on('request', request => {
  console.log(request.url(), request.method());
});
```

### 5. Check Page Content

```typescript
// View HTML
const html = await page.content();
console.log(html.substring(0, 500));

// Check text
const text = await page.innerText();
console.log(text);
```

## Mock API Responses

```typescript
// Mock successful response
await page.route('**/api/chat/**', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ message: 'response' })
  });
});

// Mock error
await page.route('**/api/chat/**', route => {
  route.abort('failed');
});

// Continue with modifications
await page.route('**/api/**', route => {
  route.continue({
    headers: { 'Authorization': 'Bearer token' }
  });
});
```

## Test Setup Pattern

```typescript
test.beforeEach(async ({ page, context }) => {
  // Mock auth
  await setupMockAuth(context);

  // Navigate to page
  await page.goto('/chat');

  // Optional: Mock APIs
  await page.route('**/api/**', route => {
    route.continue();
  });
});

test('your test', async ({ page }) => {
  // Test code
});
```

## Common Issues

### Test times out

```typescript
// Increase timeout
await expect(element).toBeVisible({ timeout: 10000 });

// Or check if exists first
if (await element.count() > 0) {
  await expect(element).toBeVisible();
}
```

### Can't find element

```typescript
// Debug: list all matching elements
const elements = page.locator('selector');
console.log('Found:', await elements.count());

// Use more specific selector
page.locator('button').filter({ hasText: /send/i }).first()
```

### Authentication not working

```typescript
// Verify auth setup in beforeEach
test.beforeEach(async ({ page, context }) => {
  await setupMockAuth(context);  // Must be called
  await page.goto('/chat');
});
```

### API mock not working

```typescript
// Route must be set BEFORE navigation
await page.route('**/api/**', route => { ... });
await page.goto('/chat');  // After route setup
```

## Useful Patterns

### Wait for Network Idle
```typescript
await page.waitForLoadState('networkidle');
```

### Wait for Condition
```typescript
await expect(element).toBeVisible();
```

### Type with Delay
```typescript
await input.type('message', { delay: 50 });
```

### Get Element Count
```typescript
const count = await elements.count();
```

### Get Element Value
```typescript
const value = await input.inputValue();
```

### Get Element Text
```typescript
const text = await element.textContent();
```

### Check If Disabled
```typescript
const isDisabled = await button.isDisabled();
```

## Performance Tips

1. **Use specific selectors** - faster than generic ones
2. **Group related tests** - share setup
3. **Mock external APIs** - faster tests
4. **Avoid arbitrary waits** - use `expect()` instead
5. **Run tests in parallel** - use separate test suites

## Best Practices

✅ **Do:**
- Name tests like user actions: "user can send message"
- Use semantic selectors: `role`, `text`, `aria-label`
- Mock external APIs
- Test one thing per test
- Use `test.describe()` to group related tests

❌ **Don't:**
- Use implementation details for selectors
- Test internal state
- Make tests dependent on each other
- Use arbitrary delays
- Leave skipped tests

## Resources

- Full guide: `PLAYWRIGHT_CHAT_TESTING.md`
- Playwright docs: https://playwright.dev
- API reference: https://playwright.dev/docs/api/class-test

## Support

For issues or questions about chat tests:

1. Check `PLAYWRIGHT_CHAT_TESTING.md` for detailed guide
2. Use UI mode to debug: `pnpm test:e2e:ui`
3. Review existing tests as examples
4. Check Playwright documentation

---

**Last Updated:** 2024
**Test Coverage:** Chat functionality (60+ tests)
