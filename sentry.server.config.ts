import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Enable logs
  enableLogs: true,

  // Filter out non-blocking wallet extension errors from Privy
  beforeSend(event, hint) {
    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
    
    // Filter out chrome.runtime.sendMessage errors from Privy wallet provider
    // These are non-blocking and occur when Privy tries to detect wallet extensions
    if (
      errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('runtime.sendMessage') ||
      (errorMessage.includes('Extension ID') && errorMessage.includes('from a webpage'))
    ) {
      console.warn('[Sentry] Filtered out non-blocking Privy wallet extension error:', errorMessage);
      return null; // Don't send this error to Sentry
    }

    return event;
  },
});
