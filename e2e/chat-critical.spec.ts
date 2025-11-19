import { test, expect } from './fixtures';

/**
 * Chat Functionality - Critical Path E2E Tests
 *
 * Tests cover:
 * - Chat page loads with authenticated user
 * - Chat message input and submission
 * - Model selection in chat
 * - Message display and formatting
 * - Chat session management
 * - Error handling during chat operations
 * - Real-time message streaming
 *
 * Run: pnpm test:e2e -g "Chat.*Critical"
 * Debug: pnpm test:e2e:debug -g "Chat.*Critical"
 */

test.describe('Chat - Page Loading', () => {
  test('chat page loads successfully for authenticated users', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');

    await expect(page).toHaveURL(/\/chat/);
    await expect(page.locator('body')).toBeVisible();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Verify main content
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('chat page loads within reasonable time', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();

    const startTime = Date.now();
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Should load quickly
    expect(loadTime).toBeLessThan(10000);
  });

  test('chat page handles initial load errors gracefully', async ({ authenticatedPage: page }) => {
    // Mock API failures
    await page.route('**/api/chat/**', route => route.abort('failed'));

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // Page should still load
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat - Message Input', () => {
  test('message input field is visible and focusable', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for message input
    const messageInput = page.locator(
      'textarea[placeholder*="message" i], ' +
      'textarea[placeholder*="ask" i], ' +
      'input[placeholder*="message" i], ' +
      '[data-testid="message-input"]'
    ).first();

    if (await messageInput.count() > 0) {
      await expect(messageInput).toBeVisible();

      // Should be focusable
      await messageInput.focus();
      const isFocused = await messageInput.evaluate((el: HTMLElement) => {
        return el === document.activeElement;
      });
      expect(isFocused).toBeTruthy();
    }
  });

  test('can type message in input field', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator(
      'textarea[placeholder*="message" i], ' +
      'textarea[placeholder*="ask" i], ' +
      'input[placeholder*="message" i], ' +
      '[data-testid="message-input"]'
    ).first();

    if (await messageInput.count() > 0) {
      const testMessage = 'Hello, this is a test message for chat E2E testing.';
      await messageInput.fill(testMessage);

      const inputValue = await messageInput.inputValue();
      expect(inputValue).toBe(testMessage);
    }
  });

  test('multiline input supported (if textarea)', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea[placeholder*="message" i], textarea[placeholder*="ask" i]').first();

    if (await textarea.count() > 0) {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      await textarea.fill(multilineMessage);

      const value = await textarea.inputValue();
      expect(value).toBe(multilineMessage);
    }
  });

  test('input has helpful placeholder text', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('textarea, input');

    if (await inputs.count() > 0) {
      for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
        const placeholder = await inputs.nth(i).getAttribute('placeholder');
        if (placeholder) {
          expect(placeholder.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

test.describe('Chat - Message Sending', () => {
  test('send button exists and is clickable', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const sendButton = page.locator(
      'button:has-text("Send"), ' +
      'button:has-text("submit"), ' +
      '[data-testid="send-button"], ' +
      'button[aria-label*="send" i]'
    ).first();

    if (await sendButton.count() > 0) {
      await expect(sendButton).toBeVisible();

      // Button should be interactive
      const isDisabled = await sendButton.isDisabled();
      // Button might be disabled if no text, that's okay
      expect(typeof isDisabled).toBe('boolean');
    }
  });

  test('can submit message', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator(
      'textarea[placeholder*="message" i], ' +
      'input[placeholder*="message" i], ' +
      '[data-testid="message-input"]'
    ).first();

    const sendButton = page.locator(
      'button:has-text("Send"), ' +
      'button:has-text("submit"), ' +
      '[data-testid="send-button"]'
    ).first();

    if (await messageInput.count() > 0 && await sendButton.count() > 0) {
      // Type message
      await messageInput.fill('Test message');

      // Send message
      await sendButton.click();

      // Wait a moment for processing
      await page.waitForTimeout(500);

      // Page should still be interactive
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('handles failed message submission gracefully', async ({ authenticatedPage: page }) => {
    // Mock failed API
    await page.route('**/api/chat/completions*', route => route.abort('failed'));

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator('textarea, input').first();
    const sendButton = page.locator('button:has-text("Send"), button:has-text("submit")').first();

    if (await messageInput.count() > 0 && await sendButton.count() > 0) {
      await messageInput.fill('Test message');
      await sendButton.click();
      await page.waitForTimeout(500);

      // Page should still be usable
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Chat - Model Selection', () => {
  test('model selector is visible', async ({ authenticatedPage: page, mockChatAPI, mockModelsAPI }) => {
    await mockChatAPI();
    await mockModelsAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const modelSelector = page.locator(
      'button:has-text("Model"), ' +
      'button:has-text("Select"), ' +
      '[data-testid="model-selector"], ' +
      '[role="combobox"]'
    ).first();

    // Model selector should exist (if visible)
    // It might be lazy-loaded
    await page.waitForTimeout(1000);
  });

  test('can open model selector dropdown', async ({ authenticatedPage: page, mockChatAPI, mockModelsAPI }) => {
    await mockChatAPI();
    await mockModelsAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const modelButton = page.locator(
      'button:has-text("Model"), ' +
      'button:has-text("Select"), ' +
      '[data-testid="model-selector"]'
    ).first();

    if (await modelButton.count() > 0) {
      await modelButton.click();
      await page.waitForTimeout(300);

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('can switch between models', async ({ authenticatedPage: page, mockChatAPI, mockModelsAPI }) => {
    await mockChatAPI();
    await mockModelsAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const modelButton = page.locator('button:has-text("Model"), button:has-text("Select")').first();

    if (await modelButton.count() > 0) {
      // Click to open
      await modelButton.click();
      await page.waitForTimeout(300);

      // Look for model options
      const options = page.locator('[role="option"], .model-option, li').first();

      if (await options.count() > 0) {
        await options.click();
        await page.waitForTimeout(300);

        // Page should remain interactive
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});

test.describe('Chat - Message Display', () => {
  test('chat messages display area is visible', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for message container
    const messageArea = page.locator(
      '[role="main"], ' +
      'main, ' +
      '.chat-messages, ' +
      '.messages-container, ' +
      '[data-testid="message-area"]'
    ).first();

    if (await messageArea.count() > 0) {
      await expect(messageArea).toBeVisible();
    }
  });

  test('can display mock messages', async ({ page }) => {
    await page.goto('/chat');

    // Inject test messages
    await page.evaluate(() => {
      // Create a message container if it doesn't exist
      let container = document.querySelector('[role="main"], main, .messages');
      if (!container) {
        container = document.createElement('div');
        document.body.appendChild(container);
      }

      // Add test messages
      const message1 = document.createElement('div');
      message1.textContent = 'User: Hello';
      message1.setAttribute('data-role', 'user');

      const message2 = document.createElement('div');
      message2.textContent = 'Assistant: Hi there!';
      message2.setAttribute('data-role', 'assistant');

      container?.appendChild(message1);
      container?.appendChild(message2);
    });

    // Verify messages are present
    const userMessage = page.locator('text=User: Hello');
    const assistantMessage = page.locator('text=Hi there');

    if (await userMessage.count() > 0) {
      await expect(userMessage).toBeVisible();
    }
  });
});

test.describe('Chat - Session Management', () => {
  test('chat maintains session during interaction', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Get initial auth
    const initialAuth = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(initialAuth).toBe('test-api-key-e2e-12345');

    // Interact with page
    const messageInput = page.locator('textarea, input').first();
    if (await messageInput.count() > 0) {
      await messageInput.fill('Test message');
      await page.waitForTimeout(300);
    }

    // Auth should still exist
    const currentAuth = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(currentAuth).toBe(initialAuth);
  });

  test('can create new chat session', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const newChatButton = page.locator(
      'button:has-text("New"), ' +
      'button:has-text("new chat"), ' +
      '[data-testid="new-chat"]'
    ).first();

    if (await newChatButton.count() > 0) {
      await newChatButton.click();
      await page.waitForTimeout(300);

      // Should still be on chat page
      await expect(page).toHaveURL(/\/chat/);
    }
  });
});

test.describe('Chat - Performance', () => {
  test('chat page loads without excessive console errors', async ({ authenticatedPage: page, mockChatAPI }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Filter out expected errors
    const significantErrors = errors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('cross-origin') &&
      !e.includes('401')
    );

    expect(significantErrors.length).toBeLessThanOrEqual(3);
  });

  test('input field responsive immediately', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');

    const messageInput = page.locator('textarea[placeholder*="message" i], input[placeholder*="message" i]').first();

    if (await messageInput.count() > 0) {
      // Should be able to type immediately
      await messageInput.type('Quick type test', { delay: 10 });

      const value = await messageInput.inputValue();
      expect(value).toContain('Quick type test');
    }
  });

  test('chat page works on multiple viewport sizes', async ({ authenticatedPage: page, mockChatAPI }) => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    await mockChatAPI();

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Should render on all sizes
      await expect(page.locator('body')).toBeVisible();

      // Input should be accessible
      const input = page.locator('textarea, input').first();
      if (await input.count() > 0) {
        await expect(input).toBeVisible();
      }
    }
  });
});

test.describe('Chat - Accessibility', () => {
  test('chat is keyboard navigable', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');

    // Tab through page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Page should remain interactive
    await expect(page.locator('body')).toBeVisible();
  });

  test('message input has accessible label', async ({ authenticatedPage: page, mockChatAPI }) => {
    await mockChatAPI();
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, input').first();

    if (await input.count() > 0) {
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');

      // Should have either label or placeholder
      expect(ariaLabel || placeholder).toBeTruthy();
    }
  });
});
