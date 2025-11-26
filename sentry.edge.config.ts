import * as Sentry from "@sentry/nextjs";
import { shouldFilterWalletExtensionError } from "./sentry-wallet-filter";

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
    if (shouldFilterWalletExtensionError(event, hint)) {
      const error = hint?.originalException;
      const errorMessage =
        (typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : undefined) ||
        event.message ||
        "Wallet extension error";

      console.warn("[Sentry] Filtered out non-blocking Privy wallet extension error:", errorMessage);
      return null;
    }

    return event;
  },
});
