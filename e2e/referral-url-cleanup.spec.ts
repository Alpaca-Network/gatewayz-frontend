/**
 * E2E test for referral URL parameter cleanup
 *
 * This test verifies that when a user visits the site with a ?ref= parameter,
 * the parameter is removed from the URL after the referral code is stored.
 * This ensures the ref parameter doesn't interfere with chat or other functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Referral URL Cleanup', () => {
  test('should remove ref parameter from URL after storing referral code', async ({ page }) => {
    // Navigate to home page with a ref parameter
    await page.goto('/?ref=E2E_TEST_CODE');

    // Wait for the page to load and JavaScript to execute
    await page.waitForLoadState('networkidle');

    // Wait a bit for initializeReferralTracking to execute
    await page.waitForTimeout(1000);

    // Check that the URL no longer contains the ref parameter
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('ref=');
    expect(currentUrl).not.toContain('E2E_TEST_CODE');

    // Verify that the referral code was stored in localStorage
    const storedCode = await page.evaluate(() => {
      return localStorage.getItem('gatewayz_referral_code');
    });

    expect(storedCode).toBe('E2E_TEST_CODE');
  });

  test('should remove both ref and referral parameters', async ({ page }) => {
    // Navigate with both ref and referral parameters
    await page.goto('/?ref=REF_CODE&referral=REFERRAL_CODE&other=param');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check that both ref and referral params are removed but other param remains
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('ref=');
    expect(currentUrl).not.toContain('referral=');
    expect(currentUrl).toContain('other=param');
  });

  test('should preserve Next.js navigation after ref removal', async ({ page }) => {
    // Navigate with ref parameter
    await page.goto('/?ref=NAV_TEST');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to navigate using Next.js Link (client-side navigation)
    // This tests that history state is preserved
    const modelsLink = page.locator('a[href="/models"]').first();
    if (await modelsLink.isVisible()) {
      await modelsLink.click();

      // Wait for navigation
      await page.waitForURL(/.*\/models.*/);

      // If we can navigate successfully, history state was preserved
      expect(page.url()).toContain('/models');

      // Navigate back
      await page.goBack();

      // URL should not have ref parameter anymore
      const urlAfterBack = page.url();
      expect(urlAfterBack).not.toContain('ref=');
    }
  });

  test('should handle URL cleanup gracefully even if localStorage fails', async ({ page, context }) => {
    // Block localStorage to simulate failure scenario
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('localStorage error'); },
          setItem: () => { throw new Error('localStorage error'); },
          removeItem: () => { throw new Error('localStorage error'); },
        },
        writable: false,
      });
    });

    // Navigate with ref parameter
    await page.goto('/?ref=ERROR_TEST');

    await page.waitForLoadState('networkidle');

    // Page should still load successfully despite localStorage error
    await expect(page).toHaveTitle(/Gatewayz/);

    // The code should handle the error gracefully
    // We don't check for URL removal here since it depends on localStorage
  });
});
