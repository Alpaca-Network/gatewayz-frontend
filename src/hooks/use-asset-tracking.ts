"use client";

import { useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import {
  RawAssetEntry,
  AssetData,
  getAssetType,
  parameterizeAssetUrl,
} from '@/lib/sentry-assets-types';

// Storage key for persisting asset data
const ASSET_STORAGE_KEY = 'gatewayz_asset_metrics';
const MAX_STORED_ASSETS = 500;

interface StoredAssetData {
  assets: Map<string, AssetData>;
  lastUpdated: string;
}

/**
 * Hook for tracking browser asset performance using the Resource Timing API.
 * Automatically instruments pageloads and navigation to capture asset metrics.
 *
 * Based on Sentry's asset monitoring approach:
 * @see https://docs.sentry.io/product/insights/frontend/assets/
 */
export function useAssetTracking(options?: {
  enabled?: boolean;
  sampleRate?: number;
  excludePatterns?: RegExp[];
}) {
  const {
    enabled = true,
    sampleRate = 1.0,
    excludePatterns = [
      /^chrome-extension:/,
      /^moz-extension:/,
      /^safari-extension:/,
      /\/hot-update\./,
      /\/__webpack_hmr/,
      /\/_next\/webpack-hmr/,
    ],
  } = options || {};

  const observerRef = useRef<PerformanceObserver | null>(null);
  const assetsRef = useRef<Map<string, AssetData>>(new Map());
  const pageContextRef = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : '/');

  // Load stored assets on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    try {
      const stored = localStorage.getItem(ASSET_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        assetsRef.current = new Map(Object.entries(parsed.assets || {}));
      }
    } catch (error) {
      console.debug('Failed to load stored asset data:', error);
    }
  }, [enabled]);

  // Save assets to storage
  const persistAssets = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      // Limit stored assets to prevent storage bloat
      const assetsArray = Array.from(assetsRef.current.entries());
      const limitedAssets = assetsArray
        .sort((a, b) => new Date(b[1].lastSeen).getTime() - new Date(a[1].lastSeen).getTime())
        .slice(0, MAX_STORED_ASSETS);

      const data: StoredAssetData = {
        assets: new Map(limitedAssets) as any,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify({
        assets: Object.fromEntries(limitedAssets),
        lastUpdated: data.lastUpdated,
      }));
    } catch (error) {
      console.debug('Failed to persist asset data:', error);
    }
  }, []);

  // Process a resource timing entry
  const processEntry = useCallback((entry: PerformanceResourceTiming) => {
    // Apply sampling
    if (Math.random() > sampleRate) return;

    // Check exclusion patterns
    if (excludePatterns.some(pattern => pattern.test(entry.name))) return;

    // Skip if transfer size is 0 (cached or blocked)
    if (entry.transferSize === 0 && entry.decodedBodySize === 0) return;

    const rawEntry: RawAssetEntry = {
      name: entry.name,
      entryType: 'resource',
      startTime: entry.startTime,
      duration: entry.duration,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      renderBlockingStatus: (entry as any).renderBlockingStatus || '',
      nextHopProtocol: entry.nextHopProtocol,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      fetchStart: entry.fetchStart,
      domainLookupStart: entry.domainLookupStart,
      domainLookupEnd: entry.domainLookupEnd,
      connectStart: entry.connectStart,
      connectEnd: entry.connectEnd,
      secureConnectionStart: entry.secureConnectionStart,
      requestStart: entry.requestStart,
    };

    const assetType = getAssetType(rawEntry);
    const resourceName = parameterizeAssetUrl(entry.name);
    const assetId = `${assetType}:${resourceName}`;

    const existing = assetsRef.current.get(assetId);
    const now = new Date().toISOString();
    const currentPage = pageContextRef.current;

    if (existing) {
      // Update existing asset with new sample
      const newCount = existing.requestCount + 1;
      const newAvgDuration = ((existing.duration * existing.requestCount) + entry.duration) / newCount;
      const newAvgTransfer = ((existing.transferSize * existing.requestCount) + entry.transferSize) / newCount;
      const newAvgEncoded = ((existing.encodedSize * existing.requestCount) + entry.encodedBodySize) / newCount;
      const newAvgDecoded = ((existing.decodedSize * existing.requestCount) + entry.decodedBodySize) / newCount;

      // Update percentiles (simplified - would need full histogram for accurate percentiles)
      const durations = [existing.p50Duration, existing.p75Duration, existing.p95Duration, entry.duration].sort((a, b) => a - b);

      const updatedAsset: AssetData = {
        ...existing,
        duration: newAvgDuration,
        transferSize: newAvgTransfer,
        encodedSize: newAvgEncoded,
        decodedSize: newAvgDecoded,
        requestCount: newCount,
        timeSpent: newAvgDuration * newCount,
        lastSeen: now,
        p50Duration: durations[Math.floor(durations.length * 0.5)],
        p75Duration: durations[Math.floor(durations.length * 0.75)],
        p95Duration: durations[Math.floor(durations.length * 0.95)],
        pageContexts: [...new Set([...existing.pageContexts, currentPage])],
        renderBlocking: existing.renderBlocking || rawEntry.renderBlockingStatus === 'blocking',
      };

      assetsRef.current.set(assetId, updatedAsset);
    } else {
      // Create new asset entry
      const newAsset: AssetData = {
        id: assetId,
        url: entry.name,
        resourceName,
        assetType,
        initiatorType: rawEntry.initiatorType as any || 'other',
        duration: entry.duration,
        transferSize: entry.transferSize,
        encodedSize: entry.encodedBodySize,
        decodedSize: entry.decodedBodySize,
        requestCount: 1,
        renderBlocking: rawEntry.renderBlockingStatus === 'blocking',
        p50Duration: entry.duration,
        p75Duration: entry.duration,
        p95Duration: entry.duration,
        timeSpent: entry.duration,
        lastSeen: now,
        firstSeen: now,
        pageContexts: [currentPage],
      };

      assetsRef.current.set(assetId, newAsset);
    }

    // Create Sentry span for this asset (for Sentry's native asset tracking)
    if (Sentry.getClient()) {
      Sentry.startSpan(
        {
          op: `resource.${assetType}`,
          name: resourceName,
          attributes: {
            'http.url': entry.name,
            'http.response_transfer_size': entry.transferSize,
            'http.response_content_length': entry.decodedBodySize,
            'http.decoded_response_content_length': entry.decodedBodySize,
            'resource.render_blocking_status': rawEntry.renderBlockingStatus || 'unknown',
          },
        },
        () => {
          // Span completes immediately since we're recording after-the-fact
        }
      );
    }
  }, [sampleRate, excludePatterns]);

  // Set up PerformanceObserver
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    // Check for Performance Observer support
    if (!('PerformanceObserver' in window)) {
      console.debug('PerformanceObserver not supported');
      return;
    }

    try {
      // Process existing entries from the page load
      const existingEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      existingEntries.forEach(processEntry);

      // Set up observer for new entries
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        entries.forEach(processEntry);
        persistAssets();
      });

      observerRef.current.observe({
        type: 'resource',
        buffered: true,
      });

      // Persist initial assets
      persistAssets();

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
        persistAssets();
      };
    } catch (error) {
      console.debug('Failed to set up asset tracking:', error);
    }
  }, [enabled, processEntry, persistAssets]);

  // Update page context on navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNavigation = () => {
      pageContextRef.current = window.location.pathname;
    };

    window.addEventListener('popstate', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  // Get current asset data
  const getAssets = useCallback((): AssetData[] => {
    return Array.from(assetsRef.current.values());
  }, []);

  // Clear stored asset data
  const clearAssets = useCallback(() => {
    assetsRef.current.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ASSET_STORAGE_KEY);
    }
  }, []);

  // Get asset by ID
  const getAssetById = useCallback((id: string): AssetData | undefined => {
    return assetsRef.current.get(id);
  }, []);

  return {
    getAssets,
    getAssetById,
    clearAssets,
    isEnabled: enabled,
  };
}

/**
 * Get stored asset data without the hook (for server-side or one-time access)
 */
export function getStoredAssetData(): AssetData[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(ASSET_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Object.values(parsed.assets || {});
    }
  } catch (error) {
    console.debug('Failed to get stored asset data:', error);
  }

  return [];
}
