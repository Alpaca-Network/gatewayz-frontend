import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helper Functions
 *
 * Provides utilities for common test operations
 */

/**
 * Wait for a specific API endpoint to be called
 */
export async function waitForApiCall(page: Page, urlPattern: string | RegExp, timeout = 5000) {
  let apiCalled = false;

  page.on('request', (request) => {
    if (typeof urlPattern === 'string' ? request.url().includes(urlPattern) : urlPattern.test(request.url())) {
      apiCalled = true;
    }
  });

  const startTime = Date.now();
  while (!apiCalled && Date.now() - startTime < timeout) {
    await page.waitForTimeout(100);
  }

  return apiCalled;
}

/**
 * Get all API requests made by the page
 */
export function getApiRequests(page: Page) {
  const requests: { url: string; method: string; status?: number }[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/') || request.url().includes('/v1/')) {
      requests.push({
        url: request.url(),
        method: request.method(),
      });
    }
  });

  page.on('response', (response) => {
    const request = requests.find(r => r.url === response.url());
    if (request) {
      request.status = response.status();
    }
  });

  return requests;
}

/**
 * Check if page has any JavaScript errors
 */
export async function checkForErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.toString());
  });

  return errors;
}

/**
 * Wait for element to be in viewport and visible
 */
export async function waitForElementInViewport(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector).first();

  if (await element.count() === 0) {
    throw new Error(`Element not found: ${selector}`);
  }

  await element.waitFor({ state: 'visible', timeout });

  // Scroll into view
  await element.scrollIntoViewIfNeeded();

  return element;
}

/**
 * Fill and submit a form
 */
export async function fillAndSubmitForm(
  page: Page,
  fields: Record<string, string>,
  submitButtonSelector = 'button[type="submit"]'
) {
  for (const [selector, value] of Object.entries(fields)) {
    const field = page.locator(selector).first();
    if (await field.count() > 0) {
      await field.fill(value);
    }
  }

  const submitButton = page.locator(submitButtonSelector).first();
  if (await submitButton.count() > 0) {
    await submitButton.click();
  }
}

/**
 * Get all visible text on the page
 */
export async function getVisibleText(page: Page) {
  const text = await page.evaluate(() => {
    return document.body.innerText;
  });
  return text;
}

/**
 * Check if element contains text (case insensitive)
 */
export async function elementContainsText(page: Page, selector: string, text: string) {
  const element = page.locator(selector).first();
  if (await element.count() === 0) {
    return false;
  }

  const content = await element.innerText();
  return content.toLowerCase().includes(text.toLowerCase());
}

/**
 * Mock localStorage with specific data
 */
export async function mockLocalStorage(page: Page, data: Record<string, any>) {
  await page.evaluate((storageData) => {
    for (const [key, value] of Object.entries(storageData)) {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    }
  }, data);
}

/**
 * Get all localStorage data
 */
export async function getLocalStorageData(page: Page) {
  return page.evaluate(() => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        data[key] = value;

        // Try to parse JSON
        try {
          data[key] = JSON.parse(value || '');
        } catch (e) {
          // Keep as string
        }
      }
    }
    return data;
  });
}

/**
 * Clear all localStorage data
 */
export async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Wait for page to be fully loaded and interactive
 */
export async function waitForPageReady(page: Page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });

  // Additional check for page interactivity
  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve(true);
      } else {
        window.addEventListener('load', () => resolve(true));
      }
    });
  });
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(page: Page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
      loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
      firstPaint: (performance.getEntriesByName('first-paint')[0] as PerformanceEntry)?.startTime,
      firstContentfulPaint: (performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry)?.startTime,
      largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint').pop()?.startTime,
    };
  }).catch(() => null);
}

/**
 * Simulate network conditions
 */
export async function simulateNetworkConditions(
  page: Page,
  type: 'slow-4g' | 'fast-3g' | 'offline'
) {
  const client = await page.context().newCDPSession(page);

  const speeds: Record<string, { downloadThroughput?: number; uploadThroughput?: number; latency?: number; offline?: boolean }> = {
    'slow-4g': { downloadThroughput: 50000 / 8, uploadThroughput: 50000 / 8, latency: 2000 },
    'fast-3g': { downloadThroughput: 1.6 * 1000 * 1000 / 8, uploadThroughput: 750000 / 8, latency: 100 },
    'offline': { offline: true },
  };

  const speedConfig = speeds[type];

  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: type === 'offline',
    downloadThroughput: speedConfig?.downloadThroughput ?? -1,
    uploadThroughput: speedConfig?.uploadThroughput ?? -1,
    latency: speedConfig?.latency ?? 0,
  });
}

/**
 * Mock API endpoint with custom response
 */
export async function mockApiEndpoint(
  page: Page,
  urlPattern: string | RegExp,
  response: {
    status?: number;
    contentType?: string;
    body: string | Record<string, any>;
  }
) {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: response.status || 200,
      contentType: response.contentType || 'application/json',
      body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
    });
  });
}

/**
 * Wait for element to have specific text
 */
export async function waitForElementWithText(
  page: Page,
  text: string,
  selector = 'body',
  timeout = 5000
) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const content = await element.innerText();
    if (content.includes(text)) {
      return element;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Text "${text}" not found in ${selector}`);
}

/**
 * Screenshot helper with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${name}-${timestamp}.png`;
  await page.screenshot({ path: filename });
  return filename;
}

/**
 * Assert element is clickable
 */
export async function assertClickable(page: Page, selector: string) {
  const element = page.locator(selector).first();

  if (await element.count() === 0) {
    throw new Error(`Element not found: ${selector}`);
  }

  await element.hover();
  await expect(element).toBeEnabled();
}

/**
 * Get computed style of element
 */
export async function getElementStyle(page: Page, selector: string, property: string) {
  return page.evaluate(
    ({ sel, prop }) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      return window.getComputedStyle(element).getPropertyValue(prop);
    },
    { sel: selector, prop: property }
  );
}
