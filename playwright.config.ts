import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * See https://playwright.dev/docs/test-configuration
 *
 * Critical Tests:
 * - Authentication (login, session, context)
 * - Models loading and discovery
 * - Chat functionality (messages, model selection)
 *
 * These tests ensure that core platform functionality never breaks
 * Run locally: pnpm test:e2e
 * Run with UI: pnpm test:e2e:ui
 * Debug: pnpm test:e2e:debug
 */
export default defineConfig({
  testDir: './e2e',

  // Test patterns to run
  testMatch: [
    '**/*auth*.spec.ts',
    '**/*models*.spec.ts',
    '**/*chat*.spec.ts',
  ],

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI and local failures
  retries: process.env.CI ? 3 : 1,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : 4,

  // Global timeout for each test (increased for model loading)
  timeout: 45 * 1000,

  // Expect timeout
  expect: {
    timeout: 10 * 1000,
  },

  // Reporter configuration
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['json', { outputFile: 'test-results.json' }],
        ['list'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
      ],

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure (useful for debugging)
    video: 'retain-on-failure',

    // Network conditions simulation
    offline: false,

    // Use persistent browser context for better performance
    // Disabled by default, enable if needed for state persistence
    // persistentContext: true,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Reduce flakiness with more lenient scroll timeout
        viewport: { width: 1280, height: 720 },
      },
    },

    // Optional: Add Firefox for broader browser coverage (slower in CI)
    // Uncomment to enable cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Optional: Add WebKit for Safari compatibility testing
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Optional: Add mobile testing
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },

  // Global configuration
  globalTimeout: 30 * 60 * 1000, // 30 minutes total for all tests
});
