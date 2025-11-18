import { test, expect, BrowserContext } from '@playwright/test';

/**
 * Chat Testing Examples & Snippets
 *
 * Copy and adapt these examples when adding new chat tests.
 * These show common patterns and best practices.
 *
 * To use: Copy the test structure you need and modify for your use case.
 */

// Helper: Mock authentication
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

test.describe.skip('Example: Basic Test Structure', () => {
  test('template for simple interaction test', async ({ page, context }) => {
    // 1. Setup: Mock auth and navigate
    await setupMockAuth(context);
    await page.goto('/chat');

    // 2. Find: Locate the element
    const input = page.locator('textarea, input[type="text"]').first();

    // 3. Act: Interact with element
    await input.fill('Test message');

    // 4. Assert: Verify result
    const value = await input.inputValue();
    expect(value).toBe('Test message');
  });
});

test.describe.skip('Example: Finding Elements', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');
  });

  test('find by text content', async ({ page }) => {
    // Find button with specific text
    const sendButton = page.locator('button').filter({ hasText: /send/i }).first();

    // Verify we found it
    await expect(sendButton).toBeVisible();
  });

  test('find by role', async ({ page }) => {
    // Find element by accessibility role
    const button = page.locator('[role="button"]').first();

    if (await button.count() > 0) {
      await expect(button).toBeVisible();
    }
  });

  test('find by placeholder', async ({ page }) => {
    // Find input by placeholder text
    const input = page.locator('[placeholder*="message"]').first();

    if (await input.count() > 0) {
      await expect(input).toBeVisible();
    }
  });

  test('find by aria-label', async ({ page }) => {
    // Find element by accessibility label
    const element = page.locator('[aria-label="Send"]').first();

    if (await element.count() > 0) {
      await expect(element).toBeVisible();
    }
  });

  test('chain selectors for specificity', async ({ page }) => {
    // Combine multiple selectors
    const sendButton = page
      .locator('button')
      .filter({ hasText: /send/i })
      .first();

    await expect(sendButton).toBeVisible();
  });

  test('filter elements by text regex', async ({ page }) => {
    // Match flexible text patterns
    const buttons = page.locator('button').filter({
      hasText: /^(send|submit|send message)$/i
    });

    expect(await buttons.count()).toBeGreaterThanOrEqual(0);
  });
});

test.describe.skip('Example: User Interactions', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');
  });

  test('type text into input', async ({ page }) => {
    const input = page.locator('textarea').first();

    // Simple fill
    await input.fill('Hello');

    // Type with delay (simulates human typing)
    await input.clear();
    await input.type('World', { delay: 50 });

    const value = await input.inputValue();
    expect(value).toBe('World');
  });

  test('click buttons', async ({ page }) => {
    const button = page.locator('button').filter({ hasText: /new/i }).first();

    if (await button.count() > 0) {
      // Single click
      await button.click();

      // Double click
      // await button.dblclick();

      // Right click
      // await button.click({ button: 'right' });

      // Click with coordinates
      // await button.click({ position: { x: 10, y: 10 } });

      // Just verify click succeeds
      expect(true).toBeTruthy();
    }
  });

  test('focus and keyboard events', async ({ page }) => {
    const input = page.locator('textarea').first();

    // Focus element
    await input.focus();

    // Press key
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    // Type with keyboard
    await page.keyboard.type('message');

    // Key combinations
    // await page.keyboard.press('Control+A');
    // await page.keyboard.press('Meta+C');

    await expect(page.locator('body')).toBeVisible();
  });

  test('select from dropdown', async ({ page }) => {
    const select = page.locator('select').first();

    if (await select.count() > 0) {
      // Select by value
      await select.selectOption('value');

      // Select by label
      // await select.selectOption({ label: 'Option 1' });
    }
  });

  test('handle dialogs', async ({ page }) => {
    // Listen for alert/confirm/prompt dialogs
    page.once('dialog', async dialog => {
      // Log dialog message
      console.log('Dialog:', dialog.message());

      // Accept (OK button)
      await dialog.accept();

      // Or dismiss (Cancel button)
      // await dialog.dismiss();

      // Accept with input (for prompt)
      // await dialog.accept('input value');
    });

    // Action that triggers dialog
    // await button.click();
  });
});

test.describe.skip('Example: Assertions', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');
  });

  test('assert visibility', async ({ page }) => {
    const element = page.locator('textarea').first();

    // Visible
    if (await element.count() > 0) {
      await expect(element).toBeVisible();
      // await expect(element).toBeHidden();
    }
  });

  test('assert enabled/disabled state', async ({ page }) => {
    const button = page.locator('button').first();

    if (await button.count() > 0) {
      // Check if enabled
      // const isEnabled = await button.isEnabled();
      // expect(isEnabled).toBeTruthy();

      // Or use expectation
      // await expect(button).toBeEnabled();
      // await expect(button).toBeDisabled();
    }
  });

  test('assert element contains text', async ({ page }) => {
    const element = page.locator('button').first();

    if (await element.count() > 0) {
      // Contains specific text
      // await expect(element).toContainText('Send');

      // Or get full text
      const text = await element.innerText();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test('assert URL', async ({ page }) => {
    // Exact URL
    await expect(page).toHaveURL('/chat');

    // URL pattern
    await expect(page).toHaveURL(/\/chat/);
  });

  test('assert element count', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThan(100);
  });

  test('assert input value', async ({ page }) => {
    const input = page.locator('textarea').first();

    if (await input.count() > 0) {
      await input.fill('test value');

      const value = await input.inputValue();
      expect(value).toBe('test value');
    }
  });
});

