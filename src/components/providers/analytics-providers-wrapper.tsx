'use client';

import dynamic from 'next/dynamic';
import { ReactNode, Suspense } from 'react';

// Defer heavy analytics providers to after initial render
const StatsigProviderWrapper = dynamic(() => import('./statsig-provider').then(mod => ({ default: mod.StatsigProviderWrapper })), { ssr: false });
const ReactScanProvider = dynamic(() => import('./react-scan-provider').then(mod => ({ default: mod.ReactScanProvider })), { ssr: false });
const ModelSyncInitializer = dynamic(() => import('../model-sync-initializer').then(mod => ({ default: mod.ModelSyncInitializer })), { ssr: false });
const PostHogProviderComponent = dynamic(() => import('./posthog-provider').then(mod => ({ default: mod.PostHogProvider })), { ssr: false });
const PostHogPageViewComponent = dynamic(() => import('./posthog-provider').then(mod => ({ default: mod.PostHogPageView })), { ssr: false });

export function AnalyticsProvidersWrapper({ children }: { children: ReactNode }) {
  return (
    <StatsigProviderWrapper>
      <PostHogProviderComponent>
        <Suspense fallback={null}>
          <PostHogPageViewComponent />
        </Suspense>
        <ReactScanProvider />
        <ModelSyncInitializer />
        {children}
      </PostHogProviderComponent>
    </StatsigProviderWrapper>
  );
}
