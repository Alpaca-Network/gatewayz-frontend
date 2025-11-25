import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

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