test.describe.skip('Example: Waiting & Timing', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
  });

  test('wait for element to be visible', async ({ page }) => {
    await page.goto('/chat');

    const element = page.locator('textarea').first();

    // Wait with default timeout (30s)
    await expect(element).toBeVisible();

    // Wait with custom timeout (5s)
    // await expect(element).toBeVisible({ timeout: 5000 });
  });

  test('wait for page load', async ({ page }) => {
    // Wait until page is loaded
    await page.goto('/chat', { waitUntil: 'networkidle' });

    // Other wait states:
    // 'load'      - document load event
    // 'domcontentloaded' - DOMContentLoaded event
    // 'networkidle' - network is idle (good for SPAs)

    await expect(page.locator('body')).toBeVisible();
  });

  test('wait for specific condition', async ({ page }) => {
    await page.goto('/chat');

    // Wait for element to appear
    const input = page.locator('textarea').first();
    await expect(input).toBeVisible();

    // Wait with retries
    let found = false;
    for (let i = 0; i < 10; i++) {
      if (await input.count() > 0) {
        found = true;
        break;
      }
      await page.waitForTimeout(100);
    }

    expect(found).toBeTruthy();
  });

  test('wait for network requests', async ({ page }) => {
    const requests: string[] = [];

    // Capture requests
    page.on('request', request => {
      if (request.url().includes('/api')) {
        requests.push(request.url());
      }
    });

    await page.goto('/chat');

    // Wait a bit for any async requests
    await page.waitForTimeout(500);

    // Requests might be captured
    expect(requests.length >= 0).toBeTruthy();
  });
});

test.describe.skip('Example: Mocking API Responses', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
  });

  test('mock successful API response', async ({ page }) => {
    // Setup mock before navigation
    await page.route('**/api/models*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { id: 1, name: 'Model 1' },
            { id: 2, name: 'Model 2' }
          ]
        })
      });
    });

    await page.goto('/chat');

    // Verify page handles mocked response
    await expect(page.locator('body')).toBeVisible();
  });

  test('mock API error response', async ({ page }) => {
    // Mock error response
    await page.route('**/api/chat/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/chat');

    // Page should handle error gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('abort/fail API request', async ({ page }) => {
    // Abort request (simulates network failure)
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.goto('/chat');

    // Page should still work
    await expect(page.locator('body')).toBeVisible();
  });

  test('intercept and modify request', async ({ page }) => {
    // Modify request before sending
    await page.route('**/api/**', route => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'Authorization': 'Bearer test-token'
        }
      });
    });

    await page.goto('/chat');

    await expect(page.locator('body')).toBeVisible();
  });

  test('continue API request as-is', async ({ page }) => {
    // Record request
    const requests: string[] = [];

    await page.route('**/api/**', route => {
      requests.push(route.request().url());
      route.continue(); // Pass through to real API
    });

    await page.goto('/chat');

    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe.skip('Example: Working with localStorage', () => {
  test('set and verify localStorage', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });

    // Reload to verify persistence
    await page.reload();

    // Verify value persists
    const value = await page.evaluate(() => {
      return localStorage.getItem('test-key');
    });

    expect(value).toBe('test-value');
  });

  test('work with JSON in localStorage', async ({ page }) => {
    const testData = { user: 'test', score: 100 };

    await page.evaluate((data) => {
      localStorage.setItem('data', JSON.stringify(data));
    }, testData);

    // Retrieve and parse
    const retrieved = await page.evaluate(() => {
      const data = localStorage.getItem('data');
      return data ? JSON.parse(data) : null;
    });

    expect(retrieved.user).toBe('test');
    expect(retrieved.score).toBe(100);
  });
});

test.describe.skip('Example: Navigation & URLs', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockAuth(context);
  });

  test('navigate between pages', async ({ page }) => {
    // Navigate to chat
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat/);

    // Navigate to models
    await page.goto('/models');
    await expect(page).toHaveURL(/\/models/);

    // Navigate back
    await page.goBack();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('verify query parameters', async ({ page }) => {
    await page.goto('/chat?model=gpt-4&session=123');

    const url = page.url();
    expect(url).toContain('model=gpt-4');
    expect(url).toContain('session=123');
  });

  test('get current URL components', async ({ page }) => {
    await page.goto('/chat');

    const url = new URL(page.url());
    expect(url.pathname).toBe('/chat');
  });
});

test.describe.skip('Example: Debugging & Troubleshooting', () => {
  test('capture and log information', async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');

    // Log page title
    const title = await page.title();
    console.log('Page title:', title);

    // Log page URL
    console.log('Page URL:', page.url());

    // Count elements
    const inputs = page.locator('input, textarea');
    console.log('Input count:', await inputs.count());

    // Get text content
    const body = page.locator('body');
    const text = await body.innerText();
    console.log('Page text length:', text.length);
  });

  test('inspect page content', async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');

    // Get HTML
    const html = await page.content();
    console.log('HTML length:', html.length);

    // Check for specific content
    expect(html.length).toBeGreaterThan(100);
  });

  test('debug selector issues', async ({ page, context }) => {
    await setupMockAuth(context);
    await page.goto('/chat');

    // List all buttons
    const buttons = page.locator('button');
    const count = await buttons.count();
    console.log('Button count:', count);

    // Log each button's text
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await buttons.nth(i).innerText();
      console.log(`Button ${i}:`, text);
    }
  });
});

test.describe.skip('Example: Browser Context Features', () => {
  test('test with different user agents', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Custom User Agent String'
    });

    const page = await context.newPage();
    await page.goto('http://localhost:3000/chat');

    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });

  test('test with mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }
    });

    const page = await context.newPage();
    await page.goto('http://localhost:3000/chat');

    await expect(page.locator('body')).toBeVisible();
    await context.close();
  });
});
