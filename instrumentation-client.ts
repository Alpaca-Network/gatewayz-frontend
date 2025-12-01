import * as Sentry from "@sentry/nextjs";

// Get release information
const getRelease = () => {
  if (process.env.NEXT_PUBLIC_SENTRY_RELEASE) {
    return process.env.NEXT_PUBLIC_SENTRY_RELEASE;
  }

  if (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA) {
    return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  }

  if (typeof window !== 'undefined') {
    const metaTag = document.querySelector('meta[property="sentry:release"]');
    if (metaTag) {
      return metaTag.getAttribute('content') || undefined;
    }
  }

  return undefined;
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Release tracking for associating errors with specific versions
  release: getRelease(),

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Enable logs
  enableLogs: true,

  // Filter out non-blocking wallet extension errors from Privy
  beforeSend(event, hint) {
    const error = hint.originalException;
    const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
    const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;

    // Filter out chrome.runtime.sendMessage errors from Privy wallet provider (inpage.js)
    // These are non-blocking and occur when Privy tries to detect wallet extensions
    if (
      errorMessage.includes('chrome.runtime.sendMessage') ||
      errorMessage.includes('runtime.sendMessage') ||
      (errorMessage.includes('Extension ID') && errorMessage.includes('from a webpage'))
    ) {
      // Check if error originates from Privy's inpage.js or wallet provider code
      if (stackFrames?.some(frame =>
        frame.filename?.includes('inpage.js') ||
        frame.filename?.includes('privy') ||
        frame.function?.includes('Zt') // Minified function name from inpage.js
      )) {
        console.warn('[Sentry] Filtered out non-blocking Privy wallet extension error:', errorMessage);
        return null; // Don't send this error to Sentry
      }
    }

    // Filter out wallet extension removeListener errors (JAVASCRIPT-NEXTJS-2)
    // These occur when wallet extensions (MetaMask, Phantom, etc.) clean up listeners
    if (errorMessage.includes('removeListener') || errorMessage.includes('stopListeners')) {
      if (stackFrames?.some(frame =>
        frame.filename?.includes('inpage.js') ||
        frame.filename?.includes('app:///') ||
        frame.function?.includes('stopListeners')
      )) {
        console.warn('[Sentry] Filtered out wallet extension removeListener error');
        return null;
      }
    }

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
