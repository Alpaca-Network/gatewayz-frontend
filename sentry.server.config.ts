import * as Sentry from "@sentry/nextjs";
import { shouldFilterWalletExtensionError } from "./sentry-wallet-filter";

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
