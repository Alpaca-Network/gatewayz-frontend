"use client";

import Script from 'next/script';

// Twitter Pixel ID
const TWITTER_PIXEL_ID = 'pwpwh';

// Twitter Conversion Event ID for signup/CTA clicks
export const TWITTER_CONVERSION_EVENT_ID = 'tw-pwpwh-qxzjl';

export function TwitterPixel() {
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
export const trackTwitterConversion = (eventId?: string) => {
  if (typeof window !== 'undefined' && (window as any).twq) {
    const conversionEventId = eventId || TWITTER_CONVERSION_EVENT_ID;
    (window as any).twq('event', conversionEventId, {});
  }
};

// Helper function to track signup/CTA button clicks
export const trackTwitterSignupClick = () => {
  trackTwitterConversion(TWITTER_CONVERSION_EVENT_ID);
};
