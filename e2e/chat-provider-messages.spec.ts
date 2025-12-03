import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Chat Provider Messaging E2E Tests
 *
 * These tests verify that chat messages can be sent and non-error responses
 * are received for:
 * - The default model (Gatewayz Router)
 * - One model from each unique provider/gateway
 *
 * This ensures end-to-end connectivity and proper message handling
 * across the platform's diverse model providers.
 *
 * NOTE: These tests require a real backend connection and are SKIPPED in CI.
 * Run locally with: pnpm test:e2e e2e/chat-provider-messages.spec.ts
 *
 * For CI, use the chat-smoke tests which use mocked APIs.
 */

// Test configuration
const TEST_MESSAGE = 'What is the fastest animal on Earth? Answer in one sentence.';
const MESSAGE_TIMEOUT = 90_000; // 90 seconds for model response
const STREAMING_CHECK_INTERVAL = 500; // Check for streaming updates every 500ms

// Models to test - one representative from each major provider/gateway
// Using models known to be stable and available
const PROVIDER_MODELS = [
  // Default router - must work
  {
    name: 'Gatewayz Router (Default)',
    modelId: 'openrouter/auto',
    modelLabel: 'Gatewayz Router',
    provider: 'openrouter',
    isDefault: true,
  },
  // OpenAI via OpenRouter
  {
    name: 'OpenAI GPT-4o-mini',
    modelId: 'openai/gpt-4o-mini',
    modelLabel: 'GPT-4o Mini',
    provider: 'openai',
  },
  // Anthropic via OpenRouter
  {
    name: 'Anthropic Claude 3.5 Haiku',
    modelId: 'anthropic/claude-3-5-haiku-20241022',
    modelLabel: 'Claude 3.5 Haiku',
    provider: 'anthropic',
  },
  // Google via OpenRouter
  {
    name: 'Google Gemini Flash',
    modelId: 'google/gemini-2.0-flash-001',
    modelLabel: 'Gemini 2.0 Flash',
    provider: 'google',
  },
  // Meta Llama via Groq (fast inference)
  {
    name: 'Meta Llama 3.3 70B (Groq)',
    modelId: 'meta-llama/llama-3.3-70b-instruct',
    modelLabel: 'Llama 3.3 70B Instruct',
    provider: 'meta-llama',
    gateway: 'groq',
  },
  // DeepSeek
  {
    name: 'DeepSeek V3',
    modelId: 'deepseek/deepseek-chat-v3-0324',
    modelLabel: 'DeepSeek V3',
    provider: 'deepseek',
  },
  // Qwen
  {
    name: 'Qwen 2.5 72B',
    modelId: 'qwen/qwen-2.5-72b-instruct',
    modelLabel: 'Qwen 2.5 72B Instruct',
    provider: 'qwen',
  },
  // Mistral
  {
    name: 'Mistral Large',
    modelId: 'mistralai/mistral-large-2411',
    modelLabel: 'Mistral Large',
    provider: 'mistralai',
  },
];

// Helper function to setup mock authentication
async function setupMockAuth(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('gatewayz_api_key', 'test-api-key-e2e-chat-providers');
    localStorage.setItem(
      'gatewayz_user_data',
      JSON.stringify({
        user_id: 999,
        api_key: 'test-api-key-e2e-chat-providers',
        auth_method: 'email',
        privy_user_id: 'test-privy-user-id-chat',
        email: 'chat-provider-test@gatewayz.ai',
        display_name: 'Chat Provider Test User',
        credits: 100000,
        tier: 'pro',
        subscription_status: 'active',
      })
    );
  });
}

// Helper function to wait for chat page to be ready
async function waitForChatReady(page: Page) {
  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // Wait for model selector to be visible (indicates chat UI is ready)
  const modelSelector = page.locator('button[role="combobox"]').first();
  await expect(modelSelector).toBeVisible({ timeout: 30_000 });

  // Wait for input to be available
  const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
  await expect(input).toBeVisible({ timeout: 10_000 });
}

// Helper function to select a model
async function selectModel(page: Page, modelId: string, modelLabel: string) {
  // Click the model selector button
  const modelSelector = page.locator('button[role="combobox"]').first();
  await modelSelector.click();

  // Wait for dropdown to open
  await page.waitForTimeout(500);

  // Search for the model
  const searchInput = page.locator('input[placeholder*="Search" i]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(modelLabel);
    await page.waitForTimeout(300);
  }

  // Try to find and click the model option
  // Look for exact match first, then partial match
  let modelOption = page.locator(`[cmdk-item]`).filter({ hasText: modelLabel }).first();

  if (await modelOption.count() === 0) {
    // Try finding by model ID pattern
    const modelName = modelId.split('/').pop() || modelLabel;
    modelOption = page.locator(`[cmdk-item]`).filter({ hasText: new RegExp(modelName, 'i') }).first();
  }

  if (await modelOption.count() > 0) {
    await modelOption.click();
    await page.waitForTimeout(300);
  } else {
    // If model not found in dropdown, try to close and continue
    // Some models may not be available in the test environment
    await page.keyboard.press('Escape');
    throw new Error(`Model "${modelLabel}" (${modelId}) not found in model selector`);
  }
}

