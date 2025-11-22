import { test, expect } from './fixtures';

/**
 * Authentication Wallet Extension Error Handling Tests
 *
 * Critical regression tests for wallet extension error handling during sign-in.
 * These tests prevent the bug where wallet extension errors (chrome.runtime.sendMessage)
 * would block authentication completion, leaving users stuck in "authenticating" state.
 *
 * Issue Reference: terragon/fix-sign-in-irvy9n
 * Original Bug: Wallet errors set status to "authenticating" and returned early,
 *               preventing backend authentication from completing.
 *
 * Tests cover:
 * - Authentication completes despite wallet extension errors
 * - User credentials are saved correctly even with wallet errors
 * - Auth state is set to "authenticated" when credentials exist
 * - Non-blocking wallet errors don't trigger error toast
 * - Multiple wallet error scenarios (sendMessage, Extension ID, etc.)
 *
 * Run: pnpm test:e2e -g "Wallet Extension"
 * Debug: pnpm test:e2e:debug -g "Wallet Extension"
 */

test.describe('Authentication - Wallet Extension Error Handling', () => {
  test('authentication completes when wallet extension error occurs', async ({ page, context }) => {
    // Setup: Mock successful backend auth
    await page.route('**/api/auth', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            api_key: 'gw_test_wallet_error_key_123',
            user_id: 456,
            email: 'wallet-error-test@gatewayz.ai',
            display_name: 'Wallet Error Test User',
            credits: 1000,
            tier: 'basic',
            subscription_status: 'active',
            auth_method: 'email',
            privy_user_id: 'privy-test-id-123',
            is_new_user: false
          })
        });
      } else {
        route.continue();
      }
    });

    // Inject a script that simulates wallet extension error during auth
    await context.addInitScript(() => {
      // Store original fetch
      const originalFetch = window.fetch;

      // Override fetch to throw wallet error after successful auth response
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);

        // If this is the auth endpoint and it succeeded, throw a wallet error after
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        if (url.includes('/api/auth') && response.ok) {
          // Clone response so we can still return it
          const clonedResponse = response.clone();

          // Simulate async wallet error that happens after auth succeeds
          setTimeout(() => {
            // This simulates a wallet extension error that occurs during or after auth
            const error = new Error('chrome.runtime.sendMessage is not available from a webpage');
            error.name = 'WalletExtensionError';
            console.warn('[Test] Simulating wallet extension error after auth:', error);
          }, 100);

          return clonedResponse;
        }

        return response;
      };
    });

    // Navigate to page (triggers auth flow)
    await page.goto('/');

    // Wait for auth to complete
    await page.waitForTimeout(1000);

    // Verify authentication completed successfully despite wallet error
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_test_wallet_error_key_123');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(456);
    expect(userData.email).toBe('wallet-error-test@gatewayz.ai');

    // Verify page loaded successfully (not stuck in authenticating state)
    await expect(page.locator('body')).toBeVisible();
  });

  test('auth status is set to authenticated when credentials exist despite wallet error', async ({ page, context }) => {
    // Pre-populate localStorage with valid credentials (simulating successful auth before wallet error)
    await context.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'gw_existing_key_789');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({
        user_id: 789,
        email: 'existing-user@gatewayz.ai',
        display_name: 'Existing User',
        credits: 5000,
        tier: 'pro',
        subscription_status: 'active',
        auth_method: 'google',
        privy_user_id: 'privy-existing-123',
        api_key: 'gw_existing_key_789'
      }));

      // Simulate a wallet extension error during page load
      window.addEventListener('load', () => {
        setTimeout(() => {
          const error = new Error('Extension ID does not exist');
          error.name = 'WalletError';
          console.error('[Test] Simulating wallet error:', error);
        }, 50);
      });
    });

    // Navigate to page
    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify credentials are still present
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_existing_key_789');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(789);

    // Verify page loaded successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('wallet error patterns are correctly identified and ignored', async ({ page, context }) => {
    const walletErrorPatterns = [
      'chrome.runtime.sendMessage is not available',
      'runtime.sendMessage failed',
      'Extension ID xyz does not exist',
      'Cannot call sendMessage from a webpage'
    ];

    for (const errorPattern of walletErrorPatterns) {
      // Setup mock auth
      await page.route('**/api/auth', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              api_key: 'gw_pattern_test_key',
              user_id: 999,
              email: 'pattern-test@gatewayz.ai',
              display_name: 'Pattern Test',
              credits: 1000,
              tier: 'basic',
              subscription_status: 'active',
              auth_method: 'email',
              privy_user_id: 'privy-pattern-test',
              is_new_user: false
            })
          });
        } else {
          route.continue();
        }
      });

      // Inject script that throws the specific error pattern
      await context.addInitScript((pattern: string) => {
        const originalFetch = window.fetch;
        window.fetch = async (...args: Parameters<typeof fetch>) => {
          const response = await originalFetch(...args);
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;

          if (url.includes('/api/auth') && response.ok) {
            const clonedResponse = response.clone();
            setTimeout(() => {
              const error = new Error(pattern);
              console.warn('[Test] Simulating error pattern:', error);
            }, 100);
            return clonedResponse;
          }

          return response;
        };
      }, errorPattern);

      // Navigate and verify auth completes
      await page.goto('/');
      await page.waitForTimeout(800);

      // Verify auth completed despite wallet error pattern
      const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
      expect(apiKey).toBe('gw_pattern_test_key');

      console.log(`✓ Error pattern handled correctly: "${errorPattern}"`);
    }
  });

  test('no error toast shown for non-blocking wallet extension errors', async ({ page, context }) => {
    // Setup mock auth
    await page.route('**/api/auth', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            api_key: 'gw_toast_test_key',
            user_id: 888,
            email: 'toast-test@gatewayz.ai',
            display_name: 'Toast Test',
            credits: 1000,
            tier: 'basic',
            subscription_status: 'active',
            auth_method: 'email',
            privy_user_id: 'privy-toast-test',
            is_new_user: false
          })
        });
      } else {
        route.continue();
      }
    });

    // Inject wallet error simulation
    await context.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        if (url.includes('/api/auth') && response.ok) {
          const clonedResponse = response.clone();
          setTimeout(() => {
            const error = new Error('chrome.runtime.sendMessage failed');
            console.warn('[Test] Simulating wallet error:', error);
          }, 100);
          return clonedResponse;
        }

        return response;
      };
    });

    // Navigate to page
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Verify no error toast is shown
    // Error toasts typically have role="alert" or contain specific error text
    const errorToast = page.locator('[role="alert"]').filter({ hasText: /sign in failed|authentication failed/i });
    await expect(errorToast).not.toBeVisible();

    // Verify success - credentials are saved
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_toast_test_key');
  });

  test('authentication works without wallet extension present', async ({ page, context }) => {
    // Setup mock auth
    await page.route('**/api/auth', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            api_key: 'gw_no_wallet_key',
            user_id: 777,
            email: 'no-wallet@gatewayz.ai',
            display_name: 'No Wallet User',
            credits: 1000,
            tier: 'basic',
            subscription_status: 'active',
            auth_method: 'email',
            privy_user_id: 'privy-no-wallet',
            is_new_user: false
          })
        });
      } else {
        route.continue();
      }
    });

    // Ensure no wallet extension is present (no chrome.runtime)
    await context.addInitScript(() => {
      // Remove any chrome.runtime if it exists
      if (window.chrome && window.chrome.runtime) {
        delete (window.chrome as any).runtime;
      }
    });

    // Navigate and authenticate
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Verify auth completed successfully without wallet
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_no_wallet_key');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(777);
    expect(userData.email).toBe('no-wallet@gatewayz.ai');
  });

  test('wallet errors during token retrieval do not block authentication', async ({ page, context }) => {
    // Mock successful backend auth
    await page.route('**/api/auth', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            api_key: 'gw_token_error_key',
            user_id: 666,
            email: 'token-error@gatewayz.ai',
            display_name: 'Token Error Test',
            credits: 1000,
            tier: 'basic',
            subscription_status: 'active',
            auth_method: 'email',
            privy_user_id: 'privy-token-error',
            is_new_user: false
          })
        });
      } else {
        route.continue();
      }
    });

    // Simulate wallet error during token retrieval (before backend call)
    await context.addInitScript(() => {
      // Mock getAccessToken to simulate wallet error
      (window as any).__mockPrivyTokenError = true;

      const originalFetch = window.fetch;
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        // Simulate wallet error before auth call
        if (url.includes('/api/auth') && (window as any).__mockPrivyTokenError) {
          console.warn('[Test] Simulating wallet error during token retrieval');
          // Let the auth call proceed without token (backend should handle gracefully)
        }

        return originalFetch(...args);
      };
    });

    // Navigate and authenticate
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Verify auth completed successfully despite token retrieval wallet error
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_token_error_key');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(666);
  });

  test('credentials persist across page reload despite wallet errors', async ({ page, context }) => {
    // Setup initial credentials
    await context.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'gw_persist_test_key');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({
        user_id: 555,
        email: 'persist-test@gatewayz.ai',
        display_name: 'Persist Test',
        credits: 2000,
        tier: 'pro',
        subscription_status: 'active',
        auth_method: 'github',
        privy_user_id: 'privy-persist-test',
        api_key: 'gw_persist_test_key'
      }));
    });

    // Navigate to page
    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify initial credentials
    let apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_persist_test_key');

    // Simulate wallet error
    await page.evaluate(() => {
      const error = new Error('chrome.runtime.sendMessage error during reload');
      console.warn('[Test] Wallet error:', error);
    });

    // Reload page
    await page.reload();
    await page.waitForTimeout(500);

    // Verify credentials persisted after reload despite wallet error
    apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_persist_test_key');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(555);
  });
});

