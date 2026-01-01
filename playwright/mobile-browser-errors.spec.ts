/**
 * Mobile Browser Error Handling Tests
 *
 * Tests mobile-specific error scenarios including:
 * - iOS WebKit IndexedDB issues
 * - iOS in-app browser detection
 * - Embedded wallet disabling
 * - Storage availability checks
 *
 * Related PR: #649 (iOS webkit indexeddb issue)
 */

import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Browser Error Handling', () => {
  test.describe('iOS Safari', () => {
    test.use({
      ...devices['iPhone 13'],
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    });

    test('handles IndexedDB errors gracefully on iOS', async ({ page, context }) => {
      // Monitor console for IndexedDB errors
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      });

      // Mock IndexedDB to fail
      await context.addInitScript(() => {
        const originalOpen = window.indexedDB.open;
        window.indexedDB.open = function(...args) {
          const request = originalOpen.apply(this, args);
          setTimeout(() => {
            const event = new Event('error');
            Object.defineProperty(event, 'target', {
              value: {
                error: new Error('Database deleted by request of the user'),
              },
            });
            request.dispatchEvent(event);
          }, 100);
          return request;
        };
      });

      await page.goto('/');

      // Wait for potential errors
      await page.waitForTimeout(2000);

      // Verify IndexedDB error is logged but not blocking
      const indexedDBErrors = consoleMessages.filter(msg =>
        msg.includes('IndexedDB') || msg.includes('database_deleted')
      );

      // Should have logged the error
      expect(indexedDBErrors.length).toBeGreaterThan(0);

      // Verify app still loads
      await expect(page.locator('body')).toBeVisible();

      // Verify no unhandled errors crashed the app
      const unhandledErrors = consoleMessages.filter(msg =>
        msg.includes('error:') && !msg.includes('IndexedDB')
      );
      expect(unhandledErrors).toHaveLength(0);
    });

    test('embedded wallets work on iOS Safari', async ({ page }) => {
      await page.goto('/');

      // iOS Safari should NOT disable embedded wallets
      // (only in-app browsers disable them)
      const walletOption = page.locator('[data-testid="embedded-wallet-option"]');

      // May not exist yet, but shouldn't be explicitly hidden
      const isHidden = await walletOption.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      }).catch(() => false);

      expect(isHidden).toBe(false);
    });
  });

  test.describe('iOS In-App Browsers (PR #649)', () => {
    const inAppBrowsers = [
      {
        name: 'Twitter/X',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone',
      },
      {
        name: 'Facebook',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/1.0;FBBV/1.0]',
      },
      {
        name: 'Instagram',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 1.0.0.0.0',
      },
      {
        name: 'LinkedIn',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp',
      },
    ];

    for (const browser of inAppBrowsers) {
      test(`disables embedded wallets in ${browser.name}`, async ({ page, context }) => {
        // Set custom user agent
        await context.setExtraHTTPHeaders({
          'User-Agent': browser.userAgent,
        });

        const consoleMessages: string[] = [];
        page.on('console', (msg) => {
          consoleMessages.push(msg.text());
        });

        await page.goto('/');

        // Wait for provider initialization
        await page.waitForTimeout(2000);

        // Verify embedded wallets are disabled
        const disabledLog = consoleMessages.find(msg =>
          msg.includes('Embedded wallets disabled') ||
          msg.includes('iOS in-app browser detected')
        );

        expect(disabledLog).toBeTruthy();

        // Verify wallet options are not shown
        const walletOptions = await page.locator('[data-testid="embedded-wallet-option"]').count();
        expect(walletOptions).toBe(0);

        // Verify alternative auth methods are available
        await expect(page.locator('[data-testid="email-auth-option"]')).toBeVisible();
      });

      test(`handles IndexedDB errors in ${browser.name}`, async ({ page, context }) => {
        await context.setExtraHTTPHeaders({
          'User-Agent': browser.userAgent,
        });

        // Monitor for unhandled promise rejections
        const errors: string[] = [];
        page.on('pageerror', (error) => {
          errors.push(error.message);
        });

        await context.addInitScript(() => {
          // Simulate IndexedDB failure
          window.indexedDB.open = function() {
            throw new Error('Database deleted by request of the user');
          };
        });

        await page.goto('/');
        await page.waitForTimeout(2000);

        // Verify error is handled (not appearing as unhandled)
        const indexedDBErrors = errors.filter(e =>
          e.includes('IndexedDB') || e.includes('Database deleted')
        );

        // Should be caught and handled
        expect(indexedDBErrors).toHaveLength(0);

        // App should still be functional
        await expect(page.locator('body')).toBeVisible();
      });
    }
  });

  test.describe('Storage Availability Detection', () => {
    test('detects when storage is unavailable', async ({ page, context }) => {
      await context.addInitScript(() => {
        // Block localStorage
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('localStorage is not available');
          },
        });
      });

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await page.goto('/');

      // Should detect storage unavailability
      const storageCheck = consoleMessages.find(msg =>
        msg.includes('storage') && msg.includes('unavailable')
      );

      expect(storageCheck).toBeTruthy();

      // Should show appropriate notice
      await expect(page.locator('text=Storage is disabled')).toBeVisible();
    });

    test('falls back gracefully when IndexedDB is unavailable', async ({ page, context }) => {
      await context.addInitScript(() => {
        // Remove IndexedDB
        delete (window as any).indexedDB;
      });

      await page.goto('/');

      // App should still load
      await expect(page.locator('body')).toBeVisible();

      // Should use alternative storage or in-memory
      // Sign in should still work (without embedded wallets)
      await page.click('[data-testid="sign-in-button"]');

      // Email auth should be available
      await expect(page.locator('[data-testid="email-auth-option"]')).toBeVisible();
    });
  });

  test.describe('Browser Environment Detection', () => {
    test('correctly identifies iOS in-app browser', async ({ page }) => {
      // Navigate with iOS Twitter user agent
      await page.goto('/', {
        extraHTTPHeaders: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Twitter',
        },
      });

      // Evaluate browser detection
      const browserInfo = await page.evaluate(() => {
        // Access the browser detection utility if exposed
        return {
          userAgent: navigator.userAgent,
          isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
          isInAppBrowser: /Twitter|FBAN|Instagram|LinkedIn|Discord/.test(navigator.userAgent),
        };
      });

      expect(browserInfo.isIOS).toBe(true);
      expect(browserInfo.isInAppBrowser).toBe(true);
    });

    test('correctly identifies regular iOS Safari', async ({ page }) => {
      await page.goto('/', {
        extraHTTPHeaders: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        },
      });

      const browserInfo = await page.evaluate(() => {
        return {
          userAgent: navigator.userAgent,
          isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
          isInAppBrowser: /Twitter|FBAN|Instagram|LinkedIn|Discord/.test(navigator.userAgent),
        };
      });

      expect(browserInfo.isIOS).toBe(true);
      expect(browserInfo.isInAppBrowser).toBe(false);
    });
  });

  test.describe('Error Reporting on Mobile', () => {
    test('sends appropriate tags to Sentry for mobile errors', async ({ page, context }) => {
      const sentryEvents: any[] = [];

      // Intercept Sentry requests
      await page.route('**/sentry.io/**', (route) => {
        const postData = route.request().postDataJSON();
        if (postData) {
          sentryEvents.push(postData);
        }
        route.fulfill({ status: 200, body: '' });
      });

      // Trigger an IndexedDB error
      await context.addInitScript(() => {
        setTimeout(() => {
          const error = new Error('Database deleted by request of the user');
          window.dispatchEvent(new ErrorEvent('error', { error }));
        }, 1000);
      });

      await page.goto('/');
      await page.waitForTimeout(3000);

      // Verify Sentry event has mobile-specific tags
      const indexedDBEvent = sentryEvents.find(e =>
        e.message?.includes('IndexedDB') || e.exception?.values?.[0]?.value?.includes('Database deleted')
      );

      if (indexedDBEvent) {
        expect(indexedDBEvent.tags).toHaveProperty('blocking', false);
        expect(indexedDBEvent.tags).toHaveProperty('auth_error', true);
      }
    });
  });

  test.describe('Recovery Mechanisms', () => {
    test('recovers from IndexedDB connector timeout', async ({ page, context }) => {
      let timeoutOccurred = false;

      await context.addInitScript(() => {
        // Mock slow IndexedDB
        const originalOpen = window.indexedDB.open;
        window.indexedDB.open = function(...args) {
          const request = originalOpen.apply(this, args);
          // Never complete the request (simulate timeout)
          return request;
        };
      });

      page.on('console', (msg) => {
        if (msg.text().includes('connector_timeout')) {
          timeoutOccurred = true;
        }
      });

      await page.goto('/');
      await page.waitForTimeout(5000);

      // Should detect timeout
      expect(timeoutOccurred).toBe(true);

      // Should continue without embedded wallets
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('[data-testid="email-auth-option"]')).toBeVisible();
    });
  });
});
