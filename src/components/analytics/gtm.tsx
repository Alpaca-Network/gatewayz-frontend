'use client';

import { useEffect } from 'react';

export function GTM() {
  useEffect(() => {
    // Google Tag Manager - handles GA4 (G-NCWGNQ7981) and Ads ID initialization via GTM rules
    // Primary GA4 initialization is in google-analytics.tsx with lazyOnload strategy
    // GTM ensures both configurations are sent via dataLayer
    (function(w: any, d: Document, s: string, l: string, i: string) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      const f = d.getElementsByTagName(s)[0];
      const j = d.createElement(s) as HTMLScriptElement;
      const dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode?.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', 'GTM-5VPXMFRW');

    // No need to load separate GA4 script here - it's already loaded in GoogleAnalytics component
    // GTM will handle configuration and transmission via dataLayer
  }, []);

  return (
    <noscript>
      <iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-5VPXMFRW"
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
