'use client';

import { useState, useEffect, useCallback } from 'react';
import { networkMonitor, getNetworkStatus } from '@/lib/network-utils';

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
}

/**
 * React hook for monitoring network connectivity status
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isChecking: false,
    lastChecked: null,
  });

  useEffect(() => {
    // Set initial status
    setStatus(prev => ({
      ...prev,
      isOnline: getNetworkStatus(),
      lastChecked: new Date(),
    }));

    // Subscribe to network changes
    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      setStatus({
        isOnline,
        isChecking: false,
        lastChecked: new Date(),
      });
    });

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook that provides a function to check connectivity on demand
 */
export function useConnectivityCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<boolean | null>(null);

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const isOnline = await networkMonitor.checkConnectivity();
      setLastResult(isOnline);
      return isOnline;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    checkConnectivity,
    isChecking,
    lastResult,
  };
}
