'use client';

import { isTauriDesktop } from '@/lib/browser-detection';

export function GTM() {
  // Skip GTM iframe on desktop app to avoid CSP violations
  if (typeof window !== 'undefined' && isTauriDesktop()) {
    return null;
  }

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
