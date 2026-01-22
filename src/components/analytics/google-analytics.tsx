"use client";

import Script from 'next/script';
import { isTauriDesktop } from '@/lib/browser-detection';

// Primary GA4 ID (managed by GTM, but keep for direct initialization if GTM fails)
const GA_MEASUREMENT_ID = 'G-NCWGNQ7981';
// Beta-specific GA4 measurement ID for beta.gatewayz.ai
const GA_BETA_MEASUREMENT_ID = 'G-TE0EZ0C0SX';
const GOOGLE_ADS_ID = 'AW-17515449277';
const GTM_ID = 'GTM-5VPXMFRW';

export function GoogleAnalytics() {
  // Skip analytics on desktop app to avoid CSP violations
  // Google Tag Manager and Google Analytics scripts are blocked by Tauri's CSP
  if (typeof window !== 'undefined' && isTauriDesktop()) {
    return null;
  }

  return (
    <>
      {/* Google Tag Manager Container - loads GTM, which manages GA via tags */}
      <Script
        id="gtm-container"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
        }}
      />
      {/* Google tag (gtag.js) - for direct GA measurements and cross-domain linking */}
      <Script
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Cross-domain linker - MUST run before config
            gtag('set', 'linker', {
              'domains': ['gatewayz.ai', 'beta.gatewayz.ai']
            });

            gtag('js', new Date());

            // Configure primary GA4 property
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });

            // Configure beta GA4 property
            gtag('config', '${GA_BETA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });

            gtag('config', '${GOOGLE_ADS_ID}');
          `,
        }}
      />
    </>
  );
}

// Helper function to track custom events
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventParams);
  }
};

// Helper function to track page views
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    // Send to both GA4 properties
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
    (window as any).gtag('config', GA_BETA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Helper function to track conversions
export const trackConversion = (
  conversionId: string,
  conversionValue?: number,
  conversionCurrency?: string
) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'conversion', {
      send_to: conversionId,
      value: conversionValue,
      currency: conversionCurrency || 'USD',
    });
  }
};

// Google Ads Sign-up Conversion ID
const GOOGLE_ADS_SIGNUP_CONVERSION_ID = 'AW-17515449277/2RATCOzWnZAbEL2XgqBB';

// Timeout for conversion tracking callback (in ms)
// If the callback isn't called within this time (e.g., due to adblocker),
// we execute it anyway to ensure the user flow isn't blocked
const CONVERSION_CALLBACK_TIMEOUT = 1000;

// Track sign-up conversion for Google Ads
// Uses a timeout fallback to ensure the callback is always executed,
// even if gtag is blocked by an adblocker or fails silently
export const trackSignupConversion = (callback?: () => void) => {
  if (!callback) {
    // No callback, just fire and forget
    if (typeof window !== 'undefined' && (window as any).gtag) {
      try {
        (window as any).gtag('event', 'conversion', {
          'send_to': GOOGLE_ADS_SIGNUP_CONVERSION_ID,
        });
      } catch {
        // Silently ignore errors (e.g., from adblockers)
      }
    }
    return;
  }

  // Track whether callback has been called to prevent double execution
  let callbackExecuted = false;
  const executeCallback = () => {
    if (!callbackExecuted) {
      callbackExecuted = true;
      callback();
    }
  };

  // Set up timeout fallback - ensures callback runs even if gtag is blocked
  const timeoutId = setTimeout(() => {
    if (!callbackExecuted) {
      console.log('[Analytics] Conversion callback timeout - executing fallback');
      executeCallback();
    }
  }, CONVERSION_CALLBACK_TIMEOUT);

  if (typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', 'conversion', {
        'send_to': GOOGLE_ADS_SIGNUP_CONVERSION_ID,
        'event_callback': () => {
          clearTimeout(timeoutId);
          executeCallback();
        },
      });
    } catch {
      // If gtag throws (e.g., adblocker modified it), clear timeout and execute immediately
      clearTimeout(timeoutId);
      executeCallback();
    }
  } else {
    // If gtag is not available, clear timeout and execute immediately
    clearTimeout(timeoutId);
    executeCallback();
  }
};
