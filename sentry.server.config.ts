import * as Sentry from "@sentry/nextjs";

// Get release information
const getRelease = () => {
  if (process.env.SENTRY_RELEASE) {
    return process.env.SENTRY_RELEASE;
  }

  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }

  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA;
  }

  try {
    const packageJson = require('./package.json');
    return `${packageJson.name}@${packageJson.version}`;
  } catch (e) {
    return undefined;
  }
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

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
    const normalizedMessage = (errorMessage || '').toLowerCase();

    const isWalletExtensionError =
      normalizedMessage.includes('chrome.runtime.sendmessage') ||
      normalizedMessage.includes('runtime.sendmessage') ||
      (normalizedMessage.includes('extension id') && normalizedMessage.includes('from a webpage'));

    const isWalletConnectRelayError =
      normalizedMessage.includes('walletconnect') ||
      normalizedMessage.includes('requestrelay') ||
      normalizedMessage.includes('websocket error 1006') ||
      normalizedMessage.includes('explorer-api.walletconnect.com') ||
      normalizedMessage.includes('relay.walletconnect.com');

    if (isWalletExtensionError || isWalletConnectRelayError) {
      const label = isWalletConnectRelayError ? 'WalletConnect relay error' : 'Privy wallet extension error';
      console.warn(`[Sentry] Filtered out non-blocking ${label}:`, errorMessage);
      return null; // Don't send this error to Sentry
    }

    return event;
  },
});