// Helper function to send a message and wait for response
async function sendMessageAndWaitForResponse(
  page: Page,
  message: string,
  timeout: number = MESSAGE_TIMEOUT
): Promise<{ success: boolean; response: string; error?: string }> {
  // Find and fill the input
  const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
  await input.fill(message);

  // Get initial assistant message count - assistant messages have a Bot icon and prose content
  // Selector targets: div with flex gap-3 containing Bot avatar + prose content
  const assistantMessageSelector = 'div.prose.prose-sm';
  const initialMessageCount = await page.locator(assistantMessageSelector).count();

  // Click send button
  const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
  await sendButton.click();

  // Wait for user message to appear (user messages are in blue cards)
  await expect(page.locator('.bg-blue-600, .bg-blue-500').filter({ hasText: message }).first()).toBeVisible({ timeout: 5000 });

  // Wait for assistant response to start (new message appears)
  const startTime = Date.now();
  let responseStarted = false;
  let lastContent = '';
  let errorMessage = '';

  while (Date.now() - startTime < timeout) {
    // Check for error messages in destructive styled elements
    const errorElement = page.locator('.border-destructive, .text-destructive, .bg-destructive').first();
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent();
      if (errorText && errorText.length > 0) {
        errorMessage = errorText;
        break;
      }
    }

    // Check for assistant response - prose content after the Bot avatar
    const assistantMessages = await page.locator(assistantMessageSelector).all();

    if (assistantMessages.length > initialMessageCount) {
      responseStarted = true;
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      const content = await lastMessage.textContent();

      if (content && content.length > 0) {
        lastContent = content;

        // Check if streaming is complete (no bouncing dots indicator)
        const streamingIndicator = await page.locator('.animate-bounce').count();
        if (streamingIndicator === 0 && content.length > 10) {
          // Response is complete
          break;
        }
      }
    }

    await page.waitForTimeout(STREAMING_CHECK_INTERVAL);
  }

  if (errorMessage) {
    return {
      success: false,
      response: '',
      error: errorMessage,
    };
  }

  if (!responseStarted || lastContent.length === 0) {
    return {
      success: false,
      response: '',
      error: 'No response received within timeout',
    };
  }

  // Verify the response is meaningful (not just whitespace or loading indicators)
  const cleanedResponse = lastContent.trim();
  if (cleanedResponse.length < 5) {
    return {
      success: false,
      response: cleanedResponse,
      error: 'Response too short or empty',
    };
  }

  return {
    success: true,
    response: cleanedResponse,
  };
}

// Helper to create a new chat session
async function createNewChatSession(page: Page) {
  // Look for "New Chat" button in sidebar or header
  const newChatButton = page.locator('button').filter({ hasText: /new/i }).first();

  if (await newChatButton.count() > 0 && await newChatButton.isVisible()) {
    await newChatButton.click();
    await page.waitForTimeout(500);
  } else {
    // If no button, navigate to /chat directly
    await page.goto('/chat');
    await waitForChatReady(page);
  }
}

// Main test suite - SKIPPED in CI due to requiring real API connectivity
// Run locally with: pnpm test:e2e e2e/chat-provider-messages.spec.ts
test.describe('Chat Provider Messages - End-to-End', () => {
  // Skip all tests in this suite - they require real API connectivity
  // These tests are designed for local testing to verify all providers work
  test.skip('sends message with default Gatewayz Router and receives response', async ({ page, context }) => {
    // Skipped: This test requires real API connectivity and is meant for local testing.
    // In CI, the chat page doesn't fully load without a real backend.
    // To run this test locally, ensure you have valid API keys configured.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // The default model should already be selected (Gatewayz Router)
    const modelSelector = page.locator('button[role="combobox"]').first();
    const selectedModelText = await modelSelector.textContent();

    // Verify default model is selected or select it
    if (!selectedModelText?.includes('Router') && !selectedModelText?.includes('auto')) {
      await selectModel(page, 'openrouter/auto', 'Gatewayz Router');
    }

    // Send test message
    const result = await sendMessageAndWaitForResponse(page, TEST_MESSAGE);

    expect(result.success, `Default model should respond successfully. Error: ${result.error}`).toBe(true);
    expect(result.response.length).toBeGreaterThan(10);

    // Log success for visibility
    console.log(`[Default Model] Response received (${result.response.length} chars)`);
  });

  // Test each provider model - all skipped for CI
  for (const model of PROVIDER_MODELS) {
    if (model.isDefault) continue; // Skip default, already tested above

    test.skip(`sends message with ${model.name} and receives response`, async ({ page, context }) => {
      // Skipped: This test requires real API connectivity and is meant for local testing.
      await setupMockAuth(context);
      await page.goto('/chat');
      await waitForChatReady(page);

      // Create new session for clean state
      await createNewChatSession(page);

      try {
        // Select the model
        await selectModel(page, model.modelId, model.modelLabel);

        // Verify model is selected
        const modelSelector = page.locator('button[role="combobox"]').first();
        const selectedText = await modelSelector.textContent();
        expect(
          selectedText?.toLowerCase().includes(model.modelLabel.toLowerCase().split(' ')[0]) ||
          selectedText?.toLowerCase().includes(model.provider)
        ).toBe(true);

        // Send test message
        const result = await sendMessageAndWaitForResponse(page, TEST_MESSAGE);

        expect(
          result.success,
          `${model.name} should respond successfully. Error: ${result.error}`
        ).toBe(true);
        expect(result.response.length).toBeGreaterThan(10);

        // Log success for visibility
        console.log(`[${model.name}] Response received (${result.response.length} chars)`);
      } catch (error) {
        // If model selection fails, skip with warning (model may not be available)
        if (error instanceof Error && error.message.includes('not found in model selector')) {
          console.warn(`[${model.name}] Skipped - Model not available in selector`);
          test.skip();
        }
        throw error;
      }
    });
  }
});

