'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Defer heavy analytics providers to after initial render
const StatsigProviderWrapper = dynamic(() => import('./statsig-provider').then(mod => ({ default: mod.StatsigProviderWrapper })), { ssr: false });
const ReactScanProvider = dynamic(() => import('./react-scan-provider').then(mod => ({ default: mod.ReactScanProvider })), { ssr: false });
const ModelSyncInitializer = dynamic(() => import('../model-sync-initializer').then(mod => ({ default: mod.ModelSyncInitializer })), { ssr: false });

export function AnalyticsProvidersWrapper({ children }: { children: ReactNode }) {
  return (
    <StatsigProviderWrapper>
      <ReactScanProvider />
      <ModelSyncInitializer />
      {children}
    </StatsigProviderWrapper>
  );
}
