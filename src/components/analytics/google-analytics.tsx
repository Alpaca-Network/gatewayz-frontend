"use client";

import Script from 'next/script';

// Primary GA4 ID (managed by GTM, but keep for direct initialization if GTM fails)
const GA_MEASUREMENT_ID = 'G-NCWGNQ7981';
const GOOGLE_ADS_ID = 'AW-17515449277';
const GTM_ID = 'GTM-5VPXMFRW';

export function GoogleAnalytics() {
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
            gtag('config', '${GA_MEASUREMENT_ID}', {
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
    (window as any).gtag('config', GA_MEASUREMENT_ID, {
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