// Quick smoke test that can run faster - SKIPPED in CI
test.describe('Chat Quick Smoke Test', () => {
  test.skip('basic chat flow works with default model', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    // For CI, use the chat-critical.spec.ts tests instead which properly mock the API.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // Just verify we can type and see the input
    const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
    await input.fill('Hello');
    await expect(input).toHaveValue('Hello');

    // Verify send button exists
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
    await expect(sendButton).toBeVisible();

    // Verify model selector works
    const modelSelector = page.locator('button[role="combobox"]').first();
    await expect(modelSelector).toBeVisible();
  });
});

// Parallel provider tests - SKIPPED in CI
test.describe('Chat Provider Tests - Parallel Safe', () => {
  // These tests can run in parallel as they each use a fresh page
  // All skipped because they require real backend connectivity

  test.skip('chat UI elements are functional', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // Check model selector
    const modelSelector = page.locator('button[role="combobox"]').first();
    await expect(modelSelector).toBeEnabled();

    // Check input field
    const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
    await expect(input).toBeEnabled();

    // Check send button
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
    await expect(sendButton).toBeVisible();

    // Check attachment buttons (image, video, audio)
    const imageButton = page.locator('button').filter({ has: page.locator('svg.lucide-image') }).first();
    await expect(imageButton).toBeVisible();
  });

  test.skip('model selector opens and shows models', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // Open model selector
    const modelSelector = page.locator('button[role="combobox"]').first();
    await modelSelector.click();

    // Wait for dropdown
    await page.waitForTimeout(500);

    // Should show search input
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible();

    // Should show some model options
    const modelOptions = page.locator('[cmdk-item]');
    await expect(modelOptions.first()).toBeVisible({ timeout: 10_000 });

    // Should have multiple models
    const count = await modelOptions.count();
    expect(count).toBeGreaterThan(5);

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test.skip('can search for models in selector', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // Open model selector
    const modelSelector = page.locator('button[role="combobox"]').first();
    await modelSelector.click();
    await page.waitForTimeout(500);

    // Search for a common model
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.fill('gpt');
    await page.waitForTimeout(300);

    // Should filter to GPT models
    const gptOptions = page.locator('[cmdk-item]').filter({ hasText: /gpt/i });
    await expect(gptOptions.first()).toBeVisible({ timeout: 5_000 });

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test.skip('welcome screen shows prompts', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);
    await page.goto('/chat');
    await waitForChatReady(page);

    // Should show "What's On Your Mind?" heading
    await expect(page.getByText("What's On Your Mind?")).toBeVisible({ timeout: 10_000 });

    // Should show prompt cards
    const promptCards = page.locator('.cursor-pointer').filter({ hasText: /\?/ });
    const cardCount = await promptCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });
});

// Error handling tests - SKIPPED in CI
test.describe('Chat Error Handling', () => {
  test.skip('handles network errors gracefully', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);

    // Block API calls to simulate network error
    await page.route('**/api/chat/completions*', (route) => {
      route.abort('failed');
    });

    await page.goto('/chat');
    await waitForChatReady(page);

    // Try to send a message
    const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
    await input.fill('Test message');

    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') }).first();
    await sendButton.click();

    // Should show error state (toast or inline error) - just verify page doesn't crash
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test.skip('handles API timeout gracefully', async ({ page, context }) => {
    // Skipped: This test requires the chat page to fully load which needs backend connectivity.
    await setupMockAuth(context);

    // Add very long delay to simulate timeout
    await page.route('**/api/chat/completions*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      route.abort('timedout');
    });

    await page.goto('/chat');
    await waitForChatReady(page);

    // Page should still be interactive
    const input = page.locator('input[placeholder*="message" i], input[enterkeyhint="send"]').first();
    await expect(input).toBeEnabled();
  });
});
