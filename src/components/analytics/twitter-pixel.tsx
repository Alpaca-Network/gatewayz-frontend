"use client";

import Script from 'next/script';
import { isTauriDesktop } from '@/lib/browser-detection';

// Twitter Pixel ID
const TWITTER_PIXEL_ID = 'pwpwh';

// Twitter Conversion Event ID for signup/CTA clicks
export const TWITTER_CONVERSION_EVENT_ID = 'tw-pwpwh-qxzjl';

export function TwitterPixel() {
  // Skip Twitter pixel on desktop app to avoid CSP violations
  if (typeof window !== 'undefined' && isTauriDesktop()) {
    return null;
  }

  return (
    <>
      {/* Twitter universal website tag code */}
      <Script
        id="twitter-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
            },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
            a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
            twq('config','${TWITTER_PIXEL_ID}');
          `,
        }}
      />
    </>
  );
}

// Helper function to track Twitter conversion events
// Note: The Twitter pixel inline script creates the twq function immediately with a
// built-in queue, so events called before the full script loads are automatically queued.
// We only check for window (SSR safety) and use optional chaining as a safeguard.
export const trackTwitterConversion = (eventId?: string) => {
  if (typeof window === 'undefined') return;

  const conversionEventId = eventId || TWITTER_CONVERSION_EVENT_ID;
  const twq = (window as any).twq;

  if (typeof twq === 'function') {
    twq('event', conversionEventId, {});
  }
};

// Helper function to track signup/CTA button clicks
export const trackTwitterSignupClick = () => {
  trackTwitterConversion(TWITTER_CONVERSION_EVENT_ID);
};
