'use client';

export function GTM() {
  // GTM is now loaded by GoogleAnalytics component via Script tags
  // Removed duplicate GTM initialization - GoogleAnalytics handles gtag.js + GTM container
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
