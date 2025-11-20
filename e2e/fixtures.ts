import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Shared E2E Test Fixtures
 *
 * Provides reusable test fixtures for authentication, mocking, and common operations
 */

interface TestFixtures {
  authenticatedPage: Page;
  mockAuth: (context: BrowserContext) => Promise<void>;
  mockModelsAPI: (page: Page) => Promise<void>;
  mockChatAPI: (page: Page) => Promise<void>;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    // Setup mock authentication
    await context.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'test-api-key-e2e-12345');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({
        user_id: 999,
        email: 'e2e-test@gatewayz.ai',
        display_name: 'E2E Test User',
        credits: 10000,
        tier: 'pro',
        subscription_status: 'active'
      }));
    });

    await use(page);
  },

  mockAuth: async ({ page, context }, use) => {
    const setupAuth = async () => {
      await context.addInitScript(() => {
        localStorage.setItem('gatewayz_api_key', 'test-api-key-e2e-12345');
        localStorage.setItem('gatewayz_user_data', JSON.stringify({
          user_id: 999,
          email: 'e2e-test@gatewayz.ai',
          display_name: 'E2E Test User',
          credits: 10000,
          tier: 'pro',
          subscription_status: 'active'
        }));
      });
    };

    await use(setupAuth);
  },

  mockModelsAPI: async ({ page }, use) => {
    const setupMock = async () => {
      const mockModels = [
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          description: 'Advanced reasoning and coding',
          context_length: 128000,
          pricing: { prompt: '0.01', completion: '0.03' },
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text']
          },
          provider_slug: 'openai',
          source_gateways: ['openrouter']
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          description: 'Most capable Claude model',
          context_length: 200000,
          pricing: { prompt: '0.015', completion: '0.075' },
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text']
          },
          provider_slug: 'anthropic',
          source_gateways: ['openrouter']
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          description: 'Balanced performance model',
          context_length: 200000,
          pricing: { prompt: '0.003', completion: '0.015' },
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text']
          },
          provider_slug: 'anthropic',
          source_gateways: ['openrouter']
        },
        {
          id: 'llama-2-70b',
          name: 'Llama 2 70B',
          description: 'Open source large language model',
          context_length: 4096,
          pricing: { prompt: '0.0007', completion: '0.0009' },
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text']
          },
          provider_slug: 'meta',
          source_gateways: ['together', 'groq']
        }
      ];

      await page.route('**/api/models*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockModels, total: mockModels.length })
        });
      });

      await page.route('**/v1/models*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mockModels, total: mockModels.length })
        });
      });
    };

    await use(setupMock);
  },

  mockChatAPI: async ({ page }, use) => {
    const setupMock = async () => {
      // Mock chat completions
      await page.route('**/api/chat/completions*', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'chatcmpl-test-123',
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: 'gpt-4',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: 'This is a test response from the E2E test mock.'
                },
                finish_reason: 'stop'
              }],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30
              }
            })
          });
        } else {
          route.continue();
        }
      });

      // Mock chat sessions
      await page.route('**/api/chat/sessions*', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              sessions: [
                {
                  id: 1,
                  title: 'Test Session 1',
                  model: 'gpt-4',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  messages: []
                }
              ]
            })
          });
        } else {
          route.continue();
        }
      });
    };

    await use(setupMock);
  }
});

export { expect };
