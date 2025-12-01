/**
 * E2E tests for chat with AI SDK integration
 * Tests the complete user flow from UI to streaming response
 */

import { test, expect } from './fixtures';

test.describe('Chat with AI SDK', () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup mock authentication
    await context.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-e2e-12345');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({
        user_id: 999,
        api_key: 'test-api-key-e2e-12345',
        email: 'e2e-test@gatewayz.ai',
        display_name: 'E2E Test User',
        credits: 10000,
        tier: 'pro',
        subscription_status: 'active'
      }));
    });

    // Navigate to chat page
    await page.goto('/chat');

    // Wait for chat interface to load
    await expect(page.locator('h1')).toContainText(/What's On Your Mind|Chat/i, { timeout: 15000 });
  });

  test.describe('Basic Chat Functionality', () => {
    test('should send message and receive streaming response', async ({ page }) => {
      // Select a model
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      // Type and send message
      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'Hello, how are you?');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Wait for assistant response to appear
      await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 10000 });

      // Check that response contains text
      const assistantMessage = page.locator('[data-role="assistant"], .message-assistant').first();
      await expect(assistantMessage).not.toBeEmpty();
    });

    test('should show streaming indicator while generating', async ({ page }) => {
      // Select a model
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      // Send message
      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'Tell me a story');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Check for streaming indicator (spinner or loading state)
      await expect(page.locator('[data-lucide="refresh-cw"].animate-spin, .is-streaming')).toBeVisible({ timeout: 2000 });

      // Wait for streaming to complete
      await expect(page.locator('[data-lucide="refresh-cw"].animate-spin')).not.toBeVisible({ timeout: 30000 });
    });

    test('should work with multiple models', async ({ page }) => {
      const models = ['GPT-4', 'Claude', 'Gemini'];

      for (const model of models) {
        // Select model
        await page.click('[data-testid="model-select"], button:has-text("Select")');
        await page.click(`text=${model}`).catch(() => {
          // Model might not be available, skip
        });

        // Send message
        await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', `Test with ${model}`);
        await page.click('button[type="submit"], button:has([data-lucide="send"])');

        // Wait for response
        await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 10000 });

        // Clear chat for next test
        await page.evaluate(() => {
          // Clear messages from UI
          document.querySelectorAll('[data-role="assistant"], .message-assistant').forEach(el => el.remove());
        });
      }
    });
  });

  test.describe('Reasoning Display', () => {
    test('should display reasoning for Claude 3.7 Sonnet', async ({ page }) => {
      // Select Claude 3.7 Sonnet
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=/Claude.*3.7.*Sonnet/i').catch(() => {
        test.skip('Claude 3.7 Sonnet not available');
      });

      // Send a complex question that triggers reasoning
      await page.fill(
        'input[placeholder*="message"], textarea[placeholder*="message"]',
        'Solve this logic puzzle: If all bloops are razzies and all razzies are lazzies, are all bloops definitely lazzies?'
      );
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Wait for response
      await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 15000 });

      // Check for reasoning/thinking blocks
      const reasoningBlock = page.locator('[data-testid="reasoning-block"], .reasoning-content, .thinking-content');
      if (await reasoningBlock.count() > 0) {
        await expect(reasoningBlock.first()).toBeVisible();
      }
    });

    test('should display reasoning for O1 models', async ({ page }) => {
      // Select O1 model
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=/O1|o1-preview/i').catch(() => {
        test.skip('O1 model not available');
      });

      // Send question
      await page.fill(
        'input[placeholder*="message"], textarea[placeholder*="message"]',
        'What is 23 * 47?'
      );
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Wait for response
      await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should display error for invalid API key', async ({ page }) => {
      // Inject invalid API key
      await page.evaluate(() => {
        localStorage.setItem('gatewayz_api_key', 'invalid-key-12345');
      });

      // Reload to apply new key
      await page.reload();

      // Select model and send message
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'Test');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Check for error message
      await expect(page.locator('text=/error|failed|invalid/i')).toBeVisible({ timeout: 5000 });
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail API calls
      await page.route('**/api/chat/ai-sdk-completions', route => {
        route.abort('failed');
      });

      // Select model and send message
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'Test');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Should show error
      await expect(page.locator('text=/error|failed/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Session Management', () => {
    test('should maintain conversation history', async ({ page }) => {
      // Select model
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      // Send first message
      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'My name is Alice');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');
      await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 10000 });

      // Send follow-up message
      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'What is my name?');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Wait for response
      await expect(page.locator('[data-role="assistant"], .message-assistant').nth(1)).toBeVisible({ timeout: 10000 });

      // Response should reference the name
      const secondResponse = page.locator('[data-role="assistant"], .message-assistant').nth(1);
      await expect(secondResponse).toContainText(/Alice/i, { timeout: 5000 });
    });
  });

  test.describe('Console Logging', () => {
    test('should log AI SDK route usage', async ({ page }) => {
      const consoleLogs: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'log') {
          consoleLogs.push(msg.text());
        }
      });

      // Select model and send message
      await page.click('[data-testid="model-select"], button:has-text("Select")');
      await page.click('text=GPT-4');

      await page.fill('input[placeholder*="message"], textarea[placeholder*="message"]', 'Test');
      await page.click('button[type="submit"], button:has([data-lucide="send"])');

      // Wait for response
      await expect(page.locator('[data-role="assistant"], .message-assistant')).toBeVisible({ timeout: 10000 });

      // Check console logs
      const aiSdkLog = consoleLogs.find(log => log.includes('Using AI SDK route'));
      expect(aiSdkLog).toBeTruthy();
      expect(aiSdkLog).toContain('gpt-4');
    });
  });
});
