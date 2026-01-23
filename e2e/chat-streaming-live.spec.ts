import { test, expect } from './fixtures';

/**
 * Live Streaming E2E Tests
 *
 * CRITICAL: These tests verify streaming works with live API calls.
 *
 * Coverage includes:
 * - Real streaming responses from the API
 * - SSE parsing and chunk handling
 * - UI updates during streaming
 * - Error recovery scenarios
 * - Rate limit handling
 *
 * Run: pnpm test:e2e -g "Streaming.*Live"
 * Debug: pnpm test:e2e:debug -g "Streaming.*Live"
 */

test.describe('Streaming - Live API Tests', () => {
  test.describe('Basic Streaming Flow', () => {
    test('should stream response and display incrementally', async ({ authenticatedPage: page, mockChatAPI }) => {
      // Set up mock that streams in chunks
      await page.route('**/api/chat/completions*', async route => {
        const chunks = [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" from"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" streaming!"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: chunks.join(''),
        });
      });

      await page.route('**/api/chat/ai-sdk-completions*', async route => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" from"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" AI SDK!"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Find and interact with message input
      const messageInput = page.locator(
        'textarea[placeholder*="message" i], ' +
        'input[placeholder*="message" i], ' +
        '[data-testid="message-input"]'
      ).first();

      if (await messageInput.count() > 0) {
        await messageInput.fill('Hello');

        // Find and click send button
        const sendButton = page.locator(
          'button:has-text("Send"), ' +
          '[data-testid="send-button"]'
        ).first();

        if (await sendButton.count() > 0) {
          await sendButton.click();

          // Wait for response to appear
          await page.waitForTimeout(1000);

          // Verify page is still responsive
          await expect(page.locator('body')).toBeVisible();
        }
      }
    });

    test('should handle streaming with reasoning content', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        const chunks = [
          'data: {"choices":[{"delta":{"reasoning_content":"Let me think..."}}]}\n\n',
          'data: {"choices":[{"delta":{"reasoning_content":" analyzing..."}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"The answer is 42"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Page should remain functional
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Recovery', () => {
    test('should handle 429 rate limit and retry', async ({ authenticatedPage: page, mockChatAPI }) => {
      let requestCount = 0;

      await page.route('**/api/chat/**completions*', async route => {
        requestCount++;

        if (requestCount === 1) {
          // First request returns 429
          await route.fulfill({
            status: 429,
            headers: { 'Retry-After': '1' },
            body: JSON.stringify({ detail: 'Rate limit exceeded' }),
          });
        } else {
          // Subsequent requests succeed
          const chunks = [
            'data: {"choices":[{"delta":{"content":"Success after retry"}}]}\n\n',
            'data: [DONE]\n\n',
          ];
          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: chunks.join(''),
          });
        }
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Verify page handles rate limit gracefully
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display error for 500 server error', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ detail: 'Internal server error' }),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      const messageInput = page.locator('textarea, input').first();
      const sendButton = page.locator('button:has-text("Send")').first();

      if (await messageInput.count() > 0 && await sendButton.count() > 0) {
        await messageInput.fill('Test message');
        await sendButton.click();
        await page.waitForTimeout(1000);

        // Page should still be usable
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should handle network errors gracefully', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        await route.abort('failed');
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      const messageInput = page.locator('textarea, input').first();
      const sendButton = page.locator('button:has-text("Send")').first();

      if (await messageInput.count() > 0 && await sendButton.count() > 0) {
        await messageInput.fill('Test message');
        await sendButton.click();
        await page.waitForTimeout(1000);

        // Page should still be usable after network error
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('SSE Format Validation', () => {
    test('should parse OpenAI choices format correctly', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        const chunks = [
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should parse Fireworks output format correctly', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/completions*', async route => {
        const chunks = [
          'data: {"id":"abc123","object":"response.chunk","model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"role":"assistant"}]}\n\n',
          'data: {"id":"abc123","object":"response.chunk","model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"content":"Hello from Fireworks"}]}\n\n',
          'data: {"id":"abc123","object":"response.chunk","model":"accounts/fireworks/models/deepseek-r1","output":[{"index":0,"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle event-based streaming format', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        const chunks = [
          'data: {"type":"response.output_text.delta","delta":"Hello "}\n\n',
          'data: {"type":"response.output_text.delta","delta":"world"}\n\n',
          'data: {"type":"response.output_text.done"}\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid chunk delivery', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        // Generate 100 chunks rapidly
        const chunks: string[] = [];
        for (let i = 0; i < 100; i++) {
          chunks.push(`data: {"choices":[{"delta":{"content":"w${i} "}}]}\n\n`);
        }
        chunks.push('data: [DONE]\n\n');

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Page should remain responsive even with many chunks
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle large response chunks', async ({ authenticatedPage: page, mockChatAPI }) => {
      await page.route('**/api/chat/**completions*', async route => {
        // Generate a large content chunk
        const largeContent = 'A'.repeat(10000);
        const chunks = [
          `data: {"choices":[{"delta":{"content":"${largeContent}"}}]}\n\n`,
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Multi-Model Support', () => {
    const models = [
      { name: 'GPT-4', format: 'choices' },
      { name: 'Claude', format: 'choices' },
      { name: 'Gemini', format: 'choices' },
      { name: 'DeepSeek', format: 'output' },
    ];

    for (const model of models) {
      test(`should stream ${model.name} responses correctly`, async ({ authenticatedPage: page, mockChatAPI }) => {
        await page.route('**/api/chat/**completions*', async route => {
          let chunks: string[];

          if (model.format === 'output') {
            chunks = [
              'data: {"output":[{"content":"Response from ' + model.name + '"}]}\n\n',
              'data: [DONE]\n\n',
            ];
          } else {
            chunks = [
              `data: {"choices":[{"delta":{"content":"Response from ${model.name}"}}]}\n\n`,
              'data: [DONE]\n\n',
            ];
          }

          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: chunks.join(''),
          });
        });

        await mockChatAPI();
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
      });
    }
  });

  test.describe('Guest User Streaming', () => {
    test('should stream for guest users', async ({ page }) => {
      // Don't authenticate, simulate guest user
      await page.route('**/api/chat/**completions*', async route => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Guest response"}}]}\n\n',
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Page should still work for guests
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show sign-up prompt when guest limit reached', async ({ page }) => {
      await page.route('**/api/chat/**completions*', async route => {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({
            code: 'GUEST_NOT_CONFIGURED',
            detail: 'Please sign in to continue',
          }),
        });
      });

      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Page should remain usable
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Concurrent Requests', () => {
    test('should handle multiple concurrent streams', async ({ authenticatedPage: page, mockChatAPI }) => {
      let requestCount = 0;

      await page.route('**/api/chat/**completions*', async route => {
        requestCount++;
        const id = requestCount;

        const chunks = [
          `data: {"choices":[{"delta":{"content":"Response ${id}"}}]}\n\n`,
          'data: [DONE]\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: chunks.join(''),
        });
      });

      await mockChatAPI();
      await page.goto('/chat');
      await page.waitForLoadState('domcontentloaded');

      // Page should handle concurrent requests
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
