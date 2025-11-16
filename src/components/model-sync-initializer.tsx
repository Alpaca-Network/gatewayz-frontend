'use client';

import { useEffect } from 'react';
import { initializeModelSync } from '@/lib/background-sync';

/**
 * Component that initializes background model synchronization
 * Runs once when the app starts
 */
export function ModelSyncInitializer() {
  useEffect(() => {
    // Initialize sync in the background
    initializeModelSync().catch(error => {
      console.error('Failed to initialize model sync:', error);
    });
  }, []);

  // This component doesn't render anything
  return null;
}