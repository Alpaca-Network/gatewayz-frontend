'use client';

import dynamic from 'next/dynamic';

// Load GTM dynamically with no SSR to prevent layout router mounting issues
const GTM = dynamic(() => import('./gtm').then(mod => ({ default: mod.GTM })), {
  ssr: false
});

export function GTMLoader() {
  return <GTM />;
}
