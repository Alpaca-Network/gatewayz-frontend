/**
 * E2E tests for OpenRouter auto streaming
 *
 * These tests validate that streaming works correctly with openrouter/auto
 * in the full application context
 */

import { test, expect } from '@playwright/test';

/**
 * Helper to fulfill JSON responses
 */
const fulfillJson = (route: any, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data: body, success: true }),
  });

/**
 * Helper to create streaming SSE response
 */
const fulfillStreamingResponse = (route: any, chunks: string[]) => {
  const body = chunks.join('');
  route.fulfill({
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    body,
  });
};

test.describe('OpenRouter Auto Streaming E2E', () => {
  const mockSession = {
    id: 1,
    user_id: 1,
    title: 'OpenRouter Auto Test',
    model: 'openrouter/auto',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    messages: [],
  };

  test.beforeEach(async ({ page }) => {
    // Seed auth before page loads
    await page.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key');
      localStorage.setItem(
        'gatewayz_user_data',
        JSON.stringify({
          user_id: 1,
          api_key: 'test-api-key',
          auth_method: 'email',
          privy_user_id: 'privy-user-1',
          display_name: 'Test User',
          email: 'test@example.com',
          credits: 1000,
          tier: 'pro',
        })
      );
    });
  });

  test('should stream content with openrouter/auto model', async ({ page }) => {
    // Mock backend endpoints
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 101,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    // Mock streaming completion response
    await page.route('**/api/chat/completions', (route) => {
      fulfillStreamingResponse(route, [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" from"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" OpenRouter"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" Auto"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Send a test message
    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Test streaming');
    await page.getByRole('button', { name: /Send/i }).click();

    // User message should appear
    await expect(page.getByText('Test streaming')).toBeVisible();

    // Streamed response should appear
    await expect(page.getByText(/Hello from OpenRouter Auto/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle reasoning content in streaming', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 102,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    // Mock streaming with reasoning
    await page.route('**/api/chat/completions', (route) => {
      fulfillStreamingResponse(route, [
        'data: {"choices":[{"delta":{"reasoning":"Let me analyze this..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"The answer is"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" 42"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);
    await input.fill('What is the answer?');
    await page.getByRole('button', { name: /Send/i }).click();

    // Response content should appear
    await expect(page.getByText(/The answer is 42/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle rate limiting with retry', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 103,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    let requestCount = 0;

    // First request returns 429, second succeeds
    await page.route('**/api/chat/completions', (route) => {
      requestCount++;

      if (requestCount === 1) {
        // First request: rate limited
        route.fulfill({
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1',
          },
          body: JSON.stringify({
            error: 'Rate Limit Exceeded',
            detail: 'Rate limit exceeded. Please wait.',
          }),
        });
      } else {
        // Second request: success
        fulfillStreamingResponse(route, [
          'data: {"choices":[{"delta":{"content":"Success after retry"}}]}\n\n',
          'data: [DONE]\n\n',
        ]);
      }
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Test retry');
    await page.getByRole('button', { name: /Send/i }).click();

    // Should eventually show success message after retry
    await expect(page.getByText(/Success after retry/i)).toBeVisible({ timeout: 15000 });
  });

  test('should display error for authentication failures', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 104,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    // Mock 401 error
    await page.route('**/api/chat/completions', (route) => {
      route.fulfill({
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'Invalid API key' },
        }),
      });
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Test auth error');
    await page.getByRole('button', { name: /Send/i }).click();

    // Should show error message
    await expect(page.getByText(/Authentication failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle model errors gracefully', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 105,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    // Mock model error
    await page.route('**/api/chat/completions', (route) => {
      route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail: 'Model not available',
        }),
      });
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Test model error');
    await page.getByRole('button', { name: /Send/i }).click();

    // Should show error message
    await expect(page.getByText(/Model not available/i)).toBeVisible({ timeout: 10000 });
  });

  test('should stream multiple messages in sequence', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));

    let messageId = 100;
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        messageId++;
        return fulfillJson(route, {
          id: messageId,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    let completionCount = 0;
    await page.route('**/api/chat/completions', (route) => {
      completionCount++;
      fulfillStreamingResponse(route, [
        `data: {"choices":[{"delta":{"content":"Response ${completionCount}"}}]}\n\n`,
        'data: [DONE]\n\n',
      ]);
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);

    // Send first message
    await input.fill('Message 1');
    await page.getByRole('button', { name: /Send/i }).click();
    await expect(page.getByText('Response 1')).toBeVisible({ timeout: 10000 });

    // Send second message
    await input.fill('Message 2');
    await page.getByRole('button', { name: /Send/i }).click();
    await expect(page.getByText('Response 2')).toBeVisible({ timeout: 10000 });

    // Send third message
    await input.fill('Message 3');
    await page.getByRole('button', { name: /Send/i }).click();
    await expect(page.getByText('Response 3')).toBeVisible({ timeout: 10000 });

    // All responses should be visible
    expect(await page.getByText('Response 1').count()).toBe(1);
    expect(await page.getByText('Response 2').count()).toBe(1);
    expect(await page.getByText('Response 3').count()).toBe(1);
  });

  test('should handle long streaming responses', async ({ page }) => {
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [mockSession]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, mockSession));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      if (route.request().method() === 'POST') {
        const now = new Date().toISOString();
        const payload = route.request().postDataJSON();
        return fulfillJson(route, {
          id: 106,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, mockSession);
      }
      return fulfillJson(route, [mockSession]);
    });

    // Create a long streaming response with many chunks
    const chunks: string[] = [];
    for (let i = 1; i <= 50; i++) {
      chunks.push(`data: {"choices":[{"delta":{"content":"word${i} "}}]}\n\n`);
    }
    chunks.push('data: [DONE]\n\n');

    await page.route('**/api/chat/completions', (route) => {
      fulfillStreamingResponse(route, chunks);
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Long response test');
    await page.getByRole('button', { name: /Send/i }).click();

    // Should show parts of the long response
    await expect(page.getByText(/word1/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/word50/i)).toBeVisible({ timeout: 10000 });
  });
});
