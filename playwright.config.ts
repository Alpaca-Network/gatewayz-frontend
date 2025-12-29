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

  // Retry on CI and local failures - reduced from 3 to 1 for speed
  retries: process.env.CI ? 1 : 0,

  // Parallel workers for faster test execution
  // Increased from 1 to 3 in CI for significant speedup (50-66% faster)
  workers: process.env.CI ? 3 : 4,

  // Global timeout for each test
  // Set to 60s for /models page which loads 300+ models and waits for networkidle
  timeout: process.env.CI ? 60 * 1000 : 60 * 1000,

  // Expect timeout
  expect: {
    timeout: process.env.CI ? 10 * 1000 : 15 * 1000,
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

    // Navigation timeout - for complex pages like /models
    // Override with --timeout flag or set PLAYWRIGHT_NAVIGATION_TIMEOUT env var
    navigationTimeout: process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT
      ? parseInt(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT)
      : process.env.CI
      ? 60 * 1000 // 60 seconds for /models page with networkidle wait
      : 120 * 1000, // 2 minutes for cold Next.js dev server compiles locally

    // Action timeout (clicks, fills, etc.)
    actionTimeout: process.env.CI ? 10 * 1000 : 15 * 1000,

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
  // NOTE: For faster, more reliable tests, use production mode:
  //   1. Run: pnpm build && pnpm start (in separate terminal)
  //   2. Set: PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e
  // Or use the helper script: ./scripts/start-production-server.sh
  webServer: process.env.CI || process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000, // 3 minutes to allow for initial compilation
        // Note: Even with timeout, tests may fail on first navigation to /chat
        // due to Next.js cold compilation. See scripts/warmup-dev-server.ts
      },

  // Global configuration
  globalTimeout: 30 * 60 * 1000, // 30 minutes total for all tests
});
