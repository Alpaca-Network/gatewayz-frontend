import { test, expect } from '@playwright/test';

const session = {
  id: 1,
  user_id: 1,
  title: 'Smoke Chat',
  model: 'openrouter/auto',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_active: true,
  messages: [],
};

const fulfillJson = (route: any, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data: body, success: true }),
  });

test.describe('Chat smoke (mocked backend)', () => {
  test('auth and send message flow succeeds', async ({ page }) => {
    // Seed auth before any page scripts run
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
          credits: 100,
        })
      );
    });

    // Mock chat history endpoints
    await page.route('**/v1/chat/sessions?**', (route) => fulfillJson(route, [session]));
    await page.route('**/v1/chat/sessions/1', (route) => fulfillJson(route, session));
    await page.route('**/v1/chat/sessions/1/messages', (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const now = new Date().toISOString();
        const payload = request.postDataJSON();
        return fulfillJson(route, {
          id: 101,
          session_id: 1,
          role: payload.role,
          content: payload.content,
          model: payload.model,
          tokens: payload.tokens ?? 0,
          created_at: now,
        });
      }
      return fulfillJson(route, []);
    });

    await page.route('**/v1/chat/sessions', (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, session);
      }
      return fulfillJson(route, [session]);
    });

    // Mock streaming completion response
    await page.route('**/api/chat/completions', (route) => {
      const body = [
        'data: {"choices":[{"delta":{"content":"Hello from mock"}}]}\n\n',
        'data: [DONE]\n\n',
      ].join('');
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body,
      });
    });

    await page.goto('/chat');

    // Wait for sidebar session to appear
    await expect(page.getByText('Smoke Chat')).toBeVisible();

    // Type and send a message
    const input = page.getByPlaceholder(/Message/i);
    await input.fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();

    // User message should render
    await expect(page.getByText('Test message')).toBeVisible();
    // Assistant streaming result should render
    await expect(page.getByText('Hello from mock')).toBeVisible();
  });
});