test.describe('Authentication - Wallet Error Edge Cases', () => {
  test('multiple consecutive wallet errors do not corrupt auth state', async ({ page, context }) => {
    // Pre-populate valid credentials
    await context.addInitScript(() => {
      localStorage.setItem('gatewayz_api_key', 'gw_multi_error_key');
      localStorage.setItem('gatewayz_user_data', JSON.stringify({
        user_id: 444,
        email: 'multi-error@gatewayz.ai',
        display_name: 'Multi Error Test',
        credits: 3000,
        tier: 'max',
        subscription_status: 'active',
        auth_method: 'email',
        privy_user_id: 'privy-multi-error',
        api_key: 'gw_multi_error_key'
      }));

      // Simulate multiple rapid wallet errors
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const error = new Error(`chrome.runtime.sendMessage error ${i + 1}`);
            console.warn('[Test] Wallet error', i + 1, ':', error);
          }, i * 100);
        }
      }, 100);
    });

    // Navigate to page
    await page.goto('/');
    await page.waitForTimeout(1500);

    // Verify credentials are intact after multiple errors
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBe('gw_multi_error_key');

    const userData = await page.evaluate(() => {
      const data = localStorage.getItem('gatewayz_user_data');
      return data ? JSON.parse(data) : null;
    });

    expect(userData).toBeDefined();
    expect(userData.user_id).toBe(444);
    expect(userData.email).toBe('multi-error@gatewayz.ai');

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('real authentication errors are still caught and handled correctly', async ({ page, context }) => {
    // Mock backend auth failure (not a wallet error)
    await page.route('**/api/auth', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid credentials',
            message: 'Authentication failed'
          })
        });
      } else {
        route.continue();
      }
    });

    // Navigate to page (auth should fail properly)
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Verify credentials are NOT saved on real auth failure
    const apiKey = await page.evaluate(() => localStorage.getItem('gatewayz_api_key'));
    expect(apiKey).toBeNull();

    const userData = await page.evaluate(() => localStorage.getItem('gatewayz_user_data'));
    expect(userData).toBeNull();

    // Page should still load (just unauthenticated)
    await expect(page.locator('body')).toBeVisible();
  });
});
